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
  PrescriptionStatus,
  DosageForm,
  MedicationRoute,
  MedicationTiming,
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

describe('Cross-Module End-to-End Clinical Lifecycle (PostgreSQL Integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Track fixture IDs for clean teardown
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  const createdConsultationIds: string[] = [];
  const createdPrescriptionIds: string[] = [];

  const clinicId = crypto.randomUUID();
  const otherClinicId = crypto.randomUUID();
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
    app.setGlobalPrefix('api/v1');
    app.use(json({ limit: '1mb' }));
    app.use(urlencoded({ extended: true, limit: '1mb' }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    prisma = moduleRef.get(PrismaService);
    authService = moduleRef.get(AuthService);

    // -------------------------------------------------------------------------
    // Seed Multi-Tenant Clinics & Users
    // -------------------------------------------------------------------------
    await prisma.clinic.create({
      data: {
        id: clinicId,
        name: 'Apex Healthcare Master Clinic',
        address: '100 Medical Center Way',
        phone: '+911122334455',
      },
    });
    createdClinicIds.push(clinicId);

    await prisma.clinic.create({
      data: {
        id: otherClinicId,
        name: 'Isolated Other Clinic',
        address: '200 Other Street',
        phone: '+911122334499',
      },
    });
    createdClinicIds.push(otherClinicId);

    // Create Doctor User & Active Membership
    await prisma.user.create({
      data: {
        id: doctorUserId,
        phone: doctorPhone,
        fullName: 'Dr. Vikram Malhotra',
      },
    });
    createdUserIds.push(doctorUserId);

    await prisma.clinicMembership.create({
      data: {
        userId: doctorUserId,
        clinicId,
        role: ClinicRole.DOCTOR,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Create Second Doctor User (in same clinic)
    await prisma.user.create({
      data: {
        id: otherDoctorUserId,
        phone: otherDoctorPhone,
        fullName: 'Dr. Sunita Sharma',
      },
    });
    createdUserIds.push(otherDoctorUserId);

    await prisma.clinicMembership.create({
      data: {
        userId: otherDoctorUserId,
        clinicId,
        role: ClinicRole.DOCTOR,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Create Receptionist User & Active Membership
    await prisma.user.create({
      data: {
        id: receptionistUserId,
        phone: receptionistPhone,
        fullName: 'Pooja Verma',
      },
    });
    createdUserIds.push(receptionistUserId);

    await prisma.clinicMembership.create({
      data: {
        userId: receptionistUserId,
        clinicId,
        role: ClinicRole.RECEPTIONIST,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Generate JWT Tokens
    doctorToken = await authService.signToken(doctorUserId, doctorPhone);
    otherDoctorToken = await authService.signToken(otherDoctorUserId, otherDoctorPhone);
    receptionistToken = await authService.signToken(receptionistUserId, receptionistPhone);
  });

  afterAll(async () => {
    // -------------------------------------------------------------------------
    // Robust Teardown in Dependency Order
    // -------------------------------------------------------------------------
    if (prisma) {
      if (createdPrescriptionIds.length > 0) {
        await prisma.prescriptionItem.deleteMany({
          where: { prescriptionId: { in: createdPrescriptionIds } },
        });
        await prisma.prescription.deleteMany({
          where: { id: { in: createdPrescriptionIds } },
        });
      }

      if (createdConsultationIds.length > 0) {
        await prisma.consultation.deleteMany({
          where: { id: { in: createdConsultationIds } },
        });
      }

      if (createdPatientIds.length > 0) {
        await prisma.patient.deleteMany({
          where: { id: { in: createdPatientIds } },
        });
        await prisma.patientUhidCounter.deleteMany({
          where: { clinicId: { in: createdClinicIds } },
        });
      }

      if (createdClinicIds.length > 0) {
        await prisma.clinicMembership.deleteMany({
          where: { clinicId: { in: createdClinicIds } },
        });
        await prisma.clinic.deleteMany({
          where: { id: { in: createdClinicIds } },
        });
      }

      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    }

    if (app) {
      await app.close();
    }
  });

  describe('Master 6-Step Clinical Lifecycle Workflow', () => {
    let patientId: string;
    let consultationId: string;
    let prescriptionId: string;

    it('Step 1: Create an active patient with generated UHID', async () => {
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

    it('Step 2: Create a direct clinical consultation draft for assigned doctor', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId,
          chiefComplaint: 'Severe dry cough with throat pain for 3 days',
          symptoms: 'High fever, sore throat, chills, malaise',
          bpSystolic: 120,
          bpDiastolic: 80,
          pulse: 78,
          temperature: 101.2,
          weightKg: 72.5,
          heightCm: 175.0,
          spo2: 98,
          respiratoryRate: 18,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(ConsultationStatus.DRAFT);
      expect(res.body.clinicianId).toBe(doctorUserId);
      expect(res.body.patientId).toBe(patientId);
      consultationId = res.body.id;
      createdConsultationIds.push(consultationId);
    });

    it('Step 3: Update consultation draft with physical examination & clinical diagnosis', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${consultationId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          examination: 'Pharyngeal erythema with tonsillar pillar congestion. Chest clear to auscultation.',
          diagnosis: 'Acute Streptococcal Pharyngitis',
          treatmentPlan: 'Antibiotic therapy, warm saline gargles, hydration, antipyretic PRN.',
          followUpDate: '2026-12-05',
        })
        .expect(200);

      expect(res.body.diagnosis).toBe('Acute Streptococcal Pharyngitis');
      expect(res.body.treatmentPlan).toContain('Antibiotic therapy');
      expect(res.body.examination).toContain('Pharyngeal erythema');
      expect(res.body.status).toBe(ConsultationStatus.DRAFT);
    });

    it('Step 4: Create a draft prescription linked to the consultation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId,
          consultationId,
          notes: 'Take medications strictly after meals',
          items: [
            {
              medicationName: 'Amoxicillin-Clavulanate 625mg',
              dosageForm: DosageForm.TABLET,
              strength: '625mg',
              route: MedicationRoute.ORAL,
              frequency: '1-0-1',
              timing: MedicationTiming.AFTER_MEALS,
              durationValue: 5,
              durationUnit: 'DAYS',
              specialInstructions: 'Complete full course even if symptoms subside',
            },
            {
              medicationName: 'Paracetamol 650mg',
              dosageForm: DosageForm.TABLET,
              strength: '650mg',
              route: MedicationRoute.ORAL,
              frequency: '1-0-1',
              timing: MedicationTiming.AFTER_MEALS,
              durationValue: 3,
              durationUnit: 'DAYS',
              specialInstructions: 'Take SOS for fever > 100 F',
            },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(PrescriptionStatus.DRAFT);
      expect(res.body.patientId).toBe(patientId);
      expect(res.body.consultationId).toBe(consultationId);
      expect(res.body.items).toHaveLength(2);
      prescriptionId = res.body.id;
      createdPrescriptionIds.push(prescriptionId);
    });

    it('Step 5: Review and approve the prescription', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${prescriptionId}/approve`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          confirmApproval: true,
          doctorNotes: 'Prescription verified with patient history.',
        })
        .expect(200);

      expect(res.body.status).toBe(PrescriptionStatus.APPROVED);
      expect(res.body.approvedAt).toBeDefined();
    });

    it('Step 6: Finalize the clinical consultation', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/consultations/${consultationId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      expect(res.body.status).toBe(ConsultationStatus.FINALIZED);
      expect(res.body.finalizedAt).toBeDefined();
    });

    it('Step 7: Verify final consultation state, prescription link, and immutability', async () => {
      // 1. Verify finalized consultation
      const consultRes = await request(app.getHttpServer())
        .get(`/api/v1/consultations/${consultationId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      expect(consultRes.body.status).toBe(ConsultationStatus.FINALIZED);
      expect(consultRes.body.diagnosis).toBe('Acute Streptococcal Pharyngitis');

      // Verify prescription link and status
      const rxRes = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${prescriptionId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(200);

      expect(rxRes.body.id).toBe(prescriptionId);
      expect(rxRes.body.consultationId).toBe(consultationId);
      expect(rxRes.body.status).toBe(PrescriptionStatus.APPROVED);

      // 2. Reject editing finalized consultation
      await request(app.getHttpServer())
        .patch(`/api/v1/consultations/${consultationId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ diagnosis: 'Attempted Post-Finalization Edit' })
        .expect(409);

      // 3. Reject re-finalizing already finalized consultation
      await request(app.getHttpServer())
        .post(`/api/v1/consultations/${consultationId}/finalize`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(409);
    });
  });

  describe('Multi-Tenant Isolation & Role-Based Access Control (RBAC) Safety', () => {
    let rbacPatientId: string;
    let rbacConsultationId: string;

    beforeAll(async () => {
      const patRes = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          fullName: 'Priya Sharma',
          gender: Gender.FEMALE,
          phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        })
        .expect(201);

      rbacPatientId = patRes.body.id;
      createdPatientIds.push(rbacPatientId);

      const consultRes = await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: rbacPatientId,
          chiefComplaint: 'Migraine headache with aura',
        })
        .expect(201);

      rbacConsultationId = consultRes.body.id;
      createdConsultationIds.push(rbacConsultationId);
    });

    it('rejects consultation creation by non-doctor role (RECEPTIONIST)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/consultations')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: rbacPatientId,
          chiefComplaint: 'Unauthorized creation attempt',
        })
        .expect(403);
    });

    it('rejects prescription creation by non-doctor role (RECEPTIONIST)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          patientId: rbacPatientId,
          items: [
            {
              medicationName: 'Unauthorized Drug',
              dosageForm: DosageForm.TABLET,
              dosageStrength: '10mg',
              route: MedicationRoute.ORAL,
              frequency: '1-0-1',
              timing: MedicationTiming.AFTER_MEALS,
              durationDays: 1,
              quantity: 1,
            },
          ],
        })
        .expect(403);
    });

    it('rejects consultation finalization by non-assigned clinician', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/consultations/${rbacConsultationId}/finalize`)
        .set('Authorization', `Bearer ${otherDoctorToken}`)
        .set('x-clinic-id', clinicId)
        .expect(403);
    });

    it('enforces tenant isolation: rejects access when x-clinic-id does not match caller membership', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/consultations/${rbacConsultationId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', otherClinicId)
        .expect(403);
    });
  });
});
