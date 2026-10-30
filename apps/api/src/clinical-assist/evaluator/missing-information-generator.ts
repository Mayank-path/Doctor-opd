import { DifferentialRuleSeed } from '../../../prisma/seeds/knowledge-pack.types';
import {
  ClinicalEvaluationContext,
  MissingInfoAlert,
  UnperformedAssessmentAlert,
} from './ast-evaluator.types';

export interface MissingDataEvaluationResult {
  missingInformation: MissingInfoAlert[];
  unperformedAssessments: UnperformedAssessmentAlert[];
}

/**
 * Generates missing information prompts and flags documented unperformed examinations.
 * Guarantees the Absence of Evidence Invariant: unperformed assessments are never evaluated as normal.
 */
export function generateMissingDataAlerts(
  rule: DifferentialRuleSeed,
  context: ClinicalEvaluationContext,
): MissingDataEvaluationResult {
  const missingInformation: MissingInfoAlert[] = [];
  const unperformedAssessments: UnperformedAssessmentAlert[] = [];
  const recordedUnperformedExams = new Set<string>();

  const missingRules = rule.missingDataRules || [];

  for (const ruleItem of missingRules) {
    // 1. Missing Vital Signs
    if (ruleItem.parameter) {
      const val = context.vitals[ruleItem.parameter];
      if (val === undefined) {
        missingInformation.push({
          parameter: ruleItem.parameter,
          prompt: ruleItem.prompt,
          reason: `Required vital sign "${ruleItem.parameter}" was not recorded in patient vitals.`,
        });
      }
    }

    // 2. Physical Examinations
    if (ruleItem.examination) {
      const examKey = ruleItem.examination.toLowerCase();
      const assess = context.assessmentsMap.get(examKey);

      if (!assess) {
        missingInformation.push({
          examination: ruleItem.examination,
          prompt: ruleItem.prompt,
          reason: `Physical examination "${ruleItem.examination}" was not mentioned in the encounter records.`,
        });
      } else if (assess.status === 'NOT_ASSESSED') {
        unperformedAssessments.push({
          examination: ruleItem.examination,
          prompt: ruleItem.prompt,
          status: 'NOT_ASSESSED',
          reason: `Examination "${ruleItem.examination}" was explicitly documented as unperformed (NOT_ASSESSED).`,
        });
        recordedUnperformedExams.add(examKey);
      }
    }
  }

  // 3. Scan context assessments for any other documented NOT_ASSESSED items
  for (const [examKey, assess] of context.assessmentsMap.entries()) {
    if (assess.status === 'NOT_ASSESSED' && !recordedUnperformedExams.has(examKey)) {
      unperformedAssessments.push({
        examination: assess.examination,
        prompt: `Examination "${assess.examination}" was documented as NOT_ASSESSED.`,
        status: 'NOT_ASSESSED',
        reason: assess.reason || 'Documented as unperformed in clinical assessment.',
      });
      recordedUnperformedExams.add(examKey);
    }
  }

  return {
    missingInformation,
    unperformedAssessments,
  };
}

