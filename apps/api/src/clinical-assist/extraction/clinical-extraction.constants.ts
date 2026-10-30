import {
  ClinicalAssessmentScope,
  ClinicalAssessmentStatus,
} from './clinical-extraction.types';

export const EXTRACTION_SCHEMA_VERSION = '1.0.0' as const;
export const EXTRACTION_ENGINE_VERSION = '1.0.0' as const;
export const NORMALIZATION_ENGINE_VERSION = '1.0.0' as const;

export const SYSTEM_SAFETY_NOTICE =
  'Extraction is an assistive aid only. Doctor verification is mandatory before saving to clinical record.';

/**
 * Prohibited Unicode control characters:
 * - ASCII C0 control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F) excluding \t (0x09), \n (0x0A), \r (0x0D)
 * - Unicode Bidirectional (BiDi) override and embedding codes (U+202A-U+202E, U+2066-U+2069)
 */
/* eslint-disable no-control-regex */
export const PROHIBITED_CONTROL_CHARS_REGEX =
  /[\u0000-\u0008\v\f\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;
/* eslint-enable no-control-regex */

/**
 * Standard mapping for canonical terminology identifiers.
 */
export const CANONICAL_TERM_ID_MAP: Record<string, string> = {
  fever: 'SYM-FEVER',
  cough: 'SYM-COUGH',
  headache: 'SYM-HEADACHE',
  'throat pain': 'SYM-THROAT-PAIN',
  'chest pain': 'SYM-CHEST-PAIN',
  'abdominal pain': 'SYM-ABDOMINAL-PAIN',
  vomiting: 'SYM-VOMITING',
  nausea: 'SYM-NAUSEA',
  diarrhea: 'SYM-DIARRHEA',
  breathlessness: 'SYM-BREATHLESSNESS',
  fatigue: 'SYM-FATIGUE',
  dizziness: 'SYM-DIZZINESS',
  'body ache': 'SYM-BODY-ACHE',
  'joint pain': 'SYM-JOINT-PAIN',
  'back pain': 'SYM-BACK-PAIN',
  rash: 'SYM-RASH',
  itching: 'SYM-ITCHING',
  'loss of appetite': 'SYM-LOSS-OF-APPETITE',
  'runny nose': 'SYM-RUNNY-NOSE',
  'burning sensation': 'SYM-BURNING-SENSATION',
};

/**
 * Generate a consistent canonical ID for any canonical term name.
 */
export function getCanonicalTermId(canonicalName: string): string {
  const normalized = canonicalName.trim().toLowerCase();
  if (CANONICAL_TERM_ID_MAP[normalized]) {
    return CANONICAL_TERM_ID_MAP[normalized];
  }
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
  return `SYM-${slug}`;
}

export interface AssessmentPatternEntry {
  regex: RegExp;
  targetSystemOrExam: string;
  scope: ClinicalAssessmentScope;
  status: ClinicalAssessmentStatus;
  defaultReason?: string;
}

/**
 * Curated patterns for explicitly unperformed, deferred, or partially performed clinical examinations.
 * Note: These strictly detect examination/assessment scopes, NEVER creating symptom findings.
 */
export const CLINICAL_ASSESSMENT_PATTERNS: AssessmentPatternEntry[] = [
  {
    regex:
      /\b(?:chest|respiratory|lungs?)\s+(?:examination|exam)\s+(?:not\s+performed|not\s+done|omitted|skipped|deferred)\b/i,
    targetSystemOrExam: 'Respiratory / Chest Examination',
    scope: 'SYSTEM_EXAMINATION',
    status: ClinicalAssessmentStatus.NOT_ASSESSED,
  },
  {
    regex:
      /\b(?:cvs|cardiovascular|cardiac|heart)\s+(?:examination|exam)\s+(?:not\s+performed|not\s+done|omitted|skipped|deferred)\b/i,
    targetSystemOrExam: 'Cardiovascular Examination',
    scope: 'SYSTEM_EXAMINATION',
    status: ClinicalAssessmentStatus.NOT_ASSESSED,
  },
  {
    regex:
      /\b(?:abdominal|abdomen|per\s+abdomen|pa)\s+(?:examination|exam)\s+(?:not\s+performed|not\s+done|omitted|skipped|deferred)\b/i,
    targetSystemOrExam: 'Abdominal Examination',
    scope: 'SYSTEM_EXAMINATION',
    status: ClinicalAssessmentStatus.NOT_ASSESSED,
  },
  {
    regex:
      /\b(?:cns|neurological|neuro)\s+(?:examination|exam)\s+(?:not\s+performed|not\s+done|omitted|skipped|deferred)\b/i,
    targetSystemOrExam: 'Neurological Examination',
    scope: 'SYSTEM_EXAMINATION',
    status: ClinicalAssessmentStatus.NOT_ASSESSED,
  },
  {
    regex:
      /\b(?:ent|throat|ear|nose)\s+(?:examination|exam)\s+(?:not\s+performed|not\s+done|omitted|skipped|deferred)\b/i,
    targetSystemOrExam: 'ENT / Throat Examination',
    scope: 'SYSTEM_EXAMINATION',
    status: ClinicalAssessmentStatus.NOT_ASSESSED,
  },
  {
    regex:
      /\b(?:general|physical)\s+(?:examination|exam)\s+(?:not\s+performed|not\s+done|omitted|skipped|deferred)\b/i,
    targetSystemOrExam: 'General Physical Examination',
    scope: 'SYSTEM_EXAMINATION',
    status: ClinicalAssessmentStatus.NOT_ASSESSED,
  },
];

/**
 * Subjective sensations distinct from canonical symptoms.
 * E.g., chills is a subjective sensation of cold, distinct from elevated body temperature (fever).
 */
export const SUBJECTIVE_SENSATION_ALIASES = [
  'chills',
  'chill',
  'feeling cold',
  'sensation of cold',
  'thand lagna',
  'thand lag rahi hai',
  'kampkampi',
  'thandi lagna',
  'ठंड लगना',
  'कंपकंपी',
];
