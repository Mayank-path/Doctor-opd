import * as crypto from 'crypto';
import {
  AstNode,
  BIOLOGICAL_RANGES,
  KnowledgePackSeed,
  LogicalNode,
  MAX_AST_DEPTH,
  MAX_AST_NODES,
  MAX_RULES_PER_PACK,
  NumericParamPredicate,
} from './knowledge-pack.types';

/**
 * Validates an AST node and its sub-trees against structural safety constraints.
 * Enforces MAX_AST_DEPTH, MAX_AST_NODES, and biological numeric ranges.
 */
export function validateAstTree(
  node: AstNode,
  currentDepth = 1,
): { nodeCount: number; maxDepth: number } {
  if (currentDepth > MAX_AST_DEPTH) {
    throw new Error(
      `AST Depth Violation: Current depth ${currentDepth} exceeds MAX_AST_DEPTH (${MAX_AST_DEPTH})`,
    );
  }

  if (!node || typeof node !== 'object') {
    throw new Error(`Invalid AST node: Expected object, received ${typeof node}`);
  }

  let totalNodes = 1;
  let deepest = currentDepth;

  // Composite Logical Node (distinguished by child predicates array)
  if ('predicates' in node) {
    const logical = node as LogicalNode;
    const allowedOperators = ['ALL', 'ANY', 'NONE', 'AT_LEAST_N'];
    if (!allowedOperators.includes(logical.operator)) {
      throw new Error(`Invalid logical operator: ${logical.operator}`);
    }
    if (logical.operator === 'AT_LEAST_N') {
      if (typeof logical.threshold !== 'number' || logical.threshold < 1) {
        throw new Error(`AT_LEAST_N requires integer threshold >= 1`);
      }
    }
    if (!Array.isArray(logical.predicates) || logical.predicates.length === 0) {
      throw new Error(
        `Logical operator ${logical.operator} must have at least one predicate`,
      );
    }
    for (const child of logical.predicates) {
      const childStats = validateAstTree(child, currentDepth + 1);
      totalNodes += childStats.nodeCount;
      if (childStats.maxDepth > deepest) {
        deepest = childStats.maxDepth;
      }
    }
  } else if ('type' in node) {
    // Leaf Predicate Node
    const allowedTypes = [
      'CONCEPT_STATUS',
      'NUMERIC_PARAM',
      'TEMPORAL_DURATION',
      'SEVERITY_LEVEL',
      'PATIENT_DEMOGRAPHIC',
      'ASSESSMENT_STATE',
    ];
    if (!allowedTypes.includes(node.type)) {
      throw new Error(`Invalid predicate type: ${node.type}`);
    }

    if (node.type === 'NUMERIC_PARAM') {
      const numNode = node as NumericParamPredicate;
      const range = BIOLOGICAL_RANGES[numNode.parameter];
      if (range) {
        if (numNode.value < range.min || numNode.value > range.max) {
          throw new Error(
            `Biological Range Violation: ${numNode.parameter} value ${numNode.value} outside [${range.min}, ${range.max}] ${range.unit}`,
          );
        }
      }
    }
  } else {
    throw new Error(`Invalid AST Node structure: Missing operator or type`);
  }

  if (totalNodes > MAX_AST_NODES) {
    throw new Error(
      `AST Complexity Violation: Node count ${totalNodes} exceeds MAX_AST_NODES (${MAX_AST_NODES})`,
    );
  }

  return { nodeCount: totalNodes, maxDepth: deepest };
}

/**
 * Validates the entire knowledge pack seed for schema conformance and AST invariants.
 */
