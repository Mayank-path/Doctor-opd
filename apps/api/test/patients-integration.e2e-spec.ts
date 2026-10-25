import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  ClinicRole,
  MembershipStatus,
  Gender,
  PrismaClient,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

// ---------------------------------------------------------------------------
// Response Interfaces for Type-Safe Supertest Assertions
// ---------------------------------------------------------------------------
interface PatientResponse {
  id: string;
  clinicId: string;
  uhid: string;
  fullName: string;
  gender: string;
  dateOfBirth?: string | null;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  message?: string | string[];
}

interface PaginatedPatientResponse {
  data: PatientResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Database Isolation & Environment Configuration (Task A & Task G)
// ---------------------------------------------------------------------------

// Read DATABASE_URL from .env if not already present in process.env
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^DATABASE_URL=(.+)$/m);
    if (match) {
      process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment or .env');
}

// Strictly re-route DATABASE_URL to doctor_opd_test
const parsedDbUrl = new URL(process.env.DATABASE_URL);
parsedDbUrl.pathname = '/doctor_opd_test';
process.env.DATABASE_URL = parsedDbUrl.toString();

// Test-only JWT configuration (does not touch production or real secrets)
process.env.JWT_SECRET = 'chk6d-integration-test-secret-min-32-chars-long';
process.env.JWT_ISSUER = 'doctor-opd-api';
process.env.JWT_AUDIENCE = 'doctor-opd-client';
process.env.JWT_EXPIRES_IN = '1h';

