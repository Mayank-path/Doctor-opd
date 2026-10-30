/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ClinicRole,
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
  MembershipStatus,
} from '@prisma/client';
import request from 'supertest';
import {
  GENERAL_MEDICINE_CONDITIONS,
  GENERAL_MEDICINE_DIFFERENTIAL_RULES,
  GENERAL_MEDICINE_RED_FLAGS,
  GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS,
  GENERAL_MEDICINE_SOURCE_REFERENCES,
} from '../../../prisma/seeds/general-medicine';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DifferentialDiagnosisController } from './differential-diagnosis.controller';
import { DifferentialDiagnosisService } from './services/differential-diagnosis.service';
import {
  KNOWN_CANONICAL_CHECKSUMS,
  KnowledgePackResolverService,
} from './services/knowledge-pack-resolver.service';
import { AstEvaluatorEngine } from '../evaluator/ast-evaluator.engine';
import {
  EvaluationFindingStatus,
  InfectionSuspicionState,
} from '../evaluator/ast-evaluator.types';

describe('Phase 5B.8: Differential Diagnosis E2E Integration, Security & Safety Validation', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const jwtSecret = 'test-e2e-secret-key-must-be-at-least-32-chars!';
  const activeClinicId = '11111111-1111-4111-a111-111111111111';
  const otherClinicId = '22222222-2222-4222-a222-222222222222';
  const doctorUserId = '33333333-3333-4333-a333-333333333333';
  const staffUserId = '44444444-4444-4444-a444-444444444444';
  const patientId = '55555555-5555-4555-a555-555555555555';
  const otherPatientId = '66666666-6666-4666-a666-666666666666';
  const consultationId = '77777777-7777-4777-a777-777777777777';

  const validChecksumSha256 =
    '768f3ca6f79648bfe3ea7a6448719436f5557a9584436f6ca00791c1fa51984d';

  let doctorToken: string;
  let staffToken: string;
  let expiredToken: string;

  let prismaMock: {
    user: { findUnique: jest.Mock };
    clinicMembership: { findUnique: jest.Mock };
    patient: { findFirst: jest.Mock };
    consultation: { findFirst: jest.Mock };
    knowledgePackRelease: { findFirst: jest.Mock };
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_ISSUER = 'doctor-opd-api';
    process.env.JWT_AUDIENCE = 'doctor-opd-client';

    jwtService = new JwtService({
      secret: jwtSecret,
      signOptions: {
        issuer: 'doctor-opd-api',
        audience: 'doctor-opd-client',
        expiresIn: '1h',
      },
    });

    doctorToken = jwtService.sign({
      sub: doctorUserId,
      email: 'doctor@example.com',
      role: ClinicRole.DOCTOR,
    });

    staffToken = jwtService.sign({
      sub: staffUserId,
      email: 'staff@example.com',
      role: ClinicRole.STAFF,
    });

    expiredToken = jwtService.sign(
      {
        sub: doctorUserId,
        email: 'doctor@example.com',
        role: ClinicRole.DOCTOR,
      },
      { expiresIn: '-1s' },
    );

    prismaMock = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === doctorUserId) {
            return Promise.resolve({
              id: doctorUserId,
              email: 'doctor@example.com',
              fullName: 'Dr. Ramesh Sharma',
              role: ClinicRole.DOCTOR,
              isActive: true,
            });
          }
          if (where.id === staffUserId) {
            return Promise.resolve({
              id: staffUserId,
              email: 'staff@example.com',
              fullName: 'Staff Member',
              role: ClinicRole.STAFF,
              isActive: true,
            });
          }
          return Promise.resolve(null);
        }),
      },
      clinicMembership: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (
            where.userId_clinicId?.userId === doctorUserId &&
            where.userId_clinicId?.clinicId === activeClinicId
          ) {
            return Promise.resolve({
              id: 'mem-doc-1',
              userId: doctorUserId,
              clinicId: activeClinicId,
              role: ClinicRole.DOCTOR,
              status: MembershipStatus.ACTIVE,
            });
          }
          if (
            where.userId_clinicId?.userId === staffUserId &&
            where.userId_clinicId?.clinicId === activeClinicId
          ) {
            return Promise.resolve({
              id: 'mem-staff-1',
              userId: staffUserId,
              clinicId: activeClinicId,
              role: ClinicRole.STAFF,
              status: MembershipStatus.ACTIVE,
            });
          }
          return Promise.resolve(null);
        }),
      },
      patient: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === patientId && where.clinicId === activeClinicId) {
            return Promise.resolve({
              id: patientId,
              clinicId: activeClinicId,
              fullName: 'Rajesh Sharma',
              gender: 'MALE',
              dateOfBirth: new Date('1985-05-15'),
              deletedAt: null,
            });
          }
          return Promise.resolve(null);
        }),
      },
      consultation: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === consultationId && where.clinicId === activeClinicId) {
            return Promise.resolve({
              id: consultationId,
              clinicId: activeClinicId,
              patientId: patientId,
              status: 'DRAFT',
            });
          }
          return Promise.resolve(null);
        }),
      },
      knowledgePackRelease: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DifferentialDiagnosisController],
      providers: [
        DifferentialDiagnosisService,
        KnowledgePackResolverService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        AuthService,
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. SECURITY & TENANT ISOLATION
  // =========================================================================
  describe('1. Security & Tenant Isolation Suite', () => {
    const validPayload = {
      patientId,
      domain: 'GENERAL_MEDICINE',
      findings: [
        {
          canonicalTerm: 'Fever',
          status: 'PRESENT',
        },
      ],
      infectionSuspicion: 'UNKNOWN',
    };

    it('1.1 Missing Authorization header returns 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('x-clinic-id', activeClinicId)
        .send(validPayload);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('1.2 Expired JWT token returns 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${expiredToken}`)
        .set('x-clinic-id', activeClinicId)
        .send(validPayload);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('1.3 Missing x-clinic-id tenant header returns 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(validPayload);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toMatch(/Target clinic identifier is required|x-clinic-id/);
    });

    it('1.4 Non-doctor role (STAFF) returns 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-clinic-id', activeClinicId)
        .send(validPayload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('1.5 Doctor not a member of specified clinic returns 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', otherClinicId)
        .send(validPayload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('1.6 Patient belonging to another clinic returns 404 Not Found (Zero cross-tenant leak)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send({
          ...validPayload,
          patientId: otherPatientId,
        });

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.message).toContain('Patient not found');
    });

    it('1.7 Consultation belonging to different patient returns 400 Bad Request', async () => {
      prismaMock.consultation.findFirst = jest.fn().mockResolvedValue({
        id: consultationId,
        clinicId: activeClinicId,
        patientId: otherPatientId,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send({
          ...validPayload,
          consultationId,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('does not belong to the specified patient');
    });

    it('1.8 Non-UUID patientId returns 400 Bad Request via ValidationPipe', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send({
          ...validPayload,
          patientId: 'not-a-valid-uuid',
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('UUID')]));
    });

    it('1.9 Oversized findings count (> 50) returns 400 Bad Request', async () => {
      const oversizedFindings = Array.from({ length: 51 }, (_, i) => ({
        canonicalTerm: `Symptom ${i}`,
        status: 'PRESENT',
      }));

      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send({
          ...validPayload,
          findings: oversizedFindings,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('findings count cannot exceed 50')]),
      );
    });

    it('1.10 Invalid finding status returns 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send({
          ...validPayload,
          findings: [{ canonicalTerm: 'Fever', status: 'MAYBE' }],
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('1.11 Repeated evaluation requests execute deterministically without state corruption', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send(validPayload);

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send(validPayload);

      expect(res1.status).toBe(HttpStatus.OK);
      expect(res2.status).toBe(HttpStatus.OK);
      expect(res1.body.status).toBe(res2.body.status);
    });
  });

  // =========================================================================
  // 2. REAL DATABASE RESOLUTION & KNOWLEDGE-PACK LIFECYCLE
  // =========================================================================
  describe('2. Real Database Resolution & Lifecycle Safety', () => {
    it('2.1 Against unreleased database state, evaluate returns 200 OK with UNAVAILABLE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clinical-assist/differential-diagnosis/evaluate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-clinic-id', activeClinicId)
        .send({
          patientId,
          findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.status).toBe('UNAVAILABLE');
      expect(res.body.candidateMatches).toEqual([]);
      expect(res.body.redFlags).toEqual([]);
      expect(res.body.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('KNOWLEDGE_PACK_UNAVAILABLE')]),
      );
      expect(res.body.message).toContain('No active released knowledge pack');
      expect(res.body.disclaimer).toBeDefined();
    });

    it('2.2 Checksum Tampering Safety: resolver detects modified conditions and fails closed', () => {
      const resolver = new KnowledgePackResolverService({} as any);

      const tamperedConditions = GENERAL_MEDICINE_CONDITIONS.map((c, idx) =>
        idx === 0 ? { ...c, displayName: 'Tampered Name Malicious Change' } : c,
      );

      const tamperedVersion = {
        id: 'ver-tampered',
        majorVersion: 1,
        minorVersion: 0,
        patchVersion: 0,
        releaseStatus: KnowledgePackReleaseStatus.RELEASED,
        checksumSha256: validChecksumSha256,
        pack: { domain: KnowledgePackDomain.GENERAL_MEDICINE },
        approvals: [
          {
            id: 'appr-1',
            approvalVerdict: 'APPROVED',
            checksumSha256: validChecksumSha256,
          },
        ],
        conditions: tamperedConditions.map((c) => ({
          ...c,
          rules: GENERAL_MEDICINE_DIFFERENTIAL_RULES.filter(
            (r) => r.conditionCode === c.conditionCode,
          ).map((r) => ({
            ...r,
            applicabilityJson: r.applicability,
            mandatoryAstJson: r.mandatoryAst,
            majorSupportingJson: r.majorSupporting,
            minorSupportingJson: r.minorSupporting,
            contradictionsJson: r.contradictions,
            missingDataRulesJson: r.missingDataRules,
            investigationsJson: r.investigations,
          })),
        })),
        redFlagRules: GENERAL_MEDICINE_RED_FLAGS.map((rf) => ({
          ...rf,
          ruleAstJson: rf.ruleAst,
        })),
        sources: GENERAL_MEDICINE_SOURCE_REFERENCES,
        mappings: GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS,
      };

      const isValid = resolver.verifyReleaseIntegrity({ version: tamperedVersion });
      expect(isValid).toBe(false);
    });

    it('2.3 Approval Binding Safety: rejects version where approval checksum does not match stored checksum', () => {
      const resolver = new KnowledgePackResolverService({} as any);

      const mismatchedApprovalVersion = {
        id: 'ver-mismatched-approval',
        majorVersion: 1,
        minorVersion: 0,
        patchVersion: 0,
        releaseStatus: KnowledgePackReleaseStatus.RELEASED,
        checksumSha256: validChecksumSha256,
        pack: { domain: KnowledgePackDomain.GENERAL_MEDICINE },
        approvals: [
          {
            id: 'appr-mismatched',
            approvalVerdict: 'APPROVED',
            checksumSha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          },
        ],
        conditions: GENERAL_MEDICINE_CONDITIONS.map((c) => ({
          ...c,
          rules: GENERAL_MEDICINE_DIFFERENTIAL_RULES.filter(
            (r) => r.conditionCode === c.conditionCode,
          ).map((r) => ({
            ...r,
            applicabilityJson: r.applicability,
            mandatoryAstJson: r.mandatoryAst,
            majorSupportingJson: r.majorSupporting,
            minorSupportingJson: r.minorSupporting,
            contradictionsJson: r.contradictions,
            missingDataRulesJson: r.missingDataRules,
            investigationsJson: r.investigations,
          })),
        })),
        redFlagRules: GENERAL_MEDICINE_RED_FLAGS.map((rf) => ({
          ...rf,
          ruleAstJson: rf.ruleAst,
        })),
        sources: GENERAL_MEDICINE_SOURCE_REFERENCES,
        mappings: GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS,
      };

      const isValid = resolver.verifyReleaseIntegrity({ version: mismatchedApprovalVersion });
      expect(isValid).toBe(false);
    });
  });

  // =========================================================================
  // 3. CLINICAL SAFETY & DETERMINISTIC AST EVALUATOR MATRIX
  // =========================================================================
  describe('3. Clinical Safety Evaluator Matrix Suite', () => {
    let engine: AstEvaluatorEngine;

    beforeAll(() => {
      engine = new AstEvaluatorEngine({
        conditions: GENERAL_MEDICINE_CONDITIONS,
        rules: GENERAL_MEDICINE_DIFFERENTIAL_RULES,
        redFlags: GENERAL_MEDICINE_RED_FLAGS,
      });
    });

    it('3.1 PRESENT vs ABSENT: ABSENT findings never satisfy positive criteria', () => {
      // In COND-GM-URI-001: mandatory is Runny nose OR Cough PRESENT.
      // When both are ABSENT, the mandatory criteria is explicitly negated, which triggers CONTRADICTED.
      const resultWithAbsent = engine.evaluateDifferential({
        findings: [
          {
            canonicalTerm: 'Cough',
            status: EvaluationFindingStatus.ABSENT,
          },
          {
            canonicalTerm: 'Runny nose',
            status: EvaluationFindingStatus.ABSENT,
          },
        ],
      });

      const uriMatch = resultWithAbsent.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatch).toBeDefined();
      expect(uriMatch!.mandatoryResult?.satisfied).toBe(false);
      expect(uriMatch!.tier).toBe('CONTRADICTED');
    });

    it('3.2 UNKNOWN vs NOT_MENTIONED: both fail positive criteria and trigger missing info', () => {
      // Evaluation with UNKNOWN Cough
      const resultWithUnknown = engine.evaluateDifferential({
        findings: [
          {
            canonicalTerm: 'Cough',
            status: EvaluationFindingStatus.UNKNOWN,
          },
        ],
      });

      // COND-GM-URI-001 requires Cough or Runny nose PRESENT. UNKNOWN fails positive criteria.
      const uriMatchUnknown = resultWithUnknown.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatchUnknown).toBeUndefined(); // Excluded from candidates (UNMATCHED)
      expect(resultWithUnknown.unmatchedCount).toBeGreaterThan(0);

      // Evaluation with NOT_MENTIONED (empty findings)
      const resultEmpty = engine.evaluateDifferential({
        findings: [],
      });
      const uriMatchEmpty = resultEmpty.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatchEmpty).toBeUndefined();
      expect(resultEmpty.unmatchedCount).toBeGreaterThan(0);
    });

    it('3.3 NOT_ASSESSED vs NORMAL: documented NOT_ASSESSED exams are never treated as normal', () => {
      const result = engine.evaluateDifferential({
        findings: [
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Runny nose', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
        ],
        assessments: [
          {
            examination: 'EXAM-CHEST-AUSCULTATION',
            status: 'NOT_ASSESSED',
            reason: 'Clinician omitted',
          },
        ],
      });

      const uriMatch = result.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatch!.unperformedAssessments.length).toBeGreaterThan(0);
      expect(
        uriMatch!.unperformedAssessments.some(
          (u) => u.examination === 'EXAM-CHEST-AUSCULTATION',
        ),
      ).toBe(true);
    });

    it('3.4 UNCERTAIN findings: do not satisfy positive AST criteria', () => {
      const result = engine.evaluateDifferential({
        findings: [
          {
            canonicalTerm: 'Cough',
            status: EvaluationFindingStatus.UNCERTAIN,
          },
        ],
      });

      // UNCERTAIN Cough cannot satisfy mandatory PRESENT criterion
      const uriMatch = result.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatch).toBeUndefined();
      expect(result.unmatchedCount).toBeGreaterThan(0);
    });

    it('3.5 Contradictory findings: triggers CONTRADICTED match tier', () => {
      // RULE-GM-URI-001 contradiction rule: Breathlessness PRESENT AND VITAL_SPO2 < 92
      const result = engine.evaluateDifferential({
        findings: [
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT },
        ],
        vitals: {
          spO2: 88,
        },
      });

      const uriMatch = result.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatch).toBeDefined();
      expect(uriMatch!.contradictionTriggered).toBe(true);
      expect(uriMatch!.tier).toBe('CONTRADICTED');
    });

    it('3.6 Missing mandatory criteria: prevents STRONG/MODERATE match, downgrades candidate to POSSIBLE or UNMATCHED', () => {
      // Minor supporting finding without mandatory Runny nose or Cough
      const resultWithMinor = engine.evaluateDifferential({
        findings: [
          { canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Weakness', status: EvaluationFindingStatus.PRESENT },
        ],
      });

      const uriMatch = resultWithMinor.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatch).toBeDefined();
      expect(uriMatch!.mandatoryResult?.satisfied).toBe(false);
      expect(uriMatch!.tier).toBe('POSSIBLE'); // Cannot be STRONG or MODERATE without mandatory

      // Completely unrelated finding without mandatory or supporting
      const resultUnmatched = engine.evaluateDifferential({
        findings: [
          { canonicalTerm: 'Knee pain', status: EvaluationFindingStatus.PRESENT },
        ],
      });
      const uriMatchUnmatched = resultUnmatched.candidateMatches.find(
        (c) => c.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatchUnmatched).toBeUndefined();
    });

    it('3.7 Biological range & BP Incoherence: rejects invalid vitals (SBP <= DBP)', () => {
      expect(() =>
        engine.evaluateDifferential({
          findings: [],
          vitals: {
            systolicBp: 80,
            diastolicBp: 120,
          },
        }),
      ).toThrow(/cannot be lower than Diastolic BP/);
    });

    it('3.8 Pediatric Safeguard: Adult qSOFA is strictly gated off for patients under 18 years', () => {
      const pediatricResult = engine.evaluateDifferential({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          respiratoryRate: 26,
          systolicBp: 90,
        },
        demographics: {
          ageYears: 8,
        },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      });

      const qsofaFlag = pediatricResult.redFlags.find(
        (rf) => rf.flagCode === 'RF-QSOFA-SEPSIS',
      );
      expect(qsofaFlag).toBeDefined();
      expect(qsofaFlag!.triggered).toBe(false);
      expect(qsofaFlag!.title).toContain('Pediatric Context');
      expect(qsofaFlag!.clinicalAction).toContain('clinically invalid in pediatric patients');
    });

    it('3.9 Missing/Unrecorded Age Safeguard: Adult qSOFA is gated off when age is missing', () => {
      const missingAgeResult = engine.evaluateDifferential({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          respiratoryRate: 26,
          systolicBp: 90,
        },
        demographics: {},
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      });

      const qsofaFlag = missingAgeResult.redFlags.find(
        (rf) => rf.flagCode === 'RF-QSOFA-SEPSIS',
      );
      expect(qsofaFlag!.triggered).toBe(false);
      expect(qsofaFlag!.title).toContain('Age Unrecorded');
      expect(qsofaFlag!.clinicalAction).toContain('patient age is unrecorded or invalid');
    });

    it('3.10 Suspected vs Not-Suspected Infection: Adult qSOFA requires explicit SUSPECTED state', () => {
      const nonInfectionResult = engine.evaluateDifferential({
        findings: [],
        vitals: {
          respiratoryRate: 24,
          systolicBp: 95,
        },
        demographics: {
          ageYears: 45,
        },
        infectionSuspicion: InfectionSuspicionState.NOT_SUSPECTED,
      });

      const flagA = nonInfectionResult.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
      expect(flagA!.triggered).toBe(true);
      expect(flagA!.title).toContain('Non-Sepsis Physiology Advisory');
      expect(flagA!.clinicalAction).toContain('without clinician-documented suspected infection');

      const suspectedResult = engine.evaluateDifferential({
        findings: [],
        vitals: {
          respiratoryRate: 24,
          systolicBp: 95,
        },
        demographics: {
          ageYears: 45,
        },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      });

      const flagB = suspectedResult.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
      expect(flagB!.triggered).toBe(true);
      expect(flagB!.title).toContain('Provisional qSOFA Criteria in Suspected Infection');
      expect(flagB!.isProvisional).toBe(true);
    });

    it('3.11 qSOFA Dizziness Quarantine: Dizziness contributes 0 criteria to qSOFA', () => {
      const result = engine.evaluateDifferential({
        findings: [{ canonicalTerm: 'Dizziness', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          respiratoryRate: 24,
          systolicBp: 130,
        },
        demographics: {
          ageYears: 45,
        },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      });

      const qsofaFlag = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
      expect(qsofaFlag!.triggered).toBe(false);
      expect(qsofaFlag!.quarantinedPredicates).toContain('Dizziness');
    });

    it('3.12 Severe Blood Pressure without target-organ symptoms is evaluated as an advisory, not emergency', () => {
      const severeBpResult = engine.evaluateDifferential({
        findings: [],
        vitals: {
          systolicBp: 195,
          diastolicBp: 110,
        },
      });

      const bpFlag = severeBpResult.redFlags.find(
        (rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS',
      );
      expect(bpFlag).toBeDefined();
      expect(bpFlag!.triggered).toBe(true);
      expect(bpFlag!.title).toContain('Severe Blood Pressure Elevation Advisory');
      expect(bpFlag!.clinicalAction).toContain(
        'Severe-range blood pressure elevation alone does not establish a diagnosis of hypertensive emergency',
      );
      expect(bpFlag!.clinicalContextNotice).toContain('No acute target-organ symptoms documented');
    });

    it('3.13 Severe Blood Pressure WITH target-organ symptoms alerts for acute involvement', () => {
      const withSymptomsResult = engine.evaluateDifferential({
        findings: [
          { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT },
        ],
        vitals: {
          systolicBp: 195,
          diastolicBp: 110,
        },
      });

      const bpFlag = withSymptomsResult.redFlags.find(
        (rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS',
      );
      expect(bpFlag!.triggered).toBe(true);
      expect(bpFlag!.title).toContain('Suspected Target-Organ Involvement');
      expect(bpFlag!.clinicalContextNotice).toContain('Acute target-organ symptoms');
    });
  });
});
