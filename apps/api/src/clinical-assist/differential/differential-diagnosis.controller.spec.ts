import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClinicRole, KnowledgePackDomain } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DifferentialDiagnosisController } from './differential-diagnosis.controller';
import {
  DIFFERENTIAL_DIAGNOSIS_DISCLAIMER,
  DifferentialEvaluationResponseDto,
} from './dto/differential-response.dto';
import { EvaluateDifferentialDto } from './dto/evaluate-differential.dto';
import { DifferentialDiagnosisService } from './services/differential-diagnosis.service';
import { EvaluationFindingStatus, InfectionSuspicionState } from '../evaluator/ast-evaluator.types';

describe('DifferentialDiagnosisController — Endpoint Guards & Dispatch', () => {
  let controller: DifferentialDiagnosisController;
  let service: DifferentialDiagnosisService;

  const mockResponse: DifferentialEvaluationResponseDto = {
    status: 'EVALUATED',
    evaluatedAt: '2026-10-31T00:00:00.000Z',
    engineVersion: '1.0.0',
    knowledgePack: {
      domain: KnowledgePackDomain.GENERAL_MEDICINE,
      version: '1.0.0',
      releaseStatus: 'RELEASED' as any,
      releaseScope: 'GLOBAL',
      checksumSha256: 'mock-sha',
    },
    patientContext: {
      patientId: 'patient-123',
      resolvedAgeYears: 35,
      ageSource: 'PATIENT_DOB',
      gender: 'MALE',
    },
    infectionSuspicion: InfectionSuspicionState.SUSPECTED,
    hasUrgentRedFlags: false,
    redFlags: [],
    candidateMatches: [],
    tierSummary: {
      strongMatchCount: 0,
      moderateMatchCount: 0,
      possibleMatchCount: 0,
      contradictedMatchCount: 0,
      unmatchedCount: 0,
    },
    warnings: [],
    requiresDoctorReview: true,
    disclaimer: DIFFERENTIAL_DIAGNOSIS_DISCLAIMER,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DifferentialDiagnosisController],
      providers: [
        {
          provide: DifferentialDiagnosisService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue(mockResponse),
            getEvaluationById: jest.fn().mockResolvedValue({ id: 'audit-1', clinicId: 'clinic-alpha' }),
            reviewEvaluation: jest.fn().mockResolvedValue({ id: 'audit-1', status: 'REVIEWED' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClinicAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DifferentialDiagnosisController>(
      DifferentialDiagnosisController,
    );
    service = module.get<DifferentialDiagnosisService>(
      DifferentialDiagnosisService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should declare JwtAuthGuard, ClinicAuthGuard, and ThrottlerGuard on the controller class', () => {
    const guards = Reflect.getMetadata('__guards__', DifferentialDiagnosisController);
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(ClinicAuthGuard);
    expect(guards).toContain(ThrottlerGuard);
  });

  it('should require ClinicRole.DOCTOR on the evaluate handler', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      DifferentialDiagnosisController.prototype.evaluate,
    );
    expect(roles).toBeDefined();
    expect(roles).toEqual([ClinicRole.DOCTOR]);
  });

  it('should forward clinicId, clinicianId and DTO to differentialService.evaluate', async () => {
    const clinicId = 'clinic-alpha';
    const clinicianId = 'doc-beta';
    const dto: EvaluateDifferentialDto = {
      patientId: 'c8b417e9-4e4c-47b2-850d-82b5e2a22538',
      findings: [
        {
          canonicalTerm: 'Cough',
          status: EvaluationFindingStatus.PRESENT,
        },
      ],
    };

    const result = await controller.evaluate(clinicId, clinicianId, dto);

    expect(service.evaluate).toHaveBeenCalledWith(clinicId, clinicianId, dto);
    expect(result).toBe(mockResponse);
  });

  it('should forward clinicId, clinicianId and DTO on evaluateDirect handler', async () => {
    const clinicId = 'clinic-alpha';
    const clinicianId = 'doc-beta';
    const dto: EvaluateDifferentialDto = {
      patientId: 'c8b417e9-4e4c-47b2-850d-82b5e2a22538',
      findings: [
        {
          canonicalTerm: 'Fever',
          status: EvaluationFindingStatus.PRESENT,
        },
      ],
    };

    const result = await controller.evaluateDirect(clinicId, clinicianId, dto);

    expect(service.evaluate).toHaveBeenCalledWith(clinicId, clinicianId, dto);
    expect(result).toBe(mockResponse);
  });

  it('should forward request to service.getEvaluationById', async () => {
    const clinicId = 'clinic-alpha';
    const clinicianId = 'doc-beta';
    const auditId = 'audit-123';

    const result = await controller.getEvaluationById(clinicId, clinicianId, auditId);

    expect(service.getEvaluationById).toHaveBeenCalledWith(clinicId, clinicianId, auditId);
    expect(result).toEqual({ id: 'audit-1', clinicId: 'clinic-alpha' });
  });

  it('should forward review DTO to service.reviewEvaluation', async () => {
    const clinicId = 'clinic-alpha';
    const clinicianId = 'doc-beta';
    const auditId = 'audit-123';
    const reviewDto = {
      decisions: [
        {
          conditionCode: 'COND-PNEUMONIA-CAP',
          decision: 'ACCEPTED_AS_PRIMARY' as any,
          reason: 'Focal crepitations',
        },
      ],
      reviewNotes: 'Reviewed and confirmed.',
    };

    const result = await controller.reviewEvaluation(clinicId, clinicianId, auditId, reviewDto);

    expect(service.reviewEvaluation).toHaveBeenCalledWith(clinicId, clinicianId, auditId, reviewDto);
    expect(result).toEqual({ id: 'audit-1', status: 'REVIEWED' });
  });
});
