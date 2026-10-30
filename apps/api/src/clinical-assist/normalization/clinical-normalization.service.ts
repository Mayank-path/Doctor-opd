import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ClinicalNormalizationRegistry } from './clinical-normalization.registry';
import {
  classifyClinicalLanguage,
  detectExcludedClinicalTerms,
  evaluateCertainty,
  evaluatePolarity,
  extractBodyLocation,
  extractDuration,
  extractFrequency,
  extractSeverity,
  findMatchesInClause,
  segmentIntoClauses,
} from './clinical-normalization.rules';
import {
  NormalizedClinicalResult,
  NormalizedSymptom,
} from './clinical-normalization.types';

@Injectable()
export class ClinicalNormalizationService {
  private readonly logger = new Logger(ClinicalNormalizationService.name);

  constructor(
    private readonly terminologyRegistry: ClinicalNormalizationRegistry,
  ) {}

  /**
   * Deterministically normalizes doctor-confirmed Hinglish, Hindi, and English clinical text.
   *
   * Clinical Safety Guarantees:
   * 1. Deterministic & Explainable: Output is generated strictly via explicit rules and registry.
   * 2. Zero AI / LLM Dependency: No external API or generative hallucination.
   * 3. Zero Clinical Mutation: Stateless documentation aid; never writes to database.
   * 4. Zero Diagnostic Assertion: Never infers diseases or treatments.
   * 5. Evidence Traceability: Every extracted symptom attribute is bound to its exact source clause.
   */
  public normalize(text: string): NormalizedClinicalResult {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new BadRequestException('Clinical text must be a non-empty string');
    }

    const trimmed = text.trim();
    if (trimmed.length > 5000) {
      throw new BadRequestException(
        'Clinical text exceeds maximum allowed length of 5000 characters',
      );
    }

    // 1. Language classification
    const language = classifyClinicalLanguage(trimmed);

    // 2. Clause segmentation
    const clauses = segmentIntoClauses(trimmed);
    const compiledAliases = this.terminologyRegistry.getCompiledAliases();

    const symptoms: NormalizedSymptom[] = [];
    const unmappedClauses: string[] = [];

    // 3. Process each clause
    for (const clause of clauses) {
      const matches = findMatchesInClause(clause, compiledAliases);

      if (matches.length === 0) {
        // Collect candidate unmapped clauses that contain meaningful content
        if (clause.text.length > 3) {
          unmappedClauses.push(clause.text);
        }
        continue;
      }

      for (const match of matches) {
        // Attribute extraction scoped to clause
        const polarity = evaluatePolarity(clause.text, match.matchedAlias);
        const certainty = evaluateCertainty(clause.text);
        const duration = extractDuration(clause.text);
        const severity = extractSeverity(clause.text);
        const frequency = extractFrequency(clause.text);
        const bodyLocation = extractBodyLocation(
          clause.text,
          match.matchedAlias,
        );

        symptoms.push({
          canonicalTerm: match.canonicalTerm,
          originalExpression: match.matchedAlias,
          polarity,
          certainty,
          duration,
          severity,
          frequency,
          bodyLocation,
          evidence: clause.text,
        });
      }
    }

    // 4. Detect excluded clinical expressions (diagnoses, signs, temporal descriptors)
    const relatedClinicalExpressions = detectExcludedClinicalTerms(trimmed);

    // Filter unmapped expressions to remove trivial connector words
    const filteredUnmapped = unmappedClauses.filter((c) => {
      const lower = c.toLowerCase().trim();
      return (
        !/^(patient\s+says|mareez\s+ko|patient\s+ko|doctor|opd|hai|tha|thi|aur)$/i.test(
          lower,
        ) && lower.length > 2
      );
    });

    // Ensure any detected excluded terms are explicitly represented in unmapped expressions
    const unmappedSet = new Set<string>();
    for (const rel of relatedClinicalExpressions) {
      unmappedSet.add(rel.expression);
    }
    for (const clause of filteredUnmapped) {
      unmappedSet.add(clause);
    }

    return {
      originalText: text,
      language,
      symptoms,
      unmappedExpressions: Array.from(unmappedSet),
      relatedClinicalExpressions,
      requiresDoctorReview: true,
    };
  }
}
