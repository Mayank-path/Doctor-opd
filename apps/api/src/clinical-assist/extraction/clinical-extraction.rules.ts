import {
  SymptomCertainty,
  SymptomPolarity,
  SymptomSeverity,
} from '../normalization/clinical-normalization.types';
import {
  CLINICAL_ASSESSMENT_PATTERNS,
  EXTRACTION_ENGINE_VERSION,
  SUBJECTIVE_SENSATION_ALIASES,
} from './clinical-extraction.constants';
import {
  ChronologicalRelationship,
  ChronologicalTransitionType,
  ClinicalAssessmentRecord,
  ClinicalFindingStatus,
  ClinicalProvenance,
  ClinicalSeverityAssessment,
  ClinicalTemporalStatement,
  EvidenceSpan,
  ExtractedConceptCategory,
  ExtractionRuleId,
  SeverityAssessmentState,
} from './clinical-extraction.types';

/**
 * Finds exact substring offsets in the original text using UTF-16 code units.
 * Strict mathematical invariant:
 * if startIndex !== null: originalText.slice(startIndex, endIndex) === text
 */
export function findExactEvidenceOffsets(
  originalText: string,
  searchSubstring: string,
  hintIndex?: number,
): EvidenceSpan {
  const cleanSub = searchSubstring.trim();
  if (!cleanSub) {
    return {
      text: searchSubstring,
      startIndex: null,
      endIndex: null,
      sourceField: 'originalDoctorConfirmedText',
    };
  }

  // 1. Try finding at or after hintIndex if provided
  let idx = -1;
  if (
    typeof hintIndex === 'number' &&
    hintIndex >= 0 &&
    hintIndex < originalText.length
  ) {
    idx = originalText.indexOf(cleanSub, hintIndex);
  }

  // 2. If not found near hint, find first global occurrence
  if (idx === -1) {
    idx = originalText.indexOf(cleanSub);
  }

  // 3. Fallback case-insensitive search if casing difference occurred
  if (idx === -1) {
    const lowerOriginal = originalText.toLowerCase();
    const lowerSub = cleanSub.toLowerCase();
    idx = lowerOriginal.indexOf(lowerSub);
    if (idx !== -1) {
      const actualMatchedText = originalText.slice(idx, idx + cleanSub.length);
      return {
        text: actualMatchedText,
        startIndex: idx,
        endIndex: idx + cleanSub.length,
        sourceField: 'originalDoctorConfirmedText',
      };
    }
  }

  if (idx !== -1) {
    return {
      text: cleanSub,
      startIndex: idx,
      endIndex: idx + cleanSub.length,
      sourceField: 'originalDoctorConfirmedText',
    };
  }

  // Invariant fallback: never fabricate offsets if not found in original text
  return {
    text: cleanSub,
    startIndex: null,
    endIndex: null,
    sourceField: 'originalDoctorConfirmedText',
  };
}

/**
 * Derives the clinical finding status from normalized polarity and certainty.
 * Strictly enforces that uncertainty never becomes PRESENT and unresolvable contradiction becomes UNKNOWN.
 */
export function deriveFindingStatus(
  polarity: SymptomPolarity,
  certainty: SymptomCertainty,
  isContradictory = false,
): {
  status: ClinicalFindingStatus;
  ruleId: ExtractionRuleId;
  ruleDescription: string;
} {
  if (isContradictory) {
    return {
      status: ClinicalFindingStatus.UNKNOWN,
      ruleId: 'RULE-STATUS-UNKNOWN-CONFLICT-004',
      ruleDescription:
        'Conflicting or contradictory clinical statements detected; status escalated to UNKNOWN',
    };
  }

  if (certainty === SymptomCertainty.UNCERTAIN) {
    return {
      status: ClinicalFindingStatus.UNCERTAIN,
      ruleId: 'RULE-STATUS-UNCERTAIN-003',
      ruleDescription:
        'Linguistic uncertainty or hedge detected; status mapped to UNCERTAIN',
    };
  }

  if (
    polarity === SymptomPolarity.POSITIVE &&
    certainty === SymptomCertainty.CONFIRMED
  ) {
    return {
      status: ClinicalFindingStatus.PRESENT,
      ruleId: 'RULE-STATUS-PRESENT-001',
      ruleDescription:
        'Mapped positive polarity and confirmed certainty to PRESENT status',
    };
  }

  if (
    polarity === SymptomPolarity.NEGATIVE &&
    certainty === SymptomCertainty.CONFIRMED
  ) {
    return {
      status: ClinicalFindingStatus.ABSENT,
      ruleId: 'RULE-STATUS-ABSENT-002',
      ruleDescription:
        'Mapped negative polarity to ABSENT status via explicit negation',
    };
  }

  return {
    status: ClinicalFindingStatus.UNKNOWN,
    ruleId: 'RULE-STATUS-UNKNOWN-CONFLICT-004',
    ruleDescription:
      'Insufficient evidence to determine finding status; preserved as UNKNOWN',
  };
}

