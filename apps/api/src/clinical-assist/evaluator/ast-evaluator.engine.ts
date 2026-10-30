import { GENERAL_MEDICINE_CONDITIONS } from '../../../prisma/seeds/general-medicine/conditions.data';
import { GENERAL_MEDICINE_DIFFERENTIAL_RULES } from '../../../prisma/seeds/general-medicine/differential-rules.data';
import { GENERAL_MEDICINE_RED_FLAGS } from '../../../prisma/seeds/general-medicine/red-flag-rules.data';
import {
  ClinicalConditionSeed,
  DifferentialMatchTier,
  DifferentialRuleSeed,
  RedFlagRuleSeed,
} from '../../../prisma/seeds/knowledge-pack.types';
import {
  ClinicalEvaluationContext,
  ClinicalEvaluationInput,
  ConditionEvaluationResult,
  CriterionEvaluationDetail,
  DifferentialEvaluationResult,
  RedFlagEvaluationResult,
} from './ast-evaluator.types';
import { validateAndBuildEvaluationContext } from './ast-input-validator';
import { evaluateAst } from './ast-traversal';
import { classifyMatchTier } from './match-tier-classifier';
import { generateMissingDataAlerts } from './missing-information-generator';
import { evaluateRedFlags } from './red-flag-evaluator';

export interface EvaluatorEngineOptions {
  evaluatedAt?: string;
}

export interface KnowledgePackBundle {
  conditions: ClinicalConditionSeed[];
  rules: DifferentialRuleSeed[];
  redFlags: RedFlagRuleSeed[];
}

/**
 * Pure, deterministic AST Evaluator Engine for DOCTOR-OPD.
 * Evaluates clinical findings, vitals, and assessments against Knowledge Pack AST rules.
 *
 * Guarantees:
 * 1. 100% Deterministic: Identical inputs strictly yield identical outputs.
 * 2. Zero dynamic code execution (no eval, Function, or dynamic regex).
 * 3. Enforces bounded execution (depth <= 5, nodes <= 50, findings <= 50).
 * 4. Strictly enforces biological vital ranges and physiological BP coherence.
 * 5. NMC 2023 compliance: decision-support assistive tool, doctor maintains full autonomy.
 */
export class AstEvaluatorEngine {
  private readonly conditionsMap: Map<string, ClinicalConditionSeed>;
  private readonly rules: DifferentialRuleSeed[];
  private readonly redFlags: RedFlagRuleSeed[];

  constructor(bundle?: KnowledgePackBundle) {
    const conditions = bundle?.conditions ?? GENERAL_MEDICINE_CONDITIONS;
    this.rules = bundle?.rules ?? GENERAL_MEDICINE_DIFFERENTIAL_RULES;
    this.redFlags = bundle?.redFlags ?? GENERAL_MEDICINE_RED_FLAGS;

    this.conditionsMap = new Map<string, ClinicalConditionSeed>();
    for (const cond of conditions) {
      this.conditionsMap.set(cond.conditionCode, cond);
    }
  }

  /**
   * Main entry point: Evaluates patient context across all active knowledge pack rules.
   */
  public evaluateDifferential(
    input: ClinicalEvaluationInput,
    options?: EvaluatorEngineOptions,
  ): DifferentialEvaluationResult {
    // 1. Validate inputs and construct O(1) indexed evaluation context
    const context = validateAndBuildEvaluationContext(input);

    // 2. Evaluate high-acuity Red Flag emergency rules independently
    const redFlagResults = evaluateRedFlags(this.redFlags, context);
    const hasUrgentRedFlags = redFlagResults.some((rf) => rf.triggered);

    // 3. Evaluate each differential rule deterministically
    const allEvaluations: ConditionEvaluationResult[] = [];

    for (const rule of this.rules) {
      const condition = this.conditionsMap.get(rule.conditionCode);
      if (!condition) {
        continue;
      }

      const evalResult = this.evaluateConditionRule(rule, condition, context);
      allEvaluations.push(evalResult);
    }

    // 4. Categorize by match tier
    const strongMatches: ConditionEvaluationResult[] = [];
    const moderateMatches: ConditionEvaluationResult[] = [];
    const possibleMatches: ConditionEvaluationResult[] = [];
    const contradictedMatches: ConditionEvaluationResult[] = [];
    let unmatchedCount = 0;

    for (const item of allEvaluations) {
      switch (item.tier) {
        case DifferentialMatchTier.STRONG_MATCH:
          strongMatches.push(item);
          break;
        case DifferentialMatchTier.MODERATE_MATCH:
          moderateMatches.push(item);
          break;
        case DifferentialMatchTier.POSSIBLE:
          possibleMatches.push(item);
          break;
        case DifferentialMatchTier.CONTRADICTED:
          contradictedMatches.push(item);
          break;
        default:
          unmatchedCount++;
          break;
      }
    }

    // Deterministic sorting
    const tierPriority: Record<DifferentialMatchTier, number> = {
      [DifferentialMatchTier.RED_FLAG_URGENT]: 0,
      [DifferentialMatchTier.STRONG_MATCH]: 1,
      [DifferentialMatchTier.MODERATE_MATCH]: 2,
      [DifferentialMatchTier.POSSIBLE]: 3,
      [DifferentialMatchTier.CONTRADICTED]: 4,
    };

    const candidateMatches = allEvaluations
      .filter((item): item is ConditionEvaluationResult & { tier: DifferentialMatchTier } => item.tier !== null)
      .sort((a, b) => {
        const priorityDiff = tierPriority[a.tier] - tierPriority[b.tier];
        if (priorityDiff !== 0) return priorityDiff;
        return a.conditionCode.localeCompare(b.conditionCode);
      });

    // Sort sub-lists deterministically
    strongMatches.sort((a, b) => a.conditionCode.localeCompare(b.conditionCode));
    moderateMatches.sort((a, b) => a.conditionCode.localeCompare(b.conditionCode));
    possibleMatches.sort((a, b) => a.conditionCode.localeCompare(b.conditionCode));
    contradictedMatches.sort((a, b) => a.conditionCode.localeCompare(b.conditionCode));

    // Compile clinical warnings
    const warnings: string[] = [];
    if (hasUrgentRedFlags) {
      warnings.push(
        'CRITICAL ALERT: Emergency red flag criteria triggered. Immediate clinical escalation recommended. High-acuity advisory only; does not generate prescriptions or autonomous medication orders.',
      );
    }

    // Machine-readable provisional qSOFA warning identifying 2-criteria vital assessment
    const qsofaResult = redFlagResults.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
    if (qsofaResult?.isProvisional && qsofaResult.provisionalWarning) {
      warnings.push(qsofaResult.provisionalWarning);
    }
    const totalUnperformed = candidateMatches.reduce(
      (sum, c) => sum + c.unperformedAssessments.length,
      0,
    );
    if (totalUnperformed > 0) {
      warnings.push(
        `${totalUnperformed} physical examination(s) were explicitly documented as unperformed (NOT_ASSESSED).`,
      );
    }

    return {
      evaluatedAt: options?.evaluatedAt ?? new Date().toISOString(),
      engineVersion: '1.0.0',
      infectionSuspicion: context.infectionSuspicion,
      redFlags: redFlagResults,
      hasUrgentRedFlags,
      candidateMatches,
      strongMatches,
      moderateMatches,
      possibleMatches,
      contradictedMatches,
      unmatchedCount,
      warnings,
      requiresDoctorReview: true,
    };
  }

