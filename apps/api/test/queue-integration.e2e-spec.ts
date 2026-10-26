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
  QueueStatus,
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
process.env.JWT_SECRET = 'chk8d-queue-test-secret-at-least-32-characters';
process.env.JWT_ISSUER = 'doctor-opd-api';
process.env.JWT_AUDIENCE = 'doctor-opd-client';
process.env.JWT_EXPIRES_IN = '1h';

interface QueueEntryResponse {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  idempotencyKey: string | null;
  serviceDate: string;
  tokenNumber: number;
  status: string;
  priority: number;
  checkInTime: string;
  calledAt: string | null;
  consultationStartTime: string | null;
  consultationEndTime: string | null;
  patient?: {
    id: string;
    uhid: string;
    fullName: string;
  };
  doctor?: {
    userId: string;
    user?: {
      fullName: string;
    };
  };
  appointment?: {
    id: string;
    status: string;
  };
}

describe('OPD Queue & Token Management API (PostgreSQL Integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Track fixture IDs for clean teardown
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const createdQueueIds: string[] = [];

  // Clinic identifiers
  const clinic1Id = crypto.randomUUID();
  const clinic2Id = crypto.randomUUID();

  // User identifiers
  const doctor1UserId = crypto.randomUUID();
  const doctor2UserId = crypto.randomUUID();
  const receptionistUserId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const clinic2DoctorUserId = crypto.randomUUID();

  // Patient identifiers
  const patient1Id = crypto.randomUUID();
  const patient2Id = crypto.randomUUID();
  const softDeletedPatientId = crypto.randomUUID();

  // Auth tokens
  let doctor1Token: string;
  let doctor2Token: string;
  let receptionistToken: string;
  let staffToken: string;
  let clinic2DoctorToken: string;

  const testServiceDate = '2026-11-20';

  beforeAll(async () => {
    // Preflight Database Safety Assertion
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

    // Initialize NestJS Application with Global Config
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

    // 1. Seed Clinics
    await prisma.clinic.createMany({
      data: [
        {
          id: clinic1Id,
          name: 'Apex Health Clinic (Queue Test)',
          slug: `apex-queue-${Date.now()}`,
          phone: '+919811199990',
        },
        {
          id: clinic2Id,
          name: 'Metro General (Queue Test)',
          slug: `metro-queue-${Date.now()}`,
          phone: '+919822299990',
        },
      ],
    });
    createdClinicIds.push(clinic1Id, clinic2Id);

    // 2. Seed Users
    await prisma.user.createMany({
      data: [
        {
          id: doctor1UserId,
          phone: '+919811199001',
          email: 'doc1@queue.test',
          fullName: 'Dr. Primary Physician',
        },
        {
          id: doctor2UserId,
          phone: '+919811199002',
          email: 'doc2@queue.test',
          fullName: 'Dr. Secondary Physician',
        },
        {
          id: receptionistUserId,
          phone: '+919811199003',
          email: 'reception@queue.test',
          fullName: 'Desk Officer',
        },
        {
          id: staffUserId,
          phone: '+919811199004',
          email: 'staff@queue.test',
          fullName: 'Board Operator',
        },
        {
          id: clinic2DoctorUserId,
          phone: '+919811199005',
          email: 'doc_c2@queue.test',
          fullName: 'Dr. Foreign Clinic',
        },
      ],
    });
    createdUserIds.push(
      doctor1UserId,
      doctor2UserId,
      receptionistUserId,
      staffUserId,
      clinic2DoctorUserId,
    );

    // 3. Seed Memberships
    await prisma.clinicMembership.createMany({
      data: [
        {
          userId: doctor1UserId,
          clinicId: clinic1Id,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: doctor2UserId,
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
          uhid: 'UHID-Q00001',
          fullName: 'Queue Patient Alpha',
          gender: Gender.FEMALE,
          phone: '+919811199111',
          deletedAt: null,
        },
        {
          id: patient2Id,
          clinicId: clinic2Id,
          uhid: 'UHID-Q00002',
          fullName: 'Clinic 2 Patient',
          gender: Gender.MALE,
          phone: '+919822299222',
          deletedAt: null,
        },
        {
          id: softDeletedPatientId,
          clinicId: clinic1Id,
          uhid: 'UHID-Q00003',
          fullName: 'Soft-Deleted Patient',
          gender: Gender.OTHER,
          phone: '+919833399333',
          deletedAt: new Date(),
        },
      ],
    });

    // 5. Generate Auth Tokens
    doctor1Token = await authService.signToken(doctor1UserId, '+919811199001');
    doctor2Token = await authService.signToken(doctor2UserId, '+919811199002');
    receptionistToken = await authService.signToken(
      receptionistUserId,
      '+919811199003',
    );
    staffToken = await authService.signToken(staffUserId, '+919811199004');
    clinic2DoctorToken = await authService.signToken(
      clinic2DoctorUserId,
      '+919811199005',
    );
  });

  afterAll(async () => {
    if (prisma) {
      const verifyDb = await prisma.$queryRawUnsafe<
        Array<{ current_database: string }>
      >('SELECT current_database();');
      if (verifyDb[0]?.current_database === 'doctor_opd_test') {
        if (createdQueueIds.length > 0) {
          await prisma.opdQueueEntry.deleteMany({
            where: { id: { in: createdQueueIds } },
          });
        }
        await prisma.opdDailyCounter.deleteMany({
          where: { clinicId: { in: createdClinicIds } },
        });
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
  // 1. POST /api/v1/queue/check-in
  // =========================================================================

  describe('POST /api/v1/queue/check-in', () => {
    let testAppointmentId: string;

    beforeEach(async () => {
      const appt = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctor1UserId,
          serviceDate: new Date(`${testServiceDate}T00:00:00.000Z`),
          startTime: new Date(`${testServiceDate}T09:00:00.000Z`),
          status: AppointmentStatus.SCHEDULED,
        },
      });
      testAppointmentId = appt.id;
      createdAppointmentIds.push(appt.id);
    });

    it('checks in a scheduled appointment, allocates token 1, and updates appointment status to CHECKED_IN (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ appointmentId: testAppointmentId });

      expect(res.status).toBe(201);
      const body = res.body as QueueEntryResponse;
      expect(body.id).toBeDefined();
      createdQueueIds.push(body.id);

      expect(body.clinicId).toBe(clinic1Id);
      expect(body.patientId).toBe(patient1Id);
      expect(body.doctorId).toBe(doctor1UserId);
      expect(body.appointmentId).toBe(testAppointmentId);
      expect(body.tokenNumber).toBe(1);
      expect(body.status).toBe(QueueStatus.WAITING);

      // Verify linked appointment in DB transitioned to CHECKED_IN
      const updatedAppt = await prisma.appointment.findUnique({
        where: { id: testAppointmentId },
      });
      expect(updatedAppt?.status).toBe(AppointmentStatus.CHECKED_IN);
    });

    it('rejects duplicate check-in for already checked-in appointment (409 Conflict)', async () => {
      // First check-in
      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ appointmentId: testAppointmentId });

      expect(firstRes.status).toBe(201);
      createdQueueIds.push((firstRes.body as QueueEntryResponse).id);

      // Second check-in attempt on same appointment
      const secondRes = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ appointmentId: testAppointmentId });

      expect(secondRes.status).toBe(409);
      expect((secondRes.body as { message: string }).message).toContain('already checked in');
    });

    it('checks in a walk-in patient directly and allocates next sequential token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          doctorId: doctor1UserId,
          serviceDate: testServiceDate,
          priority: 2,
        });

      expect(res.status).toBe(201);
      const body = res.body as QueueEntryResponse;
      createdQueueIds.push(body.id);

      expect(body.appointmentId).toBeNull();
      expect(body.priority).toBe(2);
      expect(body.tokenNumber).toBeGreaterThanOrEqual(1);
    });

    it('idempotent retry with identical idempotencyKey returns existing entry without issuing new token', async () => {
      const idempKey = `idemp-${crypto.randomUUID()}`;

      // First call
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          appointmentId: testAppointmentId,
          idempotencyKey: idempKey,
        });

      expect(res1.status).toBe(201);
      const entry1 = res1.body as QueueEntryResponse;
      createdQueueIds.push(entry1.id);

      // Second call with identical key and request
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          appointmentId: testAppointmentId,
          idempotencyKey: idempKey,
        });

      expect(res2.status).toBe(201);
      const entry2 = res2.body as QueueEntryResponse;

      // Must return identical entry with identical token number
      expect(entry2.id).toBe(entry1.id);
      expect(entry2.tokenNumber).toBe(entry1.tokenNumber);
    });

    it('rejects reuse of idempotencyKey with conflicting request parameters (409 Conflict)', async () => {
      const idempKey = `idemp-conflict-${crypto.randomUUID()}`;

      // Check-in for patient1
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          doctorId: doctor1UserId,
          serviceDate: testServiceDate,
          idempotencyKey: idempKey,
        });

      expect(res1.status).toBe(201);
      createdQueueIds.push((res1.body as QueueEntryResponse).id);

      // Attempt reuse with different doctor
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          doctorId: doctor2UserId,
          serviceDate: testServiceDate,
          idempotencyKey: idempKey,
        });

      expect(res2.status).toBe(409);
      expect((res2.body as { message: string }).message).toContain('conflicting');
    });

    it('concurrent walk-in check-ins allocate consecutive unique token numbers without collision', async () => {
      const concurrentServiceDate = '2026-11-25';
      const requests = Array.from({ length: 5 }, (_, idx) =>
        request(app.getHttpServer())
          .post('/api/v1/queue/check-in')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .set('x-clinic-id', clinic1Id)
          .send({
            patientId: patient1Id,
            doctorId: doctor2UserId,
            serviceDate: concurrentServiceDate,
            priority: 0,
          }),
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(201);
        createdQueueIds.push((res.body as QueueEntryResponse).id);
      }

      const tokenNumbers = responses.map(
        (r) => (r.body as QueueEntryResponse).tokenNumber,
      );
      // All 5 tokens must be unique
      const uniqueTokens = new Set(tokenNumbers);
      expect(uniqueTokens.size).toBe(5);
      // Tokens must span 1 to 5
      expect(tokenNumbers.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });

    it('rejects check-in for soft-deleted patient (404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: softDeletedPatientId,
          doctorId: doctor1UserId,
          serviceDate: testServiceDate,
        });

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Patient not found');
    });

    it('rejects check-in for patient from another clinic (404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient2Id,
          doctorId: doctor1UserId,
          serviceDate: testServiceDate,
        });

      expect(res.status).toBe(404);
    });

    it('rejects check-in for doctor not in clinic (404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          doctorId: clinic2DoctorUserId,
          serviceDate: testServiceDate,
        });

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 2. GET /api/v1/queue (List Queue)
  // =========================================================================

  describe('GET /api/v1/queue', () => {
    const listQueueDate = '2026-11-26';

    beforeAll(async () => {
      // Seed queue entries with different priorities and token numbers
      const q1 = await prisma.opdQueueEntry.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctor1UserId,
          serviceDate: new Date(`${listQueueDate}T00:00:00.000Z`),
          tokenNumber: 1,
          priority: 0,
          status: QueueStatus.WAITING,
        },
      });
      const q2 = await prisma.opdQueueEntry.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctor1UserId,
          serviceDate: new Date(`${listQueueDate}T00:00:00.000Z`),
          tokenNumber: 2,
          priority: 5, // higher priority must be ordered first
          status: QueueStatus.WAITING,
        },
      });
      // Clinic 2 entry
      const qC2 = await prisma.opdQueueEntry.create({
        data: {
          clinicId: clinic2Id,
          patientId: patient2Id,
          doctorId: clinic2DoctorUserId,
          serviceDate: new Date(`${listQueueDate}T00:00:00.000Z`),
          tokenNumber: 1,
          priority: 0,
          status: QueueStatus.WAITING,
        },
      });
      createdQueueIds.push(q1.id, q2.id, qC2.id);
    });

    it('lists queue ordered by priority descending, then tokenNumber ascending (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/queue?serviceDate=${listQueueDate}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as { data: QueueEntryResponse[]; total: number };
      expect(body.data.length).toBe(2);

      // Priority 5 (token 2) must come before Priority 0 (token 1)
      expect(body.data[0].tokenNumber).toBe(2);
      expect(body.data[0].priority).toBe(5);
      expect(body.data[1].tokenNumber).toBe(1);
      expect(body.data[1].priority).toBe(0);

      // Verify safe summaries attached
      expect(body.data[0].patient?.fullName).toBe('Queue Patient Alpha');
      expect(body.data[0].doctor?.user?.fullName).toBe('Dr. Primary Physician');
    });

    it('STAFF role is permitted to view queue (display board authorization)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/queue?serviceDate=${listQueueDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      expect((res.body as { data: QueueEntryResponse[] }).data.length).toBe(2);
    });

    it('requires serviceDate parameter (400 if missing)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/queue')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. PATCH /api/v1/queue/:id/status (Queue Status Progression)
  // =========================================================================

  describe('PATCH /api/v1/queue/:id/status', () => {
    let queueEntryId: string;
    let linkedApptId: string;
    let patchTokenCounter = 100;

    beforeEach(async () => {
      patchTokenCounter += 1;
      const appt = await prisma.appointment.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctor1UserId,
          serviceDate: new Date('2026-11-27T00:00:00.000Z'),
          startTime: new Date('2026-11-27T10:00:00.000Z'),
          status: AppointmentStatus.CHECKED_IN,
        },
      });
      linkedApptId = appt.id;
      createdAppointmentIds.push(appt.id);

      const entry = await prisma.opdQueueEntry.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctor1UserId,
          appointmentId: linkedApptId,
          serviceDate: new Date('2026-11-27T00:00:00.000Z'),
          tokenNumber: patchTokenCounter,
          status: QueueStatus.WAITING,
        },
      });
      queueEntryId = entry.id;
      createdQueueIds.push(entry.id);
    });

    it('RECEPTIONIST successfully transitions WAITING to CALLED and stamps calledAt (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CALLED });

      expect(res.status).toBe(200);
      const body = res.body as QueueEntryResponse;
      expect(body.status).toBe(QueueStatus.CALLED);
      expect(body.calledAt).not.toBeNull();
    });

    it('assigned DOCTOR transitions CALLED to IN_CONSULTATION and updates linked appointment (200)', async () => {
      // Advance to CALLED first
      await prisma.opdQueueEntry.update({
        where: { id: queueEntryId },
        data: { status: QueueStatus.CALLED },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.IN_CONSULTATION });

      expect(res.status).toBe(200);
      const body = res.body as QueueEntryResponse;
      expect(body.status).toBe(QueueStatus.IN_CONSULTATION);
      expect(body.consultationStartTime).not.toBeNull();

      // Verify linked appointment updated
      const apptInDb = await prisma.appointment.findUnique({
        where: { id: linkedApptId },
      });
      expect(apptInDb?.status).toBe(AppointmentStatus.IN_CONSULTATION);
    });

    it('rejects IN_CONSULTATION transition if attempted by another doctor (403 Forbidden)', async () => {
      await prisma.opdQueueEntry.update({
        where: { id: queueEntryId },
        data: { status: QueueStatus.CALLED },
      });

      // doctor2 attempts to start consultation for doctor1's queue entry
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${doctor2Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.IN_CONSULTATION });

      expect(res.status).toBe(403);
      expect((res.body as { message: string }).message).toContain('assigned doctor');
    });

    it('rejects IN_CONSULTATION transition if attempted by receptionist (403 Forbidden)', async () => {
      await prisma.opdQueueEntry.update({
        where: { id: queueEntryId },
        data: { status: QueueStatus.CALLED },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.IN_CONSULTATION });

      expect(res.status).toBe(403);
    });

    it('assigned DOCTOR completes consultation, stamps consultationEndTime and updates appointment (200)', async () => {
      await prisma.opdQueueEntry.update({
        where: { id: queueEntryId },
        data: {
          status: QueueStatus.IN_CONSULTATION,
          consultationStartTime: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.COMPLETED });

      expect(res.status).toBe(200);
      const body = res.body as QueueEntryResponse;
      expect(body.status).toBe(QueueStatus.COMPLETED);
      expect(body.consultationEndTime).not.toBeNull();

      const apptInDb = await prisma.appointment.findUnique({
        where: { id: linkedApptId },
      });
      expect(apptInDb?.status).toBe(AppointmentStatus.COMPLETED);
    });

    it('rejects invalid state transition directly from WAITING to COMPLETED (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.COMPLETED });

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain('Invalid queue status transition');
    });

    it('rejects transitions out of terminal COMPLETED state (409 Conflict)', async () => {
      await prisma.opdQueueEntry.update({
        where: { id: queueEntryId },
        data: { status: QueueStatus.COMPLETED },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CALLED });

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain('Completed queue entry cannot change status');
    });

    it('preserves initial calledAt timestamp on repeated CALLED transitions', async () => {
      // First call
      const res1 = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CALLED });

      expect(res1.status).toBe(200);
      const firstCalledAt = (res1.body as QueueEntryResponse).calledAt;
      expect(firstCalledAt).not.toBeNull();

      // Wait a tick to ensure clock would advance if not preserved
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second call (recall patient)
      const res2 = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CALLED });

      expect(res2.status).toBe(200);
      const secondCalledAt = (res2.body as QueueEntryResponse).calledAt;
      expect(secondCalledAt).toBe(firstCalledAt);
    });

    it('cancelling a linked queue entry transitions linked appointment to CANCELLED (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CANCELLED });

      expect(res.status).toBe(200);
      const body = res.body as QueueEntryResponse;
      expect(body.status).toBe(QueueStatus.CANCELLED);

      // Verify linked appointment was transitioned to CANCELLED in DB
      const apptInDb = await prisma.appointment.findUnique({
        where: { id: linkedApptId },
      });
      expect(apptInDb?.status).toBe(AppointmentStatus.CANCELLED);
      expect(apptInDb?.cancellationReason).toBe('Queue entry cancelled');
      expect(apptInDb?.cancelledAt).not.toBeNull();
    });

    it('cancelling a walk-in queue entry succeeds without linked appointment (200)', async () => {
      const walkInEntry = await prisma.opdQueueEntry.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          doctorId: doctor1UserId,
          serviceDate: new Date('2026-11-27T00:00:00.000Z'),
          tokenNumber: 9999,
          status: QueueStatus.WAITING,
        },
      });
      createdQueueIds.push(walkInEntry.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${walkInEntry.id}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CANCELLED });

      expect(res.status).toBe(200);
      expect((res.body as QueueEntryResponse).status).toBe(QueueStatus.CANCELLED);
    });

    it('rejects repeated cancellation of already CANCELLED queue entry (409 Conflict)', async () => {
      // First cancel
      await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CANCELLED });

      // Second cancel attempt
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ status: QueueStatus.CANCELLED });

      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toContain(
        'Cancelled queue entry cannot change status',
      );
    });

    it('cross-clinic status transition returns 404 without leaking entry', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic2Id)
        .send({ status: QueueStatus.CALLED });

      expect(res.status).toBe(404);
    });
  });
});