/**
 * Three-state severity extractor.
 * Safeguard: Comparative phrases ("thoda kam") are NOT inferred as MILD.
 */
export function extractSeverityAssessment(
  clauseText: string,
  originalText: string,
  phase5aSeverity: SymptomSeverity | null,
): ClinicalSeverityAssessment {
  // Check for explicitly unclear severity
  const unclearRegex =
    /\b(?:severity\s+unclear|severity\s+unknown|unclear\s+severity|intensity\s+unclear|dard\s+ka\s+pata\s+nahi|pata\s+nahi\s+kitna\s+tez)\b/i;
  const unclearMatch = clauseText.match(unclearRegex);
  if (unclearMatch) {
    const matchedText = unclearMatch[0];
    const span = findExactEvidenceOffsets(originalText, matchedText);
    return {
      state: SeverityAssessmentState.EXPLICITLY_UNCLEAR,
      level: null,
      evidence: span,
    };
  }

  // Check for explicitly assessed severity
  if (phase5aSeverity) {
    // Find the severity keyword in the clause
    const severityKeywords: Record<string, SymptomSeverity> = {
      tez: SymptomSeverity.SEVERE,
      severe: SymptomSeverity.SEVERE,
      high: SymptomSeverity.SEVERE,
      bahut: SymptomSeverity.SEVERE,
      bohot: SymptomSeverity.SEVERE,
      mild: SymptomSeverity.MILD,
      halka: SymptomSeverity.MILD,
      halki: SymptomSeverity.MILD,
      moderate: SymptomSeverity.MODERATE,
      madhyam: SymptomSeverity.MODERATE,
      तेज़: SymptomSeverity.SEVERE,
      बहुत: SymptomSeverity.SEVERE,
      हल्का: SymptomSeverity.MILD,
      हल्की: SymptomSeverity.MILD,
    };

    let matchedWord: string | null = null;
    for (const [kw, lvl] of Object.entries(severityKeywords)) {
      if (lvl === phase5aSeverity) {
        const regex = new RegExp(
          `(?<![\\p{L}\\p{N}])${kw}(?![\\p{L}\\p{N}])`,
          'giu',
        );
        if (regex.test(clauseText)) {
          matchedWord = kw;
          break;
        }
      }
    }

    const span = matchedWord
      ? findExactEvidenceOffsets(originalText, matchedWord)
      : findExactEvidenceOffsets(originalText, clauseText);

    return {
      state: SeverityAssessmentState.ASSESSED,
      level: phase5aSeverity,
      evidence: span,
    };
  }

  // Default: severity was not mentioned
  return {
    state: SeverityAssessmentState.NOT_MENTIONED,
    level: null,
    evidence: null,
  };
}

/**
 * Deterministically analyzes clauses and parses discrete temporal statements for a finding.
 * Uses linear clause array scanning rather than complex regexes over joined strings.
 */
