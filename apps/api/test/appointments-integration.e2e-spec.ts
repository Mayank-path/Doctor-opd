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
  AppointmentStatus,
  AppointmentType,
  PrismaClient,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

// ---------------------------------------------------------------------------
// Database Isolation & Environment Configuration
// ---------------------------------------------------------------------------

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

// Test-only JWT configuration
process.env.JWT_SECRET = 'chk8d-appointment-test-secret-at-least-32-chars';
process.env.JWT_ISSUER = 'doctor-opd-api';
process.env.JWT_AUDIENCE = 'doctor-opd-client';
process.env.JWT_EXPIRES_IN = '1h';

interface AppointmentResponse {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  serviceDate: string;
  startTime: string;
  endTime: string | null;
  type: string;
  status: string;
  chiefComplaint: string | null;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  rescheduledFromId: string | null;
  patient?: {
    id: string;
    uhid: string;
    fullName: string;
    gender: string;
  };
  doctor?: {
    userId: string;
    role: string;
    user?: {
      id: string;
      fullName: string;
    };
  };
}

describe('Appointment Management API (PostgreSQL Integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Track fixture IDs for clean teardown
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAppointmentIds: string[] = [];

  // Clinic identifiers
  const clinic1Id = crypto.randomUUID();
  const clinic2Id = crypto.randomUUID();

  // User identifiers
  const doctorUserId = crypto.randomUUID();
  const receptionistUserId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const clinic2DoctorUserId = crypto.randomUUID();

  // Patient identifiers
  const patient1Id = crypto.randomUUID();
  const patient2Id = crypto.randomUUID();
  const softDeletedPatientId = crypto.randomUUID();

  // Auth tokens
  let doctorToken: string;
  let receptionistToken: string;
  let adminToken: string;
  let staffToken: string;
  let clinic2DoctorToken: string;

  beforeAll(async () => {
    // -------------------------------------------------------------------------
    // Preflight Database Safety Assertion
    // -------------------------------------------------------------------------
    const preflight = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
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
    // Initialize NestJS Application with identical Global Config
    // -------------------------------------------------------------------------
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
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

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

    // -------------------------------------------------------------------------
    // Seed Fixtures
    // -------------------------------------------------------------------------
    // 1. Seed Clinics
    await prisma.clinic.createMany({
      data: [
        {
          id: clinic1Id,
          name: 'City Health Clinic (Test)',
          slug: `city-health-8d-${Date.now()}`,
          phone: '+919811100000',
        },
        {
          id: clinic2Id,
          name: 'Metro Care Hospital (Test)',
          slug: `metro-care-8d-${Date.now()}`,
          phone: '+919822200000',
        },
      ],
    });
    createdClinicIds.push(clinic1Id, clinic2Id);

    // 2. Seed Users
    await prisma.user.createMany({
      data: [
        {
          id: doctorUserId,
          phone: '+919811100010',
          email: 'doctor@chk8d.test',
          fullName: 'Dr. Jane Smith',
        },
        {
          id: receptionistUserId,
          phone: '+919811100020',
          email: 'receptionist@chk8d.test',
          fullName: 'Robert Frontdesk',
        },
        {
          id: adminUserId,
          phone: '+919811100030',
          email: 'admin@chk8d.test',
          fullName: 'Alice Administrator',
        },
        {
          id: staffUserId,
          phone: '+919811100040',
          email: 'staff@chk8d.test',
          fullName: 'Sam SupportStaff',
        },
        {
          id: clinic2DoctorUserId,
          phone: '+919811100050',
          email: 'doctor2@chk8d.test',
          fullName: 'Dr. Other Clinic',
        },
      ],
    });
    createdUserIds.push(
      doctorUserId,
      receptionistUserId,
      adminUserId,
      staffUserId,
      clinic2DoctorUserId,
    );

    // 3. Seed Memberships
    await prisma.clinicMembership.createMany({
      data: [
        {
          userId: doctorUserId,
          clinicId: clinic1Id,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: receptionistUserId,
          clinicId: clinic1Id,
          role: ClinicRole.RECEPTIONIST,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: adminUserId,
          clinicId: clinic1Id,
          role: ClinicRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: staffUserId,
          clinicId: clinic1Id,
          role: ClinicRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: clinic2DoctorUserId,
          clinicId: clinic2Id,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    // 4. Seed Patients
    await prisma.patient.createMany({
      data: [
        {
          id: patient1Id,
          clinicId: clinic1Id,
          uhid: 'UHID-8D0001',
          fullName: 'Alpha Patient',
          gender: Gender.FEMALE,
          phone: '+919811111111',
          deletedAt: null,
        },
        {
          id: patient2Id,
          clinicId: clinic2Id,
          uhid: 'UHID-8D0002',
          fullName: 'Beta Patient (Clinic 2)',
          gender: Gender.MALE,
          phone: '+919822222222',
          deletedAt: null,
        },
        {
          id: softDeletedPatientId,
          clinicId: clinic1Id,
          uhid: 'UHID-8D0003',
          fullName: 'Gamma Patient (Deleted)',
          gender: Gender.OTHER,
          phone: '+919833333333',
          deletedAt: new Date(),
        },
      ],
    });

    // 5. Generate Auth Tokens
    doctorToken = await authService.signToken(doctorUserId, '+919811100010');
    receptionistToken = await authService.signToken(
      receptionistUserId,
      '+919811100020',
    );
    adminToken = await authService.signToken(adminUserId, '+919811100030');
    staffToken = await authService.signToken(staffUserId, '+919811100040');
    clinic2DoctorToken = await authService.signToken(
      clinic2DoctorUserId,
      '+919811100050',
    );
  });

  afterAll(async () => {
    if (prisma) {
      const verifyDb = await prisma.$queryRawUnsafe<
        Array<{ current_database: string }>
      >('SELECT current_database();');
      if (verifyDb[0]?.current_database === 'doctor_opd_test') {
        if (createdAppointmentIds.length > 0) {
          await prisma.appointment.deleteMany({
            where: { id: { in: createdAppointmentIds } },
          });
        }
        await prisma.patient.deleteMany({
          where: { clinicId: { in: createdClinicIds } },
        });
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
  // 1. POST /api/v1/appointments (Create)
  // =========================================================================

  describe('POST /api/v1/appointments (Create Appointment)', () => {
    it('DOCTOR successfully creates a scheduled appointment (201)', async () => {
      const payload = {
        patientId: patient1Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T09:00:00.000Z',
        endTime: '2026-10-30T09:30:00.000Z',
        type: AppointmentType.SCHEDULED,
        chiefComplaint: 'Routine diabetes checkup',
        notes: 'Bring previous lab reports',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(201);
      const body = res.body as AppointmentResponse;
      expect(body.id).toBeDefined();
      createdAppointmentIds.push(body.id);

      expect(body.clinicId).toBe(clinic1Id);
      expect(body.patientId).toBe(patient1Id);
      expect(body.doctorId).toBe(doctorUserId);
      expect(body.status).toBe(AppointmentStatus.SCHEDULED);
      expect(body.type).toBe(AppointmentType.SCHEDULED);
      expect(body.chiefComplaint).toBe('Routine diabetes checkup');
      expect(body.notes).toBe('Bring previous lab reports');
      expect(body.patient?.fullName).toBe('Alpha Patient');
      expect(body.doctor?.user?.fullName).toBe('Dr. Jane Smith');
    });

    it('RECEPTIONIST successfully creates a walk-in appointment (201)', async () => {
      const payload = {
        patientId: patient1Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T10:00:00.000Z',
        type: AppointmentType.WALK_IN,
        chiefComplaint: 'Acute cough',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(201);
      const body = res.body as AppointmentResponse;
      createdAppointmentIds.push(body.id);
      expect(body.type).toBe(AppointmentType.WALK_IN);
      expect(body.status).toBe(AppointmentStatus.SCHEDULED);
    });

    it('ADMIN successfully creates an appointment (201)', async () => {
      const payload = {
        patientId: patient1Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T11:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(201);
      createdAppointmentIds.push((res.body as AppointmentResponse).id);
    });

    it('STAFF role is denied appointment creation (403)', async () => {
      const payload = {
        patientId: patient1Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T12:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(403);
    });

    it('rejects creation for soft-deleted patient (404)', async () => {
      const payload = {
        patientId: softDeletedPatientId,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T13:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Patient not found');
    });

    it('rejects creation for patient belonging to another clinic (404)', async () => {
      // patient2Id belongs to Clinic 2, attempting to book in Clinic 1
      const payload = {
        patientId: patient2Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T14:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Patient not found');
    });

    it('rejects creation for doctor from another clinic (404)', async () => {
      // clinic2DoctorUserId belongs to Clinic 2, attempting to book in Clinic 1
      const payload = {
        patientId: patient1Id,
        doctorId: clinic2DoctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T15:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Doctor not found');
    });

    it('rejects creation when endTime is before or equal to startTime (400)', async () => {
      const payload = {
        patientId: patient1Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T16:00:00.000Z',
        endTime: '2026-10-30T15:30:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('rejects client attempts to pass protected fields like clinicId, status, id (400)', async () => {
      const payload = {
        patientId: patient1Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T17:00:00.000Z',
        clinicId: clinic2Id,
        status: AppointmentStatus.COMPLETED,
        id: crypto.randomUUID(),
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('rejects creation when startTime date does not match serviceDate (400 Bad Request)', async () => {
      const payload = {
        patientId: patient1Id,
        doctorId: doctorUserId,
        serviceDate: '2026-10-30',
        startTime: '2026-11-05T09:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toContain('does not match serviceDate');
    });
  });

  // =========================================================================
  // 2. GET /api/v1/appointments (List)
  // =========================================================================

  describe('GET /api/v1/appointments (List Appointments)', () => {
    let apptSort1Id: string;
    let apptSort2Id: string;
    let apptSort3Id: string;
    let clinic2ApptId: string;
    const testDate = '2026-11-01';

    beforeAll(async () => {
      // Create 3 appointments on testDate with deliberate startTimes for sorting
      const a1 = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctorUserId,
          serviceDate: new Date(`${testDate}T00:00:00.000Z`),
          startTime: new Date(`${testDate}T11:00:00.000Z`),
          status: AppointmentStatus.SCHEDULED,
        },
      });
      apptSort1Id = a1.id;
      createdAppointmentIds.push(a1.id);

      const a2 = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctorUserId,
          serviceDate: new Date(`${testDate}T00:00:00.000Z`),
          startTime: new Date(`${testDate}T09:00:00.000Z`),
          status: AppointmentStatus.CONFIRMED,
        },
      });
      apptSort2Id = a2.id;
      createdAppointmentIds.push(a2.id);

      const a3 = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctorUserId,
          serviceDate: new Date(`${testDate}T00:00:00.000Z`),
          startTime: new Date(`${testDate}T09:00:00.000Z`), // identical startTime to test secondary id asc sort
          status: AppointmentStatus.SCHEDULED,
        },
      });
      apptSort3Id = a3.id;
      createdAppointmentIds.push(a3.id);

      // Create an appointment in Clinic 2 to assert tenant isolation
      const c2Appt = await prisma.appointment.create({
        data: {
          clinicId: clinic2Id,
          patientId: patient2Id,
          doctorId: clinic2DoctorUserId,
          serviceDate: new Date(`${testDate}T00:00:00.000Z`),
          startTime: new Date(`${testDate}T09:00:00.000Z`),
          status: AppointmentStatus.SCHEDULED,
        },
      });
      clinic2ApptId = c2Appt.id;
      createdAppointmentIds.push(c2Appt.id);
    });

    it('requires serviceDate query parameter (400 if missing)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });

    it('lists appointments on serviceDate with default pagination and patient/doctor summaries', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments?serviceDate=${testDate}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: AppointmentResponse[];
        items: AppointmentResponse[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      };

      expect(body.data).toBeDefined();
      expect(body.items).toBeDefined();
      expect(body.data.length).toBe(3);
      expect(body.meta.total).toBe(3);

      for (const item of body.data) {
        expect(item.clinicId).toBe(clinic1Id);
        expect(item.patient?.fullName).toBe('Alpha Patient');
        expect(item.doctor?.userId).toBe(doctorUserId);
      }

      // Assert Clinic 2 appointment is excluded
      expect(body.data.some((a) => a.id === clinic2ApptId)).toBe(false);
    });

    it('sorts deterministically by startTime ascending, then id ascending', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments?serviceDate=${testDate}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const items = (res.body as { data: AppointmentResponse[] }).data;

      // 09:00 items must precede 11:00 item
      expect(items[2].id).toBe(apptSort1Id);

      // The two 09:00 items (a2 and a3) must be sorted by id ascending
      const firstTwo = [items[0].id, items[1].id];
      expect(firstTwo.includes(apptSort2Id)).toBe(true);
      expect(firstTwo.includes(apptSort3Id)).toBe(true);
      expect(items[0].id.localeCompare(items[1].id)).toBeLessThan(0);
    });

    it('filters appointments by status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments?serviceDate=${testDate}&status=CONFIRMED`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as { data: AppointmentResponse[] };
      expect(body.data.length).toBe(1);
      expect(body.data[0].id).toBe(apptSort2Id);
      expect(body.data[0].status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('filters appointments by doctorId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments?serviceDate=${testDate}&doctorId=${doctorUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as { data: AppointmentResponse[] };
      expect(body.data.length).toBe(3);
    });

    it('STAFF role is denied listing (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments?serviceDate=${testDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. GET /api/v1/appointments/:id (Details)
  // =========================================================================

  describe('GET /api/v1/appointments/:id (Appointment Details)', () => {
    let detailApptId: string;

    beforeAll(async () => {
      const appt = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctorUserId,
          serviceDate: new Date('2026-11-03T00:00:00.000Z'),
          startTime: new Date('2026-11-03T10:00:00.000Z'),
          chiefComplaint: 'Post-op wound dressing',
          notes: 'Dressing materials prepared',
          status: AppointmentStatus.SCHEDULED,
        },
      });
      detailApptId = appt.id;
      createdAppointmentIds.push(appt.id);
    });

    it('retrieves appointment details with safe summaries (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/${detailApptId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as AppointmentResponse;
      expect(body.id).toBe(detailApptId);
      expect(body.clinicId).toBe(clinic1Id);
      expect(body.chiefComplaint).toBe('Post-op wound dressing');
      expect(body.notes).toBe('Dressing materials prepared');
      expect(body.patient?.fullName).toBe('Alpha Patient');
      expect(body.doctor?.userId).toBe(doctorUserId);
    });

    it('rejects malformed UUID parameter with 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/appointments/not-a-valid-uuid')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent appointment ID', async () => {
      const fakeId = crypto.randomUUID();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/${fakeId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(404);
    });

    it('returns 404 for cross-clinic appointment without leaking existence', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/${detailApptId}`)
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic2Id);

      expect(res.status).toBe(404);
    });

    it('STAFF role is denied viewing details (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/${detailApptId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 4. POST /api/v1/appointments/:id/reschedule
  // =========================================================================

  describe('POST /api/v1/appointments/:id/reschedule', () => {
    let reschedulableApptId: string;

    beforeEach(async () => {
      const appt = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctorUserId,
          serviceDate: new Date('2026-11-04T00:00:00.000Z'),
          startTime: new Date('2026-11-04T09:00:00.000Z'),
          chiefComplaint: 'Follow-up consultation',
          status: AppointmentStatus.SCHEDULED,
        },
      });
      reschedulableApptId = appt.id;
      createdAppointmentIds.push(appt.id);
    });

    it('successfully reschedules appointment and links replacement (200)', async () => {
      const payload = {
        serviceDate: '2026-11-10',
        startTime: '2026-11-10T14:00:00.000Z',
        endTime: '2026-11-10T14:30:00.000Z',
        notes: 'Rescheduled upon patient request',
      };

      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(200);
      const replacement = res.body as AppointmentResponse;
      expect(replacement.id).toBeDefined();
      expect(replacement.id).not.toBe(reschedulableApptId);
      createdAppointmentIds.push(replacement.id);

      // Verify replacement fields
      expect(replacement.rescheduledFromId).toBe(reschedulableApptId);
      expect(replacement.status).toBe(AppointmentStatus.SCHEDULED);
      expect(replacement.patientId).toBe(patient1Id);
      expect(replacement.doctorId).toBe(doctorUserId);
      expect(replacement.notes).toBe('Rescheduled upon patient request');

      // Verify original source appointment was transitioned to RESCHEDULED
      const sourceInDb = await prisma.appointment.findUnique({
        where: { id: reschedulableApptId },
      });
      expect(sourceInDb?.status).toBe(AppointmentStatus.RESCHEDULED);
    });

    it('rejects repeated reschedule attempt on already RESCHEDULED appointment (409)', async () => {
      // Mark as RESCHEDULED first
      await prisma.appointment.update({
        where: { id: reschedulableApptId },
        data: { status: AppointmentStatus.RESCHEDULED },
      });

      const payload = {
        serviceDate: '2026-11-11',
        startTime: '2026-11-11T10:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain('cannot be rescheduled');
    });

    it('rejects reschedule of a cancelled appointment (409)', async () => {
      await prisma.appointment.update({
        where: { id: reschedulableApptId },
        data: { status: AppointmentStatus.CANCELLED },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          serviceDate: '2026-11-12',
          startTime: '2026-11-12T10:00:00.000Z',
        });

      expect(res.status).toBe(409);
    });

    it('rejects reschedule of a checked-in appointment (409)', async () => {
      await prisma.appointment.update({
        where: { id: reschedulableApptId },
        data: { status: AppointmentStatus.CHECKED_IN },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          serviceDate: '2026-11-12',
          startTime: '2026-11-12T10:00:00.000Z',
        });

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain('checked-in');
    });

    it('sequential retry with identical payload returns existing replacement appointment (200)', async () => {
      const payload = {
        serviceDate: '2026-11-15',
        startTime: '2026-11-15T09:00:00.000Z',
        endTime: '2026-11-15T09:30:00.000Z',
        notes: 'First reschedule call',
      };

      // Call 1
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res1.status).toBe(200);
      const replacement1 = res1.body as AppointmentResponse;
      createdAppointmentIds.push(replacement1.id);

      // Call 2: identical retry
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res2.status).toBe(200);
      const replacement2 = res2.body as AppointmentResponse;

      // Must return the exact same replacement appointment
      expect(replacement2.id).toBe(replacement1.id);
      expect(replacement2.rescheduledFromId).toBe(reschedulableApptId);
    });

    it('conflicting retry on already RESCHEDULED appointment returns 409 Conflict', async () => {
      const payload1 = {
        serviceDate: '2026-11-16',
        startTime: '2026-11-16T10:00:00.000Z',
      };

      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload1);

      expect(res1.status).toBe(200);
      createdAppointmentIds.push((res1.body as AppointmentResponse).id);

      // Retry with conflicting serviceDate
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          serviceDate: '2026-11-17',
          startTime: '2026-11-17T10:00:00.000Z',
        });

      expect(res2.status).toBe(409);
      expect((res2.body as { message: string }).message).toContain('conflicting parameters');
    });

    it('concurrent rescheduling: both requests succeed idempotently returning same replacement', async () => {
      const payload = {
        serviceDate: '2026-11-18',
        startTime: '2026-11-18T11:00:00.000Z',
      };

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .set('x-clinic-id', clinic1Id)
          .send(payload),
        request(app.getHttpServer())
          .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .set('x-clinic-id', clinic1Id)
          .send(payload),
      ]);

      // Both should succeed (200 OK)
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const r1 = res1.body as AppointmentResponse;
      const r2 = res2.body as AppointmentResponse;
      createdAppointmentIds.push(r1.id);

      // Both return the exact same replacement appointment ID
      expect(r1.id).toBe(r2.id);
    });

    it('rejects rescheduling when patient is soft-deleted (409 Conflict)', async () => {
      // Create appointment for soft-deleted patient
      const softDeletedAppt = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: softDeletedPatientId,
          doctorId: doctorUserId,
          serviceDate: new Date('2026-11-19T00:00:00.000Z'),
          startTime: new Date('2026-11-19T10:00:00.000Z'),
          status: AppointmentStatus.SCHEDULED,
        },
      });
      createdAppointmentIds.push(softDeletedAppt.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${softDeletedAppt.id}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          serviceDate: '2026-11-20',
          startTime: '2026-11-20T10:00:00.000Z',
        });

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain('soft-deleted');
    });

    it('rejects rescheduling when startTime date does not match serviceDate (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${reschedulableApptId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          serviceDate: '2026-11-21',
          startTime: '2026-11-25T10:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toContain('does not match serviceDate');
    });
  });

  // =========================================================================
  // 5. POST /api/v1/appointments/:id/cancel
  // =========================================================================

  describe('POST /api/v1/appointments/:id/cancel', () => {
    let cancellableApptId: string;

    beforeEach(async () => {
      const appt = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctorUserId,
          serviceDate: new Date('2026-11-05T00:00:00.000Z'),
          startTime: new Date('2026-11-05T15:00:00.000Z'),
          status: AppointmentStatus.SCHEDULED,
        },
      });
      cancellableApptId = appt.id;
      createdAppointmentIds.push(appt.id);
    });

    it('successfully cancels appointment and records reason and timestamp (200)', async () => {
      const payload = {
        cancellationReason: 'Patient called to cancel due to severe weather',
      };

      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${cancellableApptId}/cancel`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(200);
      const body = res.body as AppointmentResponse;
      expect(body.status).toBe(AppointmentStatus.CANCELLED);
      expect(body.cancellationReason).toBe(
        'Patient called to cancel due to severe weather',
      );
      expect(body.cancelledAt).not.toBeNull();

      // Verify in DB
      const inDb = await prisma.appointment.findUnique({
        where: { id: cancellableApptId },
      });
      expect(inDb?.status).toBe(AppointmentStatus.CANCELLED);
      expect(inDb?.cancellationReason).toBe(payload.cancellationReason);
    });

    it('rejects repeated cancellation with 409 Conflict', async () => {
      // First cancellation
      await request(app.getHttpServer())
        .post(`/api/v1/appointments/${cancellableApptId}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ cancellationReason: 'First reason' });

      // Repeated cancellation
      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${cancellableApptId}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ cancellationReason: 'Duplicate cancellation attempt' });

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain('already cancelled');
    });

    it('rejects cancellation of checked-in appointment (409)', async () => {
      await prisma.appointment.update({
        where: { id: cancellableApptId },
        data: { status: AppointmentStatus.CHECKED_IN },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${cancellableApptId}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ cancellationReason: 'Cannot cancel once checked in' });

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain('checked-in');
    });

    it('rejects empty cancellationReason with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${cancellableApptId}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ cancellationReason: '   ' });

      expect(res.status).toBe(400);
    });

    it('cross-clinic cancellation returns 404 Not Found without leaking record', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${cancellableApptId}/cancel`)
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic2Id)
        .send({ cancellationReason: 'Intruding clinic cancel' });

      expect(res.status).toBe(404);
    });

    it('STAFF role is denied cancellation (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/appointments/${cancellableApptId}/cancel`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ cancellationReason: 'Staff attempted cancel' });

      expect(res.status).toBe(403);
    });
  });
});
