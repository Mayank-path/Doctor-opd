import {
  DetectedClinicalLanguage,
  DurationUnit,
  SymptomCertainty,
  SymptomPolarity,
  SymptomSeverity,
} from '../normalization/clinical-normalization.types';

export {
  DetectedClinicalLanguage,
  DurationUnit,
  SymptomCertainty,
  SymptomPolarity,
  SymptomSeverity,
};

/**
 * Strict 4-state clinical finding ontology.
 * Represents only the clinical reality of an individual finding mentioned in the source.
 * NOT_ASSESSED belongs to ClinicalAssessmentRecord.
 * NOT_MENTIONED is represented purely by omission from the findings payload.
 */
export enum ClinicalFindingStatus {
  /** Explicitly reported positive finding with supporting evidence (e.g. "bukhar hai") */
  PRESENT = 'PRESENT',
  /** Explicitly denied or negated finding (e.g. "khansi nahi hai") */
  ABSENT = 'ABSENT',
  /** Finding reported with explicit linguistic uncertainty (e.g. "shayad headache hai") */
  UNCERTAIN = 'UNCERTAIN',
  /** Finding mentioned, but evidence is contradictory or sequence is unresolvable */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Status of an examination or organ-system assessment.
 */
export enum ClinicalAssessmentStatus {
  NOT_ASSESSED = 'NOT_ASSESSED',
  PARTIALLY_ASSESSED = 'PARTIALLY_ASSESSED',
  DEFERRED = 'DEFERRED',
}

/**
 * Scope of a clinical examination or assessment.
 */
export type ClinicalAssessmentScope =
  'ORGAN_SYSTEM' | 'SYSTEM_EXAMINATION' | 'PHYSICAL_MANEUVER' | 'PROCEDURE';

/**
 * Clinically defensible concept categorization.
 * Subjective patient sensations are strictly separated from objective signs and diagnoses.
 */
export type ExtractedConceptCategory =
  | 'SYMPTOM' // Subjective complaint reported by patient (e.g. fever, headache)
  | 'SUBJECTIVE_SENSATION' // Subjective sensory feeling (e.g. chills, feeling cold)
  | 'CLINICAL_SIGN' // Objective, observable physical sign (e.g. wheezing, rigors, stridor)
  | 'DIAGNOSIS_OR_CONDITION' // Pathological disease entity (e.g. migraine, pharyngitis, angina)
  | 'TEMPORAL_DESCRIPTOR' // Chronological marker (e.g. acute, chronic, kal se)
  | 'UNCLASSIFIED_EXPRESSION'; // Expression whose medical category cannot be safely determined

/**
 * Three-state severity assessment modeling.
 * Distinguishes unmentioned severity from explicitly unclear severity.
 */
export enum SeverityAssessmentState {
  NOT_MENTIONED = 'NOT_MENTIONED', // Severity was never discussed
  EXPLICITLY_UNCLEAR = 'EXPLICITLY_UNCLEAR', // Explicitly declared unclear (e.g. "severity unclear")
  ASSESSED = 'ASSESSED', // Explicitly rated (e.g. MILD, MODERATE, SEVERE)
}

/**
 * Structured severity assessment.
 */
export interface ClinicalSeverityAssessment {
  state: SeverityAssessmentState;
  level: SymptomSeverity | null; // Null if NOT_MENTIONED or EXPLICITLY_UNCLEAR; never inferred
  evidence: EvidenceSpan | null;
}

/**
 * Deterministic extraction rule identifier for end-to-end explainability.
 */
export type ExtractionRuleId =
  | 'RULE-STATUS-PRESENT-001'
  | 'RULE-STATUS-ABSENT-002'
  | 'RULE-STATUS-UNCERTAIN-003'
  | 'RULE-STATUS-UNKNOWN-CONFLICT-004'
  | 'RULE-TEMPORAL-MULTI-STATEMENT-005'
  | 'RULE-CONCEPT-SENSATION-ISOLATION-006'
  | 'RULE-CONCEPT-SIGN-ISOLATION-007'
  | 'RULE-CONCEPT-DIAGNOSIS-ISOLATION-008'
  | 'RULE-ASSESSMENT-NOT-PERFORMED-009'
  | 'RULE-SEVERITY-ASSESSMENT-010';

/**
 * Exact substring offsets in source text.
 * Refers strictly to UTF-16 code units of the original input string.
 * Set to null if character offsets cannot be guaranteed following Unicode normalization.
 */
export interface EvidenceSpan {
  text: string;
  startIndex: number | null;
  endIndex: number | null;
  sourceField: 'originalDoctorConfirmedText' | 'normalizedEvidence';
}

/**
 * Complete audit and rule provenance node.
 */
export interface ClinicalProvenance {
  ruleId: ExtractionRuleId;
  ruleDescription: string;
  matchedAlias?: string | null;
  canonicalTermId?: string;
  evidence: EvidenceSpan;
  engineVersion: string;
}

/**
 * Discrete temporal clinical statement.
 * Preserves multi-phase clinical expressions without loss of historical evidence.
 */
export interface ClinicalTemporalStatement {
  statementId: string;
  temporalAnchor: 'CURRENT' | 'HISTORICAL' | 'UNKNOWN_TIMING';
  status: ClinicalFindingStatus;
  evidence: EvidenceSpan;
  duration: {
    raw: string;
    value: number | null;
    unit: DurationUnit | null;
  } | null;
  onset: string | null;
}

/**
 * Chronological transition type between two clinical statements.
 */
export type ChronologicalTransitionType =
  | 'IMPROVED' // Episode diminished in severity or intensity while remaining present
  | 'RESOLVED' // Episode completely ceased / patient became asymptomatic
  | 'RECURRED' // Episode returned after an explicitly supported period of remission
  | 'WORSENED' // Episode explicitly increased in intensity or severity beyond baseline
  | 'NEW_ONSET' // Explicitly documented new occurrence without unsupported previous assumptions
  | 'AMBIGUOUS'; // Chronological sequence is established, but transition nature cannot be safely classified

/**
 * Explicit chronological relationship connecting two statements for a finding.
 */
export interface ChronologicalRelationship {
  relationshipId: string;
  priorStatementId: string;
  subsequentStatementId: string;
  transitionType: ChronologicalTransitionType;
  evidence: EvidenceSpan;
  confidence: 'EXPLICIT_IN_TEXT' | 'AMBIGUOUS';
}

/**
 * Anatomical body location specification.
 */
export interface ClinicalBodyLocation {
  name: string | null;
  isDefault: boolean;
  evidenceSpan: EvidenceSpan | null;
}

/**
 * Individual structured clinical finding (subjective symptom).
 */
export interface StructuredClinicalFinding {
  id: string; // e.g. "finding-fever-0"
  canonicalTermId: string; // e.g. "SYM-FEVER"
  canonicalDisplayName: string; // e.g. "Fever"
  originalExpression: string; // e.g. "bukhar"
  conceptCategory: ExtractedConceptCategory; // strictly 'SYMPTOM'
  status: ClinicalFindingStatus; // Consolidated active clinical status (PRESENT, ABSENT, UNCERTAIN, UNKNOWN)
  certainty: SymptomCertainty;
  temporalStatements: ClinicalTemporalStatement[]; // Explicit list of temporal episodes
  chronologicalRelationships: ChronologicalRelationship[]; // Multi-episode chronological relationships
  severityAssessment: ClinicalSeverityAssessment; // Explicit 3-state severity model
  bodyLocation: ClinicalBodyLocation;
  provenance: ClinicalProvenance[];
  validationWarnings: string[];
}

/**
 * Dedicated record for physical examinations, organ systems, or procedures.
 * Completely separate from individual symptom findings.
 */
export interface ClinicalAssessmentRecord {
  id: string; // e.g. "assess-chest-exam-0"
  assessmentScope: ClinicalAssessmentScope;
  targetSystemOrExam: string; // e.g. "Respiratory / Chest Examination"
  status: ClinicalAssessmentStatus;
  reason: string | null; // e.g. "patient uncooperative", "not indicated", or null
  evidence: EvidenceSpan;
  provenance: ClinicalProvenance[];
}

/**
 * Clinical expression preserved without symptom mapping to avoid diagnostic contamination.
 */
export interface UnmappedClinicalExpression {
  expression: string;
  category: ExtractedConceptCategory;
  reason: string;
  evidence: EvidenceSpan;
  provenanceRule: ExtractionRuleId;
}

/**
 * Review metadata ensuring strict human-in-the-loop clinical governance.
 */
export interface ClinicalReviewMetadata {
  requiresDoctorReview: true;
  reviewStatus: 'PENDING_REVIEW'; // Extraction endpoint unconditionally returns PENDING_REVIEW
  systemSafetyNotice: string;
}

/**
 * Summary counts of clinical findings and assessments.
 */
export interface StructuredExtractionSummaryCounts {
  totalFindings: number;
  presentCount: number;
  absentCount: number;
  uncertainCount: number;
  unknownCount: number;
  unmappedCount: number;
  clinicalAssessmentsCount: number;
}

/**
 * Top-level immutable response payload for Phase 5B extraction.
 */
export interface StructuredClinicalExtractionResult {
  schemaVersion: '1.0.0';
  extractionEngineVersion: '1.0.0';
  normalizationEngineVersion: '1.0.0';
  source: {
    originalDoctorConfirmedText: string;
    detectedLanguage: DetectedClinicalLanguage;
    characterCount: number;
  };
  findings: StructuredClinicalFinding[];
  clinicalAssessments: ClinicalAssessmentRecord[];
  unmappedExpressions: UnmappedClinicalExpression[];
  summaryCounts: StructuredExtractionSummaryCounts;
  review: ClinicalReviewMetadata;
}
