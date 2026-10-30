import { KnowledgePackDomain, KnowledgePackReleaseStatus } from '@prisma/client';
import {
  ConditionEvaluationResult,
  InfectionSuspicionState,
  RedFlagEvaluationResult,
} from '../../evaluator/ast-evaluator.types';

export const DIFFERENTIAL_DIAGNOSIS_DISCLAIMER =
  'DOCTOR-OPD Clinical Assist Differential Diagnosis is an assistive clinical decision support tool for registered medical practitioners under NMC regulations. It does NOT generate autonomous diagnoses, clinical directives, prescriptions, or drug dosages. The attending physician retains sole clinical authority and responsibility.';

/**
 * Knowledge pack release metadata returned with evaluation.
 */
export interface KnowledgePackReleaseMetadataDto {
  domain: KnowledgePackDomain;
  version: string;
  releaseStatus: KnowledgePackReleaseStatus;
  releaseScope: 'GLOBAL' | 'CLINIC';
  checksumSha256: string;
}

/**
 * Patient demographic context resolved by the server.
 */
export interface ResolvedPatientDemographicContextDto {
  patientId: string;
  resolvedAgeYears?: number;
  ageSource: 'PATIENT_DOB' | 'CLIENT_DEMOGRAPHIC' | 'UNRECORDED';
  gender?: string;
}

/**
 * Summary breakdown of candidate match counts by tier.
 */
export interface DifferentialTierSummaryDto {
  strongMatchCount: number;
  moderateMatchCount: number;
  possibleMatchCount: number;
  contradictedMatchCount: number;
  unmatchedCount: number;
}

/**
 * Top-level response for the Differential Diagnosis API.
 */
export interface DifferentialEvaluationResponseDto {
  status: 'EVALUATED' | 'UNAVAILABLE';
  evaluatedAt: string;
  engineVersion: string;
  knowledgePack?: KnowledgePackReleaseMetadataDto;
  patientContext: ResolvedPatientDemographicContextDto;
  infectionSuspicion: InfectionSuspicionState;
  hasUrgentRedFlags: boolean;
  redFlags: RedFlagEvaluationResult[];
  candidateMatches: ConditionEvaluationResult[];
  tierSummary: DifferentialTierSummaryDto;
  warnings: string[];
  requiresDoctorReview: true;
  disclaimer: string;
  message?: string;
}

