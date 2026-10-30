/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import * as crypto from 'crypto';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import {
  SPEECH_TO_TEXT_PROVIDER,
  SpeechToTextProvider,
} from '../src/clinical-assist/interfaces/speech-to-text-provider.interface';
import {
  ClinicalFindingStatus,
  SeverityAssessmentState,
} from '../src/clinical-assist/extraction/clinical-extraction.types';

// Mock STT Provider to avoid any external network calls
const mockSttProvider: SpeechToTextProvider = {
  providerName: 'openai',
  defaultModel: 'gpt-4o-transcribe',
  transcribe: jest.fn().mockResolvedValue({
    transcript: 'Mareez ko 3 din se bukhar hai',
    languageHint: null,
    detectedLanguage: 'hi',
    durationSeconds: 3.0,
    provider: 'openai',
    model: 'gpt-4o-transcribe',
  }),
};

describe('Clinical Extraction API (E2E Integration & Security)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  // Test identities
  const clinicId = crypto.randomUUID();
  const otherClinicId = crypto.randomUUID();
  const doctorUserId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();

  let doctorToken: string;
  let staffToken: string;

  beforeAll(async () => {
    // Set required test env vars
    process.env.JWT_SECRET = 'extraction-e2e-test-secret-at-least-32-chars';
    process.env.JWT_ISSUER = 'doctor-opd-api';
    process.env.JWT_AUDIENCE = 'doctor-opd-client';
    process.env.JWT_EXPIRES_IN = '1h';

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

    // Mock Prisma user lookups for JWT validation
    jest
      .spyOn(prisma.user, 'findUnique')
      .mockImplementation(async (args: any) => {
        const id = args.where.id;
        if (id === doctorUserId) {
          return {
            id: doctorUserId,
            fullName: 'Dr. Extraction Tester',
            email: 'doctor@extraction-test.com',
            phone: '+919876543210',
            isActive: true,
          } as any;
        }
        if (id === staffUserId) {
          return {
            id: staffUserId,
            fullName: 'Staff Tester',
            email: 'staff@extraction-test.com',
            phone: '+919876543211',
            isActive: true,
          } as any;
        }
        return null;
      });

    // Mock Prisma clinic membership lookups for ClinicAuthGuard
    jest
      .spyOn(prisma.clinicMembership, 'findUnique')
      .mockImplementation(async (args: any) => {
        const { userId, clinicId: targetClinicId } = args.where.userId_clinicId;

        if (targetClinicId !== clinicId) {
          return null; // Cross-tenant: user not a member of other clinic
        }

        if (userId === doctorUserId) {
          return {
            id: 'mem-doctor-1',
            userId: doctorUserId,
            clinicId,
            role: ClinicRole.DOCTOR,
            status: MembershipStatus.ACTIVE,
          } as any;
        }

        if (userId === staffUserId) {
          return {
            id: 'mem-staff-1',
            userId: staffUserId,
            clinicId,
            role: ClinicRole.STAFF,
            status: MembershipStatus.ACTIVE,
          } as any;
        }

        return null;
      });

    // Generate real cryptographically signed JWT tokens
    doctorToken = await authService.signToken(doctorUserId, '+919876543210');
    staffToken = await authService.signToken(staffUserId, '+919876543211');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Authentication & Tenant Authorization', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('x-clinic-id', clinicId)
        .send({ text: 'Mareez ko bukhar hai' });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject malformed Bearer token with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .set('x-clinic-id', clinicId)
        .send({ text: 'Mareez ko bukhar hai' });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject request missing x-clinic-id header with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ text: 'Mareez ko bukhar hai' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject request when user is not a member of the clinic with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', otherClinicId)
        .send({ text: 'Mareez ko bukhar hai' });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should reject request from non-doctor role (STAFF) with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text: 'Mareez ko bukhar hai' });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('2. Ingress Validation & Safety Controls', () => {
    it('should reject empty or whitespace text with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text: '   ' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject text exceeding 5000 characters with 400 Bad Request', async () => {
      const hugeText = 'a'.repeat(5001);
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text: hugeText });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject text containing prohibited ASCII C0 control characters (\\u0000) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text: 'Mareez ko \u0000 bukhar hai' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject text containing prohibited BiDi override characters (\\u202E) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text: 'Mareez ko \u202E bukhar hai' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject non-whitelisted request payload fields with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text: 'Mareez ko bukhar hai', extraField: 'illegal' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('3. Successful Extraction & Clinical Semantics', () => {
    it('should extract structured clinical findings from Hinglish consultation text with 200 OK', async () => {
      const text = 'Mareez ko 3 din se tez bukhar hai, khansi nahi hai.';
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.schemaVersion).toBe('1.0.0');
      expect(res.body.extractionEngineVersion).toBe('1.0.0');
      expect(res.body.source.characterCount).toBe(text.length);

      // Verify findings
      expect(res.body.findings).toHaveLength(2);

      const fever = res.body.findings.find(
        (f: any) => f.canonicalDisplayName === 'Fever',
      );
      expect(fever).toBeDefined();
      expect(fever.status).toBe(ClinicalFindingStatus.PRESENT);
      expect(fever.severityAssessment.state).toBe(
        SeverityAssessmentState.ASSESSED,
      );
      expect(fever.severityAssessment.level).toBe('SEVERE');
      expect(fever.temporalStatements[0].duration).toEqual(
        expect.objectContaining({ value: 3, unit: 'DAYS' }),
      );

      const cough = res.body.findings.find(
        (f: any) => f.canonicalDisplayName === 'Cough',
      );
      expect(cough).toBeDefined();
      expect(cough.status).toBe(ClinicalFindingStatus.ABSENT);

      // Summary counts
      expect(res.body.summaryCounts).toEqual({
        totalFindings: 2,
        presentCount: 1,
        absentCount: 1,
        uncertainCount: 0,
        unknownCount: 0,
        unmappedCount: 0,
        clinicalAssessmentsCount: 0,
      });

      // Strict evidence offset invariant
      for (const finding of res.body.findings) {
        for (const prov of finding.provenance) {
          if (prov.evidence.startIndex !== null) {
            expect(
              text.slice(prov.evidence.startIndex, prov.evidence.endIndex),
            ).toBe(prov.evidence.text);
          }
        }
      }
    });

    it('should extract unperformed clinical examination into clinicalAssessments without creating symptoms', async () => {
      const text = 'Chest examination not performed, patient has cough.';
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text });

      expect(res.status).toBe(HttpStatus.OK);

      // Clinical assessment record exists
      expect(res.body.clinicalAssessments).toHaveLength(1);
      const exam = res.body.clinicalAssessments[0];
      expect(exam.status).toBe('NOT_ASSESSED');
      expect(exam.assessmentScope).toBe('SYSTEM_EXAMINATION');
      expect(exam.targetSystemOrExam).toBe('Respiratory / Chest Examination');
      expect(exam.evidence.text).toBe('Chest examination not performed');
      expect(text.slice(exam.evidence.startIndex, exam.evidence.endIndex)).toBe(
        'Chest examination not performed',
      );

      // Only cough should be in findings, NOT chest examination
      expect(res.body.findings).toHaveLength(1);
      expect(res.body.findings[0].canonicalDisplayName).toBe('Cough');
    });

    it('should extract temporal episodes and chronological relationships for fever resurgence', async () => {
      const text = 'Fever tha kal, subah kam ho gaya, shaam ko phir aa gaya.';
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.findings).toHaveLength(1);

      const fever = res.body.findings[0];
      expect(fever.temporalStatements).toHaveLength(3);
      expect(fever.chronologicalRelationships).toHaveLength(2);

      // Relationship 1: kal -> subah is IMPROVED
      expect(fever.chronologicalRelationships[0].transitionType).toBe(
        'IMPROVED',
      );

      // Relationship 2: subah -> shaam is AMBIGUOUS
      expect(fever.chronologicalRelationships[1].transitionType).toBe(
        'AMBIGUOUS',
      );
      expect(fever.chronologicalRelationships[1].confidence).toBe('AMBIGUOUS');
    });

    it('should quarantine chills as SUBJECTIVE_SENSATION without creating Fever finding', async () => {
      const text = 'Mareez ko bukhar nahi hai par chills hai.';
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text });

      expect(res.status).toBe(HttpStatus.OK);

      // Fever is ABSENT
      const fever = res.body.findings.find(
        (f: any) => f.canonicalDisplayName === 'Fever',
      );
      expect(fever).toBeDefined();
      expect(fever.status).toBe(ClinicalFindingStatus.ABSENT);

      // Chills is in unmappedExpressions as SUBJECTIVE_SENSATION
      const chills = res.body.unmappedExpressions.find(
        (u: any) => u.category === 'SUBJECTIVE_SENSATION',
      );
      expect(chills).toBeDefined();
      expect(chills.expression.toLowerCase()).toContain('chills');
    });
  });

  describe('4. Database Statelessness Guarantee', () => {
    it('should verify zero database mutations or audit event inserts occur during extraction', async () => {
      const consultCreateSpy = jest.spyOn(prisma.consultation, 'create');
      const consultUpdateSpy = jest.spyOn(prisma.consultation, 'update');
      const auditCreateSpy = jest.spyOn(prisma.clinicalAuditEvent, 'create');
      const patientUpdateSpy = jest.spyOn(prisma.patient, 'update');

      const text = 'Mareez ko 3 din se bukhar hai.';
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/extract-structured')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', clinicId)
        .send({ text });

      expect(res.status).toBe(HttpStatus.OK);
      expect(consultCreateSpy).not.toHaveBeenCalled();
      expect(consultUpdateSpy).not.toHaveBeenCalled();
      expect(auditCreateSpy).not.toHaveBeenCalled();
      expect(patientUpdateSpy).not.toHaveBeenCalled();
    });
  });
});
