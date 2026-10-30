import {
  AstNode,
  LogicalNode,
  LogicalOperator,
  MAX_AST_DEPTH,
  MAX_AST_NODES,
} from '../../../prisma/seeds/knowledge-pack.types';
import {
  ClinicalEvaluationContext,
  NodeEvaluationDetail,
  PredicateEvaluationResult,
} from './ast-evaluator.types';
import {
  evaluateAssessmentStatePredicate,
  evaluateConceptStatusPredicate,
  evaluateNumericParamPredicate,
  evaluatePatientDemographicPredicate,
  evaluateSeverityLevelPredicate,
  evaluateTemporalDurationPredicate,
} from './predicate-evaluator';

/**
 * Traversal node counter to guarantee strictly bounded algorithmic execution.
 */
export interface AstNodeCounter {
  count: number;
}

/**
 * Pure, deterministic recursive evaluator for AST nodes.
 * Strictly enforces MAX_AST_DEPTH (5) and MAX_AST_NODES (50).
 */
export function evaluateAst(
  node: AstNode,
  context: ClinicalEvaluationContext,
  currentDepth = 1,
  counter?: AstNodeCounter,
): NodeEvaluationDetail {
  if (!node || typeof node !== 'object') {
    throw new Error('AST Evaluation Error: AST node must be a non-null object.');
  }

  // 1. Enforce depth boundary
  if (currentDepth > MAX_AST_DEPTH) {
    throw new RangeError(
      `AST Execution Boundary Violation: Maximum AST depth of ${MAX_AST_DEPTH} exceeded (current depth: ${currentDepth}).`,
    );
  }

  // 2. Enforce node count boundary
  if (!counter) {
    counter = { count: 0 };
  }
  counter.count++;
  if (counter.count > MAX_AST_NODES) {
    throw new RangeError(
      `AST Execution Boundary Violation: Maximum AST node limit of ${MAX_AST_NODES} exceeded (current count: ${counter.count}).`,
    );
  }

  // 3. Leaf Predicates (CONCEPT_STATUS, NUMERIC_PARAM, TEMPORAL_DURATION, etc.)
  if ('type' in node && typeof (node as any).type === 'string') {
    const predType = (node as any).type;
    switch (predType) {
      case 'CONCEPT_STATUS':
        return evaluateConceptStatusPredicate(node as any, context);
      case 'NUMERIC_PARAM':
        return evaluateNumericParamPredicate(node as any, context);
      case 'TEMPORAL_DURATION':
        return evaluateTemporalDurationPredicate(node as any, context);
      case 'SEVERITY_LEVEL':
        return evaluateSeverityLevelPredicate(node as any, context);
      case 'PATIENT_DEMOGRAPHIC':
        return evaluatePatientDemographicPredicate(node as any, context);
      case 'ASSESSMENT_STATE':
        return evaluateAssessmentStatePredicate(node as any, context);
      default:
        throw new Error(`AST Evaluation Error: Unsupported predicate type "${predType}".`);
    }
  }

  // 4. Composite Logical Nodes (ALL, ANY, NONE, AT_LEAST_N)
  if ('operator' in node && 'predicates' in node) {
    const logicalNode = node as LogicalNode;
    const operator = logicalNode.operator as LogicalOperator;
    const predicates = logicalNode.predicates || [];

    if (!Array.isArray(predicates)) {
      throw new Error(`AST Evaluation Error: Logical node predicates must be an array.`);
    }

    const childDetails: NodeEvaluationDetail[] = [];
    for (const child of predicates) {
      childDetails.push(evaluateAst(child, context, currentDepth + 1, counter));
    }

    let satisfied = false;
    let result = PredicateEvaluationResult.FALSE;
    let explanation = '';

    switch (operator) {
      case 'ALL': {
        const failedChild = childDetails.find((c) => !c.satisfied);
        if (!failedChild) {
          satisfied = true;
          result = PredicateEvaluationResult.TRUE;
          explanation = `ALL ${childDetails.length} criteria satisfied.`;
        } else {
          satisfied = false;
          result = failedChild.result;
          explanation = `ALL criteria failed: ${failedChild.explanation}`;
        }
        break;
      }
      case 'ANY': {
        const satisfiedChild = childDetails.find((c) => c.satisfied);
        if (satisfiedChild) {
          satisfied = true;
          result = PredicateEvaluationResult.TRUE;
          explanation = `ANY criteria satisfied by: ${satisfiedChild.explanation}`;
        } else {
          satisfied = false;
          const indeterminate = childDetails.find(
            (c) =>
              c.result === PredicateEvaluationResult.UNCERTAIN ||
              c.result === PredicateEvaluationResult.NOT_ASSESSED,
          );
          result = indeterminate ? indeterminate.result : PredicateEvaluationResult.FALSE;
          explanation = `ANY criteria failed: none of the ${childDetails.length} predicates matched.`;
        }
        break;
      }
      case 'NONE': {
        const violatedChild = childDetails.find((c) => c.satisfied);
        if (violatedChild) {
          satisfied = false;
          result = PredicateEvaluationResult.FALSE;
          explanation = `NONE criteria violated: ${violatedChild.explanation}`;
        } else {
          satisfied = true;
          result = PredicateEvaluationResult.TRUE;
          explanation = `NONE criteria satisfied: 0 of ${childDetails.length} contraindicated predicates present.`;
        }
        break;
      }
      case 'AT_LEAST_N': {
        const threshold = logicalNode.threshold ?? 1;
        const satisfiedCount = childDetails.filter((c) => c.satisfied).length;
        if (satisfiedCount >= threshold) {
          satisfied = true;
          result = PredicateEvaluationResult.TRUE;
          explanation = `AT_LEAST_N (${threshold}) satisfied: ${satisfiedCount}/${childDetails.length} criteria met.`;
        } else {
          satisfied = false;
          result = PredicateEvaluationResult.FALSE;
          explanation = `AT_LEAST_N (${threshold}) failed: only ${satisfiedCount}/${childDetails.length} criteria met (required ${threshold}).`;
        }
        break;
      }
      default:
        throw new Error(`AST Evaluation Error: Unsupported logical operator "${operator}".`);
    }

    return {
      nodeType: operator,
      result,
      satisfied,
      explanation,
      children: childDetails,
    };
  }

  throw new Error('AST Evaluation Error: Invalid AST node structure. Neither operator nor type present.');
}

/**
 * Checks whether an evaluation detail subtree contains an explicit negation
 * of a concept status (e.g. expected PRESENT but context has ABSENT, or vice versa).
 */
export function hasExplicitNegation(detail: NodeEvaluationDetail): boolean {
  if (
    detail.nodeType === 'CONCEPT_STATUS' &&
    detail.result === PredicateEvaluationResult.FALSE &&
    ((detail.expected === 'PRESENT' && detail.actual === 'ABSENT') ||
      (detail.expected === 'ABSENT' && detail.actual === 'PRESENT'))
  ) {
    return true;
  }

  if (detail.children && detail.children.length > 0) {
    return detail.children.some(hasExplicitNegation);
  }

  return false;
}

/**
 * Checks whether an evaluation detail subtree contains at least one satisfied node.
 */
export function hasAnySatisfiedNode(detail: NodeEvaluationDetail): boolean {
  if (detail.satisfied) {
    return true;
  }

  if (detail.children && detail.children.length > 0) {
    return detail.children.some(hasAnySatisfiedNode);
  }

  return false;
}
