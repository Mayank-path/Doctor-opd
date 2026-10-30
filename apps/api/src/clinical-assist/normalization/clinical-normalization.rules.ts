import {
  CURATED_BODY_LOCATIONS,
  DURATION_UNIT_MAP,
  EXCLUDED_CLINICAL_TERMS,
  FREQUENCY_RULES,
  HINGLISH_GRAMMATICAL_MARKERS,
  NEGATION_MARKERS,
  NUMBER_WORD_MAP,
  SEVERITY_RULES,
  UNCERTAINTY_MARKERS,
} from './clinical-normalization.constants';
import {
  DetectedClinicalLanguage,
  DurationUnit,
  RawClauseMatch,
  RelatedClinicalExpression,
  SymptomCertainty,
  SymptomDuration,
  SymptomFrequency,
  SymptomPolarity,
  SymptomSeverity,
} from './clinical-normalization.types';
import { CompiledAlias } from './clinical-normalization.registry';

export interface ClauseSpan {
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Splits input text into discrete, boundary-preserving clauses.
 * Delimiters include sentence-ending punctuation, semicolons, commas,
 * and scope-breaking conjunctions (e.g. "lekin", "par", "but", "however").
 */
export function segmentIntoClauses(text: string): ClauseSpan[] {
  if (!text || !text.trim()) {
    return [];
  }

  // Regex splitting on punctuation (. ; ! ? \n ,) and strong contrastive conjunctions
  // Pattern uses Unicode boundaries to match conjunctions without breaking internal words
  const delimiterPattern =
    /(?:[.;!?\n]+|,(?!\d)|(?<=[^\p{L}\p{N}]|^)(?:lekin|par|parantu|magar|kintu|but|however|although|yet|except|whereas|while|aur|and)(?=[^\p{L}\p{N}]|$))/giu;

  const clauses: ClauseSpan[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = delimiterPattern.exec(text)) !== null) {
    const rawClause = text.slice(lastIndex, match.index);
    const trimmed = rawClause.trim();
    if (trimmed.length > 0) {
      // Find exact trimmed start and end indices
      const startOffset = rawClause.indexOf(trimmed);
      clauses.push({
        text: trimmed,
        startIndex: lastIndex + startOffset,
        endIndex: lastIndex + startOffset + trimmed.length,
      });
    }
    lastIndex = match.index + match[0].length;
  }

  // Final clause
  const remainder = text.slice(lastIndex);
  const trimmedRemainder = remainder.trim();
  if (trimmedRemainder.length > 0) {
    const startOffset = remainder.indexOf(trimmedRemainder);
    clauses.push({
      text: trimmedRemainder,
      startIndex: lastIndex + startOffset,
      endIndex: lastIndex + startOffset + trimmedRemainder.length,
    });
  }

  return clauses;
}

/**
 * Finds all non-overlapping symptom matches in a clause using the compiled registry.
 * Longest aliases are evaluated first to prevent sub-term shadowing.
 */
export function findMatchesInClause(
  clause: ClauseSpan,
  compiledAliases: CompiledAlias[],
): RawClauseMatch[] {
  const matches: RawClauseMatch[] = [];
  // Mask to track occupied character positions in the clause to prevent overlapping matches
  const occupied = new Array<boolean>(clause.text.length).fill(false);

  for (const item of compiledAliases) {
    item.regex.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = item.regex.exec(clause.text)) !== null) {
      const matchStart = m.index;
      const matchEnd = matchStart + m[0].length;

      // Check if any character in this span is already occupied by a longer match
      let isOverlap = false;
      for (let i = matchStart; i < matchEnd; i++) {
        if (occupied[i]) {
          isOverlap = true;
          break;
        }
      }

      if (!isOverlap) {
        // Mark span as occupied
        for (let i = matchStart; i < matchEnd; i++) {
          occupied[i] = true;
        }

        matches.push({
          canonicalTerm: item.canonicalTerm,
          matchedAlias: m[0],
          startIndex: clause.startIndex + matchStart,
          endIndex: clause.startIndex + matchEnd,
          clauseText: clause.text,
          clauseStartIndex: clause.startIndex,
          clauseEndIndex: clause.endIndex,
          defaultBodyLocation: item.defaultBodyLocation,
        });
      }
    }
  }

  // Sort by start index in original text
  return matches.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Evaluates negation polarity for a matched symptom within its local clause context.
 * Explicitly distinguishes POSITIVE, NEGATIVE, and UNKNOWN.
 */
