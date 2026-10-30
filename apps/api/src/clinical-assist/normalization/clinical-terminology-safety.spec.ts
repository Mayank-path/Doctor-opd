import { ClinicalNormalizationRegistry } from './clinical-normalization.registry';
import { ClinicalNormalizationService } from './clinical-normalization.service';
import {
  SymptomCertainty,
  SymptomPolarity,
} from './clinical-normalization.types';

describe('Clinical Terminology Safety Audit (Phase 5A.1 Regression Suite)', () => {
  let service: ClinicalNormalizationService;
  let registry: ClinicalNormalizationRegistry;

  beforeEach(() => {
    registry = new ClinicalNormalizationRegistry();
    service = new ClinicalNormalizationService(registry);
  });

  describe('1. Unsafe Mappings Strictly Excluded from Symptom Extraction', () => {
    it('migraine must NOT automatically map to generic Headache symptom', () => {
      const input = 'Patient has migraine since morning.';
      const res = service.normalize(input);

      // Must not fabricate Headache
      expect(res.symptoms.some((s) => s.canonicalTerm === 'Headache')).toBe(
        false,
      );
      expect(res.symptoms.length).toBe(0);

      // Must be preserved in unmapped or relatedClinicalExpressions
      expect(res.unmappedExpressions).toContain('migraine');
      expect(
        res.relatedClinicalExpressions?.some(
          (r) =>
            r.expression === 'migraine' &&
            r.category === 'DIAGNOSIS_OR_CONDITION',
        ),
      ).toBe(true);
    });

    it('pharyngitis must NOT automatically map to Throat pain symptom', () => {
      const input = 'Suspected acute pharyngitis.';
      const res = service.normalize(input);

      expect(res.symptoms.some((s) => s.canonicalTerm === 'Throat pain')).toBe(
        false,
      );
      expect(res.symptoms.length).toBe(0);

      expect(res.unmappedExpressions).toContain('pharyngitis');
      expect(
        res.relatedClinicalExpressions?.some(
          (r) =>
            r.expression === 'pharyngitis' &&
            r.category === 'DIAGNOSIS_OR_CONDITION',
        ),
      ).toBe(true);
    });

    it('wheezing must NOT automatically map to Breathlessness symptom', () => {
      const input = 'Bilateral wheezing heard on auscultation.';
      const res = service.normalize(input);

      // Wheezing is an objective sign, not subjective breathlessness
      expect(
        res.symptoms.some((s) => s.canonicalTerm === 'Breathlessness'),
      ).toBe(false);
      expect(res.symptoms.length).toBe(0);

      expect(res.unmappedExpressions).toContain('wheezing');
      expect(
        res.relatedClinicalExpressions?.some(
          (r) => r.expression === 'wheezing' && r.category === 'CLINICAL_SIGN',
        ),
      ).toBe(true);
    });

    it('chills must NOT automatically map to Fever symptom', () => {
      const input = 'Patient complains of severe chills without fever.';
      const res = service.normalize(input);

      // Chills is a distinct neurovascular sensation; Fever is explicitly negative here
      const fever = res.symptoms.find((s) => s.canonicalTerm === 'Fever');
      expect(fever).toBeDefined();
      expect(fever!.polarity).toBe(SymptomPolarity.NEGATIVE);

      // Must not create an extra positive Fever for "chills"
      const positiveFever = res.symptoms.filter(
        (s) =>
          s.canonicalTerm === 'Fever' &&
          s.polarity === SymptomPolarity.POSITIVE,
      );
      expect(positiveFever.length).toBe(0);

      expect(
        res.relatedClinicalExpressions?.some(
          (r) => r.expression === 'chills' && r.category === 'CLINICAL_SIGN',
        ),
      ).toBe(true);
    });

    it('angina must NOT automatically map to generic Chest pain', () => {
      const input = 'History of stable angina.';
      const res = service.normalize(input);

      expect(res.symptoms.some((s) => s.canonicalTerm === 'Chest pain')).toBe(
        false,
      );
      expect(res.symptoms.length).toBe(0);

      expect(res.unmappedExpressions).toContain('angina');
      expect(
        res.relatedClinicalExpressions?.some(
          (r) =>
            r.expression === 'angina' &&
            r.category === 'DIAGNOSIS_OR_CONDITION',
        ),
      ).toBe(true);
    });

    it('acid reflux must NOT automatically map to generic Burning sensation', () => {
      const input = 'Suffering from acid reflux.';
      const res = service.normalize(input);

      expect(
        res.symptoms.some((s) => s.canonicalTerm === 'Burning sensation'),
      ).toBe(false);
      expect(res.symptoms.length).toBe(0);

      expect(res.unmappedExpressions).toContain('acid reflux');
      expect(
        res.relatedClinicalExpressions?.some(
          (r) =>
            r.expression === 'acid reflux' &&
            r.category === 'DIAGNOSIS_OR_CONDITION',
        ),
      ).toBe(true);
    });

    it('"acute" must NOT map to SEVERE rating (temporal descriptor vs severity)', () => {
      const input = 'Acute bukhar hai do din se.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(1);
      const fever = res.symptoms[0];
      expect(fever.canonicalTerm).toBe('Fever');
      // Acute is an onset descriptor, NOT severe!
      expect(fever.severity).toBeNull();

      expect(
        res.relatedClinicalExpressions?.some(
          (r) =>
            r.expression === 'acute' && r.category === 'TEMPORAL_DESCRIPTOR',
        ),
      ).toBe(true);
    });

    it('"cold" must NOT automatically map to Runny nose', () => {
      const input = 'Patient caught a cold.';
      const res = service.normalize(input);

      expect(res.symptoms.some((s) => s.canonicalTerm === 'Runny nose')).toBe(
        false,
      );
      expect(res.symptoms.length).toBe(0);

      expect(res.unmappedExpressions).toContain('cold');
      expect(
        res.relatedClinicalExpressions?.some(
          (r) =>
            r.expression === 'cold' && r.category === 'DIAGNOSIS_OR_CONDITION',
        ),
      ).toBe(true);
    });
  });

  describe('2. Exact Supported Aliases Still Normalize Correctly', () => {
    it('should correctly normalize exact supported symptom expressions', () => {
      const testCases = [
        { text: 'bukhar hai', term: 'Fever' },
        { text: 'khansi hai', term: 'Cough' },
        { text: 'sir dard hai', term: 'Headache' },
        { text: 'throat pain hai', term: 'Throat pain' },
        { text: 'pet dard hai', term: 'Abdominal pain' },
        { text: 'ulti ho rahi hai', term: 'Vomiting' },
        { text: 'ji michlana', term: 'Nausea' },
        { text: 'saans lene mein dikkat', term: 'Breathlessness' },
        { text: 'chakkar aa rahe hain', term: 'Dizziness' },
        { text: 'kamzori lagti hai', term: 'Weakness' },
        { text: 'loose motion hai', term: 'Diarrhea' },
        { text: 'seene mein jalan', term: 'Burning sensation' },
        { text: 'chest pain hai', term: 'Chest pain' },
        { text: 'naak behna', term: 'Runny nose' },
      ];

      for (const tc of testCases) {
        const res = service.normalize(tc.text);
        expect(res.symptoms.length).toBeGreaterThanOrEqual(1);
        expect(res.symptoms[0].canonicalTerm).toBe(tc.term);
        expect(res.symptoms[0].polarity).toBe(SymptomPolarity.POSITIVE);
      }
    });
  });

  describe('3. Unknown or Unsupported Expressions Remain Preserved', () => {
    it('preserves non-medical and unsupported terms in unmappedExpressions without dropping them', () => {
      const input = 'Mareez ko palpitations aur tingling sensations hai.';
      const res = service.normalize(input);

      expect(res.originalText).toBe(input);
      expect(res.symptoms.length).toBe(0);
      expect(res.unmappedExpressions.length).toBeGreaterThan(0);
      expect(res.requiresDoctorReview).toBe(true);
    });
  });

  describe('4. Negation and Uncertainty Safety', () => {
    it('preserves negation accurately for supported symptoms alongside excluded terms', () => {
      const input = 'No fever, but patient reports wheezing.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(1);
      const fever = res.symptoms[0];
      expect(fever.canonicalTerm).toBe('Fever');
      expect(fever.polarity).toBe(SymptomPolarity.NEGATIVE);

      // Wheezing preserved as clinical sign
      expect(
        res.relatedClinicalExpressions?.some(
          (r) => r.expression === 'wheezing',
        ),
      ).toBe(true);
    });

    it('preserves uncertainty without converting to confirmed positive finding', () => {
      const input = 'Shayad sir dard hai.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(1);
      expect(res.symptoms[0].canonicalTerm).toBe('Headache');
      expect(res.symptoms[0].certainty).toBe(SymptomCertainty.UNCERTAIN);
    });
  });

  describe('5. Data Integrity & Determinism', () => {
    it('preserves exact original text and evidence spans', () => {
      const input = 'Patient ko do din se bukhar hai aur halka headache hai.';
      const res = service.normalize(input);

      expect(res.originalText).toBe(input);
      for (const s of res.symptoms) {
        expect(s.evidence).toBeDefined();
        expect(input).toContain(s.evidence);
      }
    });

    it('never fabricates diagnoses or symptoms', () => {
      const input = 'Followup after routine checkup.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(0);
      expect(res.requiresDoctorReview).toBe(true);
    });

    it('produces identical deterministic output across repeated calls', () => {
      const input =
        'Patient reports mild throat pain and headache. Denies fever. Mentions migraine history.';
      const res1 = service.normalize(input);
      const res2 = service.normalize(input);

      expect(JSON.stringify(res1)).toBe(JSON.stringify(res2));
    });
  });
});
