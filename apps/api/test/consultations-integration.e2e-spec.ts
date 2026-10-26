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
  ConsultationStatus,
  Prisma,
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
process.env.JWT_SECRET = 'chk8a-consultation-test-secret-at-least-32-chars';
process.env.JWT_ISSUER = 'doctor-opd-api';
process.env.JWT_AUDIENCE = 'doctor-opd-client';
process.env.JWT_EXPIRES_IN = '1h';

interface ConsultationResponse {
  id: string;
  clinicId: string;
  patientId: string;
  clinicianId: string;
  encounterDate: string;
  status: string;
  finalizedAt: string | null;
  chiefComplaint: string;
  symptoms?: string | null;
  examination?: string | null;
  diagnosis?: string | null;
  treatmentPlan?: string | null;
  followUpDate?: string | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulse?: number | null;
  temperature?: string | number | null;
  weightKg?: string | number | null;
  heightCm?: string | number | null;
  spo2?: number | null;
  respiratoryRate?: number | null;
  message?: string | string[];
}

describe('Consultation Draft API (PostgreSQL Integration)', () => {
  jest.setTimeout(45000);

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Track created fixtures for teardown
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdConsultationIds: string[] = [];

  // Clinic identifiers
  const clinic1Id = crypto.randomUUID();
  const clinic2Id = crypto.randomUUID();

  // User identifiers
  const doctorUserId = crypto.randomUUID();
  const colleagueDoctorUserId = crypto.randomUUID();
  const receptionistUserId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const clinic2DoctorUserId = crypto.randomUUID();

  // Patient identifiers
  const patient1Id = crypto.randomUUID();
  const patient2Id = crypto.randomUUID(); // Clinic 2 patient
  const softDeletedPatientId = crypto.randomUUID();

  // JWT Tokens
  let doctorToken: string;
  let colleagueDoctorToken: string;
  let receptionistToken: string;
  let adminToken: string;
  let clinic2DoctorToken: string;

  beforeAll(async () => {
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

    prisma = app.get<PrismaService>(PrismaService);
    authService = app.get<AuthService>(AuthService);

    // Double-check connected database is strictly doctor_opd_test
    const dbCheck = await prisma.$queryRawUnsafe<
      Array<{ current_database: string }>
    >('SELECT current_database();');
    if (dbCheck[0]?.current_database !== 'doctor_opd_test') {
      throw new Error(
        `FATAL: Tests connected to ${dbCheck[0]?.current_database}, expected doctor_opd_test`,
      );
    }

    // 1. Seed Clinics
    await prisma.clinic.createMany({
      data: [
        {
          id: clinic1Id,
          name: 'Consultation Test Clinic 1',
          slug: `c1-${clinic1Id.substring(0, 8)}`,
        },
        {
          id: clinic2Id,
          name: 'Consultation Test Clinic 2',
          slug: `c2-${clinic2Id.substring(0, 8)}`,
        },
      ],
    });
    createdClinicIds.push(clinic1Id, clinic2Id);

    // 2. Seed Users
    await prisma.user.createMany({
      data: [
        {
          id: doctorUserId,
          phone: '+919811100001',
          email: 'doctor1@chk8a.test',
          fullName: 'Dr. Consultation Author',
        },
        {
          id: colleagueDoctorUserId,
          phone: '+919811100004',
          email: 'doctor3@chk8a.test',
          fullName: 'Dr. Colleague Doctor',
        },
        {
          id: receptionistUserId,
          phone: '+919811100002',
          email: 'receptionist1@chk8a.test',
          fullName: 'Staff Receptionist',
        },
        {
          id: adminUserId,
          phone: '+919811100005',
          email: 'admin1@chk8a.test',
          fullName: 'Clinic Administrator',
        },
        {
          id: clinic2DoctorUserId,
          phone: '+919811100003',
          email: 'doctor2@chk8a.test',
          fullName: 'Dr. Clinic Two',
        },
      ],
    });
    createdUserIds.push(
      doctorUserId,
      colleagueDoctorUserId,
      receptionistUserId,
      adminUserId,
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
          userId: colleagueDoctorUserId,
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
          uhid: 'UHID-800001',
          fullName: 'Patient Alpha',
          gender: Gender.FEMALE,
          phone: '+919811111111',
          deletedAt: null,
        },
        {
          id: patient2Id,
          clinicId: clinic2Id,
          uhid: 'UHID-800002',
          fullName: 'Patient Beta (Clinic 2)',
          gender: Gender.MALE,
          phone: '+919822222222',
          deletedAt: null,
        },
        {
          id: softDeletedPatientId,
          clinicId: clinic1Id,
          uhid: 'UHID-800003',
          fullName: 'Patient Gamma (Soft-Deleted)',
          gender: Gender.OTHER,
          phone: '+919833333333',
          deletedAt: new Date(),
        },
      ],
    });

    // 5. Generate Auth Tokens
    doctorToken = await authService.signToken(doctorUserId, '+919811100001');
    colleagueDoctorToken = await authService.signToken(
      colleagueDoctorUserId,
      '+919811100004',
    );
    receptionistToken = await authService.signToken(
      receptionistUserId,
      '+919811100002',
    );
    adminToken = await authService.signToken(adminUserId, '+919811100005');
    clinic2DoctorToken = await authService.signToken(
      clinic2DoctorUserId,
      '+919811100003',
    );
  });

  afterAll(async () => {
    if (prisma) {
      const verifyDb = await prisma.$queryRawUnsafe<
        Array<{ current_database: string }>
      >('SELECT current_database();');
      if (verifyDb[0]?.current_database === 'doctor_opd_test') {
        // Cleanup created consultations
        if (createdConsultationIds.length > 0) {
          await prisma.consultation.deleteMany({
            where: { id: { in: createdConsultationIds } },
          });
        }
        // Cleanup patients, clinics, users (cascading deletes clinic memberships)
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

  describe('POST /api/v1/consultations (Create Draft)', () => {
    it('DOCTOR successfully creates a consultation draft with valid patient and vitals (201)', async () => {
      const payload = {
        patientId: patient1Id,
        chiefComplaint: 'Acute abdominal pain and nausea',
        symptoms: 'Right lower quadrant pain for 12 hours',
        examination: 'Tenderness at McBurney point, positive rebound',
        diagnosis: 'Suspected acute appendicitis',
        treatmentPlan: 'Surgical consult, NPO, IV fluids, ultrasound',
        followUpDate: '2026-10-30',
        bpSystolic: 125,
        bpDiastolic: 82,
        pulse: 88,
        temperature: 99.8,
        weightKg: 64.5,
        heightCm: 168.0,
        spo2: 99,
        respiratoryRate: 18,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(payload);

      expect(res.status).toBe(201);
      const body = res.body as ConsultationResponse;

      expect(body.id).toBeDefined();
      createdConsultationIds.push(body.id);

      // Verify server-side derived and trusted fields
      expect(body.clinicId).toBe(clinic1Id);
      expect(body.clinicianId).toBe(doctorUserId);
      expect(body.patientId).toBe(patient1Id);
      expect(body.status).toBe(ConsultationStatus.DRAFT);
      expect(body.finalizedAt).toBeNull();
      expect(body.chiefComplaint).toBe('Acute abdominal pain and nausea');
      expect(body.bpSystolic).toBe(125);
      expect(body.bpDiastolic).toBe(82);
      expect(body.pulse).toBe(88);
      expect(Number(body.temperature)).toBe(99.8);
      expect(Number(body.weightKg)).toBe(64.5);
      expect(Number(body.heightCm)).toBe(168.0);
      expect(body.spo2).toBe(99);
      expect(body.respiratoryRate).toBe(18);

      // Verify physical persistence in PostgreSQL doctor_opd_test
      const persisted = await prisma.consultation.findUnique({
        where: { id: body.id },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.status).toBe(ConsultationStatus.DRAFT);
      expect(persisted?.clinicId).toBe(clinic1Id);
      expect(persisted?.clinicianId).toBe(doctorUserId);
      expect(persisted?.patientId).toBe(patient1Id);
    });

    it('RECEPTIONIST role is denied consultation creation (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          chiefComplaint: 'Attempted creation by receptionist',
        });

      expect(res.status).toBe(403);
    });

    it('DOCTOR from another clinic is denied access (403)', async () => {
      // Clinic 2 Doctor tries to access Clinic 1
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          chiefComplaint: 'Outsider doctor attempt',
        });

      expect(res.status).toBe(403);
    });

    it('DOCTOR cannot create consultation for patient in another clinic (404)', async () => {
      // Doctor from Clinic 1 tries to create consultation for patient in Clinic 2
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient2Id,
          chiefComplaint: 'Cross-clinic patient consultation',
        });

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain(
        'Patient not found',
      );
    });

    it('DOCTOR cannot create consultation for soft-deleted patient (404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: softDeletedPatientId,
          chiefComplaint: 'Consultation for soft-deleted patient',
        });

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain(
        'Patient not found',
      );
    });

    it('Client-supplied untrusted fields (clinicId, clinicianId, status) are rejected by ValidationPipe (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          chiefComplaint: 'Headache',
          clinicId: 'spoofed-clinic-id', // Forbidden unwhitelisted property
          status: 'FINALIZED', // Forbidden unwhitelisted property
          clinicianId: 'spoofed-clinician-id', // Forbidden unwhitelisted property
        });

      expect(res.status).toBe(400);
      expect((res.body as { message: string[] }).message.length).toBeGreaterThan(
        0,
      );
    });

    it('Missing chiefComplaint returns 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
        });

      expect(res.status).toBe(400);
    });

    it('Invalid vitals out of range return 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          chiefComplaint: 'Hypertension evaluation',
          bpSystolic: 450, // Out of range
          spo2: 120, // Out of range
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/consultations/:id (Edit Draft)', () => {
    let draftId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          chiefComplaint: 'Initial headache complaint',
          bpSystolic: 120,
        });
      draftId = (createRes.body as ConsultationResponse).id;
      createdConsultationIds.push(draftId);
    });

    it('DOCTOR successfully updates clinical narrative and vitals on DRAFT (200)', async () => {
      const updatePayload = {
        chiefComplaint: 'Updated: Migraine with photophobia',
        symptoms: 'Throbbing hemicranial headache, nausea',
        examination: 'Pupils equal, neck supple',
        diagnosis: 'Acute migraine',
        treatmentPlan: 'Sumatriptan 50mg, dark room rest',
        followUpDate: '2026-11-05',
        bpSystolic: 128,
        bpDiastolic: 84,
        pulse: 76,
        temperature: 98.6,
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${draftId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send(updatePayload);

      expect(res.status).toBe(200);
      const body = res.body as ConsultationResponse;
      expect(body.id).toBe(draftId);
      expect(body.chiefComplaint).toBe('Updated: Migraine with photophobia');
      expect(body.symptoms).toBe('Throbbing hemicranial headache, nausea');
      expect(body.bpSystolic).toBe(128);
      expect(body.bpDiastolic).toBe(84);
      expect(body.pulse).toBe(76);
      expect(body.status).toBe(ConsultationStatus.DRAFT);
      expect(body.finalizedAt).toBeNull();

      // Verify database persistence
      const inDb = await prisma.consultation.findUnique({
        where: { id: draftId },
      });
      expect(inDb?.chiefComplaint).toBe('Updated: Migraine with photophobia');
      expect(inDb?.bpSystolic).toBe(128);
    });

    it('Empty update payload returns 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${draftId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({});

      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toContain(
        'At least one field must be provided',
      );
    });

    it('Client cannot mutate protected fields (clinicId, patientId, status, finalizedAt) (400)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${draftId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          chiefComplaint: 'Valid update',
          status: 'FINALIZED',
          clinicId: 'spoofed-clinic',
          finalizedAt: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('RECEPTIONIST role is denied draft editing (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${draftId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ chiefComplaint: 'Receptionist edit attempt' });

      expect(res.status).toBe(403);
    });

    it('DOCTOR from another clinic is denied draft editing (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${draftId}`)
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ chiefComplaint: 'Cross-clinic doctor edit' });

      expect(res.status).toBe(403);
    });

    it('Updating non-existent consultation returns 404 Not Found', async () => {
      const fakeId = crypto.randomUUID();
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${fakeId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ chiefComplaint: 'Non-existent consultation' });

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain(
        'Consultation not found',
      );
    });

    it('Updating consultation belonging to another clinic returns 404 Not Found', async () => {
      // Doctor from Clinic 2 creates draft in Clinic 2
      const c2Res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic2Id)
        .send({
          patientId: patient2Id,
          chiefComplaint: 'Clinic 2 draft',
        });
      const c2DraftId = (c2Res.body as ConsultationResponse).id;
      createdConsultationIds.push(c2DraftId);

      // Doctor 1 from Clinic 1 tries to update Clinic 2 draft
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${c2DraftId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ chiefComplaint: 'Attacking clinic 2 draft' });

      expect(res.status).toBe(404);
    });

    it('rejects update if attempted by another doctor in the same clinic (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${draftId}`)
        .set('Authorization', `Bearer ${colleagueDoctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ chiefComplaint: 'Unauthorized colleague modification' });

      expect(res.status).toBe(403);
      expect((res.body as { message: string }).message).toContain(
        'Only the assigned clinician may update this consultation draft',
      );
    });
  });

  describe('POST /api/v1/consultations/:id/finalize (Finalization & Immutability)', () => {
    let draftId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          patientId: patient1Id,
          chiefComplaint: 'Pre-finalization complaint',
          bpSystolic: 120,
        });
      draftId = (createRes.body as ConsultationResponse).id;
      createdConsultationIds.push(draftId);
    });

    it('DOCTOR successfully finalizes a DRAFT consultation (200)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${draftId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as ConsultationResponse;
      expect(body.id).toBe(draftId);
      expect(body.status).toBe(ConsultationStatus.FINALIZED);
      expect(body.finalizedAt).not.toBeNull();
      expect(new Date(body.finalizedAt!).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );

      // Verify physical persistence in PostgreSQL
      const persisted = await prisma.consultation.findUnique({
        where: { id: draftId },
      });
      expect(persisted?.status).toBe(ConsultationStatus.FINALIZED);
      expect(persisted?.finalizedAt).not.toBeNull();
    });

    it('rejects finalization if attempted by another doctor in the same clinic (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${draftId}/finalize`)
        .set('Authorization', `Bearer ${colleagueDoctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
      expect((res.body as { message: string }).message).toContain(
        'Only the assigned clinician may finalize this consultation',
      );
    });

    it('Repeated finalization returns 409 Conflict', async () => {
      // First finalization
      await request(app.getHttpServer())
        .post(`/api/v1/consultations/${draftId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .expect(200);

      // Second finalization attempt
      const secondRes = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${draftId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(secondRes.status).toBe(409);
      expect((secondRes.body as { message: string }).message).toContain(
        'already finalized',
      );
    });

    it('FINALIZED consultation is IMMUTABLE: editing is strictly rejected (409)', async () => {
      // Finalize the record
      await request(app.getHttpServer())
        .post(`/api/v1/consultations/${draftId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .expect(200);

      // Attempt to edit finalized record
      const editRes = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${draftId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({
          chiefComplaint: 'Illegal tampering of finalized record',
          bpSystolic: 140,
        });

      expect(editRes.status).toBe(409);
      expect((editRes.body as { message: string }).message).toContain(
        'Cannot edit a finalized consultation',
      );

      // Verify in DB that clinical data was not altered
      const inDb = await prisma.consultation.findUnique({
        where: { id: draftId },
      });
      expect(inDb?.chiefComplaint).toBe('Pre-finalization complaint');
      expect(inDb?.bpSystolic).toBe(120);
      expect(inDb?.status).toBe(ConsultationStatus.FINALIZED);
    });

    it('RECEPTIONIST role is denied finalization (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${draftId}/finalize`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });

    it('DOCTOR from another clinic is denied finalization (403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${draftId}/finalize`)
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });

    it('Finalizing non-existent consultation returns 404 Not Found', async () => {
      const fakeId = crypto.randomUUID();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${fakeId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain(
        'Consultation not found',
      );
    });
  });

  // =========================================================================
  // Checkpoint 8C: Read APIs
  // =========================================================================

  describe('GET /api/v1/consultations (Consultation Listing)', () => {
    let listTestConsultation1Id: string;
    let listTestConsultation2Id: string;
    let listTestConsultation3FinalizedId: string;
    let clinic2ConsultationId: string;
    const sameEncounterDate = new Date('2026-10-25T14:30:00.000Z');

    beforeAll(async () => {
      // Seed consultations with explicit dates for deterministic sort testing
      const c1 = await prisma.consultation.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          clinicianId: doctorUserId,
          encounterDate: sameEncounterDate,
          status: ConsultationStatus.DRAFT,
          chiefComplaint: 'Sorting test complaint Alpha',
        },
      });
      listTestConsultation1Id = c1.id;
      createdConsultationIds.push(c1.id);

      const c2 = await prisma.consultation.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          clinicianId: doctorUserId,
          encounterDate: sameEncounterDate,
          status: ConsultationStatus.DRAFT,
          chiefComplaint: 'Sorting test complaint Beta',
        },
      });
      listTestConsultation2Id = c2.id;
      createdConsultationIds.push(c2.id);

      const c3 = await prisma.consultation.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          clinicianId: doctorUserId,
          encounterDate: new Date('2026-10-26T18:00:00.000Z'),
          status: ConsultationStatus.FINALIZED,
          finalizedAt: new Date('2026-10-26T18:15:00.000Z'),
          chiefComplaint: 'Finalized consultation for filter test',
        },
      });
      listTestConsultation3FinalizedId = c3.id;
      createdConsultationIds.push(c3.id);

      // Seed a consultation in Clinic 2 to test strict tenant isolation
      const cOther = await prisma.consultation.create({
        data: {
          clinicId: clinic2Id,
          patientId: patient2Id,
          clinicianId: clinic2DoctorUserId,
          encounterDate: new Date('2026-10-26T12:00:00.000Z'),
          status: ConsultationStatus.DRAFT,
          chiefComplaint: 'Clinic 2 private consultation',
        },
      });
      clinic2ConsultationId = cOther.id;
      createdConsultationIds.push(cOther.id);
    });

    it('DOCTOR successfully lists consultations with default pagination and patient context (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: Array<ConsultationResponse & { patient: { fullName: string; uhid: string } }>;
        items: Array<ConsultationResponse & { patient: { fullName: string; uhid: string } }>;
        meta: { page: number; limit: number; total: number; totalPages: number };
      };

      expect(body.data).toBeDefined();
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);
      expect(body.meta).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 20,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      );

      // Verify all items belong exclusively to active clinic
      for (const item of body.data) {
        expect(item.clinicId).toBe(clinic1Id);
        expect(item.patient).toBeDefined();
        expect(item.patient.fullName).toBeDefined();
        expect(item.patient.uhid).toBeDefined();
      }

      // Verify Clinic 2 consultation is completely absent
      const foundClinic2 = body.data.some((item) => item.id === clinic2ConsultationId);
      expect(foundClinic2).toBe(false);
    });

    it('orders results by encounterDate descending with deterministic secondary sort by id descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations?limit=50')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const items = (res.body as { data: Array<{ id: string; encounterDate: string }> }).data;

      // Verify encounterDate descending order
      for (let i = 0; i < items.length - 1; i++) {
        const d1 = new Date(items[i].encounterDate).getTime();
        const d2 = new Date(items[i + 1].encounterDate).getTime();
        expect(d1).toBeGreaterThanOrEqual(d2);

        // When encounterDates are equal, verify id is secondary sort descending
        if (d1 === d2) {
          expect(items[i].id.localeCompare(items[i + 1].id)).toBeGreaterThan(0);
        }
      }
    });

    it('supports status filter to return only DRAFT consultations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations?status=DRAFT')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as { data: ConsultationResponse[] };
      expect(body.data.length).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.status).toBe(ConsultationStatus.DRAFT);
      }
      expect(body.data.some((item) => item.id === listTestConsultation3FinalizedId)).toBe(false);
    });

    it('supports status filter to return only FINALIZED consultations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations?status=FINALIZED')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as { data: ConsultationResponse[] };
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      for (const item of body.data) {
        expect(item.status).toBe(ConsultationStatus.FINALIZED);
      }
      expect(body.data.some((item) => item.id === listTestConsultation3FinalizedId)).toBe(true);
    });

    it('supports patientId filter to return consultations for specific patient', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations?patientId=${patient1Id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as { data: ConsultationResponse[] };
      expect(body.data.length).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.patientId).toBe(patient1Id);
      }
    });

    it('returns empty result set when filter matches no records', async () => {
      const unusedPatientId = crypto.randomUUID();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations?patientId=${unusedPatientId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: ConsultationResponse[];
        items: ConsultationResponse[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      };
      expect(body.data).toEqual([]);
      expect(body.items).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.totalPages).toBe(1);
    });

    it('rejects invalid pagination parameters with 400 Bad Request', async () => {
      const resNegativePage = await request(app.getHttpServer())
        .get('/api/v1/consultations?page=0')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(resNegativePage.status).toBe(400);

      const resExcessiveLimit = await request(app.getHttpServer())
        .get('/api/v1/consultations?limit=51')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(resExcessiveLimit.status).toBe(400);

      const resStringPage = await request(app.getHttpServer())
        .get('/api/v1/consultations?page=abc')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);
      expect(resStringPage.status).toBe(400);
    });

    it('rejects invalid status filter with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations?status=INVALID_STATUS')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });

    it('rejects invalid patientId non-UUID filter with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations?patientId=not-a-uuid')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });

    it('rejects client-supplied untrusted clinicId query parameter (400)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations?clinicId=${clinic1Id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });

    it('RECEPTIONIST role is denied access to listing endpoint (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });

    it('Unauthenticated request is rejected (401)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations')
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/consultations/:id (Consultation Details)', () => {
    let detailDraftId: string;

    beforeAll(async () => {
      const c = await prisma.consultation.create({
        data: {
          clinicId: clinic1Id,
          patientId: patient1Id,
          clinicianId: doctorUserId,
          encounterDate: new Date('2026-10-26T15:00:00.000Z'),
          status: ConsultationStatus.DRAFT,
          chiefComplaint: 'Detail view test complaint',
          symptoms: 'Mild dizziness',
          examination: 'BP normal, clear chest',
          diagnosis: 'Dehydration',
          treatmentPlan: 'Oral rehydration',
          bpSystolic: 118,
          bpDiastolic: 76,
          pulse: 74,
          temperature: new Prisma.Decimal(98.6),
          weightKg: new Prisma.Decimal(70.0),
          heightCm: new Prisma.Decimal(175.0),
          spo2: 98,
          respiratoryRate: 16,
        },
      });
      detailDraftId = c.id;
      createdConsultationIds.push(c.id);
    });

    it('DOCTOR successfully retrieves consultation details and patient context (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations/${detailDraftId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as ConsultationResponse & {
        patient: { id: string; fullName: string; uhid: string; gender: string; phone: string };
      };

      expect(body.id).toBe(detailDraftId);
      expect(body.clinicId).toBe(clinic1Id);
      expect(body.clinicianId).toBe(doctorUserId);
      expect(body.patientId).toBe(patient1Id);
      expect(body.chiefComplaint).toBe('Detail view test complaint');
      expect(body.symptoms).toBe('Mild dizziness');
      expect(body.diagnosis).toBe('Dehydration');
      expect(body.bpSystolic).toBe(118);
      expect(body.bpDiastolic).toBe(76);
      expect(Number(body.temperature)).toBe(98.6);

      // Verify patient context is loaded
      expect(body.patient).toBeDefined();
      expect(body.patient.id).toBe(patient1Id);
      expect(body.patient.fullName).toBe('Patient Alpha');
      expect(body.patient.uhid).toBe('UHID-800001');
      expect(body.patient.phone).toBe('+919811111111');
    });

    it('rejects malformed UUID parameter with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/consultations/not-a-valid-uuid')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });

    it('returns 404 Not Found for non-existent consultation ID', async () => {
      const fakeId = crypto.randomUUID();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations/${fakeId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Consultation not found');
    });

    it('cross-clinic access returns 404 Not Found without leaking existence', async () => {
      // Clinic 2 doctor attempts to access Clinic 1 consultation using Clinic 2 active context
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations/${detailDraftId}`)
        .set('Authorization', `Bearer ${clinic2DoctorToken}`)
        .set('x-clinic-id', clinic2Id);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Consultation not found');
    });

    it('RECEPTIONIST role is denied access to details endpoint (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations/${detailDraftId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });

    it('Unauthenticated request is rejected (401)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/consultations/${detailDraftId}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/patients/:patientId/consultations (Patient History)', () => {
    let historyPatientId: string;
    let historyConsultation1Id: string;
    let historyConsultation2Id: string;

    beforeAll(async () => {
      // Create dedicated patient for history testing
      const p = await prisma.patient.create({
        data: {
          clinicId: clinic1Id,
          uhid: 'UHID-800099',
          fullName: 'History Test Patient',
          gender: Gender.MALE,
          phone: '+919899999999',
          deletedAt: null,
        },
      });
      historyPatientId = p.id;

      // Create 2 consultations for this patient
      const c1 = await prisma.consultation.create({
        data: {
          clinicId: clinic1Id,
          patientId: historyPatientId,
          clinicianId: doctorUserId,
          encounterDate: new Date('2026-10-20T10:00:00.000Z'),
          status: ConsultationStatus.FINALIZED,
          finalizedAt: new Date('2026-10-20T10:30:00.000Z'),
          chiefComplaint: 'First historical visit',
        },
      });
      historyConsultation1Id = c1.id;
      createdConsultationIds.push(c1.id);

      const c2 = await prisma.consultation.create({
        data: {
          clinicId: clinic1Id,
          patientId: historyPatientId,
          clinicianId: doctorUserId,
          encounterDate: new Date('2026-10-26T11:00:00.000Z'),
          status: ConsultationStatus.DRAFT,
          chiefComplaint: 'Second recent visit',
        },
      });
      historyConsultation2Id = c2.id;
      createdConsultationIds.push(c2.id);
    });

    it('retrieves patient consultation history in newest-first order with pagination (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${historyPatientId}/consultations`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: ConsultationResponse[];
        items: ConsultationResponse[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      };

      expect(body.data).toBeDefined();
      expect(body.items).toBeDefined();
      expect(body.data.length).toBe(2);
      expect(body.meta.total).toBe(2);

      // Verify newest-first order: c2 (Oct 26) comes before c1 (Oct 20)
      expect(body.data[0].id).toBe(historyConsultation2Id);
      expect(body.data[1].id).toBe(historyConsultation1Id);
      expect(body.data[0].chiefComplaint).toBe('Second recent visit');
      expect(body.data[1].chiefComplaint).toBe('First historical visit');
    });

    it('RECEPTIONIST role is denied access to patient consultation history (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${historyPatientId}/consultations`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });

    it('ADMIN role is denied access to patient consultation history (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${historyPatientId}/consultations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(403);
    });

    it('supports status filter on patient history (e.g. status=FINALIZED)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${historyPatientId}/consultations?status=FINALIZED`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(200);
      const body = res.body as { data: ConsultationResponse[] };
      expect(body.data.length).toBe(1);
      expect(body.data[0].id).toBe(historyConsultation1Id);
      expect(body.data[0].status).toBe(ConsultationStatus.FINALIZED);
    });

    it('rejects malformed patientId with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients/not-a-valid-uuid/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(400);
    });

    it('returns 404 Not Found for non-existent patientId', async () => {
      const fakePatientId = crypto.randomUUID();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${fakePatientId}/consultations`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Patient not found');
    });

    it('returns 404 Not Found for soft-deleted patient', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${softDeletedPatientId}/consultations`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Patient not found');
    });

    it('returns 404 Not Found when patient belongs to another clinic (tenant isolation)', async () => {
      // patient2Id belongs to clinic2, querying from clinic1
      const res = await request(app.getHttpServer())
        .get(`/api/v1/patients/${patient2Id}/consultations`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toContain('Patient not found');
    });

    it('verifies that read endpoints do not mutate database records', async () => {
      const beforeRecord = await prisma.consultation.findUnique({
        where: { id: historyConsultation1Id },
      });

      // Execute GET endpoints
      await request(app.getHttpServer())
        .get(`/api/v1/consultations/${historyConsultation1Id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      await request(app.getHttpServer())
        .get(`/api/v1/patients/${historyPatientId}/consultations`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id);

      const afterRecord = await prisma.consultation.findUnique({
        where: { id: historyConsultation1Id },
      });

      expect(afterRecord?.updatedAt.getTime()).toBe(beforeRecord?.updatedAt.getTime());
      expect(afterRecord?.status).toBe(beforeRecord?.status);
      expect(afterRecord?.chiefComplaint).toBe(beforeRecord?.chiefComplaint);
    });
  });
});