export function validateKnowledgePackSeed(seed: KnowledgePackSeed): void {
  if (!seed.name || seed.name.trim().length === 0) {
    throw new Error('Knowledge pack name is required');
  }
  if (!seed.domain) {
    throw new Error('Knowledge pack domain is required');
  }
  if (!seed.version || typeof seed.version.major !== 'number') {
    throw new Error('Knowledge pack version is invalid');
  }
  if (!Array.isArray(seed.conditions) || seed.conditions.length === 0) {
    throw new Error('Knowledge pack must contain at least one condition');
  }
  if (seed.rules.length > MAX_RULES_PER_PACK) {
    throw new Error(
      `Rule Count Violation: Pack contains ${seed.rules.length} rules, exceeding limit of ${MAX_RULES_PER_PACK}`,
    );
  }

  // Validate condition codes uniqueness
  const conditionCodes = new Set<string>();
  for (const cond of seed.conditions) {
    if (!cond.conditionCode || cond.conditionCode.trim().length === 0) {
      throw new Error(`Condition code missing in condition "${cond.displayName}"`);
    }
    if (conditionCodes.has(cond.conditionCode)) {
      throw new Error(`Duplicate condition code detected: "${cond.conditionCode}"`);
    }
    conditionCodes.add(cond.conditionCode);
  }

  // Validate differential rules
  const ruleCodes = new Set<string>();
  for (const rule of seed.rules) {
    if (!rule.ruleCode || rule.ruleCode.trim().length === 0) {
      throw new Error(`Rule code missing in rule "${rule.ruleTitle}"`);
    }
    if (ruleCodes.has(rule.ruleCode)) {
      throw new Error(`Duplicate rule code detected: "${rule.ruleCode}"`);
    }
    ruleCodes.add(rule.ruleCode);

    if (!conditionCodes.has(rule.conditionCode)) {
      throw new Error(
        `Rule "${rule.ruleCode}" references non-existent condition code "${rule.conditionCode}"`,
      );
    }

    // Validate mandatory AST
    validateAstTree(rule.mandatoryAst);

    // Validate major supporting ASTs
    if (!Array.isArray(rule.majorSupporting)) {
      throw new Error(
        `Rule "${rule.ruleCode}" majorSupporting must be an array`,
      );
    }
    for (const major of rule.majorSupporting) {
      validateAstTree(major);
    }

    // Validate minor supporting ASTs
    if (rule.minorSupporting) {
      for (const minor of rule.minorSupporting) {
        validateAstTree(minor);
      }
    }

    // Validate contradictions ASTs
    if (rule.contradictions) {
      for (const contra of rule.contradictions) {
        validateAstTree(contra);
      }
    }
  }

  // Validate red flag rules
  const flagCodes = new Set<string>();
  for (const rf of seed.redFlags) {
    if (!rf.flagCode || rf.flagCode.trim().length === 0) {
      throw new Error(`Red flag code missing in "${rf.title}"`);
    }
    if (flagCodes.has(rf.flagCode)) {
      throw new Error(`Duplicate red flag code detected: "${rf.flagCode}"`);
    }
    flagCodes.add(rf.flagCode);
    validateAstTree(rf.ruleAst);
  }

  // Validate source references
  const sourceIds = new Set<string>();
  for (const src of seed.sources) {
    if (
      !src.referenceIdentifier ||
      src.referenceIdentifier.trim().length === 0
    ) {
      throw new Error(
        `Source referenceIdentifier missing in source "${src.sourceTitle}"`,
      );
    }
    if (sourceIds.has(src.referenceIdentifier)) {
      throw new Error(
        `Duplicate source identifier detected: "${src.referenceIdentifier}"`,
      );
    }
    sourceIds.add(src.referenceIdentifier);
  }

  // Validate rule-source mappings
  const sourceMap = new Map(seed.sources.map((s) => [s.referenceIdentifier, s]));
  for (const mapping of seed.mappings) {
    if (!ruleCodes.has(mapping.ruleCode)) {
      throw new Error(
        `Rule-source mapping references non-existent ruleCode "${mapping.ruleCode}"`,
      );
    }
    if (!sourceIds.has(mapping.sourceReferenceIdentifier)) {
      throw new Error(
        `Rule-source mapping references non-existent sourceIdentifier "${mapping.sourceReferenceIdentifier}"`,
      );
    }

    const rule = seed.rules.find((r) => r.ruleCode === mapping.ruleCode);
    const source = sourceMap.get(mapping.sourceReferenceIdentifier);
    if (rule && source) {
      if (
        rule.isComplete === true &&
        source.evidenceScope === 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION'
      ) {
        throw new Error(
          `Integrity Violation: Complete rule "${rule.ruleCode}" cannot be backed solely by unratified draft source "${source.referenceIdentifier}".`,
        );
      }
    }
  }

  // Validate condition-rule evidence consistency
  for (const cond of seed.conditions) {
    const rule = seed.rules.find((r) => r.conditionCode === cond.conditionCode);
    if (!rule) {
      throw new Error(
        `Condition "${cond.conditionCode}" has no associated differential rule`,
      );
    }
    if (
      cond.evidenceStatus === 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION' &&
      rule.isComplete === true
    ) {
      throw new Error(
        `Integrity Violation: Condition "${cond.conditionCode}" is pending clinical board ratification, but rule "${rule.ruleCode}" is marked isComplete: true.`,
      );
    }
    if (
      cond.evidenceStatus === 'AUTHORITATIVE_ICMR_WHO' &&
      rule.isComplete === false
    ) {
      throw new Error(
        `Integrity Violation: Condition "${cond.conditionCode}" is authoritative, but rule "${rule.ruleCode}" is marked isComplete: false.`,
      );
    }
  }
}

/**
 * Recursively sorts all keys in an object to guarantee canonical ordering.
 */
export function canonicalizeValue(val: any): any {
  if (val === null || val === undefined) {
    return null;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    const sortedKeys = Object.keys(val).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of sortedKeys) {
      const propVal = val[key];
      if (propVal !== undefined) {
        sortedObj[key] = canonicalizeValue(propVal);
      }
    }
    return sortedObj;
  }
  return val;
}

