import { Test, TestingModule } from '@nestjs/testing';
import { ClinicalNormalizationRegistry } from '../normalization/clinical-normalization.registry';
import { ClinicalNormalizationService } from '../normalization/clinical-normalization.service';
import { ClinicalExtractionService } from './clinical-extraction.service';
import {
  ClinicalFindingStatus,
  SeverityAssessmentState,
} from './clinical-extraction.types';

describe('ClinicalExtractionService Orchestration & Regression Tests', () => {
  let service: ClinicalExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalExtractionService,
        ClinicalNormalizationService,
        ClinicalNormalizationRegistry,
      ],
    }).compile();

    service = module.get<ClinicalExtractionService>(ClinicalExtractionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Canonical Example 1: Multi-Symptom with Positive & Negated Clauses', () => {
    const text = 'Mareez ko 3 din se bukhar hai, khansi nahi hai.';

    it('should extract Fever (PRESENT, 3 DAYS) and Cough (ABSENT), omitting unmentioned symptoms', () => {
      const res = service.extract({ text });

      expect(res.source.originalDoctorConfirmedText).toBe(text);
      expect(res.source.characterCount).toBe(47);
      expect(res.findings).toHaveLength(2);

      const fever = res.findings.find((f) => f.canonicalTermId === 'SYM-FEVER');
      expect(fever).toBeDefined();
      expect(fever!.status).toBe(ClinicalFindingStatus.PRESENT);
      expect(fever!.temporalStatements[0].duration).toEqual(
        expect.objectContaining({
          value: 3,
          unit: 'DAYS',
        }),
      );
      expect(fever!.provenance[0].evidence.text).toBe(
        'Mareez ko 3 din se bukhar hai',
      );
      expect(
        text.slice(
          fever!.provenance[0].evidence.startIndex!,
          fever!.provenance[0].evidence.endIndex!,
        ),
      ).toBe('Mareez ko 3 din se bukhar hai');

      const cough = res.findings.find((f) => f.canonicalTermId === 'SYM-COUGH');
      expect(cough).toBeDefined();
      expect(cough!.status).toBe(ClinicalFindingStatus.ABSENT);
      expect(cough!.provenance[0].evidence.text).toBe('khansi nahi hai');
      expect(
        text.slice(
          cough!.provenance[0].evidence.startIndex!,
          cough!.provenance[0].evidence.endIndex!,
        ),
      ).toBe('khansi nahi hai');

      // Verify unmentioned symptoms like Headache are omitted
      const headache = res.findings.find(
        (f) => f.canonicalTermId === 'SYM-HEADACHE',
      );
      expect(headache).toBeUndefined();

      expect(res.summaryCounts.totalFindings).toBe(2);
      expect(res.summaryCounts.presentCount).toBe(1);
      expect(res.summaryCounts.absentCount).toBe(1);
      expect(res.review.reviewStatus).toBe('PENDING_REVIEW');
      expect(res.review.requiresDoctorReview).toBe(true);
    });
  });

  describe('Canonical Example 2: Explicit Linguistic Uncertainty', () => {
    const text = 'Shayad headache hai.';

    it('should extract Headache as UNCERTAIN without converting to PRESENT', () => {
      const res = service.extract({ text });

      expect(res.findings).toHaveLength(1);
      const headache = res.findings[0];
      expect(headache.canonicalTermId === 'SYM-HEADACHE').toBe(true);
      expect(headache.status).toBe(ClinicalFindingStatus.UNCERTAIN);
      expect(headache.certainty).toBe('UNCERTAIN');
      expect(res.summaryCounts.uncertainCount).toBe(1);
      expect(res.summaryCounts.presentCount).toBe(0);
    });
  });

  describe('Canonical Example 3: Concept Category Isolation (Chills Reassessed)', () => {
    const text = 'Patient has no fever but reports chills.';

    it('should extract Fever as ABSENT and preserve Chills as SUBJECTIVE_SENSATION in unmappedExpressions', () => {
      const res = service.extract({ text });

      expect(res.findings).toHaveLength(1);
      const fever = res.findings[0];
      expect(fever.canonicalTermId).toBe('SYM-FEVER');
      expect(fever.status).toBe(ClinicalFindingStatus.ABSENT);

      // Chills must NOT be converted to Fever symptom
      expect(
        res.findings.some((f) => f.originalExpression.includes('chills')),
      ).toBe(false);

      expect(res.unmappedExpressions).toHaveLength(1);
      const chillsExpr = res.unmappedExpressions[0];
      expect(chillsExpr.expression).toBe('chills');
      expect(chillsExpr.category).toBe('SUBJECTIVE_SENSATION');
      expect(
        text.slice(
          chillsExpr.evidence.startIndex!,
          chillsExpr.evidence.endIndex!,
        ),
      ).toBe('chills');
    });
  });

  describe('Canonical Example 4: Temporal Resolution of Historical vs Current', () => {
    const text = 'Fever tha, ab nahi hai.';

    it('should preserve past episode and current absence, resolving transition to RESOLVED', () => {
      const res = service.extract({ text });

      expect(res.findings).toHaveLength(1);
      const fever = res.findings[0];
      expect(fever.canonicalTermId).toBe('SYM-FEVER');
      expect(fever.status).toBe(ClinicalFindingStatus.ABSENT); // Current status

      expect(fever.temporalStatements).toHaveLength(2);
      expect(fever.temporalStatements[0].temporalAnchor).toBe('HISTORICAL');
      expect(fever.temporalStatements[0].status).toBe(
        ClinicalFindingStatus.PRESENT,
      );
      expect(fever.temporalStatements[1].temporalAnchor).toBe('CURRENT');
      expect(fever.temporalStatements[1].status).toBe(
        ClinicalFindingStatus.ABSENT,
      );

      expect(fever.chronologicalRelationships).toHaveLength(1);
      expect(fever.chronologicalRelationships[0].transitionType).toBe(
        'RESOLVED',
      );
    });
  });

  describe('Canonical Example 5: Duration with Explicitly Unclear Severity', () => {
    const text = 'Patient ko 2 din se pet dard hai, severity unclear.';

    it('should extract Abdominal pain as PRESENT, 2 days duration, with severity EXPLICITLY_UNCLEAR', () => {
      const res = service.extract({ text });

      expect(res.findings).toHaveLength(1);
      const abd = res.findings[0];
      expect(abd.canonicalTermId).toBe('SYM-ABDOMINAL-PAIN');
      expect(abd.status).toBe(ClinicalFindingStatus.PRESENT);
      expect(abd.temporalStatements[0].duration).toEqual(
        expect.objectContaining({
          value: 2,
          unit: 'DAYS',
        }),
      );

      expect(abd.severityAssessment.state).toBe(
        SeverityAssessmentState.EXPLICITLY_UNCLEAR,
      );
      expect(abd.severityAssessment.level).toBeNull();
      expect(abd.severityAssessment.evidence).not.toBeNull();
      expect(
        text.slice(
          abd.severityAssessment.evidence!.startIndex!,
          abd.severityAssessment.evidence!.endIndex!,
        ),
      ).toBe('severity unclear');
    });
  });

  describe('Canonical Example 6: Clinical Examination Assessment Isolation', () => {
    const text = 'Chest examination not performed.';

    it('should create ClinicalAssessmentRecord with status NOT_ASSESSED and ZERO symptom findings', () => {
      const res = service.extract({ text });

      // No fabricated chest pain or respiratory symptoms
      expect(res.findings).toHaveLength(0);

      // Clinical assessment record created
      expect(res.clinicalAssessments).toHaveLength(1);
      const assess = res.clinicalAssessments[0];
      expect(assess.assessmentScope).toBe('SYSTEM_EXAMINATION');
      expect(assess.targetSystemOrExam).toBe('Respiratory / Chest Examination');
      expect(assess.status).toBe('NOT_ASSESSED');
      expect(
        text.slice(assess.evidence.startIndex!, assess.evidence.endIndex!),
      ).toBe('Chest examination not performed');
      expect(res.summaryCounts.clinicalAssessmentsCount).toBe(1);
      expect(res.summaryCounts.totalFindings).toBe(0);
    });
  });

  describe('Canonical Example 7: Devanagari Baseline & Precise Code Units', () => {
    const text = 'मरीज़ को ३ दिन से तेज़ बुखार है';

    it('should extract Devanagari finding with exact 31 UTF-16 code units and slice invariants', () => {
      const res = service.extract({ text });

      expect(res.source.characterCount).toBe(31);
      expect(res.findings).toHaveLength(1);

      const fever = res.findings[0];
      expect(fever.canonicalTermId).toBe('SYM-FEVER');
      expect(fever.status).toBe(ClinicalFindingStatus.PRESENT);
      expect(fever.temporalStatements[0].duration?.value).toBe(3);

      expect(fever.severityAssessment.state).toBe(
        SeverityAssessmentState.ASSESSED,
      );
      expect(fever.severityAssessment.level).toBe('SEVERE');
      expect(fever.severityAssessment.evidence).not.toBeNull();

      const sevSpan = fever.severityAssessment.evidence!;
      expect(sevSpan.startIndex).toBe(18);
      expect(sevSpan.endIndex).toBe(22);
      expect(text.slice(sevSpan.startIndex!, sevSpan.endIndex!)).toBe('तेज़');

      // Verify full span
      const fullSpan = fever.temporalStatements[0].evidence;
      expect(fullSpan.startIndex).toBe(0);
      expect(fullSpan.endIndex).toBe(31);
      expect(text.slice(fullSpan.startIndex!, fullSpan.endIndex!)).toBe(text);
    });
  });

  describe('Canonical Example 8: Multi-Phase Fluctuation', () => {
    const text = 'Fever tha kal, subah kam ho gaya, shaam ko phir aa gaya.';

    it('should preserve 3 statements, IMPROVED transition, and AMBIGUOUS evening resurgence', () => {
      const res = service.extract({ text });

      expect(res.findings).toHaveLength(1);
      const fever = res.findings[0];
      expect(fever.temporalStatements).toHaveLength(3);
      expect(fever.chronologicalRelationships).toHaveLength(2);

      expect(fever.chronologicalRelationships[0].transitionType).toBe(
        'IMPROVED',
      );
      expect(fever.chronologicalRelationships[1].transitionType).toBe(
        'AMBIGUOUS',
      );
      expect(fever.chronologicalRelationships[1].confidence).toBe('AMBIGUOUS');
    });
  });

  describe('Unicode Surrogate Pairs & Emoji Slicing', () => {
    it('should handle surrogate pairs and emoji without index corruption or offset distortion', () => {
      const text = '👨‍⚕️ Patient reports fever 🔥 with cough 😷';
      const res = service.extract({ text });

      expect(res.findings.length).toBeGreaterThan(0);
      for (const finding of res.findings) {
        for (const prov of finding.provenance) {
          if (
            prov.evidence.startIndex !== null &&
            prov.evidence.endIndex !== null
          ) {
            expect(
              text.slice(prov.evidence.startIndex, prov.evidence.endIndex),
            ).toBe(prov.evidence.text);
          }
        }
      }
    });
  });

  describe('Idempotency & Determinism', () => {
    it('should produce 100% identical JSON results over repeated runs', () => {
      const text = 'Mareez ko 3 din se tez bukhar hai, khansi nahi hai.';
      const run1 = JSON.stringify(service.extract({ text }));
      const run2 = JSON.stringify(service.extract({ text }));
      const run3 = JSON.stringify(service.extract({ text }));

      expect(run1).toBe(run2);
      expect(run2).toBe(run3);
    });
  });
});
