import { Injectable, Logger } from '@nestjs/common';
import { ClinicalNormalizationService } from '../normalization/clinical-normalization.service';
import {
  NormalizedClinicalResult,
  NormalizedSymptom,
} from '../normalization/clinical-normalization.types';
import {
  EXTRACTION_ENGINE_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  getCanonicalTermId,
  NORMALIZATION_ENGINE_VERSION,
  SYSTEM_SAFETY_NOTICE,
} from './clinical-extraction.constants';
import { ExtractStructuredClinicalDto } from './dto/extract-structured-clinical.dto';
import {
  classifyConceptCategory,
  deriveFindingStatus,
  extractClinicalAssessments,
  extractSeverityAssessment,
  findExactEvidenceOffsets,
  parseTemporalEpisodes,
} from './clinical-extraction.rules';
import {
  ClinicalFindingStatus,
  ClinicalProvenance,
  SeverityAssessmentState,
  StructuredClinicalExtractionResult,
  StructuredClinicalFinding,
  StructuredExtractionSummaryCounts,
  UnmappedClinicalExpression,
} from './clinical-extraction.types';

@Injectable()
export class ClinicalExtractionService {
  private readonly logger = new Logger(ClinicalExtractionService.name);

  constructor(
    private readonly normalizationService: ClinicalNormalizationService,
  ) {}

  /**
   * Pure, stateless extraction of structured clinical findings from doctor-confirmed text.
   * Completely deterministic. Never modifies database records or accesses external LLMs.
   */
  public extract(
    dto: ExtractStructuredClinicalDto,
  ): StructuredClinicalExtractionResult {
    const originalText = dto.text;

    // 1. Internal server-side recomputation of Phase 5A normalization (Zero-Trust Security)
    const normResult: NormalizedClinicalResult =
      this.normalizationService.normalize(originalText);

    // 2. Extract clinical assessment records (examinations/systems not performed)
    const clinicalAssessments = extractClinicalAssessments(originalText);

    // 3. Split original text into clauses to identify anaphoric / continuation clauses
    const clauseRegex =
      /[,.;:!?\n\r]+|\b(?:aur|lekin|par|and|but|however)\b/giu;
    const rawClauses: { text: string; start: number; end: number }[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = clauseRegex.exec(originalText)) !== null) {
      const clause = originalText.slice(lastIdx, match.index).trim();
      if (clause.length > 0) {
        rawClauses.push({ text: clause, start: lastIdx, end: match.index });
      }
      lastIdx = clauseRegex.lastIndex;
    }
    const remaining = originalText.slice(lastIdx).trim();
    if (remaining.length > 0) {
      rawClauses.push({
        text: remaining,
        start: lastIdx,
        end: originalText.length,
      });
    }

    // Process and group normalized symptoms by canonical term
    const findings: StructuredClinicalFinding[] = [];
    const groupedSymptoms = new Map<string, NormalizedSymptom[]>();
    const consumedClauses = new Set<string>();

    for (const symptom of normResult.symptoms) {
      const key = symptom.canonicalTerm.toLowerCase();
      if (!groupedSymptoms.has(key)) {
        groupedSymptoms.set(key, []);
      }
      groupedSymptoms.get(key)!.push(symptom);
    }

