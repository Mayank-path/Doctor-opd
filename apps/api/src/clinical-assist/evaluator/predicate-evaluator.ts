import {
  AssessmentStatePredicate,
  ConceptStatusPredicate,
  NumericParamPredicate,
  PatientDemographicPredicate,
  SeverityLevelPredicate,
  TemporalDurationPredicate,
} from '../../../prisma/seeds/knowledge-pack.types';
import {
  ClinicalEvaluationContext,
  NodeEvaluationDetail,
  PredicateEvaluationResult,
} from './ast-evaluator.types';

/**
 * Pure, deterministic evaluation of typed AST leaf predicates against patient context.
 */
export function evaluateConceptStatusPredicate(
  pred: ConceptStatusPredicate,
  context: ClinicalEvaluationContext,
): NodeEvaluationDetail {
  const termKey = pred.canonicalTerm?.toLowerCase();
  const idKey = pred.conceptId?.toLowerCase();

  const finding =
    (termKey ? context.findingsMap.get(termKey) : undefined) ||
    (idKey ? context.findingsMap.get(idKey) : undefined);

  if (!finding) {
    // Check if an assessment for this concept was explicitly documented as NOT_ASSESSED
    const examKey = (pred.canonicalTerm || pred.conceptId || '').toLowerCase();
    const assess = context.assessmentsMap.get(examKey);
    if (assess && assess.status === 'NOT_ASSESSED') {
      return {
        nodeType: 'CONCEPT_STATUS',
        result: PredicateEvaluationResult.NOT_ASSESSED,
        satisfied: false,
        explanation: `Concept "${pred.canonicalTerm || pred.conceptId}" was documented as NOT_ASSESSED.`,
        canonicalTerm: pred.canonicalTerm,
        expected: pred.expectedStatus,
        actual: 'NOT_ASSESSED',
      };
    }

    return {
      nodeType: 'CONCEPT_STATUS',
      result: PredicateEvaluationResult.NOT_MENTIONED,
      satisfied: false,
      explanation: `Concept "${pred.canonicalTerm || pred.conceptId}" was not mentioned in clinical findings.`,
      canonicalTerm: pred.canonicalTerm,
      expected: pred.expectedStatus,
      actual: 'NOT_MENTIONED',
    };
  }

  // Exact matching for PRESENT and ABSENT
  if (finding.status === pred.expectedStatus) {
    return {
      nodeType: 'CONCEPT_STATUS',
      result: PredicateEvaluationResult.TRUE,
      satisfied: true,
      explanation: `Concept "${finding.canonicalTerm}" explicitly matched expected status ${pred.expectedStatus}.`,
      canonicalTerm: pred.canonicalTerm,
      expected: pred.expectedStatus,
      actual: finding.status,
    };
  }

  // Handle uncertain or unknown statuses
  if (finding.status === 'UNCERTAIN') {
    return {
      nodeType: 'CONCEPT_STATUS',
      result: PredicateEvaluationResult.UNCERTAIN,
      satisfied: false,
      explanation: `Concept "${finding.canonicalTerm}" is UNCERTAIN (linguistic doubt expressed by clinician).`,
      canonicalTerm: pred.canonicalTerm,
      expected: pred.expectedStatus,
      actual: 'UNCERTAIN',
    };
  }

  if (finding.status === 'UNKNOWN') {
    return {
      nodeType: 'CONCEPT_STATUS',
      result: PredicateEvaluationResult.UNKNOWN,
      satisfied: false,
      explanation: `Concept "${finding.canonicalTerm}" is UNKNOWN (status cannot be determined from available clinical documentation).`,
      canonicalTerm: pred.canonicalTerm,
      expected: pred.expectedStatus,
      actual: 'UNKNOWN',
    };
  }

  // Opposite status (e.g. expected PRESENT, but finding is ABSENT)
  return {
    nodeType: 'CONCEPT_STATUS',
    result: PredicateEvaluationResult.FALSE,
    satisfied: false,
    explanation: `Concept "${finding.canonicalTerm}" has status ${finding.status}, contradicting expected ${pred.expectedStatus}.`,
    canonicalTerm: pred.canonicalTerm,
    expected: pred.expectedStatus,
    actual: finding.status,
  };
}

/**
 * Evaluates numeric comparison predicates against vital signs and lab values.
 */