export function evaluatePolarity(
  clauseText: string,
  matchedAlias: string,
): SymptomPolarity {
  const lowerClause = clauseText.toLowerCase();
  const lowerAlias = matchedAlias.toLowerCase();

  // Find alias position in clause
  const aliasPos = lowerClause.indexOf(lowerAlias);
  if (aliasPos === -1) {
    return SymptomPolarity.POSITIVE;
  }

  const beforeText = lowerClause.slice(0, aliasPos);
  const afterText = lowerClause.slice(aliasPos + lowerAlias.length);

  // Check for presence of negation markers
  let hasNegation = false;
  const hasAffirmationWithContradiction = false;

  for (const marker of NEGATION_MARKERS) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
    const regex = new RegExp(pattern, 'u');

    // Negation before symptom: "no fever", "denies headache", "without vomiting"
    if (regex.test(beforeText)) {
      hasNegation = true;
      break;
    }

    // Negation after symptom: "bukhar nahi hai", "headache nahi hai", "cough absent"
    if (regex.test(afterText)) {
      hasNegation = true;
      break;
    }
  }

  if (hasNegation) {
    // Check for ambiguous conflicting phrases like "ho bhi sakta hai aur nahi bhi"
    if (
      lowerClause.includes('aur nahi') ||
      lowerClause.includes('doubtful if no') ||
      hasAffirmationWithContradiction
    ) {
      return SymptomPolarity.UNKNOWN;
    }
    return SymptomPolarity.NEGATIVE;
  }

  return SymptomPolarity.POSITIVE;
}

/**
 * Evaluates certainty for a matched symptom.
 * Explicitly distinguishes CONFIRMED, UNCERTAIN, and UNKNOWN.
 */
export function evaluateCertainty(clauseText: string): SymptomCertainty {
  const lowerClause = clauseText.toLowerCase();

  for (const marker of UNCERTAINTY_MARKERS) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
    const regex = new RegExp(pattern, 'u');

    if (regex.test(lowerClause)) {
      return SymptomCertainty.UNCERTAIN;
    }
  }

  return SymptomCertainty.CONFIRMED;
}

/**
 * Extracts and parses explicit duration and onset expressions from a clause.
 */