    let findingIndex = 0;
    for (const [canonicalKey, symptoms] of groupedSymptoms.entries()) {
      const primarySymptom = symptoms[0];
      const canonicalDisplayName = primarySymptom.canonicalTerm;
      const canonicalTermId = getCanonicalTermId(canonicalDisplayName);

      // Collect all evidence clauses explicitly identified by Phase 5A
      const findingClauseTexts: string[] = [];
      for (const s of symptoms) {
        const text = s.evidence || s.originalExpression;
        findingClauseTexts.push(text);
        consumedClauses.add(text.toLowerCase());
      }

      // Check for subsequent continuation clauses in rawClauses (e.g. "ab nahi hai", "subah kam ho gaya", "severity unclear")
      // A clause is a continuation if it does NOT contain other symptoms or excluded concepts, but has temporal/severity markers
      const primaryEvidence =
        primarySymptom.evidence || primarySymptom.originalExpression;
      const primaryClauseIndex = rawClauses.findIndex((c) =>
        c.text.toLowerCase().includes(primaryEvidence.toLowerCase()),
      );

      if (primaryClauseIndex !== -1) {
        for (let i = primaryClauseIndex + 1; i < rawClauses.length; i++) {
          const nextClause = rawClauses[i].text;
          const nextLower = nextClause.toLowerCase();

          // Check if it belongs to another symptom or excluded concept
          const hasOtherSymptom = normResult.symptoms.some(
            (s) =>
              s.canonicalTerm.toLowerCase() !== canonicalKey &&
              nextLower.includes(
                (s.evidence || s.originalExpression).toLowerCase(),
              ),
          );
          const hasExcluded = normResult.relatedClinicalExpressions?.some((r) =>
            nextLower.includes(r.expression.toLowerCase()),
          );

          if (hasOtherSymptom || hasExcluded) {
            break; // Reached next distinct clinical finding
          }

          // Check if clause has temporal transition indicators or severity qualifiers
          const isContinuation =
            /\b(?:ab\s+nahi|ab\s+theek|kam\s+ho\s+gaya|phir\s+aa\s+gaya|subah|shaam|theek\s+hai|theek\s+ho\s+gaya|badh\s+gaya|now|resolved|severity\s+unclear|severity\s+unknown|unclear\s+severity|intensity\s+unclear|dard\s+ka\s+pata\s+nahi)\b/i.test(
              nextLower,
            );

          if (isContinuation) {
            findingClauseTexts.push(nextClause);
            consumedClauses.add(nextLower);
          } else {
            break;
          }
        }
      }

      const originalExpression = symptoms
        .map((s) => s.originalExpression)
        .join(', ');

      // Initial status evaluation
      const statusDerivation = deriveFindingStatus(
        primarySymptom.polarity,
        primarySymptom.certainty,
      );

      // Parse temporal episodes and chronological transitions
      const { statements, chronologicalRelationships, warnings } =
        parseTemporalEpisodes(
          canonicalDisplayName,
          findingClauseTexts,
          originalText,
          statusDerivation.status,
        );

      // Attach duration to active statement if present from Phase 5A
      if (primarySymptom.duration && statements.length > 0) {
        const targetStatement = statements[statements.length - 1]; // active statement
        targetStatement.duration = {
          raw: primarySymptom.duration.raw,
          value: primarySymptom.duration.value,
          unit: primarySymptom.duration.unit,
        };
      }

      // Determine consolidated clinical status
      let consolidatedStatus = statusDerivation.status;
      if (statements.length > 1) {
        const currentStmt = statements.find(
          (s) => s.temporalAnchor === 'CURRENT',
        );
        if (currentStmt) {
          consolidatedStatus = currentStmt.status;
        }
      }

      // Severity extraction (3-state model)
      const severityAssessment = extractSeverityAssessment(
        findingClauseTexts.join(' '),
        originalText,
        primarySymptom.severity,
      );

      if (
        severityAssessment.state === SeverityAssessmentState.EXPLICITLY_UNCLEAR
      ) {
        warnings.push(
          "Severity was explicitly declared unclear in source text ('severity unclear'); level preserved as null with state EXPLICITLY_UNCLEAR.",
        );
      }

      // Anatomical body location
      const bodyLocation = {
        name: primarySymptom.bodyLocation,
        isDefault: Boolean(primarySymptom.bodyLocation),
        evidenceSpan: null,
      };

      // Build provenance chain
      const provenance: ClinicalProvenance[] = [];
      for (const s of symptoms) {
        const span = findExactEvidenceOffsets(
          originalText,
          s.evidence || s.originalExpression,
        );
        provenance.push({
          ruleId: statusDerivation.ruleId,
          ruleDescription: statusDerivation.ruleDescription,
          matchedAlias: s.originalExpression,
          canonicalTermId,
          evidence: span,
          engineVersion: EXTRACTION_ENGINE_VERSION,
        });
      }

      // Add severity provenance if assessed or explicitly unclear
      if (severityAssessment.evidence) {
        provenance.push({
          ruleId: 'RULE-SEVERITY-ASSESSMENT-010',
          ruleDescription:
            severityAssessment.state ===
            SeverityAssessmentState.EXPLICITLY_UNCLEAR
              ? 'Severity explicitly stated as unclear; recorded as EXPLICITLY_UNCLEAR with evidence'
              : 'Severity explicitly assessed and matched to standardized level',
          evidence: severityAssessment.evidence,
          engineVersion: EXTRACTION_ENGINE_VERSION,
        });
      }

      findings.push({
        id: `finding-${canonicalKey.replace(/[^a-z0-9]+/g, '-')}-${findingIndex++}`,
        canonicalTermId,
        canonicalDisplayName,
        originalExpression,
        conceptCategory: 'SYMPTOM',
        status: consolidatedStatus,
        certainty: primarySymptom.certainty,
        temporalStatements: statements,
        chronologicalRelationships,
        severityAssessment,
        bodyLocation,
        provenance,
        validationWarnings: warnings,
      });
    }

