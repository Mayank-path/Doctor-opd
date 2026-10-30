import { BIOLOGICAL_RANGES } from '../../../prisma/seeds/knowledge-pack.types';
import {
  ClinicalAssessmentInput,
  ClinicalEvaluationContext,
  ClinicalEvaluationInput,
  ClinicalFindingInput,
  EvaluationFindingStatus,
  InfectionSuspicionState,
} from './ast-evaluator.types';

export const MAX_INPUT_FINDINGS = 50;

/**
 * Validates clinical evaluation input and constructs an indexed, fast O(1) evaluation context.
 * Strictly enforces biological vital-sign ranges and physiological coherence.
 */
export function validateAndBuildEvaluationContext(
  input: ClinicalEvaluationInput,
): ClinicalEvaluationContext {
  if (!input || typeof input !== 'object') {
    throw new Error('Input Validation Error: Evaluation input must be a non-null object.');
  }

  // 1. Findings validation
  const rawFindings = input.findings || [];
  if (!Array.isArray(rawFindings)) {
    throw new Error('Input Validation Error: "findings" must be an array.');
  }
  if (rawFindings.length > MAX_INPUT_FINDINGS) {
    throw new Error(
      `Input Validation Error: Findings count (${rawFindings.length}) exceeds maximum limit of ${MAX_INPUT_FINDINGS}.`,
    );
  }

  const findingsMap = new Map<string, ClinicalFindingInput>();
  const allowedStatuses = new Set([
    EvaluationFindingStatus.PRESENT,
    EvaluationFindingStatus.ABSENT,
    EvaluationFindingStatus.UNCERTAIN,
    EvaluationFindingStatus.UNKNOWN,
  ]);

  for (let i = 0; i < rawFindings.length; i++) {
    const finding = rawFindings[i];
    if (!finding || typeof finding !== 'object') {
      throw new Error(`Input Validation Error: Finding at index ${i} is not a valid object.`);
    }

    const term = finding.canonicalTerm?.trim();
    if (!term) {
      throw new Error(`Input Validation Error: Finding at index ${i} is missing canonicalTerm.`);
    }

    if (!allowedStatuses.has(finding.status as EvaluationFindingStatus)) {
      throw new Error(
        `Input Validation Error: Finding "${term}" has invalid status "${finding.status}". Allowed: PRESENT, ABSENT, UNCERTAIN, UNKNOWN.`,
      );
    }

    // Index by lower-case canonicalTerm
    findingsMap.set(term.toLowerCase(), finding);

    // Also index by conceptId if provided
    if (finding.conceptId?.trim()) {
      findingsMap.set(finding.conceptId.trim().toLowerCase(), finding);
    }
  }

  // 2. Vitals validation & normalization
  const normalizedVitals: Record<string, number> = {};
  const rawVitals = input.vitals || {};

  // Alias mapping
  const vitalAliasMap: Record<string, string> = {
    temperatureC: 'VITAL_TEMPERATURE_C',
    systolicBp: 'VITAL_BP_SYSTOLIC',
    diastolicBp: 'VITAL_BP_DIASTOLIC',
    pulse: 'VITAL_PULSE',
    spO2: 'VITAL_SPO2',
    respiratoryRate: 'VITAL_RESPIRATORY_RATE',
  };

  // Merge canonical keys and aliases
  for (const [key, val] of Object.entries(rawVitals)) {
    if (val === undefined || val === null) continue;
    if (typeof val !== 'number' || Number.isNaN(val)) {
      throw new Error(`Input Validation Error: Vital sign "${key}" must be a valid number.`);
    }

    const canonicalKey = vitalAliasMap[key] || key;
    normalizedVitals[canonicalKey] = val;
  }

  // Biological range enforcement (zero silent clamping)
  for (const [paramKey, range] of Object.entries(BIOLOGICAL_RANGES)) {
    const val = normalizedVitals[paramKey];
    if (val !== undefined) {
      if (val < range.min || val > range.max) {
        throw new RangeError(
          `Biological Range Violation: ${paramKey} value ${val} outside [${range.min}, ${range.max}] ${range.unit}`,
        );
      }
    }
  }

  // Physiological Blood Pressure Coherence Check
  const sbp = normalizedVitals['VITAL_BP_SYSTOLIC'];
  const dbp = normalizedVitals['VITAL_BP_DIASTOLIC'];
  if (sbp !== undefined && dbp !== undefined) {
    if (sbp < dbp) {
      throw new Error(
        `Physiological Incoherence Violation: Systolic BP (${sbp} mmHg) cannot be lower than Diastolic BP (${dbp} mmHg).`,
      );
    }
  }

  // 3. Demographics validation
  const demographics = input.demographics || {};
  if (demographics.ageYears !== undefined) {
    if (
      typeof demographics.ageYears !== 'number' ||
      Number.isNaN(demographics.ageYears) ||
      demographics.ageYears < 0 ||
      demographics.ageYears > 130
    ) {
      throw new RangeError(
        `Demographic Violation: Age (${demographics.ageYears}) must be between 0 and 130 years.`,
      );
    }
  }

  const allowedGenders = new Set(['MALE', 'FEMALE', 'OTHER', 'ALL']);
  if (demographics.gender && !allowedGenders.has(demographics.gender)) {
    throw new Error(
      `Demographic Violation: Invalid gender "${demographics.gender}". Allowed: MALE, FEMALE, OTHER, ALL.`,
    );
  }

  // 4. Assessments validation & indexing
  const assessmentsMap = new Map<string, ClinicalAssessmentInput>();
  const rawAssessments = input.assessments || [];
  const allowedAssessmentStatuses = new Set(['PERFORMED', 'NOT_ASSESSED', 'DEFERRED']);

  for (let i = 0; i < rawAssessments.length; i++) {
    const assess = rawAssessments[i];
    if (!assess || typeof assess !== 'object') {
      throw new Error(`Input Validation Error: Assessment at index ${i} is not a valid object.`);
    }

    const exam = assess.examination?.trim();
    if (!exam) {
      throw new Error(`Input Validation Error: Assessment at index ${i} is missing examination.`);
    }

    if (!allowedAssessmentStatuses.has(assess.status)) {
      throw new Error(
        `Input Validation Error: Assessment "${exam}" has invalid status "${assess.status}". Allowed: PERFORMED, NOT_ASSESSED, DEFERRED.`,
      );
    }

    assessmentsMap.set(exam.toLowerCase(), assess);
  }

  // 5. Explicit Infection Suspicion State Validation
  const allowedInfectionStates = new Set([
    InfectionSuspicionState.SUSPECTED,
    InfectionSuspicionState.NOT_SUSPECTED,
    InfectionSuspicionState.UNKNOWN,
    InfectionSuspicionState.NOT_ASSESSED,
  ]);

  let infectionSuspicion: InfectionSuspicionState = InfectionSuspicionState.UNKNOWN;
  if (input.infectionSuspicion !== undefined && input.infectionSuspicion !== null) {
    if (!allowedInfectionStates.has(input.infectionSuspicion as InfectionSuspicionState)) {
      throw new Error(
        `Input Validation Error: Invalid infectionSuspicion "${input.infectionSuspicion}". Allowed: SUSPECTED, NOT_SUSPECTED, UNKNOWN, NOT_ASSESSED.`,
      );
    }
    infectionSuspicion = input.infectionSuspicion as InfectionSuspicionState;
  }

  // Supporting evidence detection (informative only — never establishes infection suspicion!)
  const supportingInfectionEvidence: string[] = [];
  const temp = normalizedVitals['VITAL_TEMPERATURE_C'];
  if (temp !== undefined && temp >= 38.0) {
    supportingInfectionEvidence.push(`Febrile body temperature (>= 38.0 C; measured: ${temp} C)`);
  }
  const feverFinding = findingsMap.get('fever');
  if (feverFinding && feverFinding.status === EvaluationFindingStatus.PRESENT) {
    supportingInfectionEvidence.push('Fever documented as PRESENT');
  }
  const chillsFinding = findingsMap.get('chills');
  if (chillsFinding && chillsFinding.status === EvaluationFindingStatus.PRESENT) {
    supportingInfectionEvidence.push('Chills documented as PRESENT');
  }
  const specificInfectionTerms = [
    'infection',
    'suspected infection',
    'pneumonia',
    'sepsis',
    'pyelonephritis',
    'cellulitis',
    'abscess',
    'meningitis',
    'cholangitis',
    'peritonitis',
  ];
  for (const term of specificInfectionTerms) {
    const finding = findingsMap.get(term);
    if (finding && finding.status === EvaluationFindingStatus.PRESENT) {
      supportingInfectionEvidence.push(
        `Infection-related concept "${finding.canonicalTerm}" documented as PRESENT`,
      );
    }
  }

  return {
    findingsMap,
    vitals: normalizedVitals,
    demographics,
    assessmentsMap,
    infectionSuspicion,
    supportingInfectionEvidence,
    rawInput: input,
  };
}