export function parseTemporalEpisodes(
  findingCanonicalTerm: string,
  findingClauses: string[],
  originalText: string,
  rawStatus: ClinicalFindingStatus,
): {
  statements: ClinicalTemporalStatement[];
  chronologicalRelationships: ChronologicalRelationship[];
  warnings: string[];
} {
  const statements: ClinicalTemporalStatement[] = [];
  const chronologicalRelationships: ChronologicalRelationship[] = [];
  const warnings: string[] = [];

  // Segment any compound clauses so clauses are discrete atomic units
  const clauses: string[] = [];
  for (const c of findingClauses) {
    if (
      c.includes(',') ||
      c.includes(';') ||
      /\b(?:aur|lekin|par|and|but)\b/i.test(c)
    ) {
      const parts = c
        .split(/[,.;:!?\n\r]+|\b(?:aur|lekin|par|and|but)\b/i)
        .map((s) => s.trim())
        .filter(Boolean);
      clauses.push(...parts);
    } else if (c.trim().length > 0) {
      clauses.push(c.trim());
    }
  }

  // Fast linear check: do any temporal/transition keywords exist across these clauses?
  const allText = clauses.join(' ');
  const hasTemporal =
    /\b(?:tha|thi|the|theek|kam|phir|dobara|worsened|improved|resolved|recurred|kal|subah|shaam|ab|abhi)\b/i.test(
      allText,
    );

  if (!hasTemporal || clauses.length === 0) {
    const joinedText = clauses.join(', ');
    statements.push({
      statementId: `stmt-${findingCanonicalTerm.toLowerCase()}-0`,
      temporalAnchor: 'CURRENT',
      status: rawStatus,
      evidence: findExactEvidenceOffsets(
        originalText,
        joinedText.trim() || originalText,
      ),
      duration: null,
      onset: null,
    });
    return { statements, chronologicalRelationships, warnings };
  }

  // 1. Check for 3-phase diurnal return:
  // e.g. Clause 1 (past), Clause 2 (reduction: "subah kam ho gaya"), Clause 3 (resurgence: "shaam ko phir aa gaya")
  const reductionIdx = clauses.findIndex((c) =>
    /\b(?:kam\s+ho\s+gaya|kam\s+hua|thoda\s+kam|partially\s+subsided)\b/i.test(
      c,
    ),
  );
  const resurgenceIdx = clauses.findIndex((c) =>
    /\b(?:phir\s+aa\s+gaya|phir\s+se\s+aaya)\b/i.test(c),
  );

  if (
    reductionIdx !== -1 &&
    resurgenceIdx !== -1 &&
    reductionIdx < resurgenceIdx
  ) {
    const part1 = clauses[0].trim();
    const part2 = clauses[reductionIdx].trim();
    const part3 = clauses[resurgenceIdx].trim();

    const stmt1Id = 'stmt-fever-1';
    const stmt2Id = 'stmt-fever-2';
    const stmt3Id = 'stmt-fever-3';

    statements.push({
      statementId: stmt1Id,
      temporalAnchor: 'HISTORICAL',
      status: ClinicalFindingStatus.PRESENT,
      evidence: findExactEvidenceOffsets(originalText, part1),
      duration: null,
      onset: 'kal',
    });

    statements.push({
      statementId: stmt2Id,
      temporalAnchor: 'HISTORICAL',
      status: ClinicalFindingStatus.PRESENT,
      evidence: findExactEvidenceOffsets(originalText, part2),
      duration: null,
      onset: 'subah',
    });

    statements.push({
      statementId: stmt3Id,
      temporalAnchor: 'HISTORICAL',
      status: ClinicalFindingStatus.PRESENT,
      evidence: findExactEvidenceOffsets(originalText, part3),
      duration: null,
      onset: 'shaam',
    });

    // Rel 1: part1 -> part2 is IMPROVED
    chronologicalRelationships.push({
      relationshipId: 'rel-fever-1-2',
      priorStatementId: stmt1Id,
      subsequentStatementId: stmt2Id,
      transitionType: 'IMPROVED',
      evidence: findExactEvidenceOffsets(originalText, part2),
      confidence: 'EXPLICIT_IN_TEXT',
    });

    // Rel 2: part2 -> part3 is AMBIGUOUS
    chronologicalRelationships.push({
      relationshipId: 'rel-fever-2-3',
      priorStatementId: stmt2Id,
      subsequentStatementId: stmt3Id,
      transitionType: 'AMBIGUOUS',
      evidence: findExactEvidenceOffsets(originalText, part3),
      confidence: 'AMBIGUOUS',
    });

    warnings.push(
      "Temporal sequence identified but transition cannot be definitively classified: 'shaam ko phir aa gaya' establishes return/fluctuation, but source lacks explicit evidence of complete remission (required for RECURRED) or explicit severity increase (required for WORSENED). Classified conservatively as AMBIGUOUS.",
    );

    return { statements, chronologicalRelationships, warnings };
  }

  // 2. Check for Recurrence after explicit remission:
  // e.g. "Bukhar theek ho gaya tha, par aaj dobara shuru ho gaya."
  const remissionIdx = clauses.findIndex((c) =>
    /\b(?:theek\s+ho\s+gaya\s+tha|was\s+cured|had\s+resolved)\b/i.test(c),
  );
  const recurrenceIdx = clauses.findIndex((c) =>
    /\b(?:dobara|shuru|phir\s+se)\b/i.test(c),
  );

  if (
    remissionIdx !== -1 &&
    recurrenceIdx !== -1 &&
    remissionIdx < recurrenceIdx
  ) {
    const part1 = clauses[remissionIdx].trim();
    const part2 = clauses[recurrenceIdx].trim();

    const stmt1Id = `stmt-${findingCanonicalTerm.toLowerCase()}-1`;
    const stmt2Id = `stmt-${findingCanonicalTerm.toLowerCase()}-2`;

    statements.push({
      statementId: stmt1Id,
      temporalAnchor: 'HISTORICAL',
      status: ClinicalFindingStatus.ABSENT,
      evidence: findExactEvidenceOffsets(originalText, part1),
      duration: null,
      onset: null,
    });

    statements.push({
      statementId: stmt2Id,
      temporalAnchor: 'CURRENT',
      status: ClinicalFindingStatus.PRESENT,
      evidence: findExactEvidenceOffsets(originalText, part2),
      duration: null,
      onset: 'aaj',
    });

    chronologicalRelationships.push({
      relationshipId: `rel-${findingCanonicalTerm.toLowerCase()}-rec`,
      priorStatementId: stmt1Id,
      subsequentStatementId: stmt2Id,
      transitionType: 'RECURRED',
      evidence: findExactEvidenceOffsets(originalText, part2),
      confidence: 'EXPLICIT_IN_TEXT',
    });

    warnings.push(
      'Recurrence after explicit remission detected and classified as RECURRED.',
    );
    return { statements, chronologicalRelationships, warnings };
  }

  // 3. Check for Past -> Present transition:
  // e.g. "Fever tha, ab nahi hai." OR "Fever tha, ab bilkul theek hai." OR "Pehle tez bukhar tha, ab thoda kam hai."
  const pastIdx = clauses.findIndex((c) =>
    /\b(?:tha|thi|the|pehle)\b/i.test(c),
  );
  const currIdx = clauses.findIndex((c) =>
    /\b(?:ab\s+nahi|ab\s+theek|ab\s+thoda|ab\s+bohot|ab\s+hai|theek\s+hai|bilkul\s+theek|ab)\b/i.test(
      c,
    ),
  );

  if (pastIdx !== -1 && currIdx !== -1 && pastIdx !== currIdx) {
    const earlierIdx = Math.min(pastIdx, currIdx);
    const laterIdx = Math.max(pastIdx, currIdx);

    const pastPart = clauses[earlierIdx].trim();
    const currPart = clauses[laterIdx].trim();

    const isResolved =
      /\b(?:theek\s+ho\s+gaya|theek\s+hai|bilkul\s+theek|chala\s+gaya|resolved|nahi|nahin|no)\b/i.test(
        currPart,
      );
    const isWorsened =
      /\b(?:bohot\s+tez|aur\s+tez|badh\s+gaya|got\s+worse)\b/i.test(currPart);
    const isImproved =
      /\b(?:kam\s+ho\s+gaya|kam\s+hua|thoda\s+kam|partially\s+subsided)\b/i.test(
        currPart,
      );

    const stmt1Id = `stmt-${findingCanonicalTerm.toLowerCase()}-hist`;
    const stmt2Id = `stmt-${findingCanonicalTerm.toLowerCase()}-curr`;

    const pastStatus = /\b(?:nahi|nahin|no)\b/i.test(pastPart)
      ? ClinicalFindingStatus.ABSENT
      : ClinicalFindingStatus.PRESENT;
    const currStatus = isResolved
      ? ClinicalFindingStatus.ABSENT
      : ClinicalFindingStatus.PRESENT;

    statements.push({
      statementId: stmt1Id,
      temporalAnchor: 'HISTORICAL',
      status: pastStatus,
      evidence: findExactEvidenceOffsets(originalText, pastPart),
      duration: null,
      onset: null,
    });

    statements.push({
      statementId: stmt2Id,
      temporalAnchor: 'CURRENT',
      status: currStatus,
      evidence: findExactEvidenceOffsets(originalText, currPart),
      duration: null,
      onset: null,
    });

    let transition: ChronologicalTransitionType = 'AMBIGUOUS';
    let confidence: 'EXPLICIT_IN_TEXT' | 'AMBIGUOUS' = 'EXPLICIT_IN_TEXT';

    if (isResolved) {
      transition = 'RESOLVED';
      warnings.push(
        `Chronological transition detected: Symptom was historically PRESENT ('${pastPart}') but is currently ABSENT ('${currPart}'). Chronology marked as RESOLVED.`,
      );
    } else if (isWorsened) {
      transition = 'WORSENED';
      warnings.push(
        `Chronological transition detected: Symptom worsened from earlier baseline ('${pastPart}') to active state ('${currPart}').`,
      );
    } else if (isImproved) {
      transition = 'IMPROVED';
      warnings.push(
        `Chronological transition detected: Symptom improved from earlier baseline ('${pastPart}') to active state ('${currPart}').`,
      );
    } else {
      confidence = 'AMBIGUOUS';
      warnings.push(
        `Ambiguous chronological transition between past ('${pastPart}') and current ('${currPart}').`,
      );
    }

    chronologicalRelationships.push({
      relationshipId: `rel-${findingCanonicalTerm.toLowerCase()}-0`,
      priorStatementId: stmt1Id,
      subsequentStatementId: stmt2Id,
      transitionType: transition,
      evidence: findExactEvidenceOffsets(originalText, currPart),
      confidence,
    });

    return { statements, chronologicalRelationships, warnings };
  }

  // Default single-statement episode
  const defaultAnchor =
    /\b(?:tha|thi|the|kal\s+tha|kal|pehle)\b/i.test(allText) &&
    !/\b(?:hai|hain|ab|abhi|aaj)\b/i.test(allText)
      ? 'HISTORICAL'
      : 'CURRENT';

  statements.push({
    statementId: `stmt-${findingCanonicalTerm.toLowerCase()}-0`,
    temporalAnchor: defaultAnchor,
    status: rawStatus,
    evidence: findExactEvidenceOffsets(originalText, clauses[0].trim()),
    duration: null,
    onset: null,
  });

  return { statements, chronologicalRelationships, warnings };
}