    // 4. Process unmapped expressions and concept category isolation (chills, signs, conditions)
    const unmappedExpressions: UnmappedClinicalExpression[] = [];

    // Process related clinical expressions from Phase 5A (e.g. excluded clinical concepts)
    if (normResult.relatedClinicalExpressions) {
      for (const expr of normResult.relatedClinicalExpressions) {
        const category = classifyConceptCategory(
          expr.expression,
          expr.category,
        );
        const span = findExactEvidenceOffsets(originalText, expr.expression);

        let ruleId: import('./clinical-extraction.types').ExtractionRuleId =
          'RULE-CONCEPT-SIGN-ISOLATION-007';
        let reason = expr.note;

        if (category === 'SUBJECTIVE_SENSATION') {
          ruleId = 'RULE-CONCEPT-SENSATION-ISOLATION-006';
          reason =
            'Preserved as patient-reported subjective cold sensation; distinct from elevated body temperature (Fever). Prohibited from fallback symptom conversion.';
        } else if (category === 'DIAGNOSIS_OR_CONDITION') {
          ruleId = 'RULE-CONCEPT-DIAGNOSIS-ISOLATION-008';
        }

        unmappedExpressions.push({
          expression: expr.expression,
          category,
          reason,
          evidence: span,
          provenanceRule: ruleId,
        });
      }
    }

    // Process general unmapped expressions from Phase 5A (skipping already consumed continuation clauses or supersets of captured sensations)
    for (const unmapped of normResult.unmappedExpressions) {
      const lowerUnmapped = unmapped.toLowerCase().trim();

      // Skip if consumed as continuation clause of a symptom
      if (consumedClauses.has(lowerUnmapped)) {
        continue;
      }

      // Skip if it contains or is contained by an already captured relatedClinicalExpression (e.g. "reports chills" when "chills" is captured)
      const isSubOrSuperOfCaptured = unmappedExpressions.some(
        (u) =>
          u.expression.toLowerCase() === lowerUnmapped ||
          lowerUnmapped.includes(u.expression.toLowerCase()),
      );
      if (isSubOrSuperOfCaptured) {
        continue;
      }

      // Skip if matches unperformed assessment text
      const isAssessmentText = clinicalAssessments.some((a) =>
        a.evidence.text.toLowerCase().includes(lowerUnmapped),
      );
      if (isAssessmentText) {
        continue;
      }

      const category = classifyConceptCategory(unmapped);
      const span = findExactEvidenceOffsets(originalText, unmapped);

      unmappedExpressions.push({
        expression: unmapped,
        category,
        reason:
          'Unrecognized clinical expression requiring clinician clarification.',
        evidence: span,
        provenanceRule: 'RULE-CONCEPT-SIGN-ISOLATION-007',
      });
    }

    // 5. Compute summary counts
    const summaryCounts: StructuredExtractionSummaryCounts = {
      totalFindings: findings.length,
      presentCount: findings.filter(
        (f) => f.status === ClinicalFindingStatus.PRESENT,
      ).length,
      absentCount: findings.filter(
        (f) => f.status === ClinicalFindingStatus.ABSENT,
      ).length,
      uncertainCount: findings.filter(
        (f) => f.status === ClinicalFindingStatus.UNCERTAIN,
      ).length,
      unknownCount: findings.filter(
        (f) => f.status === ClinicalFindingStatus.UNKNOWN,
      ).length,
      unmappedCount: unmappedExpressions.length,
      clinicalAssessmentsCount: clinicalAssessments.length,
    };

    return {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      extractionEngineVersion: EXTRACTION_ENGINE_VERSION,
      normalizationEngineVersion: NORMALIZATION_ENGINE_VERSION,
      source: {
        originalDoctorConfirmedText: originalText,
        detectedLanguage: normResult.language,
        characterCount: originalText.length, // UTF-16 code units
      },
      findings,
      clinicalAssessments,
      unmappedExpressions,
      summaryCounts,
      review: {
        requiresDoctorReview: true,
        reviewStatus: 'PENDING_REVIEW',
        systemSafetyNotice: SYSTEM_SAFETY_NOTICE,
      },
    };
  }
}
