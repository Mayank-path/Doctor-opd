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
  ConsultationStatus,
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
process.env.JWT_SECRET = 'cross-module-master-test-secret-at-least-32-chars';
process.env.JWT_ISSUER = 'doctor-opd-api';
process.env.JWT_AUDIENCE = 'doctor-opd-client';
process.env.JWT_EXPIRES_IN = '1h';

describe('Cross-Module End-to-End Workflow & Lifecycle (PostgreSQL Integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Track fixture IDs for clean teardown
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const createdQueueIds: string[] = [];
  const createdConsultationIds: string[] = [];

  const clinicId = crypto.randomUUID();
  const doctorUserId = crypto.randomUUID();
  const otherDoctorUserId = crypto.randomUUID();
  const receptionistUserId = crypto.randomUUID();

  const doctorPhone = `+919811${Math.floor(100000 + Math.random() * 900000)}`;
  const otherDoctorPhone = `+919822${Math.floor(100000 + Math.random() * 900000)}`;
  const receptionistPhone = `+919833${Math.floor(100000 + Math.random() * 900000)}`;

  let doctorToken: string;
  let otherDoctorToken: string;
  let receptionistToken: string;

  beforeAll(async () => {
    // -------------------------------------------------------------------------
    // Preflight Database Safety Assertion (Fail Closed)
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
    // Initialize NestJS Application with Global Config
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

    // 1. Seed Clinic
    await prisma.clinic.create({
      data: {
        id: clinicId,
        name: 'Apex Lifecare Centre (Master E2E)',
        slug: `apex-master-${Date.now()}`,
        phone: '+919811100099',
      },
    });
    createdClinicIds.push(clinicId);

    // 2. Seed Users
    await prisma.user.createMany({
      data: [
        {
          id: doctorUserId,
          email: `doc.master.${Date.now()}@example.com`,
          phone: doctorPhone,
          fullName: 'Dr. Vikram Sharma',
          passwordHash: 'dummy-hash-not-used-for-jwt-direct-auth',
          isActive: true,
        },
        {
          id: otherDoctorUserId,
          email: `doc.other.${Date.now()}@example.com`,
          phone: otherDoctorPhone,
          fullName: 'Dr. Sneha Patel',
          passwordHash: 'dummy-hash-not-used-for-jwt-direct-auth',
          isActive: true,
        },
        {
          id: receptionistUserId,
          email: `rec.master.${Date.now()}@example.com`,
          phone: receptionistPhone,
          fullName: 'Pooja Verma',
          passwordHash: 'dummy-hash-not-used-for-jwt-direct-auth',
          isActive: true,
        },
      ],
    });
    createdUserIds.push(doctorUserId, otherDoctorUserId, receptionistUserId);

    // 3. Seed Memberships
    await prisma.clinicMembership.createMany({
      data: [
        {
          userId: doctorUserId,
          clinicId,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: otherDoctorUserId,
          clinicId,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: receptionistUserId,
          clinicId,
          role: ClinicRole.RECEPTIONIST,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    // 4. Generate Authenticated JWT Tokens
    doctorToken = await authService.signToken(doctorUserId, doctorPhone);
    otherDoctorToken = await authService.signToken(
      otherDoctorUserId,
      otherDoctorPhone,
    );
    receptionistToken = await authService.signToken(
      receptionistUserId,
      receptionistPhone,
    );
  });

  afterAll(async () => {
    const preflight = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    await preflight.$connect();
    const dbCheck = await preflight.$queryRawUnsafe<
      Array<{ current_database: string }>
    >('SELECT current_database();');
    await preflight.$disconnect();

    if (dbCheck[0]?.current_database === 'doctor_opd_test') {
      await prisma.consultation.deleteMany({
        where: { id: { in: createdConsultationIds } },
      });
      await prisma.opdQueueEntry.deleteMany({
        where: { id: { in: createdQueueIds } },
      });
      await prisma.opdDailyCounter.deleteMany({
        where: { clinicId: { in: createdClinicIds } },
      });
      await prisma.appointment.deleteMany({
        where: { id: { in: createdAppointmentIds } },
      });
      await prisma.patient.deleteMany({
        where: { id: { in: createdPatientIds } },
      });
      await prisma.patientUhidCounter.deleteMany({
        where: { clinicId: { in: createdClinicIds } },
      });
      await prisma.clinicMembership.deleteMany({
        where: { clinicId: { in: createdClinicIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      await prisma.clinic.deleteMany({
        where: { id: { in: createdClinicIds } },
      });
    }

    if (app) {
      await app.close();
    }
  });

  describe('Master 9-Step Scheduled Workflow', () => {
    let patientId: string;
    let appointmentId: string;
    let queueEntryId: string;
    let consultationId: string;
    const serviceDate = '2026-11-25';

    it('Step 1: Create an active patient', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          fullName: 'Rajesh Kumar',
          gender: Gender.MALE,
          dateOfBirth: '1985-06-15',
          phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.uhid).toMatch(/^UHID-\d{6}$/);
      expect(res.body.fullName).toBe('Rajesh Kumar');
      patientId = res.body.id;
      createdPatientIds.push(patientId);
    });

    it('Step 2: Create a scheduled appointment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId,
          doctorId: doctorUserId,
          serviceDate,
          startTime: `${serviceDate}T10:00:00+05:30`,
          endTime: `${serviceDate}T10:30:00+05:30`,
          type: AppointmentType.SCHEDULED,
          chiefComplaint: 'Persistent cough for two weeks',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(AppointmentStatus.SCHEDULED);
      expect(res.body.patient.fullName).toBe('Rajesh Kumar');
      appointmentId = res.body.id;
      createdAppointmentIds.push(appointmentId);
    });

    it('Step 3: Check in the appointment and issue token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          appointmentId,
          idempotencyKey: `chk-scheduled-${appointmentId}`,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.tokenNumber).toBe(1);
      expect(res.body.status).toBe(QueueStatus.WAITING);
      expect(res.body.appointmentId).toBe(appointmentId);
      queueEntryId = res.body.id;
      createdQueueIds.push(queueEntryId);
    });

    it('Step 4: Call the patient', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({ status: QueueStatus.CALLED })
        .expect(200);

      expect(res.body.status).toBe(QueueStatus.CALLED);
      expect(res.body.calledAt).toBeDefined();
    });

    it('Step 5: Move queue entry to IN_CONSULTATION as assigned doctor', async () => {
      // Must reject if attempted by non-assigned doctor
      await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${otherDoctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ status: QueueStatus.IN_CONSULTATION })
        .expect(403);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ status: QueueStatus.IN_CONSULTATION })
        .expect(200);

      expect(res.body.status).toBe(QueueStatus.IN_CONSULTATION);
      expect(res.body.consultationStartTime).toBeDefined();

      // Verify linked appointment was also updated to IN_CONSULTATION
      const apptCheck = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });
      expect(apptCheck?.status).toBe(AppointmentStatus.IN_CONSULTATION);
    });

    it('Step 6: Create consultation draft for assigned doctor', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId,
          chiefComplaint: 'Severe dry cough with throat pain',
          symptoms: 'Fever for 3 days, dry cough',
          bpSystolic: 120,
          bpDiastolic: 80,
          pulse: 78,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(ConsultationStatus.DRAFT);
      expect(res.body.clinicianId).toBe(doctorUserId);
      consultationId = res.body.id;
      createdConsultationIds.push(consultationId);
    });

    it('Step 7: Update and finalize the consultation', async () => {
      // Update draft
      await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${consultationId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          diagnosis: 'Upper Respiratory Tract Infection (Acute Pharyngitis)',
          treatmentPlan:
            'Azithromycin 500mg daily for 3 days, warm saline gargles',
          followUpDate: '2026-12-02',
        })
        .expect(200);

      // Finalize consultation
      const finalizeRes = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${consultationId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      expect(finalizeRes.body.status).toBe(ConsultationStatus.FINALIZED);
      expect(finalizeRes.body.finalizedAt).toBeDefined();
    });

    it('Step 8: Complete the queue entry', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${queueEntryId}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ status: QueueStatus.COMPLETED })
        .expect(200);

      expect(res.body.status).toBe(QueueStatus.COMPLETED);
      expect(res.body.consultationEndTime).toBeDefined();
    });

    it('Step 9: Verify final consultation, queue, and appointment states', async () => {
      // 1. Consultation state
      const consultRes = await request(app.getHttpServer())
        .get(`/api/v1/consultations/${consultationId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      expect(consultRes.body.status).toBe(ConsultationStatus.FINALIZED);
      expect(consultRes.body.finalizedAt).toBeDefined();
      expect(consultRes.body.diagnosis).toBe(
        'Upper Respiratory Tract Infection (Acute Pharyngitis)',
      );

      // 2. Queue state
      const queueListRes = await request(app.getHttpServer())
        .get(`/api/v1/queue?serviceDate=${serviceDate}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      const targetEntry = queueListRes.body.data.find(
        (e: any) => e.id === queueEntryId,
      );
      expect(targetEntry).toBeDefined();
      expect(targetEntry.status).toBe(QueueStatus.COMPLETED);
      expect(targetEntry.consultationEndTime).toBeDefined();

      // 3. Appointment state
      const apptRes = await request(app.getHttpServer())
        .get(`/api/v1/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      expect(apptRes.body.status).toBe(AppointmentStatus.COMPLETED);
    });
  });

  describe('Walk-In Workflow with Auto-Coordinated Queue Finalization', () => {
    let walkInPatientId: string;
    let walkInQueueId: string;
    let walkInConsultationId: string;
    const serviceDate = '2026-11-26';

    it('registers walk-in and transitions through CALLED to IN_CONSULTATION', async () => {
      // 1. Create Patient
      const patRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          fullName: 'Ananya Roy',
          gender: Gender.FEMALE,
          phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        })
        .expect(201);
      walkInPatientId = patRes.body.id;
      createdPatientIds.push(walkInPatientId);

      // 2. Walk-in check-in (no appointmentId)
      const queueRes = await request(app.getHttpServer())
        .post('/api/v1/queue/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: walkInPatientId,
          doctorId: doctorUserId,
          serviceDate,
        })
        .expect(201);

      expect(queueRes.body.appointmentId).toBeNull();
      expect(queueRes.body.status).toBe(QueueStatus.WAITING);
      walkInQueueId = queueRes.body.id;
      createdQueueIds.push(walkInQueueId);

      // 3. Call patient
      await request(app.getHttpServer())
        .patch(`/api/v1/queue/${walkInQueueId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({ status: QueueStatus.CALLED })
        .expect(200);

      // 4. Move to IN_CONSULTATION
      await request(app.getHttpServer())
        .patch(`/api/v1/queue/${walkInQueueId}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ status: QueueStatus.IN_CONSULTATION })
        .expect(200);
    });

    it('creates draft and automatically completes walk-in queue entry upon consultation finalization', async () => {
      // 1. Doctor creates consultation draft
      const consultRes = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: walkInPatientId,
          chiefComplaint: 'Migraine headache',
        })
        .expect(201);
      walkInConsultationId = consultRes.body.id;
      createdConsultationIds.push(walkInConsultationId);

      // 2. Doctor finalizes consultation
      const finalizeRes = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${walkInConsultationId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      expect(finalizeRes.body.status).toBe(ConsultationStatus.FINALIZED);

      // 3. Verify walk-in queue entry was automatically completed
      const queueCheck = await prisma.opdQueueEntry.findUnique({
        where: { id: walkInQueueId },
      });
      expect(queueCheck?.status).toBe(QueueStatus.COMPLETED);
      expect(queueCheck?.consultationEndTime).toBeDefined();

      // 4. Verify idempotent retry on queue completion endpoint returns 200 without conflict
      const retryRes = await request(app.getHttpServer())
        .patch(`/api/v1/queue/${walkInQueueId}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ status: QueueStatus.COMPLETED })
        .expect(200);

      expect(retryRes.body.status).toBe(QueueStatus.COMPLETED);
    });
  });

  describe('Timezone & Asia/Kolkata Midnight Boundary E2E Verification', () => {
    let tzPatientId: string;
    const testDate = '2026-11-27';

    beforeAll(async () => {
      const patRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          fullName: 'Sunil Mehta',
          gender: Gender.MALE,
          phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        })
        .expect(201);
      tzPatientId = patRes.body.id;
      createdPatientIds.push(tzPatientId);
    });

    it('accepts appointment scheduled at 01:30 AM IST (which is previous UTC calendar date)', async () => {
      // 01:30 AM IST on 2026-11-27 = 2026-11-26T20:00:00.000Z in UTC
      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: tzPatientId,
          doctorId: doctorUserId,
          serviceDate: testDate,
          startTime: `${testDate}T01:30:00+05:30`,
          endTime: `${testDate}T02:00:00+05:30`,
          type: AppointmentType.SCHEDULED,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      createdAppointmentIds.push(res.body.id);
    });

    it('accepts appointment scheduled at exact midnight boundary 00:00:00 IST', async () => {
      // 00:00:00 IST on 2026-11-27 = 2026-11-26T18:30:00.000Z in UTC
      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: tzPatientId,
          doctorId: doctorUserId,
          serviceDate: testDate,
          startTime: `${testDate}T00:00:00+05:30`,
          endTime: `${testDate}T00:30:00+05:30`,
          type: AppointmentType.SCHEDULED,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      createdAppointmentIds.push(res.body.id);
    });

    it('rejects appointment when startTime IST date differs from serviceDate', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: tzPatientId,
          doctorId: doctorUserId,
          serviceDate: testDate,
          startTime: '2026-11-28T10:00:00+05:30', // Next day
          endTime: '2026-11-28T10:30:00+05:30',
        })
        .expect(400);
    });

    it('rejects appointment when endTime is equal to or before startTime', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: tzPatientId,
          doctorId: doctorUserId,
          serviceDate: testDate,
          startTime: `${testDate}T11:00:00+05:30`,
          endTime: `${testDate}T10:30:00+05:30`,
        })
        .expect(400);
    });
  });
});