export function evaluateNumericParamPredicate(
  pred: NumericParamPredicate,
  context: ClinicalEvaluationContext,
): NodeEvaluationDetail {
  const actualVal = context.vitals[pred.parameter];

  if (actualVal === undefined) {
    return {
      nodeType: 'NUMERIC_PARAM',
      result: PredicateEvaluationResult.NOT_MENTIONED,
      satisfied: false,
      explanation: `Numeric parameter "${pred.parameter}" is not recorded in patient vitals.`,
      parameter: pred.parameter,
      expected: `${pred.operator} ${pred.value}`,
      actual: undefined,
    };
  }

  let satisfied = false;
  switch (pred.operator) {
    case 'GREATER_THAN':
      satisfied = actualVal > pred.value;
      break;
    case 'GREATER_THAN_OR_EQUAL':
      satisfied = actualVal >= pred.value;
      break;
    case 'LESS_THAN':
      satisfied = actualVal < pred.value;
      break;
    case 'LESS_THAN_OR_EQUAL':
      satisfied = actualVal <= pred.value;
      break;
    case 'EQUAL':
      satisfied = actualVal === pred.value;
      break;
    case 'BETWEEN':
      satisfied = actualVal >= pred.value && actualVal <= (pred.maxValue ?? pred.value);
      break;
    default:
      satisfied = false;
  }

  return {
    nodeType: 'NUMERIC_PARAM',
    result: satisfied ? PredicateEvaluationResult.TRUE : PredicateEvaluationResult.FALSE,
    satisfied,
    explanation: satisfied
      ? `Parameter "${pred.parameter}" (${actualVal}) satisfies ${pred.operator} ${pred.value}.`
      : `Parameter "${pred.parameter}" (${actualVal}) fails ${pred.operator} ${pred.value}.`,
    parameter: pred.parameter,
    expected: `${pred.operator} ${pred.value}${pred.maxValue !== undefined ? ` and ${pred.maxValue}` : ''}`,
    actual: actualVal,
  };
}

/**
 * Evaluates symptom duration in days.
 */
export function evaluateTemporalDurationPredicate(
  pred: TemporalDurationPredicate,
  context: ClinicalEvaluationContext,
): NodeEvaluationDetail {
  const termKey = pred.canonicalTerm?.toLowerCase();
  const idKey = pred.conceptId?.toLowerCase();

  const finding =
    (termKey ? context.findingsMap.get(termKey) : undefined) ||
    (idKey ? context.findingsMap.get(idKey) : undefined);

  if (!finding || finding.durationDays === undefined) {
    return {
      nodeType: 'TEMPORAL_DURATION',
      result: PredicateEvaluationResult.NOT_MENTIONED,
      satisfied: false,
      explanation: `Duration for concept "${pred.canonicalTerm || pred.conceptId}" is not recorded.`,
      canonicalTerm: pred.canonicalTerm,
      expected: `min: ${pred.minDays}, max: ${pred.maxDays}`,
      actual: undefined,
    };
  }

  const days = finding.durationDays;
  let satisfied = true;
  if (pred.minDays !== undefined && days < pred.minDays) {
    satisfied = false;
  }
  if (pred.maxDays !== undefined && days > pred.maxDays) {
    satisfied = false;
  }

  return {
    nodeType: 'TEMPORAL_DURATION',
    result: satisfied ? PredicateEvaluationResult.TRUE : PredicateEvaluationResult.FALSE,
    satisfied,
    explanation: satisfied
      ? `Duration (${days} days) for "${finding.canonicalTerm}" meets duration criteria.`
      : `Duration (${days} days) for "${finding.canonicalTerm}" fails duration criteria [${pred.minDays ?? 0}, ${pred.maxDays ?? 'inf'}].`,
    canonicalTerm: pred.canonicalTerm,
    expected: `min: ${pred.minDays ?? 0}, max: ${pred.maxDays ?? 'unlimited'}`,
    actual: days,
  };
}

/**
 * Evaluates symptom severity assessment.
 */