  /**
   * Pure evaluation of a single condition differential rule.
   */
  public evaluateConditionRule(
    rule: DifferentialRuleSeed,
    condition: ClinicalConditionSeed,
    context: ClinicalEvaluationContext,
  ): ConditionEvaluationResult {
    // 1. Evaluate Mandatory AST
    const mandatoryDetail = evaluateAst(rule.mandatoryAst, context);
    const mandatoryResult: CriterionEvaluationDetail = {
      satisfied: mandatoryDetail.satisfied,
      result: mandatoryDetail.result,
      explanation: mandatoryDetail.explanation,
      detail: mandatoryDetail,
    };

    // 2. Evaluate Major Supporting ASTs
    const majorSupportingResults: CriterionEvaluationDetail[] = (rule.majorSupporting || []).map(
      (ast) => {
        const detail = evaluateAst(ast, context);
        return {
          satisfied: detail.satisfied,
          result: detail.result,
          explanation: detail.explanation,
          detail,
        };
      },
    );

    // 3. Evaluate Minor Supporting ASTs
    const minorSupportingResults: CriterionEvaluationDetail[] = (rule.minorSupporting || []).map(
      (ast) => {
        const detail = evaluateAst(ast, context);
        return {
          satisfied: detail.satisfied,
          result: detail.result,
          explanation: detail.explanation,
          detail,
        };
      },
    );

    // 4. Evaluate Contradictions ASTs
    const contradictionResults: CriterionEvaluationDetail[] = (rule.contradictions || []).map(
      (ast) => {
        const detail = evaluateAst(ast, context);
        return {
          satisfied: detail.satisfied,
          result: detail.result,
          explanation: detail.explanation,
          detail,
        };
      },
    );

    // 5. Generate Missing Information & Unperformed Assessments
    const { missingInformation, unperformedAssessments } = generateMissingDataAlerts(rule, context);

    // 6. Deterministic Tier Classification
    const classification = classifyMatchTier(
      mandatoryDetail,
      majorSupportingResults.map((r) => r.detail),
      minorSupportingResults.map((r) => r.detail),
      contradictionResults.map((r) => r.detail),
      rule.minMajorCount ?? 1,
      rule.applicability,
      context.demographics,
    );

    return {
      conditionCode: condition.conditionCode,
      conditionDisplayName: condition.displayName,
      category: condition.category,
      ruleCode: rule.ruleCode,
      ruleTitle: rule.ruleTitle,
      tier: classification.tier,
      minMajorCount: rule.minMajorCount ?? 1,
      majorSupportingMatchedCount: classification.majorSupportingMatchedCount,
      mandatoryResult,
      majorSupportingResults,
      minorSupportingResults,
      contradictionResults,
      contradictionTriggered: classification.contradictionTriggered,
      missingInformation,
      unperformedAssessments,
      suggestedInvestigations: rule.investigations || [],
      isComplete: rule.isComplete ?? false,
      evidenceStatus: condition.evidenceStatus,
      rationale: classification.rationale,
    };
  }
}
