import {
  DifferentialMatchTier,
  RuleApplicability,
} from '../../../prisma/seeds/knowledge-pack.types';
import {
  NodeEvaluationDetail,
  PatientDemographicsInput,
} from './ast-evaluator.types';
import { hasAnySatisfiedNode, hasExplicitNegation } from './ast-traversal';

export interface TierClassificationResult {
  tier: DifferentialMatchTier | null;
  isApplicable: boolean;
  inapplicabilityReason?: string;
  contradictionTriggered: boolean;
  majorSupportingMatchedCount: number;
  rationale: string;
}

/**
 * Pure, deterministic classifier for differential diagnosis candidate match tiers.
 * Exactly implements Ratified Section 4.2 tier hierarchy.
 */
export function classifyMatchTier(
  mandatoryDetail: NodeEvaluationDetail,
  majorDetails: NodeEvaluationDetail[],
  minorDetails: NodeEvaluationDetail[],
  contradictionDetails: NodeEvaluationDetail[],
  minMajorCount: number,
  applicability?: RuleApplicability,
  demographics?: PatientDemographicsInput,
): TierClassificationResult {
  // 1. Encounter and demographic applicability check
  if (applicability && demographics) {
    const { ageYears, gender } = demographics;

    if (applicability.minAgeYears !== undefined && ageYears !== undefined) {
      if (ageYears < applicability.minAgeYears) {
        return {
          tier: null,
          isApplicable: false,
          inapplicabilityReason: `Patient age (${ageYears}y) is below rule minimum of ${applicability.minAgeYears}y.`,
          contradictionTriggered: false,
          majorSupportingMatchedCount: 0,
          rationale: `Rule not applicable: patient age (${ageYears}y) below minimum requirement.`,
        };
      }
    }

    if (applicability.maxAgeYears !== undefined && ageYears !== undefined) {
      if (ageYears > applicability.maxAgeYears) {
        return {
          tier: null,
          isApplicable: false,
          inapplicabilityReason: `Patient age (${ageYears}y) exceeds rule maximum of ${applicability.maxAgeYears}y.`,
          contradictionTriggered: false,
          majorSupportingMatchedCount: 0,
          rationale: `Rule not applicable: patient age (${ageYears}y) exceeds maximum requirement.`,
        };
      }
    }

    if (applicability.gender && applicability.gender !== 'ALL') {
      if (gender && gender !== applicability.gender) {
        return {
          tier: null,
          isApplicable: false,
          inapplicabilityReason: `Patient gender (${gender}) does not match required ${applicability.gender}.`,
          contradictionTriggered: false,
          majorSupportingMatchedCount: 0,
          rationale: `Rule not applicable: patient gender does not match requirement.`,
        };
      }
    }
  }

  // Count satisfied major supporting criteria
  const majorSupportingMatchedCount = majorDetails.filter((d) => d.satisfied).length;

  // 2. CONTRADICTED evaluation (Absolute precedence)
  const contradictionRuleFired = contradictionDetails.some((d) => d.satisfied);
  const mandatoryNegated = !mandatoryDetail.satisfied && hasExplicitNegation(mandatoryDetail);

  if (contradictionRuleFired || mandatoryNegated) {
    const reason = contradictionRuleFired
      ? 'Contradiction rule explicitly matched.'
      : 'Mandatory clinical criterion explicitly negated.';
    return {
      tier: DifferentialMatchTier.CONTRADICTED,
      isApplicable: true,
      contradictionTriggered: true,
      majorSupportingMatchedCount,
      rationale: `Contradicted: ${reason}`,
    };
  }

  // 3. STRONG_MATCH and MODERATE_MATCH (All mandatory criteria satisfied)
  if (mandatoryDetail.satisfied) {
    if (majorSupportingMatchedCount >= minMajorCount) {
      return {
        tier: DifferentialMatchTier.STRONG_MATCH,
        isApplicable: true,
        contradictionTriggered: false,
        majorSupportingMatchedCount,
        rationale: `Strong match: Mandatory criteria satisfied and ${majorSupportingMatchedCount}/${minMajorCount} required major supporting criteria met.`,
      };
    } else {
      return {
        tier: DifferentialMatchTier.MODERATE_MATCH,
        isApplicable: true,
        contradictionTriggered: false,
        majorSupportingMatchedCount,
        rationale: `Moderate match: Mandatory criteria satisfied, but only ${majorSupportingMatchedCount}/${minMajorCount} major supporting criteria met.`,
      };
    }
  }

  // 4. POSSIBLE (Mandatory incomplete, but at least one positive criterion met)
  const hasPositiveEvidence =
    hasAnySatisfiedNode(mandatoryDetail) ||
    majorSupportingMatchedCount > 0 ||
    minorDetails.some((d) => d.satisfied);

  if (hasPositiveEvidence) {
    return {
      tier: DifferentialMatchTier.POSSIBLE,
      isApplicable: true,
      contradictionTriggered: false,
      majorSupportingMatchedCount,
      rationale:
        'Possible match: Key clinical symptoms detected, but mandatory diagnostic criteria remain incomplete.',
    };
  }

  // 5. UNMATCHED (No criteria satisfied)
  return {
    tier: null,
    isApplicable: true,
    contradictionTriggered: false,
    majorSupportingMatchedCount: 0,
    rationale: 'Unmatched: No supporting or mandatory clinical criteria were satisfied.',
  };
}