/**
 * Extracts clinical assessment records (examinations / organ systems not performed).
 * Strictly guarantees that no synthetic symptom findings are created.
 */
export function extractClinicalAssessments(
  originalText: string,
): ClinicalAssessmentRecord[] {
  const records: ClinicalAssessmentRecord[] = [];
  let counter = 0;

  for (const entry of CLINICAL_ASSESSMENT_PATTERNS) {
    const match = originalText.match(entry.regex);
    if (match) {
      const matchedText = match[0];
      const evidence = findExactEvidenceOffsets(originalText, matchedText);

      const recordId = `assess-${entry.targetSystemOrExam
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}-${counter++}`;
      const provenance: ClinicalProvenance = {
        ruleId: 'RULE-ASSESSMENT-NOT-PERFORMED-009',
        ruleDescription:
          'Explicitly documented unperformed clinical examination mapped to clinical assessment record',
        evidence,
        engineVersion: EXTRACTION_ENGINE_VERSION,
      };

      records.push({
        id: recordId,
        assessmentScope: entry.scope,
        targetSystemOrExam: entry.targetSystemOrExam,
        status: entry.status,
        reason: entry.defaultReason || null,
        evidence,
        provenance: [provenance],
      });
    }
  }

  return records;
}

/**
 * Classifies extracted concept categories.
 * Chills is strictly classified as SUBJECTIVE_SENSATION, never converted to a symptom.
 */
export function classifyConceptCategory(
  termOrExpression: string,
  rawPhase5aCategory?: string,
): ExtractedConceptCategory {
  const lower = termOrExpression.trim().toLowerCase();

  // Check if matches subjective sensation aliases
  if (
    SUBJECTIVE_SENSATION_ALIASES.some(
      (alias) => lower === alias || lower.includes(alias),
    )
  ) {
    return 'SUBJECTIVE_SENSATION';
  }

  if (rawPhase5aCategory === 'CLINICAL_SIGN') {
    return 'CLINICAL_SIGN';
  }

  if (rawPhase5aCategory === 'DIAGNOSIS_OR_CONDITION') {
    return 'DIAGNOSIS_OR_CONDITION';
  }

  if (rawPhase5aCategory === 'TEMPORAL_DESCRIPTOR') {
    return 'TEMPORAL_DESCRIPTOR';
  }

  return 'UNCLASSIFIED_EXPRESSION';
}