describe('Patient API & UHID Concurrency (PostgreSQL Integration)', () => {
  jest.setTimeout(45000);

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Track created fixture IDs for cleanup
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];

  // Clinic identifiers
  const clinic1Id = crypto.randomUUID();
  const clinic2Id = crypto.randomUUID();
  const clinic3Id = crypto.randomUUID(); // Fresh clinic for concurrent initialization
  const clinic4Id = crypto.randomUUID(); // Fresh clinic for rollback testing

  // User identifiers
  const adminUserId = crypto.randomUUID();
  const receptionistUserId = crypto.randomUUID();
  const doctorUserId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const suspendedUserId = crypto.randomUUID();
  const clinic2ReceptionistId = crypto.randomUUID();
  const outsiderUserId = crypto.randomUUID();
  const clinic4AdminId = crypto.randomUUID();
  const suspendedDoctorUserId = crypto.randomUUID();

  // Test Tokens
  let adminToken: string;
  let receptionistToken: string;
  let doctorToken: string;
  let staffToken: string;
  let suspendedToken: string;
  let suspendedDoctorToken: string;
  let clinic2ReceptionistToken: string;
  let outsiderToken: string;
  let clinic4AdminToken: string;

  beforeAll(async () => {
    // -------------------------------------------------------------------------
    // Preflight Database Safety Assertion (Fail Closed)
    // -------------------------------------------------------------------------
    const preflight = new PrismaClient();
    await preflight.$connect();
    const dbCheck = await preflight.$queryRawUnsafe<
      Array<{ current_database: string }>
    >('SELECT current_database();');
    await preflight.$disconnect();

    const activeDb = dbCheck[0]?.current_database;
    if (activeDb !== 'doctor_opd_test') {
      throw new Error(
        `FATAL SAFETY VIOLATION: Integration test attempted to connect to "${activeDb}". Expected "doctor_opd_test". Aborting!`,
      );
    }

    // -------------------------------------------------------------------------
    // Initialize NestJS Application with Real Modules & Prisma
    // -------------------------------------------------------------------------
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(json({ limit: '64kb' }));
    app.use(urlencoded({ extended: true, limit: '64kb' }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Prevent MaxListenersExceededWarning during 25+ simultaneous requests
    const server = app.getHttpServer() as unknown as {
      setMaxListeners: (n: number) => void;
    };
    if (typeof server.setMaxListeners === 'function') {
      server.setMaxListeners(50);
    }

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // -------------------------------------------------------------------------
    // Create Synthetic Test Fixtures in doctor_opd_test
    // -------------------------------------------------------------------------
    // 1. Create Clinics
    const testClinics = [
      { id: clinic1Id, name: 'Chk6D Clinic Alpha' },
      { id: clinic2Id, name: 'Chk6D Clinic Beta' },
      { id: clinic3Id, name: 'Chk6D Fresh Clinic Gamma' },
      { id: clinic4Id, name: 'Chk6D Rollback Clinic Delta' },
    ];
    for (const c of testClinics) {
      await prisma.clinic.create({ data: c });
      createdClinicIds.push(c.id);
    }

    // 2. Create Users
    const testUsers = [
      {
        id: adminUserId,
        phone: '+919999900001',
        fullName: 'Test Admin User',
        email: 'test.admin@chk6d.test',
      },
      {
        id: receptionistUserId,
        phone: '+919999900002',
        fullName: 'Test Receptionist User',
        email: 'test.recep@chk6d.test',
      },
      {
        id: doctorUserId,
        phone: '+919999900003',
        fullName: 'Test Doctor User',
        email: 'test.doc@chk6d.test',
      },
      {
        id: staffUserId,
        phone: '+919999900004',
        fullName: 'Test Staff User',
        email: 'test.staff@chk6d.test',
      },
      {
        id: suspendedUserId,
        phone: '+919999900005',
        fullName: 'Test Suspended User',
        email: 'test.susp@chk6d.test',
      },
      {
        id: clinic2ReceptionistId,
        phone: '+919999900006',
        fullName: 'Test Clinic 2 Receptionist',
        email: 'test.c2recep@chk6d.test',
      },
      {
        id: outsiderUserId,
        phone: '+919999900007',
        fullName: 'Test Outsider User',
        email: 'test.outsider@chk6d.test',
      },
      {
        id: clinic4AdminId,
        phone: '+919999900008',
        fullName: 'Test Clinic 4 Admin',
        email: 'test.c4admin@chk6d.test',
      },
      {
        id: suspendedDoctorUserId,
        phone: '+919999900009',
        fullName: 'Test Suspended Doctor',
        email: 'test.suspdoc@chk6d.test',
      },
    ];
    for (const u of testUsers) {
      await prisma.user.create({ data: u });
      createdUserIds.push(u.id);
    }

    // 3. Create Memberships
    await prisma.clinicMembership.createMany({
      data: [
        {
          userId: adminUserId,
          clinicId: clinic1Id,
          role: ClinicRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: receptionistUserId,
          clinicId: clinic1Id,
          role: ClinicRole.RECEPTIONIST,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: doctorUserId,
          clinicId: clinic1Id,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: staffUserId,
          clinicId: clinic1Id,
          role: ClinicRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: suspendedUserId,
          clinicId: clinic1Id,
          role: ClinicRole.RECEPTIONIST,
          status: MembershipStatus.SUSPENDED,
        },
        {
          userId: clinic2ReceptionistId,
          clinicId: clinic2Id,
          role: ClinicRole.RECEPTIONIST,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: clinic4AdminId,
          clinicId: clinic4Id,
          role: ClinicRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: suspendedDoctorUserId,
          clinicId: clinic1Id,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.SUSPENDED,
        },
      ],
    });

    // 4. Generate Valid Synthetic JWTs
    adminToken = await authService.signToken(adminUserId, '+919999900001');
    receptionistToken = await authService.signToken(
      receptionistUserId,
      '+919999900002',
    );
    doctorToken = await authService.signToken(doctorUserId, '+919999900003');
    staffToken = await authService.signToken(staffUserId, '+919999900004');
    suspendedToken = await authService.signToken(
      suspendedUserId,
      '+919999900005',
    );
    clinic2ReceptionistToken = await authService.signToken(
      clinic2ReceptionistId,
      '+919999900006',
    );
    outsiderToken = await authService.signToken(
      outsiderUserId,
      '+919999900007',
    );
    clinic4AdminToken = await authService.signToken(
      clinic4AdminId,
      '+919999900008',
    );
    suspendedDoctorToken = await authService.signToken(
      suspendedDoctorUserId,
      '+919999900009',
    );
  });

  afterAll(async () => {
    // -------------------------------------------------------------------------
    // Safe Fixture Cleanup (Task G)
    // -------------------------------------------------------------------------
    if (prisma) {
      // Re-verify database identity before cleanup
      const verifyDb = await prisma.$queryRawUnsafe<
        Array<{ current_database: string }>
      >('SELECT current_database();');
      if (verifyDb[0]?.current_database === 'doctor_opd_test') {
        // Cascading delete clinics cleans up memberships, patients, uhid counters
        await prisma.clinic.deleteMany({
          where: { id: { in: createdClinicIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // Task D: Real UHID Concurrency & Allocation Tests
  // =========================================================================

  describe('Task D: Real UHID Concurrency and Allocation', () => {
    it('Scenario 1: First allocation in fresh clinic returns UHID-000001', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'First Patient',
          gender: Gender.MALE,
          phone: '+919811100001',
          dateOfBirth: '1990-01-01',
        });

      expect(res.status).toBe(201);
      const body = res.body as PatientResponse;
      expect(body.uhid).toBe('UHID-000001');
      expect(body.fullName).toBe('First Patient');
      expect(body.clinicId).toBe(clinic1Id);

      // Verify counter in PostgreSQL
      const counter = await prisma.patientUhidCounter.findUnique({
        where: { clinicId: clinic1Id },
      });
      expect(counter).not.toBeNull();
      expect(counter?.lastUhid).toBe(1);
    });

    it('Scenario 2: Sequential allocations increment correctly (UHID-000002, UHID-000003)', async () => {
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Second Patient',
          gender: Gender.FEMALE,
          phone: '+919811100002',
        });
      expect(res2.status).toBe(201);
      const body2 = res2.body as PatientResponse;
      expect(body2.uhid).toBe('UHID-000002');

      const res3 = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Third Patient',
          gender: Gender.OTHER,
          phone: '+919811100003',
        });
      expect(res3.status).toBe(201);
      const body3 = res3.body as PatientResponse;
      expect(body3.uhid).toBe('UHID-000003');

      const counter = await prisma.patientUhidCounter.findUnique({
        where: { clinicId: clinic1Id },
      });
      expect(counter?.lastUhid).toBe(3);
    });

    it('Scenario 3: 25 simultaneous concurrent registrations in Clinic 1 produce 25 unique consecutive UHIDs', async () => {
      const concurrencyCount = 25;
      const requests = Array.from({ length: concurrencyCount }, (_, i) => {
        const patientNum = i + 4; // since 1, 2, 3 already exist
        return request(app.getHttpServer())
          .post('/api/v1/patients')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-clinic-id', clinic1Id)
          .send({
            fullName: `Concurrent Patient ${patientNum}`,
            gender: patientNum % 2 === 0 ? Gender.MALE : Gender.FEMALE,
            phone: `+9198111${String(patientNum).padStart(5, '0')}`,
            city: 'Shimla',
          });
      });

      const responses = await Promise.all(requests);

      // Verify all requests succeeded with HTTP 201
      responses.forEach((res) => {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('uhid');
      });

      const allocatedUhids = responses.map(
        (r) => (r.body as PatientResponse).uhid,
      );
      const uniqueUhids = new Set(allocatedUhids);

      // Verify all 25 UHIDs are strictly unique
      expect(uniqueUhids.size).toBe(concurrencyCount);

      // Verify sequence covers exact contiguous range UHID-000004 through UHID-000028
      const numericSequences = allocatedUhids
        .map((u) => parseInt(u.replace('UHID-', ''), 10))
        .sort((a, b) => a - b);

      expect(numericSequences[0]).toBe(4);
      expect(numericSequences[numericSequences.length - 1]).toBe(28);

      for (let i = 0; i < numericSequences.length; i++) {
        expect(numericSequences[i]).toBe(4 + i);
      }

      // Verify counter in PostgreSQL matches exactly 28
      const counter = await prisma.patientUhidCounter.findUnique({
        where: { clinicId: clinic1Id },
      });
      expect(counter?.lastUhid).toBe(28);

      // Total patient count in clinic 1 is 28
      const totalCount = await prisma.patient.count({
        where: { clinicId: clinic1Id },
      });
      expect(totalCount).toBe(28);
    });

    it('Scenario 4: Concurrent first-time initialization in fresh Clinic 3 creates exactly 1 counter row without duplicates', async () => {
      // Confirm clinic3 has no counter
      const initialCounter = await prisma.patientUhidCounter.findUnique({
        where: { clinicId: clinic3Id },
      });
      expect(initialCounter).toBeNull();

      // Temporarily give admin membership to clinic3 for test
      await prisma.clinicMembership.create({
        data: {
          userId: adminUserId,
          clinicId: clinic3Id,
          role: ClinicRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      const freshConcurrencyCount = 10;
      const requests = Array.from({ length: freshConcurrencyCount }, (_, i) => {
        return request(app.getHttpServer())
          .post('/api/v1/patients')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-clinic-id', clinic3Id)
          .send({
            fullName: `Fresh Clinic Patient ${i + 1}`,
            gender: Gender.FEMALE,
            phone: `+9198222${String(i + 1).padStart(5, '0')}`,
          });
      });

      const responses = await Promise.all(requests);

      // Confirm all succeeded
      responses.forEach((res) => {
        expect(res.status).toBe(201);
      });

      // Confirm exactly 1 counter row in table for clinic3
      const counters = await prisma.patientUhidCounter.findMany({
        where: { clinicId: clinic3Id },
      });
      expect(counters.length).toBe(1);
      expect(counters[0].lastUhid).toBe(freshConcurrencyCount);

      // Confirm unique contiguous range 1..10
      const allocatedUhids = responses.map(
        (r) => (r.body as PatientResponse).uhid,
      );
      const uniqueUhids = new Set(allocatedUhids);
      expect(uniqueUhids.size).toBe(freshConcurrencyCount);

      const numericSequences = allocatedUhids
        .map((u) => parseInt(u.replace('UHID-', ''), 10))
        .sort((a, b) => a - b);
      expect(numericSequences[0]).toBe(1);
      expect(numericSequences[numericSequences.length - 1]).toBe(10);
    });

    it('Scenario 5: Cross-clinic sequence independence and tenant isolation', async () => {
      // Clinic 2 registration with Clinic 2 receptionist
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${clinic2ReceptionistToken}`)
        .set('x-clinic-id', clinic2Id)
        .send({
          fullName: 'Clinic 2 Patient One',
          gender: Gender.FEMALE,
          phone: '+919833300001',
        });

      expect(res.status).toBe(201);
      const body = res.body as PatientResponse;
      // Independent sequence: Clinic 2 first patient starts at UHID-000001
      expect(body.uhid).toBe('UHID-000001');
      expect(body.clinicId).toBe(clinic2Id);

      const clinic2PatientId = body.id;

      // User belonging only to Clinic 1 cannot access Clinic 2 by spoofing x-clinic-id
      const spoofRes = await request(app.getHttpServer())
        .get(`/api/v1/patients/${clinic2PatientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic2Id);
      expect(spoofRes.status).toBe(403);

      // User in Clinic 1 searching with Clinic 1 header cannot find Clinic 2 patient ID (returns 404)
      const notFoundRes = await request(app.getHttpServer())
        .get(`/api/v1/patients/${clinic2PatientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(notFoundRes.status).toBe(404);
    });
  });

  // =========================================================================
  // Task E: Transaction Rollback
  // =========================================================================

  describe('Task E: Transaction Rollback Verification', () => {
    it('Rolls back counter increment when patient creation violates database unique constraint', async () => {
      // 1. Initial valid registration in Clinic 4 -> UHID-000001
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${clinic4AdminToken}`)
        .set('x-clinic-id', clinic4Id)
        .send({
          fullName: 'Rollback Clinic Initial Patient',
          gender: Gender.MALE,
          phone: '+919844400001',
        });
      expect(res1.status).toBe(201);
      expect((res1.body as PatientResponse).uhid).toBe('UHID-000001');

      let counter = await prisma.patientUhidCounter.findUnique({
        where: { clinicId: clinic4Id },
      });
      expect(counter?.lastUhid).toBe(1);

      // 2. Pre-insert a conflicting patient record directly into PostgreSQL with uhid = 'UHID-000002'
      // This will trigger a real @@unique([clinicId, uhid]) violation in PostgreSQL during the transaction
      const conflictingPatient = await prisma.patient.create({
        data: {
          clinicId: clinic4Id,
          uhid: 'UHID-000002',
          fullName: 'Conflicting Ghost Patient',
          gender: Gender.MALE,
          phone: '+919844499999',
          isActive: true,
        },
      });

      // 3. Attempt HTTP registration that will allocate sequence 2 -> UHID-000002
      // Inside tx, counter increments to 2, but tx.patient.create hits duplicate key violation
      const failedRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${clinic4AdminToken}`)
        .set('x-clinic-id', clinic4Id)
        .send({
          fullName: 'Victim Patient That Fails',
          gender: Gender.FEMALE,
          phone: '+919844400002',
        });

      // Request fails safely with HTTP 500 without disclosing internal database details
      expect(failedRes.status).toBe(500);
      const errorBody = failedRes.body as ErrorResponse;
      expect(errorBody.statusCode).toBe(500);
      expect(errorBody.message).toBe('Internal server error');
      expect(failedRes.body).not.toHaveProperty('stack');
      expect(failedRes.body).not.toHaveProperty('code');
      expect(failedRes.body).not.toHaveProperty('meta');
      const serialized = JSON.stringify(failedRes.body);
      expect(serialized).not.toContain('Prisma');
      expect(serialized).not.toContain('clinicId');
      expect(serialized).not.toContain('uhid');
      expect(serialized).not.toContain('Unique constraint');

      // 4. Verify transaction rolled back: counter in PostgreSQL MUST STILL BE 1
      counter = await prisma.patientUhidCounter.findUnique({
        where: { clinicId: clinic4Id },
      });
      expect(counter?.lastUhid).toBe(1);

      // Verify the victim patient record does NOT exist in PostgreSQL
      const victim = await prisma.patient.findFirst({
        where: {
          clinicId: clinic4Id,
          fullName: 'Victim Patient That Fails',
        },
      });
      expect(victim).toBeNull();

      // 5. Remove the artificially planted conflicting record
      await prisma.patient.delete({ where: { id: conflictingPatient.id } });

      // 6. Execute a subsequent valid HTTP registration
      const recoveredRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${clinic4AdminToken}`)
        .set('x-clinic-id', clinic4Id)
        .send({
          fullName: 'Recovered Patient',
          gender: Gender.FEMALE,
          phone: '+919844400002',
        });

      expect(recoveredRes.status).toBe(201);
      // Confirms sequence resumes at UHID-000002 without gap or corruption
      expect((recoveredRes.body as PatientResponse).uhid).toBe('UHID-000002');

      counter = await prisma.patientUhidCounter.findUnique({
        where: { clinicId: clinic4Id },
      });
      expect(counter?.lastUhid).toBe(2);
    });
  });

  // =========================================================================
  // Task F: Authorization and Data Integrity
  // =========================================================================

  describe('Task F: Authorization and Data Integrity', () => {
    let testPatientId: string;

    beforeAll(async () => {
      // Register a patient in Clinic 1 to use across authorization tests
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Auth Test Subject',
          gender: Gender.MALE,
          phone: '+919855500001',
          alternatePhone: '+919855500002',
          email: 'subject@test.com',
          address: 'Mall Road',
          city: 'Shimla',
          pincode: '171001',
        });
      testPatientId = (res.body as PatientResponse).id;
    });

    it('Fails with 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('x-clinic-id', clinic1Id);
      expect(res.status).toBe(401);
      const body = res.body as ErrorResponse;
      expect(body.message).toContain('Missing authorization bearer token');
    });

    it('Fails with 401 when Bearer token is malformed', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('Authorization', 'Bearer invalid-garbage-token')
        .set('x-clinic-id', clinic1Id);
      expect(res.status).toBe(401);
    });

    it('Fails with 401 when token is signed with a different secret', async () => {
      // Sign a token with a rogue secret
      const rogueToken = authService['jwtService'].sign(
        { sub: adminUserId, phone: '+919999900001' },
        { secret: 'wrong-secret-that-does-not-match-at-all' },
      );
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${rogueToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(res.status).toBe(401);
    });

    it('Fails with 400 when x-clinic-id header is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      const body = res.body as ErrorResponse;
      expect(body.message).toContain('Target clinic identifier is required');
    });

    it('Fails with 403 when user is not a member of the clinic', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(res.status).toBe(403);
      const body = res.body as ErrorResponse;
      expect(body.message).toContain('not a member');
    });

    it('Fails with 403 when user membership is SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${suspendedToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(res.status).toBe(403);
      const body = res.body as ErrorResponse;
      expect(body.message).toContain('SUSPENDED');
    });

    it('STAFF role is denied access to all patient endpoints (403)', async () => {
      // POST /patients
      const postRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Staff Denied',
          gender: Gender.MALE,
          phone: '+919866600001',
        });
      expect(postRes.status).toBe(403);

      // GET /patients
      const getListRes = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(getListRes.status).toBe(403);

      // GET /patients/:id
      const getDetailRes = await request(app.getHttpServer())
        .get(`/api/v1/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(getDetailRes.status).toBe(403);

      // PATCH /patients/:id
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ fullName: 'Staff Modified' });
      expect(patchRes.status).toBe(403);
    });

    it('DOCTOR role is permitted all patient operations (create, search, detail, update)', async () => {
      // 1. DOCTOR creates patient (201)
      const postRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Doctor Created Patient',
          gender: Gender.FEMALE,
          phone: '+919866600002',
          city: 'Solan',
        });
      expect(postRes.status).toBe(201);
      const doctorPatient = postRes.body as PatientResponse;
      expect(doctorPatient.fullName).toBe('Doctor Created Patient');
      expect(doctorPatient.clinicId).toBe(clinic1Id);
      expect(doctorPatient.uhid).toBeDefined();

      const newId = doctorPatient.id;

      // 2. DOCTOR searches for patient (200)
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/patients?q=Doctor+Created')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(listRes.status).toBe(200);
      const searchBody = listRes.body as PaginatedPatientResponse;
      expect(searchBody.data.some((p) => p.id === newId)).toBe(true);

      // 3. DOCTOR views patient detail (200)
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/patients/${newId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(detailRes.status).toBe(200);
      expect((detailRes.body as PatientResponse).id).toBe(newId);

      // 4. DOCTOR updates patient demographics (200)
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/patients/${newId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ city: 'Shimla East', address: 'Near Ridge' });
      expect(patchRes.status).toBe(200);
      const updatedPatient = patchRes.body as PatientResponse;
      expect(updatedPatient.city).toBe('Shimla East');
      expect(updatedPatient.address).toBe('Near Ridge');
      expect(updatedPatient.clinicId).toBe(clinic1Id);
    });

    it('DOCTOR who is not a member of the selected practice is denied (403)', async () => {
      // Doctor from Clinic 1 tries to access Clinic 2
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic2Id);
      expect(res.status).toBe(403);
      expect((res.body as ErrorResponse).message).toContain('not a member');
    });

    it('DOCTOR with suspended membership is denied (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${suspendedDoctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Suspended Doctor Patient',
          gender: Gender.MALE,
          phone: '+919866600099',
        });
      expect(res.status).toBe(403);
      expect((res.body as ErrorResponse).message).toContain('SUSPENDED');
    });

    it('RECEPTIONIST role is permitted all patient operations (201, 200)', async () => {
      // POST
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Recep Allowed Patient',
          gender: Gender.FEMALE,
          phone: '+919866600003',
        });
      expect(createRes.status).toBe(201);
      const newId = (createRes.body as PatientResponse).id;

      // GET detail
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/patients/${newId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(detailRes.status).toBe(200);

      // PATCH
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/patients/${newId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ city: 'Kullu' });
      expect(patchRes.status).toBe(200);
      expect((patchRes.body as PatientResponse).city).toBe('Kullu');
    });

    it('Cross-clinic patient update returns 404', async () => {
      // Create patient in Clinic 2
      const c2Patient = await prisma.patient.create({
        data: {
          clinicId: clinic2Id,
          uhid: 'UHID-000099',
          fullName: 'Clinic 2 Private Patient',
          gender: Gender.FEMALE,
          phone: '+919877700001',
          isActive: true,
        },
      });

      // Clinic 1 admin tries to update Clinic 2 patient using Clinic 1 header
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/patients/${c2Patient.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ fullName: 'Tampered Name' });

      expect(res.status).toBe(404);
      expect((res.body as ErrorResponse).message).toBe('Patient not found');

      // Verify name in DB remains untampered
      const verified = await prisma.patient.findUnique({
        where: { id: c2Patient.id },
      });
      expect(verified?.fullName).toBe('Clinic 2 Private Patient');
    });

    it('Search total and data strictly exclude patients from other clinics', async () => {
      const c1SearchRes = await request(app.getHttpServer())
        .get('/api/v1/patients?q=Private')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(c1SearchRes.status).toBe(200);
      const c1Body = c1SearchRes.body as PaginatedPatientResponse;
      expect(c1Body.data.length).toBe(0);
      expect(c1Body.meta.total).toBe(0);

      const c2SearchRes = await request(app.getHttpServer())
        .get('/api/v1/patients?q=Private')
        .set('Authorization', `Bearer ${clinic2ReceptionistToken}`)
        .set('x-clinic-id', clinic2Id);

      expect(c2SearchRes.status).toBe(200);
      const c2Body = c2SearchRes.body as PaginatedPatientResponse;
      expect(c2Body.data.length).toBe(1);
      expect(c2Body.meta.total).toBe(1);
      expect(c2Body.data[0].fullName).toBe('Clinic 2 Private Patient');
    });

    it('Soft-deleted patients are completely excluded from search, detail, and update (404)', async () => {
      // Register a patient to soft-delete
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Soft Delete Candidate',
          gender: Gender.OTHER,
          phone: '+919877700002',
        });
      expect(createRes.status).toBe(201);
      const patientId = (createRes.body as PatientResponse).id;

      // Soft delete directly in DB
      await prisma.patient.update({
        where: { id: patientId },
        data: { deletedAt: new Date() },
      });

      // GET detail -> 404
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(detailRes.status).toBe(404);

      // PATCH update -> 404
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ fullName: 'Updated Dead Record' });
      expect(patchRes.status).toBe(404);

      // Search by term -> excluded
      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/patients?q=Candidate')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(searchRes.status).toBe(200);
      const searchBody = searchRes.body as PaginatedPatientResponse;
      expect(searchBody.data.length).toBe(0);
      expect(searchBody.meta.total).toBe(0);
    });

    it('Rejects unwhitelisted/forbidden DTO fields with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          fullName: 'Injection Attempt',
          gender: Gender.MALE,
          phone: '+919877700003',
          clinicId: 'spoofed-clinic-id',
          uhid: 'UHID-999999',
          id: crypto.randomUUID(),
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorResponse;
      expect(Array.isArray(body.message)).toBe(true);
      const messages = body.message as string[];
      expect(messages.some((msg) => msg.includes('should not exist'))).toBe(
        true,
      );
    });

    it('Rejects invalid UUID route parameter with 400 Bad Request', async () => {
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/patients/not-a-valid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(getRes.status).toBe(400);

      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/patients/not-a-valid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ fullName: 'Valid Name' });
      expect(patchRes.status).toBe(400);
    });

    it('Rejects invalid pagination bounds with 400 Bad Request', async () => {
      // page < 1
      const resPage0 = await request(app.getHttpServer())
        .get('/api/v1/patients?page=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(resPage0.status).toBe(400);

      // limit > 50
      const resLimit100 = await request(app.getHttpServer())
        .get('/api/v1/patients?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(resLimit100.status).toBe(400);

      // query term < 2 chars
      const resShortQuery = await request(app.getHttpServer())
        .get('/api/v1/patients?q=a')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(resShortQuery.status).toBe(400);
    });

    it('Correctly clears nullable fields when explicit null is passed in PATCH', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          alternatePhone: null,
          email: null,
          address: null,
        });

      expect(res.status).toBe(200);
      const body = res.body as PatientResponse;
      expect(body.alternatePhone).toBeNull();
      expect(body.email).toBeNull();
      expect(body.address).toBeNull();

      // Verify in DB
      const inDb = await prisma.patient.findUnique({
        where: { id: testPatientId },
      });
      expect(inDb?.alternatePhone).toBeNull();
      expect(inDb?.email).toBeNull();
      expect(inDb?.address).toBeNull();
    });

    it('Rejects empty PATCH body with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({});

      expect(res.status).toBe(400);
      const body = res.body as ErrorResponse;
      expect(body.message).toContain(
        'At least one field must be provided for update',
      );
    });
  });
});
