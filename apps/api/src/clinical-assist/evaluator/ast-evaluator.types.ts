import {
  AstNode,
  DifferentialMatchTier,
  DifferentialRuleSeed,
  KnowledgePackDomain,
  MissingDataRule,
  RedFlagRuleSeed,
} from '../../../prisma/seeds/knowledge-pack.types';

export type {
  AstNode,
  DifferentialRuleSeed,
  MissingDataRule,
  RedFlagRuleSeed,
};

export {
  DifferentialMatchTier,
  KnowledgePackDomain,
};

/**
 * Six discrete finding statuses supported by the clinical ontology.
 */
export enum EvaluationFindingStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  UNCERTAIN = 'UNCERTAIN',
  UNKNOWN = 'UNKNOWN',
  NOT_MENTIONED = 'NOT_MENTIONED',
  NOT_ASSESSED = 'NOT_ASSESSED',
}

/**
 * Explicit clinician-documented infection suspicion state.
 * Only explicitly documented SUSPECTED may enable adult qSOFA evaluation.
 */
export enum InfectionSuspicionState {
  SUSPECTED = 'SUSPECTED',
  NOT_SUSPECTED = 'NOT_SUSPECTED',
  UNKNOWN = 'UNKNOWN',
  NOT_ASSESSED = 'NOT_ASSESSED',
}

/**
 * Discrete evaluation outcome for a single AST predicate or node.
 */
export enum PredicateEvaluationResult {
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  UNCERTAIN = 'UNCERTAIN',
  UNKNOWN = 'UNKNOWN',
  NOT_MENTIONED = 'NOT_MENTIONED',
  NOT_ASSESSED = 'NOT_ASSESSED',
}

/**
 * Input finding representation for clinical evaluation.
 */
export interface ClinicalFindingInput {
  canonicalTerm: string;
  conceptId?: string;
  status: EvaluationFindingStatus | 'PRESENT' | 'ABSENT' | 'UNCERTAIN' | 'UNKNOWN';
  durationDays?: number;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  bodyLocation?: string;
}

/**
 * Validated vital signs input.
 */
export interface VitalSignsInput {
  VITAL_TEMPERATURE_C?: number;
  temperatureC?: number;
  VITAL_BP_SYSTOLIC?: number;
  systolicBp?: number;
  VITAL_BP_DIASTOLIC?: number;
  diastolicBp?: number;
  VITAL_PULSE?: number;
  pulse?: number;
  VITAL_SPO2?: number;
  spO2?: number;
  VITAL_RESPIRATORY_RATE?: number;
  respiratoryRate?: number;
  [key: string]: number | undefined;
}

/**
 * Patient demographic context.
 */
export interface PatientDemographicsInput {
  ageYears?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'ALL';
  isPregnant?: boolean;
}

/**
 * Physical examination or assessment record.
 */
export interface ClinicalAssessmentInput {
  examination: string;
  status: 'PERFORMED' | 'NOT_ASSESSED' | 'DEFERRED';
  reason?: string;
}

/**
 * Complete clinical evaluation input payload.
 */
export interface ClinicalEvaluationInput {
  findings: ClinicalFindingInput[];
  vitals?: VitalSignsInput;
  demographics?: PatientDemographicsInput;
  assessments?: ClinicalAssessmentInput[];
  infectionSuspicion?: InfectionSuspicionState | 'SUSPECTED' | 'NOT_SUSPECTED' | 'UNKNOWN' | 'NOT_ASSESSED';
}

/**
 * Fast O(1) indexed clinical evaluation context for deterministic evaluation.
 */
export interface ClinicalEvaluationContext {
  findingsMap: Map<string, ClinicalFindingInput>;
  vitals: Record<string, number>;
  demographics: PatientDemographicsInput;
  assessmentsMap: Map<string, ClinicalAssessmentInput>;
  infectionSuspicion: InfectionSuspicionState;
  supportingInfectionEvidence: string[];
  rawInput: ClinicalEvaluationInput;
}

/**
 * Detailed node evaluation result for auditability and explainability.
 */
export interface NodeEvaluationDetail {
  nodeType: string;
  result: PredicateEvaluationResult;
  satisfied: boolean;
  explanation: string;
  parameter?: string;
  canonicalTerm?: string;
  expected?: any;
  actual?: any;
  children?: NodeEvaluationDetail[];
}

/**
 * Detailed evaluation outcome for a differential criterion group.
 */
export interface CriterionEvaluationDetail {
  satisfied: boolean;
  result: PredicateEvaluationResult;
  explanation: string;
  detail: NodeEvaluationDetail;
}

/**
 * Missing information alert generated from missingDataRules.
 */
export interface MissingInfoAlert {
  parameter?: string;
  examination?: string;
  prompt: string;
  reason: string;
}

/**
 * Explicit alert for documented unperformed physical examinations.
 */
export interface UnperformedAssessmentAlert {
  examination: string;
  prompt: string;
  status: 'NOT_ASSESSED';
  reason: string;
}

/**
 * Evaluated condition candidate match result.
 */
export interface ConditionEvaluationResult {
  conditionCode: string;
  conditionDisplayName: string;
  category: string;
  ruleCode: string;
  ruleTitle: string;
  tier: DifferentialMatchTier | null;
  minMajorCount: number;
  majorSupportingMatchedCount: number;
  mandatoryResult: CriterionEvaluationDetail;
  majorSupportingResults: CriterionEvaluationDetail[];
  minorSupportingResults: CriterionEvaluationDetail[];
  contradictionResults: CriterionEvaluationDetail[];
  contradictionTriggered: boolean;
  missingInformation: MissingInfoAlert[];
  unperformedAssessments: UnperformedAssessmentAlert[];
  suggestedInvestigations: string[];
  isComplete: boolean;
  evidenceStatus?: string;
  rationale: string;
}

/**
 * Evaluated red-flag emergency rule outcome.
 */
export interface RedFlagEvaluationResult {
  flagCode: string;
  title: string;
  urgencyLevel: 'IMMEDIATE' | 'HIGH';
  triggered: boolean;
  clinicalAction: string;
  evaluatedAstDetail: NodeEvaluationDetail;
  sourceReferenceIdentifier?: string;
  disclaimer: string;
  isProvisional?: boolean;
  provisionalWarning?: string;
  quarantinedPredicates?: string[];
  missingAssessmentNotice?: string;
  clinicalContextNotice?: string;
  infectionSuspicionState?: InfectionSuspicionState;
  gatingExplanation?: string;
  supportingInfectionEvidence?: string[];
}

/**
 * Top-level immutable result of the Differential Diagnosis AST Evaluator.
 */
export interface DifferentialEvaluationResult {
  evaluatedAt: string;
  engineVersion: '1.0.0';
  infectionSuspicion: InfectionSuspicionState;
  redFlags: RedFlagEvaluationResult[];
  hasUrgentRedFlags: boolean;
  candidateMatches: ConditionEvaluationResult[];
  strongMatches: ConditionEvaluationResult[];
  moderateMatches: ConditionEvaluationResult[];
  possibleMatches: ConditionEvaluationResult[];
  contradictedMatches: ConditionEvaluationResult[];
  unmatchedCount: number;
  warnings: string[];
  requiresDoctorReview: true;
}
