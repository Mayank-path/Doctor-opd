import { BadRequestException } from '@nestjs/common';
import { ClinicalNormalizationRegistry } from './clinical-normalization.registry';
import { ClinicalNormalizationService } from './clinical-normalization.service';
import {
  DetectedClinicalLanguage,
  DurationUnit,
  SymptomCertainty,
  SymptomFrequency,
  SymptomPolarity,
  SymptomSeverity,
} from './clinical-normalization.types';

describe('ClinicalNormalizationService', () => {
  let service: ClinicalNormalizationService;
  let registry: ClinicalNormalizationRegistry;

  beforeEach(() => {
    registry = new ClinicalNormalizationRegistry();
    service = new ClinicalNormalizationService(registry);
  });

  describe('Prompt Target Examples', () => {
    it('Example 1: "Mareez ko teen din se bukhar hai."', () => {
      const input = 'Mareez ko teen din se bukhar hai.';
      const res = service.normalize(input);

      expect(res.originalText).toBe(input);
      expect(res.language).toBe(DetectedClinicalLanguage.HINGLISH);
      expect(res.requiresDoctorReview).toBe(true);
      expect(res.symptoms.length).toBe(1);

      const s = res.symptoms[0];
      expect(s.canonicalTerm).toBe('Fever');
      expect(s.originalExpression.toLowerCase()).toBe('bukhar');
      expect(s.polarity).toBe(SymptomPolarity.POSITIVE);
      expect(s.certainty).toBe(SymptomCertainty.CONFIRMED);
      expect(s.duration).toEqual({
        raw: 'teen din se',
        value: 3,
        unit: DurationUnit.DAYS,
      });
      expect(s.severity).toBeNull();
      expect(s.frequency).toBeNull();
      expect(s.evidence).toContain('bukhar');
    });

    it('Example 2: "Patient ko kal se khansi aur halka headache hai."', () => {
      const input = 'Patient ko kal se khansi aur halka headache hai.';
      const res = service.normalize(input);

      expect(res.originalText).toBe(input);
      expect(res.symptoms.length).toBe(2);

      const cough = res.symptoms.find((s) => s.canonicalTerm === 'Cough');
      const headache = res.symptoms.find((s) => s.canonicalTerm === 'Headache');

      expect(cough).toBeDefined();
      expect(cough!.polarity).toBe(SymptomPolarity.POSITIVE);
      expect(cough!.duration).toEqual({
        raw: 'kal se',
        value: 1,
        unit: DurationUnit.DAYS,
        onset: 'since yesterday',
      });

      expect(headache).toBeDefined();
      expect(headache!.polarity).toBe(SymptomPolarity.POSITIVE);
      expect(headache!.severity).toBe(SymptomSeverity.MILD);
    });

    it('Example 3: "Bukhar nahi hai, lekin throat pain hai."', () => {
      const input = 'Bukhar nahi hai, lekin throat pain hai.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(2);

      const fever = res.symptoms.find((s) => s.canonicalTerm === 'Fever');
      const throat = res.symptoms.find(
        (s) => s.canonicalTerm === 'Throat pain',
      );

      expect(fever).toBeDefined();
      expect(fever!.polarity).toBe(SymptomPolarity.NEGATIVE);
      expect(fever!.evidence).toBe('Bukhar nahi hai');

      expect(throat).toBeDefined();
      expect(throat!.polarity).toBe(SymptomPolarity.POSITIVE);
      expect(throat!.evidence).toBe('throat pain hai');
    });

    it('Example 4: "Patient says saans lene mein dikkat hoti hai."', () => {
      const input = 'Patient says saans lene mein dikkat hoti hai.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(1);
      const dyspnea = res.symptoms[0];
      expect(dyspnea.canonicalTerm).toBe('Breathlessness');
      expect(dyspnea.originalExpression.toLowerCase()).toBe(
        'saans lene mein dikkat',
      );
      expect(dyspnea.polarity).toBe(SymptomPolarity.POSITIVE);
    });

    it('Example 5: "No vomiting, but nausea hai."', () => {
      const input = 'No vomiting, but nausea hai.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(2);

      const vomit = res.symptoms.find((s) => s.canonicalTerm === 'Vomiting');
      const nausea = res.symptoms.find((s) => s.canonicalTerm === 'Nausea');

      expect(vomit).toBeDefined();
      expect(vomit!.polarity).toBe(SymptomPolarity.NEGATIVE);
      expect(vomit!.evidence).toBe('No vomiting');

      expect(nausea).toBeDefined();
      expect(nausea!.polarity).toBe(SymptomPolarity.POSITIVE);
      expect(nausea!.evidence).toBe('nausea hai');
    });

    it('Example 6: "Kabhi kabhi chest mein pain hota hai."', () => {
      const input = 'Kabhi kabhi chest mein pain hota hai.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(1);
      const chestPain = res.symptoms[0];
      expect(chestPain.canonicalTerm).toBe('Chest pain');
      expect(chestPain.frequency).toBe(SymptomFrequency.OCCASIONAL);
      expect(chestPain.bodyLocation).toBe('Chest');
      expect(chestPain.polarity).toBe(SymptomPolarity.POSITIVE);
    });

    it('Example 7: "Patient ko do hafte se pet mein jalan ho rahi hai."', () => {
      const input = 'Patient ko do hafte se pet mein jalan ho rahi hai.';
      const res = service.normalize(input);

      expect(res.symptoms.length).toBe(1);
      const burning = res.symptoms[0];
      expect(burning.canonicalTerm).toBe('Burning sensation');
      expect(burning.duration).toEqual({
        raw: 'do hafte se',
        value: 2,
        unit: DurationUnit.WEEKS,
      });
      expect(burning.bodyLocation).toBe('Abdomen');
      expect(burning.polarity).toBe(SymptomPolarity.POSITIVE);
    });
  });

  describe('Clinical Safety and Data Integrity', () => {
    it('should always require doctor review', () => {
      const res = service.normalize('Cough for 3 days');
      expect(res.requiresDoctorReview).toBe(true);
    });

    it('should preserve original text exactly without alteration', () => {
      const input = 'Mareez ko kal se tez bukhar hai.';
      const res = service.normalize(input);
      expect(res.originalText).toBe(input);
    });

    it('should produce identical deterministic output upon repeated calls', () => {
      const input =
        'Patient reports mild headache and nausea since yesterday. No fever.';
      const res1 = service.normalize(input);
      const res2 = service.normalize(input);
      expect(JSON.stringify(res1)).toBe(JSON.stringify(res2));
    });

    it('should never invent unmentioned symptoms', () => {
      const input = 'Patient has throat pain.';
      const res = service.normalize(input);
      expect(res.symptoms.length).toBe(1);
      expect(res.symptoms[0].canonicalTerm).toBe('Throat pain');
      // Must not invent Fever, Cough, etc.
      expect(res.symptoms.some((s) => s.canonicalTerm === 'Fever')).toBe(false);
    });

    it('should never invent duration, severity, or frequency when not stated', () => {
      const input = 'Patient has cough.';
      const res = service.normalize(input);
      const cough = res.symptoms[0];
      expect(cough.duration).toBeNull();
      expect(cough.severity).toBeNull();
      expect(cough.frequency).toBeNull();
    });

    it('should handle uncertainty without converting it to confirmed positive finding', () => {
      const input = 'Shayad bukhar hai.';
      const res = service.normalize(input);
      expect(res.symptoms[0].certainty).toBe(SymptomCertainty.UNCERTAIN);
    });

    it('should reject empty or whitespace-only text with BadRequestException', () => {
      expect(() => service.normalize('')).toThrow(BadRequestException);
      expect(() => service.normalize('   ')).toThrow(BadRequestException);
    });

    it('should reject text exceeding 5000 characters with BadRequestException', () => {
      const longText = 'a'.repeat(5001);
      expect(() => service.normalize(longText)).toThrow(BadRequestException);
    });
  });
});
