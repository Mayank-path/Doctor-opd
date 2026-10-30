import {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
  DifferentialMatchTier,
  DoctorCandidateAction,
} from '@prisma/client';

export {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
  DifferentialMatchTier,
  DoctorCandidateAction,
};

/**
 * Structural execution safety limits for AST rules.
 * Ratified in Phase 5B.3.2 to prevent algorithmic complexity and ReDoS attacks.
 */
export const MAX_AST_DEPTH = 5;
export const MAX_AST_NODES = 50;
export const MAX_RULES_PER_PACK = 500;

/**
 * Allowlisted logical operators for composite AST nodes.
 */
export type LogicalOperator = 'ALL' | 'ANY' | 'NONE' | 'AT_LEAST_N';

/**
 * Allowlisted predicate types for leaf AST nodes.
 */
export type PredicateType =
  | 'CONCEPT_STATUS'
  | 'NUMERIC_PARAM'
  | 'TEMPORAL_DURATION'
  | 'SEVERITY_LEVEL'
  | 'PATIENT_DEMOGRAPHIC'
  | 'ASSESSMENT_STATE';

/**
 * Allowed comparison operators for numeric vitals/lab values.
 */
export type NumericOperator =
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'EQUAL'
  | 'BETWEEN';

/**
 * Biological range validation rules for vitals.
 */
export const BIOLOGICAL_RANGES: Record<
  string,
  { min: number; max: number; unit: string }
> = {
  VITAL_TEMPERATURE_C: { min: 30.0, max: 45.0, unit: 'C' },
  VITAL_BP_SYSTOLIC: { min: 40, max: 300, unit: 'mmHg' },
  VITAL_BP_DIASTOLIC: { min: 20, max: 200, unit: 'mmHg' },
  VITAL_PULSE: { min: 20, max: 260, unit: 'bpm' },
  VITAL_SPO2: { min: 50, max: 100, unit: '%' },
  VITAL_RESPIRATORY_RATE: { min: 4, max: 80, unit: 'breaths/min' },
};

/**
 * Concept status matching predicate.
 */
export interface ConceptStatusPredicate {
  type: 'CONCEPT_STATUS';
  conceptId?: string;
  canonicalTerm?: string;
  expectedStatus: 'PRESENT' | 'ABSENT' | 'UNCERTAIN';
  importance?: 'MANDATORY' | 'MAJOR' | 'MINOR';
  rationale?: string;
}

/**
 * Quantitative numeric comparison predicate.
 */
export interface NumericParamPredicate {
  type: 'NUMERIC_PARAM';
  parameter: string;
  operator: NumericOperator;
  value: number;
  maxValue?: number;
  unit?: string;
}

/**
 * Chronological duration matching predicate.
 */
export interface TemporalDurationPredicate {
  type: 'TEMPORAL_DURATION';
  conceptId?: string;
  canonicalTerm?: string;
  minDays?: number;
  maxDays?: number;
}

/**
 * Explicit symptom severity matching predicate.
 */
export interface SeverityLevelPredicate {
  type: 'SEVERITY_LEVEL';
  conceptId?: string;
  canonicalTerm?: string;
  level: 'MILD' | 'MODERATE' | 'SEVERE';
}

/**
 * Patient demographic matching predicate.
 */
export interface PatientDemographicPredicate {
  type: 'PATIENT_DEMOGRAPHIC';
  minAgeYears?: number;
  maxAgeYears?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'ALL';
}

/**
 * Objective clinical examination state matching predicate.
 */
export interface AssessmentStatePredicate {
  type: 'ASSESSMENT_STATE';
  examination: string;
  expectedState: 'PERFORMED' | 'NOT_ASSESSED' | 'DEFERRED';
}

/**
 * Composite logical AST node.
 */
export interface LogicalNode {
  operator: LogicalOperator;
  threshold?: number; // Required when operator is AT_LEAST_N
  predicates: AstNode[];
}

/**
 * Unified AST Node type.
 */
export type AstNode =
  | ConceptStatusPredicate
  | NumericParamPredicate
  | TemporalDurationPredicate
  | SeverityLevelPredicate
  | PatientDemographicPredicate
  | AssessmentStatePredicate
  | LogicalNode;

/**
 * Missing-data prompt definition for mandatory examinations or vitals.
 */
export interface MissingDataRule {
  parameter?: string;
  examination?: string;
  prompt: string;
}

/**
 * Encounter and demographic applicability filter.
 */
export interface RuleApplicability {
  minAgeYears?: number;
  maxAgeYears?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'ALL';
  encounterType?: string;
}

/**
 * Clinical condition seed definition.
 */
export interface ClinicalConditionSeed {
  conditionCode: string;
  displayName: string;
  icd10Guidance?: string | null;
  description: string;
  category: string;
  evidenceStatus:
    | 'AUTHORITATIVE_ICMR_WHO'
    | 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION';
}

/**
 * Differential diagnosis rule seed definition.
 */
export interface DifferentialRuleSeed {
  ruleCode: string;
  conditionCode: string;
  ruleTitle: string;
  minMajorCount: number;
  applicability: RuleApplicability;
  mandatoryAst: AstNode;
  majorSupporting: AstNode[];
  minorSupporting?: AstNode[];
  contradictions?: AstNode[];
  missingDataRules?: MissingDataRule[];
  investigations?: string[];
  sourceReferenceIdentifiers?: string[];
  isComplete?: boolean;
}

/**
 * Red flag emergency alert rule seed definition.
 */
export interface RedFlagRuleSeed {
  flagCode: string;
  title: string;
  urgencyLevel: 'IMMEDIATE' | 'HIGH';
  clinicalAction: string;
  ruleAst: AstNode;
  sourceReferenceIdentifier?: string;
}

/**
 * Authoritative clinical guideline source reference seed.
 */
export interface ClinicalSourceReferenceSeed {
  referenceIdentifier: string;
  sourceOrganization: string;
  sourceTitle: string;
  publicationDate: string;
  sectionIdentifier: string;
  sourceUrlOrDoi: string;
  licensingStatus: string;
  evidenceScope: string;
}

/**
 * Mapping between rules and source references.
 */
export interface RuleSourceMappingSeed {
  ruleCode: string;
  sourceReferenceIdentifier: string;
}

/**
 * Complete knowledge pack seed bundle.
 */
export interface KnowledgePackSeed {
  domain: KnowledgePackDomain;
  name: string;
  description: string;
  version: {
    major: number;
    minor: number;
    patch: number;
    changelog: string;
  };
  conditions: ClinicalConditionSeed[];
  rules: DifferentialRuleSeed[];
  redFlags: RedFlagRuleSeed[];
  sources: ClinicalSourceReferenceSeed[];
  mappings: RuleSourceMappingSeed[];
}