export function extractDuration(clauseText: string): SymptomDuration | null {
  const lower = clauseText.toLowerCase().trim();

  // 1. Relative temporal onset expressions
  // "kal se" / "since yesterday" -> 1 day
  if (
    /(?<![\p{L}\p{N}])(?:kal\s+se|since\s+yesterday)(?![\p{L}\p{N}])/u.test(
      lower,
    )
  ) {
    const match = lower.match(/(?:kal\s+se|since\s+yesterday)/u);
    return {
      raw: match ? match[0] : 'kal se',
      value: 1,
      unit: DurationUnit.DAYS,
      onset: 'since yesterday',
    };
  }

  // "parso se" / "day before yesterday" -> 2 days
  if (
    /(?<![\p{L}\p{N}])(?:parso\s+se|day\s+before\s+yesterday)(?![\p{L}\p{N}])/u.test(
      lower,
    )
  ) {
    const match = lower.match(/(?:parso\s+se|day\s+before\s+yesterday)/u);
    return {
      raw: match ? match[0] : 'parso se',
      value: 2,
      unit: DurationUnit.DAYS,
      onset: 'day before yesterday',
    };
  }

  // "subah se" / "since morning" -> raw onset, numeric null
  if (
    /(?<![\p{L}\p{N}])(?:subah\s+se|aaj\s+subah\s+se|since\s+morning)(?![\p{L}\p{N}])/u.test(
      lower,
    )
  ) {
    const match = lower.match(
      /(?:aaj\s+subah\s+se|subah\s+se|since\s+morning)/u,
    );
    return {
      raw: match ? match[0] : 'subah se',
      value: null,
      unit: null,
      onset: 'since morning',
    };
  }

  // "last night" / "kal raat se" -> raw onset
  if (
    /(?<![\p{L}\p{N}])(?:kal\s+raat\s+se|last\s+night)(?![\p{L}\p{N}])/u.test(
      lower,
    )
  ) {
    const match = lower.match(/(?:kal\s+raat\s+se|last\s+night)/u);
    return {
      raw: match ? match[0] : 'last night',
      value: null,
      unit: null,
      onset: 'last night',
    };
  }

  // 2. Explicit numeric duration patterns
  // Examples:
  // "teen din se", "2 din se", "for 2 weeks", "do hafte se", "1 month", "3 hours"
  const knownNumeralWords = Object.keys(NUMBER_WORD_MAP).join('|');
  const numericDurationRegex = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:for\\s+)?(\\d+|${knownNumeralWords})\\s+([a-zA-Z\\u0900-\\u097F]+)(?:\\s+se)?(?![\\p{L}\\p{N}])`,
    'gui',
  );

  let m: RegExpExecArray | null;
  while ((m = numericDurationRegex.exec(lower)) !== null) {
    const numPart = m[1];
    const unitPart = m[2];
    const fullMatch = m[0];

    // Check if unitPart matches a known duration unit
    const unit = DURATION_UNIT_MAP[unitPart];
    if (unit) {
      let parsedValue: number | null = null;

      if (/^\d+$/.test(numPart)) {
        parsedValue = parseInt(numPart, 10);
      } else if (NUMBER_WORD_MAP[numPart] !== undefined) {
        parsedValue = NUMBER_WORD_MAP[numPart];
      }

      if (parsedValue !== null && !isNaN(parsedValue)) {
        return {
          raw: fullMatch.trim(),
          value: parsedValue,
          unit,
        };
      } else {
        // Return raw text without fabricated number
        return {
          raw: fullMatch.trim(),
          value: null,
          unit,
        };
      }
    }
  }

  // 3. Fallback: Generic unparseable temporal mentions like "kuch dino se", "several days"
  const genericTemporal = lower.match(
    /(?:kuch\s+dino?\s+se|several\s+days|some\s+time|few\s+days|few\s+weeks)/u,
  );
  if (genericTemporal) {
    return {
      raw: genericTemporal[0],
      value: null,
      unit: null,
    };
  }

  return null;
}

/**
 * Extracts explicit severity from a clause.
 * Never assigns severity when none was provided.
 */
export function extractSeverity(clauseText: string): SymptomSeverity | null {
  const lower = clauseText.toLowerCase();

  for (const rule of SEVERITY_RULES) {
    for (const marker of rule.markers) {
      const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
      const regex = new RegExp(pattern, 'u');

      if (regex.test(lower)) {
        return rule.level;
      }
    }
  }

  return null;
}

/**
 * Extracts explicit frequency from a clause.
 * Never assigns frequency when none was provided.
 */
export function extractFrequency(clauseText: string): SymptomFrequency | null {
  const lower = clauseText.toLowerCase();

  for (const rule of FREQUENCY_RULES) {
    for (const marker of rule.markers) {
      const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
      const regex = new RegExp(pattern, 'u');

      if (regex.test(lower)) {
        return rule.level;
      }
    }
  }

  return null;
}

/**
 * Extracts explicit body location from a clause.
 * Requirement: Only maps when an anatomical location term from the curated vocabulary
 * is explicitly present in the text. Does not infer from symptom name alone.
 */
export function extractBodyLocation(
  clauseText: string,
  matchedAlias: string,
): string | null {
  const lowerClause = clauseText.toLowerCase();
  const lowerAlias = matchedAlias.toLowerCase();

  for (const [locationName, aliases] of Object.entries(
    CURATED_BODY_LOCATIONS,
  )) {
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
      const regex = new RegExp(pattern, 'u');

      // Check if alias is present in the clause
      if (regex.test(lowerClause)) {
        // If the alias was simply part of the symptom expression (e.g. "headache" or "head" in "headache"),
        // ensure it was an explicitly stated anatomical word
        if (
          lowerAlias === alias &&
          (alias === 'head' ||
            alias === 'throat' ||
            alias === 'stomach' ||
            alias === 'chest')
        ) {
          // It was just the symptom expression itself; return only if there is a distinct anatomical mention
          continue;
        }
        return locationName;
      }
    }
  }

  return null;
}

/**
 * Conservative deterministic language classification.
 * Classifies text into: HINDI, HINGLISH, ENGLISH, MIXED, UNKNOWN.
 */
export function classifyClinicalLanguage(
  text: string,
): DetectedClinicalLanguage {
  const trimmed = text.trim();
  if (trimmed.length < 4) {
    return DetectedClinicalLanguage.UNKNOWN;
  }

  let devanagariCount = 0;
  let latinCount = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    // Devanagari Unicode Block: 0x0900 - 0x097F
    if (code >= 0x0900 && code <= 0x097f) {
      devanagariCount++;
    } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      latinCount++;
    }
  }

  const totalAlpha = devanagariCount + latinCount;
  if (totalAlpha === 0) {
    return DetectedClinicalLanguage.UNKNOWN;
  }

  const devanagariRatio = devanagariCount / totalAlpha;
  const latinRatio = latinCount / totalAlpha;

  // Pure Devanagari Hindi dominance (> 50%)
  if (devanagariRatio > 0.5) {
    return latinCount > 3
      ? DetectedClinicalLanguage.MIXED
      : DetectedClinicalLanguage.HINDI;
  }

  // Mixed scripts
  if (devanagariRatio > 0.15 && latinRatio > 0.15) {
    return DetectedClinicalLanguage.MIXED;
  }

  // Latin script dominates: evaluate Hinglish markers vs English
  const lowerWords = trimmed.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  let hinglishMarkerCount = 0;

  for (const word of lowerWords) {
    if (HINGLISH_GRAMMATICAL_MARKERS.includes(word)) {
      hinglishMarkerCount++;
    }
  }

  // If 2 or more distinct Hinglish grammatical markers or common vocabulary words appear
  if (hinglishMarkerCount >= 2) {
    return DetectedClinicalLanguage.HINGLISH;
  }

  // If 1 marker appears and total words is very small (<= 4)
  if (hinglishMarkerCount >= 1 && lowerWords.length <= 4) {
    return DetectedClinicalLanguage.HINGLISH;
  }

  // Standard English vocabulary
  if (latinRatio > 0.8 && hinglishMarkerCount === 0) {
    return DetectedClinicalLanguage.ENGLISH;
  }

  return DetectedClinicalLanguage.HINGLISH;
}

/**
 * Scans text for clinically significant expressions that are explicitly excluded
 * from generic symptom mapping (e.g. diagnoses like migraine, pharyngitis, angina,
 * or signs like wheezing, chills, or temporal descriptors like acute).
 */
export function detectExcludedClinicalTerms(
  text: string,
): RelatedClinicalExpression[] {
  const detected: RelatedClinicalExpression[] = [];
  const lower = text.toLowerCase();

  for (const item of EXCLUDED_CLINICAL_TERMS) {
    const escaped = item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
    const regex = new RegExp(pattern, 'gui');

    if (regex.test(lower)) {
      detected.push({
        expression: item.term,
        category: item.category,
        note: item.clinicalExplanation,
      });
    }
  }

  return detected;
}
