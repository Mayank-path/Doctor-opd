import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KnowledgePackDomain } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AstEvaluatorEngine } from '../../evaluator/ast-evaluator.engine';
import {
  ClinicalEvaluationInput,
  InfectionSuspicionState,
} from '../../evaluator/ast-evaluator.types';
import {
  DIFFERENTIAL_DIAGNOSIS_DISCLAIMER,
  DifferentialEvaluationResponseDto,
} from '../dto/differential-response.dto';
import { EvaluateDifferentialDto } from '../dto/evaluate-differential.dto';
import { KnowledgePackResolverService } from './knowledge-pack-resolver.service';

@Injectable()
export class DifferentialDiagnosisService {
  private readonly logger = new Logger(DifferentialDiagnosisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgePackResolver: KnowledgePackResolverService,
  ) {}

  /**
   * Evaluates differential diagnosis candidates and emergency red flags for an outpatient encounter.
   *
   * Security & Safety Guarantees:
   * 1. Multi-tenant isolation: Patient must belong to active clinic; returns 404 otherwise.
   * 2. Consultation ownership: If supplied, consultation must belong to active clinic and patient.
   * 3. Clinician verification: Clinician must hold verified DOCTOR role in the active clinic.
   * 4. Trusted demographic derivation: Server derives age from patient DOB, overriding client claims.
   * 5. Explicit infection suspicion: Defaults to UNKNOWN, never silently promotes to SUSPECTED.
   * 6. Zero automatic writes: Pure evaluation pipeline, no consultation or diagnosis mutations.
   * 7. Safe unavailable response: If no approved release exists, returns safe UNAVAILABLE payload.
   */
  async evaluate(
    clinicId: string,
    clinicianId: string,
    dto: EvaluateDifferentialDto,
  ): Promise<DifferentialEvaluationResponseDto> {
    // 1. Verify patient exists in active clinic (prevents cross-tenant information leaks)
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: dto.patientId,
        clinicId,
        deletedAt: null,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // 2. If consultationId is supplied, verify it belongs to the active clinic and patient
    if (dto.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: {
          id: dto.consultationId,
          clinicId,
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      if (consultation.patientId !== patient.id) {
        throw new BadRequestException(
          'Consultation does not belong to the specified patient',
        );
      }
    }

    // 3. Resolve trusted patient demographics (derive age from server DOB if available)
    let resolvedAgeYears: number | undefined;
    let ageSource: 'PATIENT_DOB' | 'CLIENT_DEMOGRAPHIC' | 'UNRECORDED' =
      'UNRECORDED';

    if (patient.dateOfBirth) {
      resolvedAgeYears = this.calculateAgeInYears(patient.dateOfBirth);
      ageSource = 'PATIENT_DOB';
    } else if (dto.demographics?.ageYears !== undefined) {
      resolvedAgeYears = dto.demographics.ageYears;
      ageSource = 'CLIENT_DEMOGRAPHIC';
    }

    const domain = dto.domain ?? KnowledgePackDomain.GENERAL_MEDICINE;

    // 4. Resolve eligible active knowledge-pack release
    const resolvedPack = await this.knowledgePackResolver.resolveActiveRelease(
      clinicId,
      domain,
    );

    const infectionSuspicion =
      dto.infectionSuspicion ?? InfectionSuspicionState.UNKNOWN;

    // If no eligible APPROVED/RELEASED pack exists, return explicit safe UNAVAILABLE response
    if (!resolvedPack) {
      return {
        status: 'UNAVAILABLE',
        evaluatedAt: new Date().toISOString(),
        engineVersion: '1.0.0',
        patientContext: {
          patientId: patient.id,
          resolvedAgeYears,
          ageSource,
          gender: patient.gender,
        },
        infectionSuspicion,
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
        warnings: [
          `KNOWLEDGE_PACK_UNAVAILABLE: No active RELEASED knowledge pack release configured for domain "${domain}".`,
        ],
        requiresDoctorReview: true,
        disclaimer: DIFFERENTIAL_DIAGNOSIS_DISCLAIMER,
        message: `Differential diagnosis evaluation is currently unavailable. No active released knowledge pack for domain ${domain} is configured for this clinic.`,
      };
    }

    // 5. Construct trusted evaluator input
    const evaluatorInput: ClinicalEvaluationInput = {
      findings: dto.findings.map((f) => ({
        canonicalTerm: f.canonicalTerm,
        conceptId: f.conceptId,
        status: f.status,
        durationDays: f.durationDays,
        severity: f.severity,
        bodyLocation: f.bodyLocation,
      })),
      vitals: dto.vitals ? { ...dto.vitals } : undefined,
      demographics: {
        ageYears: resolvedAgeYears,
        gender: (dto.demographics?.gender as any) || (patient.gender as any),
        isPregnant: dto.demographics?.isPregnant,
      },
      infectionSuspicion,
      assessments: dto.assessments?.map((a) => ({
        examination: a.examination,
        status: a.status,
        reason: a.reason,
      })),
    };

    // 6. Run pure, deterministic AST Evaluator Engine
    const engine = new AstEvaluatorEngine(resolvedPack.bundle);
    const evalResult = engine.evaluateDifferential(evaluatorInput);

    // 7. Assemble API response
    return {
      status: 'EVALUATED',
      evaluatedAt: evalResult.evaluatedAt,
      engineVersion: evalResult.engineVersion,
      knowledgePack: resolvedPack.metadata,
      patientContext: {
        patientId: patient.id,
        resolvedAgeYears,
        ageSource,
        gender: patient.gender,
      },
      infectionSuspicion: evalResult.infectionSuspicion,
      hasUrgentRedFlags: evalResult.hasUrgentRedFlags,
      redFlags: evalResult.redFlags,
      candidateMatches: evalResult.candidateMatches,
      tierSummary: {
        strongMatchCount: evalResult.strongMatches.length,
        moderateMatchCount: evalResult.moderateMatches.length,
        possibleMatchCount: evalResult.possibleMatches.length,
        contradictedMatchCount: evalResult.contradictedMatches.length,
        unmatchedCount: evalResult.unmatchedCount,
      },
      warnings: evalResult.warnings,
      requiresDoctorReview: true,
      disclaimer: DIFFERENTIAL_DIAGNOSIS_DISCLAIMER,
    };
  }

  /**
   * Calculates exact integer age in completed years from Date of Birth relative to current server date.
   */
  private calculateAgeInYears(dob: Date, referenceDate: Date = new Date()): number {
    const birthDate = new Date(dob);
    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return Math.max(0, age);
  }
}

