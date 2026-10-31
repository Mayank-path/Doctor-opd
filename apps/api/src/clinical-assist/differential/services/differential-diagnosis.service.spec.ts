import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
} from '@prisma/client';
import { GENERAL_MEDICINE_CONDITIONS } from '../../../../prisma/seeds/general-medicine/conditions.data';
import { GENERAL_MEDICINE_DIFFERENTIAL_RULES } from '../../../../prisma/seeds/general-medicine/differential-rules.data';
import { GENERAL_MEDICINE_RED_FLAGS } from '../../../../prisma/seeds/general-medicine/red-flag-rules.data';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  EvaluationFindingStatus,
  InfectionSuspicionState,
} from '../../evaluator/ast-evaluator.types';
import { EvaluateDifferentialDto } from '../dto/evaluate-differential.dto';
import { DifferentialDiagnosisService } from './differential-diagnosis.service';
import { KnowledgePackResolverService } from './knowledge-pack-resolver.service';

describe('DifferentialDiagnosisService — API Integration & Clinical Safety', () => {
  let service: DifferentialDiagnosisService;
  let prisma: {
    patient: { findFirst: jest.Mock };
    consultation: { findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    differentialDiagnosisAudit: { create: jest.Mock };
  };
  let resolver: {
    resolveActiveRelease: jest.Mock;
  };

  const clinicId = 'clinic-alpha-uuid';
  const clinicianId = 'doctor-uuid-1';
  const patientId = 'patient-uuid-1';
  const consultationId = 'consultation-uuid-1';

  // Sample release pack using validated General Medicine seed rules
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
      checksumSha256: 'mock-sha256-hash',
    },
  };

  beforeEach(async () => {
    prisma = {
      patient: { findFirst: jest.fn() },
      consultation: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      differentialDiagnosisAudit: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    resolver = {
      resolveActiveRelease: jest.fn(),
      listKnowledgePacks: jest.fn(),
      getKnowledgePackVersion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DifferentialDiagnosisService,
        { provide: PrismaService, useValue: prisma },
        { provide: KnowledgePackResolverService, useValue: resolver },
      ],
    }).compile();

    service = module.get<DifferentialDiagnosisService>(
      DifferentialDiagnosisService,
    );
  });

  // =========================================================================
  // 1. TENANT ISOLATION & PATIENT/CONSULTATION INTEGRITY
  // =========================================================================
  describe('1. Tenant Isolation & Patient/Consultation Boundaries', () => {
    it('should throw NotFoundException if patient does not exist or belongs to another clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [{ canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT }],
      };

      await expect(service.evaluate(clinicId, clinicianId, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: patientId, clinicId, deletedAt: null },
      });
    });

    it('should throw NotFoundException if consultation does not exist in active clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: patientId,
        clinicId,
        gender: 'FEMALE',
      });
      prisma.consultation.findFirst.mockResolvedValue(null);

      const dto: EvaluateDifferentialDto = {
        patientId,
        consultationId,
        findings: [{ canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT }],
      };

      await expect(service.evaluate(clinicId, clinicianId, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: consultationId, clinicId },
      });
    });

    it('should throw BadRequestException if consultation belongs to a different patient', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: patientId,
        clinicId,
        gender: 'FEMALE',
      });
      prisma.consultation.findFirst.mockResolvedValue({
        id: consultationId,
        clinicId,
        patientId: 'different-patient-uuid', // Mismatch!
      });

      const dto: EvaluateDifferentialDto = {
        patientId,
        consultationId,
        findings: [{ canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT }],
      };

      await expect(service.evaluate(clinicId, clinicianId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.evaluate(clinicId, clinicianId, dto)).rejects.toThrow(
        /Consultation does not belong to the specified patient/,
      );
    });
  });

  // =========================================================================
  // 2. TRUSTED DEMOGRAPHIC DERIVATION & AGE OVERRIDE SAFETY
  // =========================================================================
  describe('2. Trusted Demographic Derivation', () => {
    it('should calculate age from trusted patient DOB and ignore client demographic age claim', async () => {
      // Patient born 20 years ago
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 20);

      prisma.patient.findFirst.mockResolvedValue({
        id: patientId,
        clinicId,
        dateOfBirth: dob,
        gender: 'MALE',
      });

      resolver.resolveActiveRelease.mockResolvedValue(sampleResolvedPack);

      const dto: EvaluateDifferentialDto = {
        patientId,
        demographics: { ageYears: 45 }, // Client falsely claims 45!
        findings: [{ canonicalTerm: 'Sore throat', status: EvaluationFindingStatus.PRESENT }],
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      expect(result.patientContext.ageSource).toBe('PATIENT_DOB');
      expect(result.patientContext.resolvedAgeYears).toBe(20); // Derived from server DOB!
    });

    it('should fallback to client demographic age when patient DOB is null', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: patientId,
        clinicId,
        dateOfBirth: null, // No DOB on file
        gender: 'MALE',
      });

      resolver.resolveActiveRelease.mockResolvedValue(sampleResolvedPack);

      const dto: EvaluateDifferentialDto = {
        patientId,
        demographics: { ageYears: 32 },
        findings: [{ canonicalTerm: 'Sore throat', status: EvaluationFindingStatus.PRESENT }],
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      expect(result.patientContext.ageSource).toBe('CLIENT_DEMOGRAPHIC');
      expect(result.patientContext.resolvedAgeYears).toBe(32);
    });

    it('should mark ageSource as UNRECORDED when neither DOB nor client age are provided', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: patientId,
        clinicId,
        dateOfBirth: null,
        gender: 'FEMALE',
      });

      resolver.resolveActiveRelease.mockResolvedValue(sampleResolvedPack);

      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [{ canonicalTerm: 'Sore throat', status: EvaluationFindingStatus.PRESENT }],
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      expect(result.patientContext.ageSource).toBe('UNRECORDED');
      expect(result.patientContext.resolvedAgeYears).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. SAFE UNAVAILABLE RESPONSE WHEN NO RELEASE ACTIVE
  // =========================================================================
  describe('3. Safe Unavailable Response When No Active Release', () => {
    it('should return safe status UNAVAILABLE when no eligible pack is configured', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: patientId,
        clinicId,
        dateOfBirth: new Date('1995-05-10'),
        gender: 'FEMALE',
      });

      // Resolver returns null (e.g. current TEST DB where pack is DRAFT)
      resolver.resolveActiveRelease.mockResolvedValue(null);

      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      expect(result.status).toBe('UNAVAILABLE');
      expect(result.candidateMatches).toEqual([]);
      expect(result.redFlags).toEqual([]);
      expect(result.hasUrgentRedFlags).toBe(false);
      expect(result.warnings.some((w) => w.includes('KNOWLEDGE_PACK_UNAVAILABLE'))).toBe(true);
      expect(result.requiresDoctorReview).toBe(true);
      expect(result.disclaimer).toBeDefined();
      expect(result.message).toContain('No active released knowledge pack');
    });
  });

  // =========================================================================
  // 4. DETERMINISTIC EVALUATION & CLINICAL SAFETY
  // =========================================================================
  describe('4. Deterministic Evaluation & Clinical Safety', () => {
    beforeEach(() => {
      prisma.patient.findFirst.mockResolvedValue({
        id: patientId,
        clinicId,
        dateOfBirth: new Date('1985-01-01'), // Adult (~41)
        gender: 'MALE',
      });
      resolver.resolveActiveRelease.mockResolvedValue(sampleResolvedPack);
    });

    it('should evaluate candidates deterministically and assign correct match tier', async () => {
      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.ABSENT },
        ],
        vitals: { temperatureC: 38.6 },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      expect(result.status).toBe('EVALUATED');
      expect(result.knowledgePack?.version).toBe('1.0.0');
      expect(result.candidateMatches.length).toBeGreaterThan(0);
      const strepMatch = result.candidateMatches.find((c) => c.conditionCode === 'COND-GM-STREP-002');
      expect(strepMatch).toBeDefined();
      expect(strepMatch?.tier).toBe('STRONG_MATCH');
      expect(result.tierSummary.strongMatchCount).toBeGreaterThan(0);
    });

    it('Infection Suspicion Safety: missing infectionSuspicion defaults to UNKNOWN, never SUSPECTED', async () => {
      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: { respiratoryRate: 24, systolicBp: 95 },
        // infectionSuspicion omitted!
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      expect(result.infectionSuspicion).toBe(InfectionSuspicionState.UNKNOWN);
      const qsofa = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
      expect(qsofa).toBeDefined();
      expect(qsofa?.triggered).toBe(true);
      // Because infection is UNKNOWN, fires non-sepsis physiology advisory!
      expect(qsofa?.title).toContain('Non-Sepsis Physiology Advisory');
      expect(qsofa?.title).not.toContain('Potential Sepsis Screening Alert');
    });

    it('Explicit SUSPECTED enables adult qSOFA sepsis screening alert', async () => {
      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: { respiratoryRate: 24, systolicBp: 95 },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      expect(result.infectionSuspicion).toBe(InfectionSuspicionState.SUSPECTED);
      const qsofa = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
      expect(qsofa?.triggered).toBe(true);
      expect(qsofa?.title).toContain('Potential Sepsis Screening Alert (Provisional qSOFA Criteria in Suspected Infection)');
    });

    it('Pediatric safety: patient under 18 never receives adult qSOFA', async () => {
      // Child born 8 years ago
      const childDob = new Date();
      childDob.setFullYear(childDob.getFullYear() - 8);

      prisma.patient.findFirst.mockResolvedValueOnce({
        id: patientId,
        clinicId,
        dateOfBirth: childDob,
        gender: 'MALE',
      });

      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: { respiratoryRate: 28, systolicBp: 85 },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      };

      const result = await service.evaluate(clinicId, clinicianId, dto);

      const qsofa = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
      expect(qsofa?.triggered).toBe(false);
      expect(qsofa?.title).toContain('qSOFA Inapplicable — Pediatric Context');
    });

    it('Zero-mutation guarantee: must never write to database during evaluation', async () => {
      prisma.consultation.findFirst.mockResolvedValueOnce({
        id: consultationId,
        clinicId,
        patientId,
      });

      const dto: EvaluateDifferentialDto = {
        patientId,
        consultationId,
        findings: [{ canonicalTerm: 'Sore throat', status: EvaluationFindingStatus.PRESENT }],
      };

      await service.evaluate(clinicId, clinicianId, dto);

      // Verify zero write calls to consultation or audit tables
      expect(prisma.consultation.update).not.toHaveBeenCalled();
      expect(prisma.consultation.updateMany).not.toHaveBeenCalled();
      expect(prisma.differentialDiagnosisAudit.create).not.toHaveBeenCalled();
    });

    it('Determinism: consecutive evaluations on identical input produce strictly identical output', async () => {
      const dto: EvaluateDifferentialDto = {
        patientId,
        findings: [
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.ABSENT },
        ],
        vitals: { temperatureC: 38.8, pulse: 84 },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      };

      const result1 = await service.evaluate(clinicId, clinicianId, dto);
      const result2 = await service.evaluate(clinicId, clinicianId, dto);

      expect(result1.status).toBe(result2.status);
      expect(result1.tierSummary).toEqual(result2.tierSummary);
      expect(result1.candidateMatches.length).toBe(result2.candidateMatches.length);
      expect(result1.candidateMatches[0].tier).toBe(result2.candidateMatches[0].tier);
      expect(result1.redFlags.length).toBe(result2.redFlags.length);
    });
  });

  // =========================================================================
  // 5. AUDIT RETRIEVAL, REVIEW RECORDING & KNOWLEDGE PACK METADATA
  // =========================================================================
  describe('5. Audit Retrieval, Review Recording & Knowledge Pack Metadata', () => {
    it('getEvaluationById: returns audit record when found by audit id in active clinic', async () => {
      const mockAudit = {
        id: 'audit-001',
        clinicId,
        consultationId,
        patientId,
        clinicianId,
        knowledgePackVerId: '1.0.0',
        matchedCandidatesJson: [],
      };
      prisma.differentialDiagnosisAudit.findFirst.mockResolvedValueOnce(mockAudit);

      const res = await service.getEvaluationById(clinicId, clinicianId, 'audit-001');

      expect(res).toBe(mockAudit);
      expect(prisma.differentialDiagnosisAudit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'audit-001', clinicId },
        }),
      );
    });

    it('getEvaluationById: falls back to consultationId when audit id not matched directly', async () => {
      const mockAudit = {
        id: 'audit-002',
        clinicId,
        consultationId,
        patientId,
        clinicianId,
      };
      prisma.differentialDiagnosisAudit.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAudit);

      const res = await service.getEvaluationById(clinicId, clinicianId, consultationId);

      expect(res).toBe(mockAudit);
      expect(prisma.differentialDiagnosisAudit.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { consultationId, clinicId },
        }),
      );
    });

    it('getEvaluationById: throws NotFoundException when no record exists', async () => {
      prisma.differentialDiagnosisAudit.findFirst.mockResolvedValue(null);

      await expect(
        service.getEvaluationById(clinicId, clinicianId, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('reviewEvaluation: updates existing audit record with clinician decisions', async () => {
      const mockExisting = { id: 'audit-001', clinicId };
      prisma.differentialDiagnosisAudit.findFirst.mockResolvedValueOnce(mockExisting);
      prisma.differentialDiagnosisAudit.update.mockResolvedValueOnce({
        id: 'audit-001',
        doctorDecisionsJson: { reviewedBy: clinicianId },
      });

      const res = await service.reviewEvaluation(clinicId, clinicianId, 'audit-001', {
        decisions: [
          {
            conditionCode: 'COND-PNEUMONIA-CAP',
            decision: 'ACCEPTED_AS_PRIMARY' as any,
          },
        ],
        reviewNotes: 'Verified with vitals',
      });

      expect(prisma.differentialDiagnosisAudit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'audit-001' },
          data: expect.objectContaining({
            doctorDecisionsJson: expect.objectContaining({
              reviewedBy: clinicianId,
              reviewNotes: 'Verified with vitals',
            }),
          }),
        }),
      );
      expect(res.id).toBe('audit-001');
    });

    it('reviewEvaluation: creates new audit record when id matches consultation', async () => {
      prisma.differentialDiagnosisAudit.findFirst.mockResolvedValueOnce(null);
      prisma.consultation.findFirst.mockResolvedValueOnce({
        id: consultationId,
        clinicId,
        patientId,
      });
      prisma.differentialDiagnosisAudit.create.mockResolvedValueOnce({
        id: 'new-audit-id',
        consultationId,
      });

      const res = await service.reviewEvaluation(clinicId, clinicianId, consultationId, {
        decisions: [
          {
            conditionCode: 'COND-ACUTE-BRONCHITIS',
            decision: 'REJECTED' as any,
          },
        ],
      });

      expect(prisma.differentialDiagnosisAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId,
            consultationId,
            clinicianId,
          }),
        }),
      );
      expect(res.id).toBe('new-audit-id');
    });

    it('reviewEvaluation: throws NotFoundException when neither audit nor consultation found', async () => {
      prisma.differentialDiagnosisAudit.findFirst.mockResolvedValueOnce(null);
      prisma.consultation.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.reviewEvaluation(clinicId, clinicianId, 'invalid-id', { decisions: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('listKnowledgePacks delegates to knowledgePackResolver', async () => {
      resolver.listKnowledgePacks.mockResolvedValueOnce([{ id: 'GENERAL_MEDICINE' }]);
      const res = await service.listKnowledgePacks(clinicId);
      expect(resolver.listKnowledgePacks).toHaveBeenCalledWith(clinicId);
      expect(res).toEqual([{ id: 'GENERAL_MEDICINE' }]);
    });

    it('getKnowledgePackVersion delegates to knowledgePackResolver', async () => {
      resolver.getKnowledgePackVersion.mockResolvedValueOnce({ domain: 'GENERAL_MEDICINE' });
      const res = await service.getKnowledgePackVersion(clinicId, 'GENERAL_MEDICINE');
      expect(resolver.getKnowledgePackVersion).toHaveBeenCalledWith(clinicId, 'GENERAL_MEDICINE');
      expect(res).toEqual({ domain: 'GENERAL_MEDICINE' });
    });
  });
});
