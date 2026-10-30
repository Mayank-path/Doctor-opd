import {
  DetectedClinicalLanguage,
  DurationUnit,
  SymptomCertainty,
  SymptomFrequency,
  SymptomPolarity,
  SymptomSeverity,
} from './clinical-normalization.types';
import {
  classifyClinicalLanguage,
  evaluateCertainty,
  evaluatePolarity,
  extractBodyLocation,
  extractDuration,
  extractFrequency,
  extractSeverity,
  segmentIntoClauses,
} from './clinical-normalization.rules';

describe('ClinicalNormalizationRules', () => {
  describe('Clause Segmentation', () => {
    it('should split on sentence-ending punctuation', () => {
      const text = 'Mareez ko bukhar hai. Khansi nahi hai! Halka headache hai?';
      const clauses = segmentIntoClauses(text);
      expect(clauses.length).toBe(3);
      expect(clauses[0].text).toBe('Mareez ko bukhar hai');
      expect(clauses[1].text).toBe('Khansi nahi hai');
      expect(clauses[2].text).toBe('Halka headache hai');
    });

    it('should split on contrastive conjunctions like lekin, par, but, however', () => {
      const text = 'Fever nahi hai lekin cough hai, par dizziness bhi hai';
      const clauses = segmentIntoClauses(text);
      expect(clauses.length).toBe(3);
      expect(clauses[0].text).toBe('Fever nahi hai');
      expect(clauses[1].text).toBe('cough hai');
      expect(clauses[2].text).toBe('dizziness bhi hai');
    });

    it('should preserve accurate start and end character offsets', () => {
      const text = 'No vomiting, but nausea hai.';
      const clauses = segmentIntoClauses(text);
      expect(clauses.length).toBe(2);
      expect(clauses[0].text).toBe('No vomiting');
      expect(text.slice(clauses[0].startIndex, clauses[0].endIndex)).toBe(
        'No vomiting',
      );
      expect(clauses[1].text).toBe('nausea hai');
      expect(text.slice(clauses[1].startIndex, clauses[1].endIndex)).toBe(
        'nausea hai',
      );
    });
  });

  describe('Negation Detection & Polarity', () => {
    it('should identify positive polarity when no negation is present', () => {
      expect(evaluatePolarity('Mareez ko bukhar hai', 'bukhar')).toBe(
        SymptomPolarity.POSITIVE,
      );
      expect(evaluatePolarity('Patient has cough', 'cough')).toBe(
        SymptomPolarity.POSITIVE,
      );
    });

    it('should identify postfix Hindi/Hinglish negation', () => {
      expect(evaluatePolarity('bukhar nahi hai', 'bukhar')).toBe(
        SymptomPolarity.NEGATIVE,
      );
      expect(evaluatePolarity('khansi nahin thi', 'khansi')).toBe(
        SymptomPolarity.NEGATIVE,
      );
      expect(evaluatePolarity('cough absent', 'cough')).toBe(
        SymptomPolarity.NEGATIVE,
      );
    });

    it('should identify prefix English and Hindi negation', () => {
      expect(evaluatePolarity('no fever', 'fever')).toBe(
        SymptomPolarity.NEGATIVE,
      );
      expect(evaluatePolarity('denies headache', 'headache')).toBe(
        SymptomPolarity.NEGATIVE,
      );
      expect(evaluatePolarity('without vomiting', 'vomiting')).toBe(
        SymptomPolarity.NEGATIVE,
      );
      expect(evaluatePolarity('koi bukhar nahi hai', 'bukhar')).toBe(
        SymptomPolarity.NEGATIVE,
      );
    });

    it('should strictly isolate negation scope so one symptom does not negate another', () => {
      // In segmented clauses:
      const clause1 = 'Fever nahi hai';
      const clause2 = 'cough hai';
      expect(evaluatePolarity(clause1, 'fever')).toBe(SymptomPolarity.NEGATIVE);
      expect(evaluatePolarity(clause2, 'cough')).toBe(SymptomPolarity.POSITIVE);
    });

    it('should mark ambiguous/conflicting negation as UNKNOWN', () => {
      const ambiguous = 'bukhar ho sakta hai aur nahi bhi';
      expect(evaluatePolarity(ambiguous, 'bukhar')).toBe(
        SymptomPolarity.UNKNOWN,
      );
    });
  });

  describe('Uncertainty Detection', () => {
    it('should detect Hindi/Hinglish uncertainty expressions', () => {
      expect(evaluateCertainty('shayad bukhar hai')).toBe(
        SymptomCertainty.UNCERTAIN,
      );
      expect(evaluateCertainty('lagta hai bukhar hai')).toBe(
        SymptomCertainty.UNCERTAIN,
      );
      expect(evaluateCertainty('ho sakta hai bukhar ho')).toBe(
        SymptomCertainty.UNCERTAIN,
      );
    });

    it('should detect English uncertainty expressions', () => {
      expect(evaluateCertainty('possibly fever')).toBe(
        SymptomCertainty.UNCERTAIN,
      );
      expect(evaluateCertainty('maybe cough')).toBe(SymptomCertainty.UNCERTAIN);
      expect(evaluateCertainty('suspected by patient')).toBe(
        SymptomCertainty.UNCERTAIN,
      );
    });

    it('should default to CONFIRMED when no uncertainty markers are present', () => {
      expect(evaluateCertainty('teen din se bukhar hai')).toBe(
        SymptomCertainty.CONFIRMED,
      );
    });
  });

  describe('Duration and Onset Extraction', () => {
    it('should parse Hindi word numerals with units', () => {
      const res = extractDuration('Mareez ko teen din se bukhar hai');
      expect(res).toEqual({
        raw: 'teen din se',
        value: 3,
        unit: DurationUnit.DAYS,
      });
    });

    it('should parse digit numerals with units', () => {
      const res = extractDuration('Patient has fever for 2 weeks');
      expect(res).toEqual({
        raw: 'for 2 weeks',
        value: 2,
        unit: DurationUnit.WEEKS,
      });
    });

    it('should parse weeks in Hinglish', () => {
      const res = extractDuration('do hafte se pet me jalan hai');
      expect(res).toEqual({
        raw: 'do hafte se',
        value: 2,
        unit: DurationUnit.WEEKS,
      });
    });

    it('should parse relative onset "kal se" / "since yesterday"', () => {
      const res = extractDuration('kal se khansi hai');
      expect(res).toEqual({
        raw: 'kal se',
        value: 1,
        unit: DurationUnit.DAYS,
        onset: 'since yesterday',
      });
    });

    it('should parse onset "subah se" preserving raw text without fabricated numbers', () => {
      const res = extractDuration('aaj subah se ulti ho rahi hai');
      expect(res).toEqual({
        raw: 'aaj subah se',
        value: null,
        unit: null,
        onset: 'since morning',
      });
    });

    it('should return null when no temporal expression is present', () => {
      expect(extractDuration('halka headache hai')).toBeNull();
    });
  });

  describe('Severity Extraction', () => {
    it('should extract MILD severity', () => {
      expect(extractSeverity('halka headache hai')).toBe(SymptomSeverity.MILD);
      expect(extractSeverity('slight cough')).toBe(SymptomSeverity.MILD);
      expect(extractSeverity('low grade fever')).toBe(SymptomSeverity.MILD);
    });

    it('should extract MODERATE severity', () => {
      expect(extractSeverity('moderate pain')).toBe(SymptomSeverity.MODERATE);
    });

    it('should extract SEVERE severity', () => {
      expect(extractSeverity('bahut zyada pet dard')).toBe(
        SymptomSeverity.SEVERE,
      );
      expect(extractSeverity('severe chest tightness')).toBe(
        SymptomSeverity.SEVERE,
      );
      expect(extractSeverity('tez bukhar')).toBe(SymptomSeverity.SEVERE);
    });

    it('should return null when no severity was stated', () => {
      expect(extractSeverity('bukhar hai')).toBeNull();
    });
  });

  describe('Frequency Extraction', () => {
    it('should extract OCCASIONAL frequency', () => {
      expect(extractFrequency('kabhi kabhi ulti hoti hai')).toBe(
        SymptomFrequency.OCCASIONAL,
      );
      expect(extractFrequency('occasional dizziness')).toBe(
        SymptomFrequency.OCCASIONAL,
      );
    });

    it('should extract INTERMITTENT frequency', () => {
      expect(extractFrequency('sometimes chest pain')).toBe(
        SymptomFrequency.INTERMITTENT,
      );
      expect(extractFrequency('ruk ruk kar dard')).toBe(
        SymptomFrequency.INTERMITTENT,
      );
    });

    it('should extract FREQUENT frequency', () => {
      expect(extractFrequency('baar baar loose motion')).toBe(
        SymptomFrequency.FREQUENT,
      );
      expect(extractFrequency('frequent headache')).toBe(
        SymptomFrequency.FREQUENT,
      );
    });

    it('should extract CONTINUOUS frequency', () => {
      expect(extractFrequency('lagatar cough')).toBe(
        SymptomFrequency.CONTINUOUS,
      );
      expect(extractFrequency('constant burning')).toBe(
        SymptomFrequency.CONTINUOUS,
      );
    });

    it('should return null when no frequency is stated', () => {
      expect(extractFrequency('cough hai')).toBeNull();
    });
  });

  describe('Body Location Extraction', () => {
    it('should extract explicit anatomical location from text', () => {
      expect(extractBodyLocation('pet mein jalan ho rahi hai', 'jalan')).toBe(
        'Abdomen',
      );
      expect(extractBodyLocation('chhati mein pain hota hai', 'pain')).toBe(
        'Chest',
      );
      expect(extractBodyLocation('gale me kharash hai', 'kharash')).toBe(
        'Throat',
      );
    });

    it('should not fabricate body location if not explicitly stated as distinct anatomical term', () => {
      expect(extractBodyLocation('halka headache hai', 'headache')).toBeNull();
      expect(extractBodyLocation('fever hai', 'fever')).toBeNull();
    });
  });

  describe('Language Classification', () => {
    it('should identify Devanagari Hindi', () => {
      expect(classifyClinicalLanguage('मरीज को तीन दिन से बुखार है')).toBe(
        DetectedClinicalLanguage.HINDI,
      );
    });

    it('should identify Hinglish with grammatical markers', () => {
      expect(classifyClinicalLanguage('Mareez ko teen din se bukhar hai')).toBe(
        DetectedClinicalLanguage.HINGLISH,
      );
      expect(
        classifyClinicalLanguage(
          'Patient ko kal se khansi aur halka headache hai',
        ),
      ).toBe(DetectedClinicalLanguage.HINGLISH);
    });

    it('should identify English without Hinglish markers', () => {
      expect(
        classifyClinicalLanguage(
          'Patient reports high fever and productive cough for three days',
        ),
      ).toBe(DetectedClinicalLanguage.ENGLISH);
    });

    it('should identify MIXED when Devanagari and Latin script are interspersed', () => {
      expect(
        classifyClinicalLanguage('Patient ko बुखार hai aur headache hai'),
      ).toBe(DetectedClinicalLanguage.MIXED);
    });

    it('should classify very short or non-linguistic input as UNKNOWN', () => {
      expect(classifyClinicalLanguage('a')).toBe(
        DetectedClinicalLanguage.UNKNOWN,
      );
    });
  });
});
