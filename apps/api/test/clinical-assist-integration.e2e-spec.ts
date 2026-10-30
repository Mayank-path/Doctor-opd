/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClinicRole, Gender, MembershipStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import {
  SPEECH_TO_TEXT_PROVIDER,
  SpeechToTextProvider,
} from '../src/clinical-assist/interfaces/speech-to-text-provider.interface';

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
process.env.JWT_SECRET = 'stt-integration-test-secret-at-least-32-chars';
process.env.JWT_ISSUER = 'doctor-opd-api';
process.env.JWT_AUDIENCE = 'doctor-opd-client';
process.env.JWT_EXPIRES_IN = '1h';

// Mock STT Provider implementation
const mockSttProvider: SpeechToTextProvider = {
  providerName: 'openai',
  defaultModel: 'gpt-4o-transcribe',
  transcribe: jest
    .fn()
    .mockImplementation(async (_buf, _filename, _mime, options) => {
      return {
        transcript: 'Mareez ko teen din se bukhar hai aur gale me dard hai.',
        languageHint: options.languageHint ?? null,
        detectedLanguage: 'hi',
        durationSeconds: 4.5,
        provider: 'openai',
        model: 'gpt-4o-transcribe',
      };
    }),
};

describe('Clinical Assist STT API (PostgreSQL Integration)', () => {
  jest.setTimeout(45000);

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Track created fixtures for teardown
  const createdClinicIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];

  // Clinic identifiers
  const clinic1Id = crypto.randomUUID();
  const clinic2Id = crypto.randomUUID();

  // User identifiers
  const doctorUserId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();

  // Patient identifiers
  const patient1Id = crypto.randomUUID();
  const patient2Clinic2Id = crypto.randomUUID();

  // Tokens
  let doctorToken: string;
  let adminToken: string;

  // Helper to generate a minimal valid WAV buffer
  const createValidWavBuffer = (): Buffer => {
    const buf = Buffer.alloc(44);
    buf.write('RIFF', 0, 'ascii');
    buf.writeUInt32LE(36, 4);
    buf.write('WAVE', 8, 'ascii');
    buf.write('fmt ', 12, 'ascii');
    return buf;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SPEECH_TO_TEXT_PROVIDER)
      .useValue(mockSttProvider)
      .compile();

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

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

    // 1. Seed Clinics
    await prisma.clinic.create({
      data: {
        id: clinic1Id,
        name: 'STT Clinic 1',
        slug: `stt-clinic-1-${Date.now()}`,
      },
    });
    createdClinicIds.push(clinic1Id);

    await prisma.clinic.create({
      data: {
        id: clinic2Id,
        name: 'STT Clinic 2',
        slug: `stt-clinic-2-${Date.now()}`,
      },
    });
    createdClinicIds.push(clinic2Id);

    // 2. Seed Users
    await prisma.user.create({
      data: {
        id: doctorUserId,
        phone: `+91981${Math.floor(1000000 + Math.random() * 9000000)}`,
        fullName: 'Dr. Speech Tester',
        email: `doc-stt-${Date.now()}@test.com`,
        passwordHash: 'dummy-hash',
        isActive: true,
      },
    });
    createdUserIds.push(doctorUserId);

    await prisma.user.create({
      data: {
        id: adminUserId,
        phone: `+91982${Math.floor(1000000 + Math.random() * 9000000)}`,
        fullName: 'Admin NonDoctor Tester',
        email: `admin-stt-${Date.now()}@test.com`,
        passwordHash: 'dummy-hash',
        isActive: true,
      },
    });
    createdUserIds.push(adminUserId);

    // 3. Seed Memberships
    await prisma.clinicMembership.create({
      data: {
        userId: doctorUserId,
        clinicId: clinic1Id,
        role: ClinicRole.DOCTOR,
        status: MembershipStatus.ACTIVE,
      },
    });

    await prisma.clinicMembership.create({
      data: {
        userId: adminUserId,
        clinicId: clinic1Id,
        role: ClinicRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    // 4. Seed Patients
    await prisma.patient.create({
      data: {
        id: patient1Id,
        clinicId: clinic1Id,
        uhid: `STT-${Date.now().toString().slice(-6)}`,
        fullName: 'Ramesh Kumar',
        gender: Gender.MALE,
        phone: '+919876543210',
      },
    });
    createdPatientIds.push(patient1Id);

    await prisma.patient.create({
      data: {
        id: patient2Clinic2Id,
        clinicId: clinic2Id,
        uhid: `STT2-${Date.now().toString().slice(-6)}`,
        fullName: 'Other Clinic Patient',
        gender: Gender.FEMALE,
        phone: '+919876543211',
      },
    });
    createdPatientIds.push(patient2Clinic2Id);

    // 5. Generate Auth Tokens
    doctorToken = await authService.signToken(doctorUserId, '+919810000000');
    adminToken = await authService.signToken(adminUserId, '+919820000000');
  });

  afterAll(async () => {
    // Teardown audit events safely if table exists
    try {
      await prisma.clinicalAuditEvent.deleteMany({
        where: {
          clinicId: { in: createdClinicIds },
        },
      });
    } catch {
      // Ignore if table does not exist in doctor_opd_test
    }

    // Teardown patients
    await prisma.patient.deleteMany({
      where: {
        id: { in: createdPatientIds },
      },
    });

    // Teardown memberships
    await prisma.clinicMembership.deleteMany({
      where: {
        clinicId: { in: createdClinicIds },
      },
    });

    // Teardown users
    await prisma.user.deleteMany({
      where: {
        id: { in: createdUserIds },
      },
    });

    // Teardown clinics
    await prisma.clinic.deleteMany({
      where: {
        id: { in: createdClinicIds },
      },
    });

    await app.close();
  });

  it('allows an authorized DOCTOR to transcribe audio with verified consent', async () => {
    const wavAudio = createValidWavBuffer();

    const response = await request(app.getHttpServer())
      .post('/api/v1/clinical-assist/transcribe')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinic1Id)
      .attach('audio', wavAudio, 'patient_voice.wav')
      .field('patientId', patient1Id)
      .field('patientConsentVerified', 'true')
      .field('languageHint', 'hi-IN');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toEqual(
      expect.objectContaining({
        transcript: 'Mareez ko teen din se bukhar hai aur gale me dard hai.',
        languageHint: 'hi-IN',
        detectedLanguage: 'hi',
        durationSeconds: 4.5,
        provider: 'openai',
        model: 'gpt-4o-transcribe',
      }),
    );
  });

  it('rejects unauthenticated requests with 401', async () => {
    const wavAudio = createValidWavBuffer();

    const response = await request(app.getHttpServer())
      .post('/api/v1/clinical-assist/transcribe')
      .set('x-clinic-id', clinic1Id)
      .attach('audio', wavAudio, 'test.wav')
      .field('patientId', patient1Id)
      .field('patientConsentVerified', 'true');

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('rejects non-doctor roles (ADMIN) with 403 Forbidden', async () => {
    const wavAudio = createValidWavBuffer();

    const response = await request(app.getHttpServer())
      .post('/api/v1/clinical-assist/transcribe')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinic1Id)
      .attach('audio', wavAudio, 'test.wav')
      .field('patientId', patient1Id)
      .field('patientConsentVerified', 'true');

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('rejects cross-clinic patient IDs with 404 Not Found', async () => {
    const wavAudio = createValidWavBuffer();

    const response = await request(app.getHttpServer())
      .post('/api/v1/clinical-assist/transcribe')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinic1Id)
      .attach('audio', wavAudio, 'test.wav')
      .field('patientId', patient2Clinic2Id) // Patient belongs to clinic2, not clinic1
      .field('patientConsentVerified', 'true');

    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  });

  it('rejects missing or false patient consent with 400 Bad Request', async () => {
    const wavAudio = createValidWavBuffer();

    const response = await request(app.getHttpServer())
      .post('/api/v1/clinical-assist/transcribe')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinic1Id)
      .attach('audio', wavAudio, 'test.wav')
      .field('patientId', patient1Id)
      .field('patientConsentVerified', 'false');

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('rejects unsupported audio formats with 415 Unsupported Media Type', async () => {
    const fakeAudio = Buffer.from('Plain text file content, not audio at all');

    const response = await request(app.getHttpServer())
      .post('/api/v1/clinical-assist/transcribe')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinic1Id)
      .attach('audio', fakeAudio, 'fake.wav')
      .field('patientId', patient1Id)
      .field('patientConsentVerified', 'true');

    expect(response.status).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  });

  it('rejects missing audio file with 400 Bad Request', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/clinical-assist/transcribe')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinic1Id)
      .field('patientId', patient1Id)
      .field('patientConsentVerified', 'true');

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
  });

  describe('Clinical Text Normalization Endpoint (POST /api/v1/clinical-assist/normalize)', () => {
    it('successfully normalizes Hinglish clinical text for an authorized doctor', async () => {
      const input =
        'Mareez ko teen din se bukhar hai aur halka headache hai. Khansi nahi hai.';

      const response = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/normalize')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ text: input });

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toBeDefined();
      expect(response.body.originalText).toBe(input);
      expect(response.body.language).toBe('HINGLISH');
      expect(response.body.requiresDoctorReview).toBe(true);
      expect(Array.isArray(response.body.symptoms)).toBe(true);
      expect(response.body.symptoms.length).toBe(3);

      const fever = response.body.symptoms.find(
        (s: { canonicalTerm: string }) => s.canonicalTerm === 'Fever',
      );
      const headache = response.body.symptoms.find(
        (s: { canonicalTerm: string }) => s.canonicalTerm === 'Headache',
      );
      const cough = response.body.symptoms.find(
        (s: { canonicalTerm: string }) => s.canonicalTerm === 'Cough',
      );

      expect(fever).toBeDefined();
      expect(fever.polarity).toBe('POSITIVE');
      expect(fever.duration).toEqual({
        raw: 'teen din se',
        value: 3,
        unit: 'DAYS',
      });

      expect(headache).toBeDefined();
      expect(headache.polarity).toBe('POSITIVE');
      expect(headache.severity).toBe('MILD');

      expect(cough).toBeDefined();
      expect(cough.polarity).toBe('NEGATIVE');
    });

    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/normalize')
        .set('x-clinic-id', clinic1Id)
        .send({ text: 'Patient has fever' });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rejects non-doctor role (e.g. ADMIN) with 403 Forbidden', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/normalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ text: 'Patient has fever' });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rejects empty or whitespace string with 400 Bad Request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/normalize')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ text: '   ' });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rejects text exceeding 5000 characters with 400 Bad Request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/normalize')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinic1Id)
        .send({ text: 'a'.repeat(5001) });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });
});
