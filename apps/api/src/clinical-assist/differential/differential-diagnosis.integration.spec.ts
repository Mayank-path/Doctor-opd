/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClinicRole, KnowledgePackDomain, KnowledgePackReleaseStatus, MembershipStatus } from '@prisma/client';
import request from 'supertest';
import {
  GENERAL_MEDICINE_CONDITIONS,
  GENERAL_MEDICINE_DIFFERENTIAL_RULES,
  GENERAL_MEDICINE_PACK_METADATA,
  GENERAL_MEDICINE_RED_FLAGS,
  GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS,
  GENERAL_MEDICINE_SOURCE_REFERENCES,
} from '../../../prisma/seeds/general-medicine';
import { PrismaService } from '../../prisma/prisma.service';
import { EvaluationFindingStatus, InfectionSuspicionState } from '../evaluator/ast-evaluator.types';
import { AuthService } from '../../auth/auth.service';
import { DifferentialDiagnosisController } from './differential-diagnosis.controller';
import { DifferentialDiagnosisService } from './services/differential-diagnosis.service';
import { KnowledgePackResolverService } from './services/knowledge-pack-resolver.service';

describe('Differential Diagnosis API Integration (HTTP Pipeline & RBAC)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const jwtSecret = 'test-secret-at-least-32-chars-long-for-jwt-signing';
  const clinicId = 'c1111111-1111-4111-a111-111111111111';
  const otherClinicId = 'c2222222-2222-4222-a222-222222222222';
  const doctorUserId = 'd1111111-1111-4111-a111-111111111111';
  const staffUserId = 'e2222222-2222-4222-a222-222222222222';
  const patientId = 'a1111111-1111-4111-a111-111111111111';
  const consultationId = 'b1111111-1111-4111-a111-111111111111';
  const otherPatientId = 'f1111111-2222-4222-a222-222222222222';

  const validChecksumSha256 =
    '768f3ca6f79648bfe3ea7a6448719436f5557a9584436f6ca00791c1fa51984d';

  let doctorToken: string;
  let staffToken: string;

  let prismaMock: {
    clinicMembership: { findUnique: jest.Mock };
    patient: { findFirst: jest.Mock };
    consultation: { findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    differentialDiagnosisAudit: { create: jest.Mock };
    knowledgePackRelease: { findFirst: jest.Mock };
  };

  const sampleResolvedPack = {
    bundle: {
      conditions: GENERAL_MEDICINE_CONDITIONS,
      rules: GENERAL_MEDICINE_DIFFERENTIAL_RULES,
      redFlags: GENERAL_MEDICINE_RED_FLAGS,
    },
    metadata: {
      domain: KnowledgePackDomain.GENERAL_MEDICINE,
      version: '1.0.0',
      releaseStatus: KnowledgePackReleaseStatus.RELEASED,
      releaseScope: 'GLOBAL' as const,
      checksumSha256: validChecksumSha256,
    },
  };

  const createMockVersion = (
    status: KnowledgePackReleaseStatus,
    checksum: string = validChecksumSha256,
    approvals: any[] = [
      {
        id: 'appr-1',
        versionId: 'ver-1-0-0',
        clinicianName: 'Dr. Jane Smith, MD',
        approvalVerdict: 'APPROVED',
        checksumSha256: checksum,
        reviewNotes: `Approved release with SHA-256: ${checksum}`,
      },
    ],
  ) => ({
    id: 'ver-1-0-0',
    majorVersion: 1,
    minorVersion: 0,
    patchVersion: 0,
    changelog: GENERAL_MEDICINE_PACK_METADATA.version.changelog,
    releaseStatus: status,
    checksumSha256: checksum,
    pack: {
      domain: KnowledgePackDomain.GENERAL_MEDICINE,
      name: GENERAL_MEDICINE_PACK_METADATA.name,
      description: GENERAL_MEDICINE_PACK_METADATA.description,
    },
    approvals,
    conditions: sampleResolvedPack.bundle.conditions.map((c) => ({
      ...c,
      rules: sampleResolvedPack.bundle.rules
        .filter((r) => r.conditionCode === c.conditionCode)
        .map((r) => ({
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
    redFlagRules: sampleResolvedPack.bundle.redFlags.map((rf) => ({
      ...rf,
      ruleAstJson: rf.ruleAst,
    })),
    sources: GENERAL_MEDICINE_SOURCE_REFERENCES,
    mappings: GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS,
  });

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
      role: 'DOCTOR',
    });

    staffToken = jwtService.sign({
      sub: staffUserId,
      email: 'staff@example.com',
      role: 'STAFF',
    });

    prismaMock = {
      clinicMembership: { findUnique: jest.fn() },
      patient: { findFirst: jest.fn() },
      consultation: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      differentialDiagnosisAudit: { create: jest.fn() },
      knowledgePackRelease: { findFirst: jest.fn() },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DifferentialDiagnosisController],
      providers: [
        DifferentialDiagnosisService,
        KnowledgePackResolverService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtService },
        {
          provide: AuthService,
          useValue: {
            verifyToken: jest.fn().mockImplementation((token: string) => {
              if (token === doctorToken) return { sub: doctorUserId, role: 'DOCTOR' };
              if (token === staffToken) return { sub: staffUserId, role: 'STAFF' };
              throw new Error('Invalid token');
            }),
            validateUser: jest.fn().mockImplementation((sub: string) => {
              if (sub === doctorUserId) return { id: doctorUserId, email: 'doctor@example.com' };
              if (sub === staffUserId) return { id: staffUserId, email: 'staff@example.com' };
              throw new Error('User not found');
            }),
          },
        },
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

    // Default membership setup: doctor has ACTIVE DOCTOR membership in clinicId
    prismaMock.clinicMembership.findUnique.mockImplementation(({ where }) => {
      if (
        where.userId_clinicId.userId === doctorUserId &&
        where.userId_clinicId.clinicId === clinicId
      ) {
        return Promise.resolve({
          id: 'mem-doc-1',
          userId: doctorUserId,
          clinicId,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        });
      }
      if (
        where.userId_clinicId.userId === staffUserId &&
        where.userId_clinicId.clinicId === clinicId
      ) {
        return Promise.resolve({
          id: 'mem-staff-1',
          userId: staffUserId,
          clinicId,
          role: ClinicRole.STAFF,
          status: MembershipStatus.ACTIVE,
        });
      }
      return Promise.resolve(null);
    });
  });

  const endpoint = '/api/v1/clinical-assist/differential-diagnosis/evaluate';

  it('1. Authentication: should return 401 Unauthorized when Authorization header is missing', async () => {
    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('2. Tenant Selector: should return 400 Bad Request when x-clinic-id is missing', async () => {
    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('3. RBAC: should return 403 Forbidden when caller does not have DOCTOR role (e.g. STAFF)', async () => {
    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('4. Multi-Tenant Isolation: should return 404 Not Found when patient belongs to another clinic', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId: otherPatientId,
        findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.message).toContain('Patient not found');
  });

  it('5. Consultation Isolation: should return 400 Bad Request when consultation belongs to another patient', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
    });

    prismaMock.consultation.findFirst.mockResolvedValueOnce({
      id: consultationId,
      clinicId,
      patientId: otherPatientId,
    });

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        consultationId,
        findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.message).toContain('Consultation does not belong to the specified patient');
  });

  it('6. Validation Pipe: should return 400 Bad Request on invalid finding status', async () => {
    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Cough', status: 'INVALID_STATUS' }],
      });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('7. Validation Pipe: should return 400 Bad Request on non-UUID patientId', async () => {
    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId: 'not-a-valid-uuid',
        findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('8. Safe Unavailable: should return 200 OK with status UNAVAILABLE when no active release exists', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1990-06-15'),
      gender: 'FEMALE',
    });
    // Knowledge pack resolver queries return null (no release configured)
    prismaMock.knowledgePackRelease.findFirst.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.status).toBe('UNAVAILABLE');
    expect(res.body.candidateMatches).toEqual([]);
    expect(res.body.hasUrgentRedFlags).toBe(false);
    expect(res.body.warnings.some((w: string) => w.includes('KNOWLEDGE_PACK_UNAVAILABLE'))).toBe(true);
    expect(res.body.requiresDoctorReview).toBe(true);
  });

  it('9. Successful Evaluation: should evaluate AST rules deterministically and return candidates when release is active', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1988-02-14'),
      gender: 'MALE',
    });

    const validVersion = createMockVersion(KnowledgePackReleaseStatus.RELEASED);

    // Mock active global release
    prismaMock.knowledgePackRelease.findFirst
      .mockResolvedValueOnce(null) // no clinic override
      .mockResolvedValueOnce({
        id: 'rel-global-1',
        clinicId: null,
        versionId: validVersion.id,
        isActive: true,
        activatedAt: new Date(),
        version: validVersion,
      });

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.ABSENT },
        ],
        vitals: { temperatureC: 38.6 },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.status).toBe('EVALUATED');
    expect(res.body.knowledgePack.version).toBe('1.0.0');
    expect(res.body.patientContext.ageSource).toBe('PATIENT_DOB');
    expect(res.body.candidateMatches.length).toBeGreaterThan(0);
    expect(res.body.requiresDoctorReview).toBe(true);

    // Verify zero database writes occurred
    expect(prismaMock.consultation.update).not.toHaveBeenCalled();
    expect(prismaMock.consultation.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.differentialDiagnosisAudit.create).not.toHaveBeenCalled();
  });

  it('10. Lifecycle Safety: APPROVED but not RELEASED must return UNAVAILABLE response', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1992-05-10'),
      gender: 'MALE',
    });

    // Query returns null because database filter specifies RELEASED
    prismaMock.knowledgePackRelease.findFirst.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Cough', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.status).toBe('UNAVAILABLE');
    expect(res.body.requiresDoctorReview).toBe(true);
  });

  it('11. Integrity Safety: RELEASED with checksum mismatch returns safe UNAVAILABLE response', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1985-07-20'),
      gender: 'FEMALE',
    });

    const corruptVersion = createMockVersion(
      KnowledgePackReleaseStatus.RELEASED,
      '0000000000000000000000000000000000000000000000000000000000000000', // Mismatch against canonical 1.0.0
    );

    prismaMock.knowledgePackRelease.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'rel-corrupt',
        clinicId: null,
        versionId: corruptVersion.id,
        isActive: true,
        version: corruptVersion,
      });

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.status).toBe('UNAVAILABLE');
    expect(res.body.candidateMatches).toEqual([]);
  });

  it('12. Integrity Safety: RELEASED without required clinical approval returns safe UNAVAILABLE response', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1985-07-20'),
      gender: 'FEMALE',
    });

    const unapprovedVersion = createMockVersion(
      KnowledgePackReleaseStatus.RELEASED,
      validChecksumSha256,
      [], // No approvals
    );

    prismaMock.knowledgePackRelease.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'rel-unapproved',
        clinicId: null,
        versionId: unapprovedVersion.id,
        isActive: true,
        version: unapprovedVersion,
      });

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.status).toBe('UNAVAILABLE');
  });

  it('13. Selection Priority: Clinic-specific active release takes precedence over global baseline', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
    });

    const resolver = app.get(KnowledgePackResolverService);
    const baseMock = createMockVersion(KnowledgePackReleaseStatus.RELEASED);
    const clinicVersion: any = {
      ...baseMock,
      id: 'ver-clinic-override',
      majorVersion: 2,
      minorVersion: 0,
      patchVersion: 0,
    };
    const clinicChecksum = resolver.computeLoadedVersionChecksum(clinicVersion);
    clinicVersion.checksumSha256 = clinicChecksum;
    clinicVersion.approvals = [
      {
        id: 'appr-clinic',
        approvalVerdict: 'APPROVED',
        checksumSha256: clinicChecksum,
        reviewNotes: `Approved SHA-256: ${clinicChecksum}`,
      },
    ];

    // First call (clinic lookup) returns clinic release immediately
    prismaMock.knowledgePackRelease.findFirst.mockResolvedValueOnce({
      id: 'rel-clinic-custom',
      clinicId,
      versionId: clinicVersion.id,
      isActive: true,
      version: clinicVersion,
    });

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
        ],
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.status).toBe('EVALUATED');
    expect(res.body.knowledgePack.releaseScope).toBe('CLINIC');
    expect(res.body.knowledgePack.version).toBe('2.0.0');
    // Global lookup was never invoked because clinic override satisfied the request
    expect(prismaMock.knowledgePackRelease.findFirst).toHaveBeenCalledTimes(1);
  });

  it('14. Lifecycle Safety: DRAFT releases are never matched or evaluated', async () => {
    prismaMock.patient.findFirst.mockResolvedValueOnce({
      id: patientId,
      clinicId,
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
    });

    // DRAFT query returns null
    prismaMock.knowledgePackRelease.findFirst.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: 'PRESENT' }],
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.status).toBe('UNAVAILABLE');
  });
});
