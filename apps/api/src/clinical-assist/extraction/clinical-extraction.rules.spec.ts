import {
  SymptomCertainty,
  SymptomPolarity,
  SymptomSeverity,
} from '../normalization/clinical-normalization.types';
import {
  classifyConceptCategory,
  deriveFindingStatus,
  extractClinicalAssessments,
  extractSeverityAssessment,
  findExactEvidenceOffsets,
  parseTemporalEpisodes,
} from './clinical-extraction.rules';
import {
  ClinicalAssessmentStatus,
  ClinicalFindingStatus,
  SeverityAssessmentState,
} from './clinical-extraction.types';

describe('Clinical Extraction Rules & Deterministic Resolvers', () => {
  describe('findExactEvidenceOffsets', () => {
    it('should find exact substring and satisfy slice invariant', () => {
      const text = 'Mareez ko 3 din se bukhar hai, khansi nahi hai.';
      const sub = 'bukhar';
      const span = findExactEvidenceOffsets(text, sub);

      expect(span.startIndex).not.toBeNull();
      expect(span.endIndex).not.toBeNull();
      expect(text.slice(span.startIndex!, span.endIndex!)).toBe(sub);
      expect(span.text).toBe(sub);
    });

    it('should handle Devanagari UTF-16 code units with exact slice match', () => {
      const text = 'मरीज़ को ३ दिन से तेज़ बुखार है';
      const sub = 'तेज़ बुखार';
      const span = findExactEvidenceOffsets(text, sub);

      expect(span.startIndex).toBe(18);
      expect(span.endIndex).toBe(28);
      expect(text.slice(span.startIndex!, span.endIndex!)).toBe(sub);
    });

    it('should return null offsets if substring is not in original text without fabricating', () => {
      const text = 'Patient has fever';
      const nonExistent = 'vomiting';
      const span = findExactEvidenceOffsets(text, nonExistent);

      expect(span.startIndex).toBeNull();
      expect(span.endIndex).toBeNull();
      expect(span.text).toBe(nonExistent);
    });
  });

  describe('deriveFindingStatus', () => {
    it('should derive PRESENT from positive polarity and confirmed certainty', () => {
      const res = deriveFindingStatus(
        SymptomPolarity.POSITIVE,
        SymptomCertainty.CONFIRMED,
      );
      expect(res.status).toBe(ClinicalFindingStatus.PRESENT);
      expect(res.ruleId).toBe('RULE-STATUS-PRESENT-001');
    });

    it('should derive ABSENT from negative polarity and confirmed certainty', () => {
      const res = deriveFindingStatus(
        SymptomPolarity.NEGATIVE,
        SymptomCertainty.CONFIRMED,
      );
      expect(res.status).toBe(ClinicalFindingStatus.ABSENT);
      expect(res.ruleId).toBe('RULE-STATUS-ABSENT-002');
    });

    it('should derive UNCERTAIN when certainty is uncertain, regardless of polarity', () => {
      const resPos = deriveFindingStatus(
        SymptomPolarity.POSITIVE,
        SymptomCertainty.UNCERTAIN,
      );
      expect(resPos.status).toBe(ClinicalFindingStatus.UNCERTAIN);
      expect(resPos.ruleId).toBe('RULE-STATUS-UNCERTAIN-003');

      const resNeg = deriveFindingStatus(
        SymptomPolarity.NEGATIVE,
        SymptomCertainty.UNCERTAIN,
      );
      expect(resNeg.status).toBe(ClinicalFindingStatus.UNCERTAIN);
    });

    it('should derive UNKNOWN when contradictory or unresolvable', () => {
      const res = deriveFindingStatus(
        SymptomPolarity.POSITIVE,
        SymptomCertainty.CONFIRMED,
        true,
      );
      expect(res.status).toBe(ClinicalFindingStatus.UNKNOWN);
      expect(res.ruleId).toBe('RULE-STATUS-UNKNOWN-CONFLICT-004');
    });
  });

  describe('extractSeverityAssessment', () => {
    it('should return NOT_MENTIONED when severity was not discussed', () => {
      const res = extractSeverityAssessment(
        'Mareez ko bukhar hai',
        'Mareez ko bukhar hai',
        null,
      );
      expect(res.state).toBe(SeverityAssessmentState.NOT_MENTIONED);
      expect(res.level).toBeNull();
      expect(res.evidence).toBeNull();
    });

    it('should return EXPLICITLY_UNCLEAR when severity is declared unclear', () => {
      const clause = 'pet dard hai, severity unclear';
      const text = 'Patient ko 2 din se pet dard hai, severity unclear.';
      const res = extractSeverityAssessment(clause, text, null);

      expect(res.state).toBe(SeverityAssessmentState.EXPLICITLY_UNCLEAR);
      expect(res.level).toBeNull();
      expect(res.evidence).not.toBeNull();
      expect(res.evidence!.text).toBe('severity unclear');
      expect(
        text.slice(res.evidence!.startIndex!, res.evidence!.endIndex!),
      ).toBe('severity unclear');
    });

    it('should return ASSESSED when severity is explicitly stated', () => {
      const clause = 'tez bukhar hai';
      const text = 'Mareez ko tez bukhar hai.';
      const res = extractSeverityAssessment(
        clause,
        text,
        SymptomSeverity.SEVERE,
      );

      expect(res.state).toBe(SeverityAssessmentState.ASSESSED);
      expect(res.level).toBe(SymptomSeverity.SEVERE);
      expect(res.evidence).not.toBeNull();
      expect(res.evidence!.text).toBe('tez');
    });
  });

  describe('parseTemporalEpisodes', () => {
    it('should parse single current episode', () => {
      const text = 'Mareez ko 3 din se bukhar hai';
      const { statements, chronologicalRelationships } = parseTemporalEpisodes(
        'Fever',
        ['3 din se bukhar hai'],
        text,
        ClinicalFindingStatus.PRESENT,
      );

      expect(statements).toHaveLength(1);
      expect(statements[0].temporalAnchor).toBe('CURRENT');
      expect(statements[0].status).toBe(ClinicalFindingStatus.PRESENT);
      expect(chronologicalRelationships).toHaveLength(0);
    });

    it('should resolve historical present and current absent transition to RESOLVED', () => {
      const text = 'Fever tha, ab nahi hai.';
      const { statements, chronologicalRelationships } = parseTemporalEpisodes(
        'Fever',
        ['Fever tha, ab nahi hai'],
        text,
        ClinicalFindingStatus.ABSENT,
      );

      expect(statements).toHaveLength(2);
      expect(statements[0].temporalAnchor).toBe('HISTORICAL');
      expect(statements[0].status).toBe(ClinicalFindingStatus.PRESENT);
      expect(statements[1].temporalAnchor).toBe('CURRENT');
      expect(statements[1].status).toBe(ClinicalFindingStatus.ABSENT);

      expect(chronologicalRelationships).toHaveLength(1);
      expect(chronologicalRelationships[0].transitionType).toBe('RESOLVED');
      expect(chronologicalRelationships[0].priorStatementId).toBe(
        statements[0].statementId,
      );
      expect(chronologicalRelationships[0].subsequentStatementId).toBe(
        statements[1].statementId,
      );
    });

    it('should resolve multi-phase diurnal return: IMPROVED followed by AMBIGUOUS', () => {
      const text = 'Fever tha kal, subah kam ho gaya, shaam ko phir aa gaya.';
      const { statements, chronologicalRelationships, warnings } =
        parseTemporalEpisodes(
          'Fever',
          [text],
          text,
          ClinicalFindingStatus.PRESENT,
        );

      expect(statements).toHaveLength(3);
      expect(statements[0].temporalAnchor).toBe('HISTORICAL');
      expect(statements[1].temporalAnchor).toBe('HISTORICAL');
      expect(statements[2].temporalAnchor).toBe('HISTORICAL');

      expect(chronologicalRelationships).toHaveLength(2);
      // Rel 1: kal -> subah is IMPROVED
      expect(chronologicalRelationships[0].transitionType).toBe('IMPROVED');
      // Rel 2: subah -> shaam is AMBIGUOUS
      expect(chronologicalRelationships[1].transitionType).toBe('AMBIGUOUS');
      expect(chronologicalRelationships[1].confidence).toBe('AMBIGUOUS');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should parse recurrence after explicit remission as RECURRED', () => {
      const text = 'Bukhar theek ho gaya tha, par aaj dobara shuru ho gaya.';
      const { statements, chronologicalRelationships } = parseTemporalEpisodes(
        'Fever',
        [text],
        text,
        ClinicalFindingStatus.PRESENT,
      );

      expect(statements).toHaveLength(2);
      expect(statements[0].status).toBe(ClinicalFindingStatus.ABSENT);
      expect(statements[1].status).toBe(ClinicalFindingStatus.PRESENT);
      expect(chronologicalRelationships).toHaveLength(1);
      expect(chronologicalRelationships[0].transitionType).toBe('RECURRED');
    });

    it('should parse explicit worsening as WORSENED', () => {
      const text = 'Pehle halka bukhar tha, ab bohot tez ho gaya hai.';
      const { statements, chronologicalRelationships } = parseTemporalEpisodes(
        'Fever',
        [text],
        text,
        ClinicalFindingStatus.PRESENT,
      );

      expect(statements).toHaveLength(2);
      expect(chronologicalRelationships).toHaveLength(1);
      expect(chronologicalRelationships[0].transitionType).toBe('WORSENED');
    });
  });

  describe('extractClinicalAssessments', () => {
    it('should extract unperformed chest examination as assessment record without creating symptoms', () => {
      const text = 'Chest examination not performed.';
      const assessments = extractClinicalAssessments(text);

      expect(assessments).toHaveLength(1);
      expect(assessments[0].assessmentScope).toBe('SYSTEM_EXAMINATION');
      expect(assessments[0].targetSystemOrExam).toBe(
        'Respiratory / Chest Examination',
      );
      expect(assessments[0].status).toBe(ClinicalAssessmentStatus.NOT_ASSESSED);
      expect(assessments[0].evidence.text).toBe(
        'Chest examination not performed',
      );
      expect(
        text.slice(
          assessments[0].evidence.startIndex!,
          assessments[0].evidence.endIndex!,
        ),
      ).toBe('Chest examination not performed');
    });
  });

  describe('classifyConceptCategory', () => {
    it('should classify chills as SUBJECTIVE_SENSATION', () => {
      expect(classifyConceptCategory('chills')).toBe('SUBJECTIVE_SENSATION');
      expect(classifyConceptCategory('feeling cold')).toBe(
        'SUBJECTIVE_SENSATION',
      );
      expect(classifyConceptCategory('thand lagna')).toBe(
        'SUBJECTIVE_SENSATION',
      );
    });

    it('should preserve clinical signs and conditions', () => {
      expect(classifyConceptCategory('wheezing', 'CLINICAL_SIGN')).toBe(
        'CLINICAL_SIGN',
      );
      expect(
        classifyConceptCategory('migraine', 'DIAGNOSIS_OR_CONDITION'),
      ).toBe('DIAGNOSIS_OR_CONDITION');
    });
  });
});