export function evaluateSeverityLevelPredicate(
  pred: SeverityLevelPredicate,
  context: ClinicalEvaluationContext,
): NodeEvaluationDetail {
  const termKey = pred.canonicalTerm?.toLowerCase();
  const idKey = pred.conceptId?.toLowerCase();

  const finding =
    (termKey ? context.findingsMap.get(termKey) : undefined) ||
    (idKey ? context.findingsMap.get(idKey) : undefined);

  if (!finding || !finding.severity) {
    return {
      nodeType: 'SEVERITY_LEVEL',
      result: PredicateEvaluationResult.NOT_MENTIONED,
      satisfied: false,
      explanation: `Severity for concept "${pred.canonicalTerm || pred.conceptId}" is not mentioned.`,
      canonicalTerm: pred.canonicalTerm,
      expected: pred.level,
      actual: undefined,
    };
  }

  const satisfied = finding.severity === pred.level;
  return {
    nodeType: 'SEVERITY_LEVEL',
    result: satisfied ? PredicateEvaluationResult.TRUE : PredicateEvaluationResult.FALSE,
    satisfied,
    explanation: satisfied
      ? `Severity "${finding.severity}" for "${finding.canonicalTerm}" matches expected "${pred.level}".`
      : `Severity "${finding.severity}" for "${finding.canonicalTerm}" does not match expected "${pred.level}".`,
    canonicalTerm: pred.canonicalTerm,
    expected: pred.level,
    actual: finding.severity,
  };
}

/**
 * Evaluates patient demographic filters.
 */
export function evaluatePatientDemographicPredicate(
  pred: PatientDemographicPredicate,
  context: ClinicalEvaluationContext,
): NodeEvaluationDetail {
  const { ageYears, gender } = context.demographics;

  if (pred.minAgeYears !== undefined) {
    if (ageYears === undefined || ageYears < pred.minAgeYears) {
      return {
        nodeType: 'PATIENT_DEMOGRAPHIC',
        result: PredicateEvaluationResult.FALSE,
        satisfied: false,
        explanation: `Patient age (${ageYears ?? 'unknown'}) is below required minimum of ${pred.minAgeYears} years.`,
        expected: `minAge: ${pred.minAgeYears}`,
        actual: ageYears,
      };
    }
  }

  if (pred.maxAgeYears !== undefined) {
    if (ageYears === undefined || ageYears > pred.maxAgeYears) {
      return {
        nodeType: 'PATIENT_DEMOGRAPHIC',
        result: PredicateEvaluationResult.FALSE,
        satisfied: false,
        explanation: `Patient age (${ageYears ?? 'unknown'}) exceeds maximum allowed of ${pred.maxAgeYears} years.`,
        expected: `maxAge: ${pred.maxAgeYears}`,
        actual: ageYears,
      };
    }
  }

  if (pred.gender && pred.gender !== 'ALL') {
    if (!gender || gender !== pred.gender) {
      return {
        nodeType: 'PATIENT_DEMOGRAPHIC',
        result: PredicateEvaluationResult.FALSE,
        satisfied: false,
        explanation: `Patient gender (${gender ?? 'unknown'}) does not match required gender "${pred.gender}".`,
        expected: pred.gender,
        actual: gender,
      };
    }
  }

  return {
    nodeType: 'PATIENT_DEMOGRAPHIC',
    result: PredicateEvaluationResult.TRUE,
    satisfied: true,
    explanation: 'Patient demographic criteria satisfied.',
    expected: pred,
    actual: { ageYears, gender },
  };
}

/**
 * Evaluates physical examination state predicates.
 */
export function evaluateAssessmentStatePredicate(
  pred: AssessmentStatePredicate,
  context: ClinicalEvaluationContext,
): NodeEvaluationDetail {
  const examKey = pred.examination.toLowerCase();
  const assess = context.assessmentsMap.get(examKey);

  if (!assess) {
    // If expected is NOT_ASSESSED, omission does NOT equal documented NOT_ASSESSED
    return {
      nodeType: 'ASSESSMENT_STATE',
      result: PredicateEvaluationResult.NOT_MENTIONED,
      satisfied: false,
      explanation: `Examination "${pred.examination}" was not mentioned in physical examination records.`,
      expected: pred.expectedState,
      actual: 'NOT_MENTIONED',
    };
  }

  const satisfied = assess.status === pred.expectedState;
  const result =
    assess.status === 'NOT_ASSESSED'
      ? PredicateEvaluationResult.NOT_ASSESSED
      : satisfied
      ? PredicateEvaluationResult.TRUE
      : PredicateEvaluationResult.FALSE;

  return {
    nodeType: 'ASSESSMENT_STATE',
    result,
    satisfied,
    explanation: satisfied
      ? `Examination "${pred.examination}" matched expected state "${pred.expectedState}".`
      : `Examination "${pred.examination}" has state "${assess.status}", expected "${pred.expectedState}".`,
    expected: pred.expectedState,
    actual: assess.status,
  };
}