/**
 * Builds the canonical payload representation for SHA-256 checksum generation.
 *
 * SPECIFICATION OF FIELDS INCLUDED IN THE CHECKSUM:
 * 1. domain: KnowledgePackDomain string
 * 2. name: Knowledge pack name string
 * 3. description: Knowledge pack description string
 * 4. majorVersion, minorVersion, patchVersion: Integer semantic version
 * 5. conditions: Sorted array of { category, conditionCode, description, displayName, icd10Guidance }
 * 6. rules: Sorted array of { applicability, conditionCode, contradictions, investigations,
 *                             majorSupporting, mandatoryAst, minMajorCount, minorSupporting,
 *                             missingDataRules, ruleCode, ruleTitle }
 * 7. redFlags: Sorted array of { clinicalAction, flagCode, ruleAst, title, urgencyLevel }
 * 8. sources: Sorted array of { evidenceScope, licensingStatus, publicationDate,
 *                               referenceIdentifier, sectionIdentifier, sourceOrganization,
 *                               sourceTitle, sourceUrlOrDoi }
 * 9. mappings: Sorted array of { ruleCode, sourceReferenceIdentifier }
 *
 * EXCLUDED FIELDS:
 * - Database primary keys (UUID id)
 * - Timestamps (createdAt, updatedAt, publishedAt)
 * - Release status (since status is a lifecycle state, while checksum guarantees content immutability)
 * - Dynamic runtime state
 */
export function buildCanonicalPayload(seed: KnowledgePackSeed): Record<string, any> {
  const sortedConditions = [...seed.conditions]
    .sort((a, b) => a.conditionCode.localeCompare(b.conditionCode))
    .map((c) => ({
      category: c.category,
      conditionCode: c.conditionCode,
      description: c.description,
      displayName: c.displayName,
      icd10Guidance: c.icd10Guidance || null,
      evidenceStatus: c.evidenceStatus,
    }));

  const sortedRules = [...seed.rules]
    .sort((a, b) => a.ruleCode.localeCompare(b.ruleCode))
    .map((r) => ({
      applicability: r.applicability,
      conditionCode: r.conditionCode,
      contradictions: r.contradictions || null,
      investigations: r.investigations || null,
      isComplete: r.isComplete !== false,
      majorSupporting: r.majorSupporting,
      mandatoryAst: r.mandatoryAst,
      minMajorCount: r.minMajorCount,
      minorSupporting: r.minorSupporting || null,
      missingDataRules: r.missingDataRules || null,
      ruleCode: r.ruleCode,
      ruleTitle: r.ruleTitle,
    }));

  const sortedRedFlags = [...seed.redFlags]
    .sort((a, b) => a.flagCode.localeCompare(b.flagCode))
    .map((rf) => ({
      clinicalAction: rf.clinicalAction,
      flagCode: rf.flagCode,
      ruleAst: rf.ruleAst,
      title: rf.title,
      urgencyLevel: rf.urgencyLevel,
    }));

  const sortedSources = [...seed.sources]
    .sort((a, b) => a.referenceIdentifier.localeCompare(b.referenceIdentifier))
    .map((s) => ({
      evidenceScope: s.evidenceScope,
      licensingStatus: s.licensingStatus,
      publicationDate: s.publicationDate,
      referenceIdentifier: s.referenceIdentifier,
      sectionIdentifier: s.sectionIdentifier,
      sourceOrganization: s.sourceOrganization,
      sourceTitle: s.sourceTitle,
      sourceUrlOrDoi: s.sourceUrlOrDoi,
    }));

  const sortedMappings = [...seed.mappings]
    .sort((a, b) => {
      const cmp = a.ruleCode.localeCompare(b.ruleCode);
      if (cmp !== 0) return cmp;
      return a.sourceReferenceIdentifier.localeCompare(
        b.sourceReferenceIdentifier,
      );
    })
    .map((m) => ({
      ruleCode: m.ruleCode,
      sourceReferenceIdentifier: m.sourceReferenceIdentifier,
    }));

  const rawPayload = {
    conditions: sortedConditions,
    description: seed.description,
    domain: seed.domain,
    majorVersion: seed.version.major,
    mappings: sortedMappings,
    minorVersion: seed.version.minor,
    name: seed.name,
    patchVersion: seed.version.patch,
    redFlags: sortedRedFlags,
    rules: sortedRules,
    sources: sortedSources,
  };

  return canonicalizeValue(rawPayload);
}

/**
 * Serializes the canonical payload into a deterministic UTF-8 JSON string.
 */
export function serializeCanonicalJson(seed: KnowledgePackSeed): string {
  const canonicalPayload = buildCanonicalPayload(seed);
  return JSON.stringify(canonicalPayload);
}

/**
 * Computes the canonical SHA-256 hex digest for a knowledge pack seed.
 */
export function computeCanonicalChecksum(seed: KnowledgePackSeed): string {
  const canonicalString = serializeCanonicalJson(seed);
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

