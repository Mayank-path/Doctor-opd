import {
  AstEvaluatorEngine,
  ClinicalEvaluationInput,
  DifferentialMatchTier,
  EvaluationFindingStatus,
  InfectionSuspicionState,
  MAX_AST_DEPTH,
  MAX_AST_NODES,
  PredicateEvaluationResult,
  evaluateAst,
  validateAndBuildEvaluationContext,
} from './index';

describe('AstEvaluatorEngine — Deterministic Differential Diagnosis Engine', () => {
  let engine: AstEvaluatorEngine;

  beforeEach(() => {
    engine = new AstEvaluatorEngine();
  });

  // =========================================================================
  // 1. INPUT VALIDATION & BIOLOGICAL RANGES
  // =========================================================================
  describe('1. Input Validation, Biological Ranges & Physiological Coherence', () => {
    it('should reject non-object or null input', () => {
      expect(() => validateAndBuildEvaluationContext(null as any)).toThrow(
        /Evaluation input must be a non-null object/,
      );
    });

    it('should reject findings count exceeding MAX_INPUT_FINDINGS (50)', () => {
      const findings = Array.from({ length: 51 }, (_, i) => ({
        canonicalTerm: `Symptom ${i}`,
        status: EvaluationFindingStatus.PRESENT,
      }));

      expect(() => validateAndBuildEvaluationContext({ findings })).toThrow(
        /exceeds maximum limit of 50/,
      );
    });

    it('should reject invalid finding status', () => {
      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [{ canonicalTerm: 'Fever', status: 'MAYBE' as any }],
        }),
      ).toThrow(/invalid status "MAYBE"/);
    });

    it('should enforce biological vital-sign ranges (Temperature: 30.0 - 45.0 C)', () => {
      // Below biological floor
      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          vitals: { temperatureC: 28.5 },
        }),
      ).toThrow(RangeError);

      // Above biological ceiling
      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          vitals: { temperatureC: 46.2 },
        }),
      ).toThrow(RangeError);

      // Valid physiological value
      const ctx = validateAndBuildEvaluationContext({
        findings: [],
        vitals: { temperatureC: 38.5 },
      });
      expect(ctx.vitals['VITAL_TEMPERATURE_C']).toBe(38.5);
    });

    it('should enforce biological vital-sign ranges for SpO2 (50 - 100%)', () => {
      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          vitals: { spO2: 45 },
        }),
      ).toThrow(RangeError);

      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          vitals: { spO2: 105 },
        }),
      ).toThrow(RangeError);
    });

    it('should enforce physiological blood pressure coherence (Systolic >= Diastolic)', () => {
      // Incoherent: Systolic 90 < Diastolic 110
      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          vitals: { systolicBp: 90, diastolicBp: 110 },
        }),
      ).toThrow(/Physiological Incoherence Violation/);

      // Coherent: Systolic 120 >= Diastolic 80
      const ctx = validateAndBuildEvaluationContext({
        findings: [],
        vitals: { systolicBp: 120, diastolicBp: 80 },
      });
      expect(ctx.vitals['VITAL_BP_SYSTOLIC']).toBe(120);
      expect(ctx.vitals['VITAL_BP_DIASTOLIC']).toBe(80);
    });

    it('should enforce patient demographic age limits (0 to 130 years)', () => {
      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          demographics: { ageYears: -1 },
        }),
      ).toThrow(RangeError);

      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          demographics: { ageYears: 135 },
        }),
      ).toThrow(RangeError);
    });

    it('should reject invalid infectionSuspicion state', () => {
      expect(() =>
        validateAndBuildEvaluationContext({
          findings: [],
          infectionSuspicion: 'CONFIRMED' as any,
        }),
      ).toThrow(/Invalid infectionSuspicion "CONFIRMED"/);
    });

    it('should validate and extract infectionSuspicion state, defaulting to UNKNOWN when omitted', () => {
      const ctxDefault = validateAndBuildEvaluationContext({ findings: [] });
      expect(ctxDefault.infectionSuspicion).toBe(InfectionSuspicionState.UNKNOWN);

      const ctxSuspected = validateAndBuildEvaluationContext({
        findings: [],
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      });
      expect(ctxSuspected.infectionSuspicion).toBe(InfectionSuspicionState.SUSPECTED);

      const ctxNotSuspected = validateAndBuildEvaluationContext({
        findings: [],
        infectionSuspicion: InfectionSuspicionState.NOT_SUSPECTED,
      });
      expect(ctxNotSuspected.infectionSuspicion).toBe(InfectionSuspicionState.NOT_SUSPECTED);

      const ctxNotAssessed = validateAndBuildEvaluationContext({
        findings: [],
        infectionSuspicion: InfectionSuspicionState.NOT_ASSESSED,
      });
      expect(ctxNotAssessed.infectionSuspicion).toBe(InfectionSuspicionState.NOT_ASSESSED);
    });

    it('should ensure UNKNOWN and NOT_ASSESSED cannot silently become SUSPECTED even with fever present', () => {
      const ctxFeverUnknown = validateAndBuildEvaluationContext({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: { temperatureC: 39.2 },
        infectionSuspicion: InfectionSuspicionState.UNKNOWN,
      });
      expect(ctxFeverUnknown.infectionSuspicion).toBe(InfectionSuspicionState.UNKNOWN);
      expect(ctxFeverUnknown.supportingInfectionEvidence.length).toBeGreaterThan(0);

      const ctxFeverNotAssessed = validateAndBuildEvaluationContext({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: { temperatureC: 39.2 },
        infectionSuspicion: InfectionSuspicionState.NOT_ASSESSED,
      });
      expect(ctxFeverNotAssessed.infectionSuspicion).toBe(InfectionSuspicionState.NOT_ASSESSED);
    });
  });

  // =========================================================================
  // 2. BOUNDED AST TRAVERSAL & EXECUTION SAFETY
  // =========================================================================
  describe('2. Bounded AST Traversal & Execution Safety Limits', () => {
    it('should throw RangeError if AST depth exceeds MAX_AST_DEPTH (5)', () => {
      const context = validateAndBuildEvaluationContext({ findings: [] });

      // Construct deeply nested AST of depth 6
      const deepAst: any = {
        operator: 'ALL',
        predicates: [
          {
            operator: 'ALL',
            predicates: [
              {
                operator: 'ALL',
                predicates: [
                  {
                    operator: 'ALL',
                    predicates: [
                      {
                        operator: 'ALL',
                        predicates: [
                          {
                            type: 'CONCEPT_STATUS',
                            canonicalTerm: 'Fever',
                            expectedStatus: 'PRESENT',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => evaluateAst(deepAst, context)).toThrow(RangeError);
      expect(() => evaluateAst(deepAst, context)).toThrow(/Maximum AST depth of 5 exceeded/);
    });

    it('should throw RangeError if AST total node count exceeds MAX_AST_NODES (50)', () => {
      const context = validateAndBuildEvaluationContext({ findings: [] });

      // Create a flat logical node with 51 leaf predicates
      const manyNodesAst: any = {
        operator: 'ALL',
        predicates: Array.from({ length: 51 }, (_, i) => ({
          type: 'CONCEPT_STATUS',
          canonicalTerm: `Symptom_${i}`,
          expectedStatus: 'PRESENT',
        })),
      };

      expect(() => evaluateAst(manyNodesAst, context)).toThrow(RangeError);
      expect(() => evaluateAst(manyNodesAst, context)).toThrow(
        /Maximum AST node limit of 50 exceeded/,
      );
    });

    it('should correctly evaluate composite logical operators: ALL, ANY, NONE, AT_LEAST_N', () => {
      const context = validateAndBuildEvaluationContext({
        findings: [
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
        ],
      });

      // ALL: Fever and Cough present -> satisfied
      const allAst: any = {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
        ],
      };
      expect(evaluateAst(allAst, context).satisfied).toBe(true);

      // ANY: Fever present or Headache present -> satisfied
      const anyAst: any = {
        operator: 'ANY',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
        ],
      };
      expect(evaluateAst(anyAst, context).satisfied).toBe(true);

      // NONE: Neither Vomiting nor Diarrhea present -> satisfied
      const noneAst: any = {
        operator: 'NONE',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Diarrhea', expectedStatus: 'PRESENT' },
        ],
      };
      expect(evaluateAst(noneAst, context).satisfied).toBe(true);

      // AT_LEAST_N: threshold 2 with 3 predicates (Fever, Cough, Headache) -> 2 met -> satisfied
      const atLeastAst: any = {
        operator: 'AT_LEAST_N',
        threshold: 2,
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
        ],
      };
      expect(evaluateAst(atLeastAst, context).satisfied).toBe(true);
    });
  });

  // =========================================================================
  // 3. SIX FINDING STATUSES & ABSENCE OF EVIDENCE INVARIANT
  // =========================================================================
  describe('3. Six Clinical Finding Statuses & Absence of Evidence Invariant', () => {
    it('PRESENT matches expected PRESENT, fails expected ABSENT', () => {
      const ctx = validateAndBuildEvaluationContext({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
      });

      const predPresent: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Fever',
        expectedStatus: 'PRESENT',
      };
      const resPresent = evaluateAst(predPresent, ctx);
      expect(resPresent.result).toBe(PredicateEvaluationResult.TRUE);
      expect(resPresent.satisfied).toBe(true);

      const predAbsent: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Fever',
        expectedStatus: 'ABSENT',
      };
      const resAbsent = evaluateAst(predAbsent, ctx);
      expect(resAbsent.result).toBe(PredicateEvaluationResult.FALSE);
      expect(resAbsent.satisfied).toBe(false);
    });

    it('ABSENT matches expected ABSENT, explicitly negates expected PRESENT', () => {
      const ctx = validateAndBuildEvaluationContext({
        findings: [{ canonicalTerm: 'Cough', status: EvaluationFindingStatus.ABSENT }],
      });

      const predAbsent: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Cough',
        expectedStatus: 'ABSENT',
      };
      const resAbsent = evaluateAst(predAbsent, ctx);
      expect(resAbsent.result).toBe(PredicateEvaluationResult.TRUE);
      expect(resAbsent.satisfied).toBe(true);

      const predPresent: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Cough',
        expectedStatus: 'PRESENT',
      };
      const resPresent = evaluateAst(predPresent, ctx);
      expect(resPresent.result).toBe(PredicateEvaluationResult.FALSE);
      expect(resPresent.satisfied).toBe(false);
      expect(resPresent.actual).toBe('ABSENT');
    });

    it('UNCERTAIN fails mandatory criterion without triggering contradiction', () => {
      const ctx = validateAndBuildEvaluationContext({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.UNCERTAIN }],
      });

      const pred: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Fever',
        expectedStatus: 'PRESENT',
      };
      const res = evaluateAst(pred, ctx);
      expect(res.result).toBe(PredicateEvaluationResult.UNCERTAIN);
      expect(res.satisfied).toBe(false);
    });

    it('UNKNOWN fails mandatory criterion without triggering contradiction', () => {
      const ctx = validateAndBuildEvaluationContext({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.UNKNOWN }],
      });

      const pred: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Fever',
        expectedStatus: 'PRESENT',
      };
      const res = evaluateAst(pred, ctx);
      expect(res.result).toBe(PredicateEvaluationResult.UNKNOWN);
      expect(res.satisfied).toBe(false);
    });

    it('NOT_MENTIONED: concept omitted from findings never evaluates to PRESENT or ABSENT', () => {
      const ctx = validateAndBuildEvaluationContext({ findings: [] });

      const pred: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Chest pain',
        expectedStatus: 'PRESENT',
      };
      const res = evaluateAst(pred, ctx);
      expect(res.result).toBe(PredicateEvaluationResult.NOT_MENTIONED);
      expect(res.satisfied).toBe(false);
    });

    it('NOT_ASSESSED: unperformed assessment documented explicitly fails mandatory and emits alert', () => {
      const ctx = validateAndBuildEvaluationContext({
        findings: [],
        assessments: [{ examination: 'EXAM-CHEST-AUSCULTATION', status: 'NOT_ASSESSED' }],
      });

      const pred: any = {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'EXAM-CHEST-AUSCULTATION',
        expectedStatus: 'PRESENT',
      };
      const res = evaluateAst(pred, ctx);
      expect(res.result).toBe(PredicateEvaluationResult.NOT_ASSESSED);
      expect(res.satisfied).toBe(false);
    });
  });

  // =========================================================================
  // 4. HIGH-ACUITY EMERGENCY RED FLAGS
  // =========================================================================
  describe('4. High-Acuity Emergency Red Flags Evaluation', () => {
    it('should fire RF-QSOFA-SEPSIS when qSOFA criteria met (RR >= 22 and SBP <= 100 in adult with suspected infection)', () => {
      const input: ClinicalEvaluationInput = {
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          respiratoryRate: 24,
          systolicBp: 95,
          diastolicBp: 65,
        },
        demographics: { ageYears: 45 },
        infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      };

      const result = engine.evaluateDifferential(input);
      expect(result.hasUrgentRedFlags).toBe(true);

      const sepsisFlag = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
      expect(sepsisFlag).toBeDefined();
      expect(sepsisFlag?.triggered).toBe(true);
      expect(sepsisFlag?.urgencyLevel).toBe('IMMEDIATE');
      expect(sepsisFlag?.title).toContain('Provisional qSOFA Criteria in Suspected Infection');
    });

    it('should fire RF-ACS-ISCHEMIA when chest pain and breathlessness are present', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT },
        ],
      };

      const result = engine.evaluateDifferential(input);
      expect(result.hasUrgentRedFlags).toBe(true);

      const acsFlag = result.redFlags.find((rf) => rf.flagCode === 'RF-ACS-ISCHEMIA');
      expect(acsFlag?.triggered).toBe(true);
      expect(acsFlag?.clinicalAction).toContain('12-lead ECG');
    });

    it('should fire RF-RESP-FAILURE when breathlessness is present with SpO2 < 90%', () => {
      const input: ClinicalEvaluationInput = {
        findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT }],
        vitals: { spO2: 88 },
      };

      const result = engine.evaluateDifferential(input);
      expect(result.hasUrgentRedFlags).toBe(true);

      const respFlag = result.redFlags.find((rf) => rf.flagCode === 'RF-RESP-FAILURE');
      expect(respFlag?.triggered).toBe(true);
    });

    it('should fire RF-HYPERTENSIVE-CRISIS when SBP >= 180 or DBP >= 120', () => {
      const input: ClinicalEvaluationInput = {
        findings: [{ canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          systolicBp: 195,
          diastolicBp: 110,
        },
      };

      const result = engine.evaluateDifferential(input);
      expect(result.hasUrgentRedFlags).toBe(true);

      const bpFlag = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
      expect(bpFlag?.triggered).toBe(true);
    });
  });

  // =========================================================================
  // 5. CLINICAL CASE SCENARIOS & CANDIDATE MATCH TIERS
  // =========================================================================
  describe('5. Real Knowledge Pack Clinical Cases & Tier Classification', () => {
    it('Case A: Classic Streptococcal Pharyngitis -> STRONG_MATCH', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.ABSENT },
        ],
        vitals: {
          temperatureC: 38.5,
        },
        demographics: {
          ageYears: 22,
          gender: 'FEMALE',
        },
      };

      const result = engine.evaluateDifferential(input);

      const strepMatch = result.strongMatches.find(
        (m) => m.conditionCode === 'COND-GM-STREP-002',
      );
      expect(strepMatch).toBeDefined();
      expect(strepMatch?.tier).toBe(DifferentialMatchTier.STRONG_MATCH);
      expect(strepMatch?.mandatoryResult.satisfied).toBe(true);
      expect(strepMatch?.majorSupportingMatchedCount).toBeGreaterThanOrEqual(1);
      expect(strepMatch?.contradictionTriggered).toBe(false);
    });

    it('Case B: Acute Viral URI (Common Cold) -> STRONG_MATCH', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Runny nose', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
        ],
        vitals: {
          spO2: 98,
        },
        demographics: {
          ageYears: 28,
        },
      };

      const result = engine.evaluateDifferential(input);

      const uriMatch = result.strongMatches.find((m) => m.conditionCode === 'COND-GM-URI-001');
      expect(uriMatch).toBeDefined();
      expect(uriMatch?.tier).toBe(DifferentialMatchTier.STRONG_MATCH);
      expect(uriMatch?.mandatoryResult.satisfied).toBe(true);
    });

    it('Case C: Explicit Negation of Mandatory Criterion triggers CONTRADICTED', () => {
      // Strep pharyngitis requires Throat pain PRESENT. Patient explicitly denies Throat pain.
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.ABSENT },
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
        ],
        demographics: {
          ageYears: 25,
        },
      };

      const result = engine.evaluateDifferential(input);

      const strepMatch = result.contradictedMatches.find(
        (m) => m.conditionCode === 'COND-GM-STREP-002',
      );
      expect(strepMatch).toBeDefined();
      expect(strepMatch?.tier).toBe(DifferentialMatchTier.CONTRADICTED);
      expect(strepMatch?.contradictionTriggered).toBe(true);
      expect(strepMatch?.rationale).toContain('Mandatory clinical criterion explicitly negated');
    });

    it('Case D: Contradiction Rule fires -> CONTRADICTED regardless of supporting evidence', () => {
      // Acute Viral URI is contradicted if patient has Breathlessness AND SpO2 < 92
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Runny nose', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT },
        ],
        vitals: {
          spO2: 89,
        },
        demographics: {
          ageYears: 30,
        },
      };

      const result = engine.evaluateDifferential(input);

      const uriMatch = result.contradictedMatches.find(
        (m) => m.conditionCode === 'COND-GM-URI-001',
      );
      expect(uriMatch).toBeDefined();
      expect(uriMatch?.tier).toBe(DifferentialMatchTier.CONTRADICTED);
      expect(uriMatch?.contradictionTriggered).toBe(true);
    });

    it('Case E: Incomplete Mandatory with Supporting Symptoms -> POSSIBLE', () => {
      // Patient has Fever and Headache, but no respiratory symptoms documented yet
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT },
        ],
        demographics: {
          ageYears: 32,
        },
      };

      const result = engine.evaluateDifferential(input);

      // Strep pharyngitis has Fever in majorSupporting, but Throat pain is not mentioned (mandatory incomplete)
      const strepMatch = result.possibleMatches.find(
        (m) => m.conditionCode === 'COND-GM-STREP-002',
      );
      expect(strepMatch).toBeDefined();
      expect(strepMatch?.tier).toBe(DifferentialMatchTier.POSSIBLE);
      expect(strepMatch?.mandatoryResult.satisfied).toBe(false);
      expect(strepMatch?.rationale).toContain('Possible match');
    });

    it('Case F: Essential Hypertension -> STRONG_MATCH when SBP >= 140 and Headache present', () => {
      const input: ClinicalEvaluationInput = {
        findings: [{ canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          systolicBp: 155,
          diastolicBp: 95,
        },
        demographics: {
          ageYears: 48,
          gender: 'MALE',
        },
      };

      const result = engine.evaluateDifferential(input);

      const htnMatch = result.strongMatches.find(
        (m) => m.conditionCode === 'COND-GM-HYPERTENSION-017',
      );
      expect(htnMatch).toBeDefined();
      expect(htnMatch?.tier).toBe(DifferentialMatchTier.STRONG_MATCH);
      expect(htnMatch?.mandatoryResult.satisfied).toBe(true);
      expect(htnMatch?.majorSupportingMatchedCount).toBe(1);
    });

    it('Case G: Essential Hypertension -> CONTRADICTED when SBP < 120 and DBP < 80', () => {
      const input: ClinicalEvaluationInput = {
        findings: [{ canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          systolicBp: 110,
          diastolicBp: 70,
        },
        demographics: {
          ageYears: 40,
        },
      };

      const result = engine.evaluateDifferential(input);

      const htnMatch = result.contradictedMatches.find(
        (m) => m.conditionCode === 'COND-GM-HYPERTENSION-017',
      );
      expect(htnMatch).toBeDefined();
      expect(htnMatch?.tier).toBe(DifferentialMatchTier.CONTRADICTED);
      expect(htnMatch?.contradictionTriggered).toBe(true);
    });

    it('Case H: Uncomplicated Malaria -> STRONG_MATCH when Fever PRESENT and Temp >= 38.5 C', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Body ache', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT },
        ],
        vitals: {
          temperatureC: 39.2,
        },
        demographics: {
          ageYears: 27,
        },
      };

      const result = engine.evaluateDifferential(input);

      const malariaMatch = result.strongMatches.find(
        (m) => m.conditionCode === 'COND-GM-MALARIA-UNCOMP-013',
      );
      expect(malariaMatch).toBeDefined();
      expect(malariaMatch?.tier).toBe(DifferentialMatchTier.STRONG_MATCH);
      expect(malariaMatch?.mandatoryResult.satisfied).toBe(true);
      expect(malariaMatch?.majorSupportingMatchedCount).toBeGreaterThanOrEqual(1);
      expect(malariaMatch?.suggestedInvestigations).toContain(
        'Rapid Diagnostic Test for Malaria (Pf/Pv RDT)',
      );
    });

    it('Case I: Acute Viral Gastroenteritis -> STRONG_MATCH when Diarrhea and Vomiting PRESENT', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Diarrhea', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Vomiting', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Abdominal pain', status: EvaluationFindingStatus.PRESENT },
        ],
        demographics: {
          ageYears: 19,
        },
      };

      const result = engine.evaluateDifferential(input);

      const gastroMatch = result.strongMatches.find(
        (m) => m.conditionCode === 'COND-GM-GASTRO-VIRAL-006',
      );
      expect(gastroMatch).toBeDefined();
      expect(gastroMatch?.tier).toBe(DifferentialMatchTier.STRONG_MATCH);
      expect(gastroMatch?.mandatoryResult.satisfied).toBe(true);
    });

    it('Case J: Pediatric patient filters out adult-only rule (Hypertension minAge 18)', () => {
      const input: ClinicalEvaluationInput = {
        findings: [{ canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT }],
        vitals: {
          systolicBp: 150,
          diastolicBp: 95,
        },
        demographics: {
          ageYears: 10, // Under 18
        },
      };

      const result = engine.evaluateDifferential(input);

      // Hypertension rule should be not applicable (tier is null / not in candidateMatches)
      const htnMatch = result.candidateMatches.find(
        (m) => m.conditionCode === 'COND-GM-HYPERTENSION-017',
      );
      expect(htnMatch).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. MISSING INFORMATION & UNPERFORMED ASSESSMENTS
  // =========================================================================
  describe('6. Missing Information & Unperformed Assessments Alerts', () => {
    it('should generate missing vital sign alert when required vital is omitted', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Runny nose', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
        ],
        // VITAL_TEMPERATURE_C is omitted
      };

      const result = engine.evaluateDifferential(input);
      const uriMatch = result.candidateMatches.find((m) => m.conditionCode === 'COND-GM-URI-001');

      expect(uriMatch).toBeDefined();
      const tempMissing = uriMatch?.missingInformation.find(
        (info) => info.parameter === 'VITAL_TEMPERATURE_C',
      );
      expect(tempMissing).toBeDefined();
      expect(tempMissing?.prompt).toContain('Body temperature not recorded');
    });

    it('should record unperformed assessment alert when exam is documented as NOT_ASSESSED', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Runny nose', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
        ],
        assessments: [{ examination: 'EXAM-CHEST-AUSCULTATION', status: 'NOT_ASSESSED' }],
      };

      const result = engine.evaluateDifferential(input);
      const uriMatch = result.candidateMatches.find((m) => m.conditionCode === 'COND-GM-URI-001');

      expect(uriMatch).toBeDefined();
      const examAlert = uriMatch?.unperformedAssessments.find(
        (a) => a.examination === 'EXAM-CHEST-AUSCULTATION',
      );
      expect(examAlert).toBeDefined();
      expect(examAlert?.status).toBe('NOT_ASSESSED');
    });
  });

  // =========================================================================
  // 7. DETERMINISM & INVARIANTS
  // =========================================================================
  describe('7. Determinism, Immutability & NMC Regulatory Compliance', () => {
    it('should be 100% deterministic across 50 consecutive runs', () => {
      const input: ClinicalEvaluationInput = {
        findings: [
          { canonicalTerm: 'Runny nose', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT },
          { canonicalTerm: 'Throat pain', status: EvaluationFindingStatus.PRESENT },
        ],
        vitals: {
          temperatureC: 37.8,
          spO2: 97,
        },
        demographics: {
          ageYears: 24,
          gender: 'MALE',
        },
      };

      const fixedTimestamp = '2026-10-30T16:00:00.000Z';
      const baselineJson = JSON.stringify(
        engine.evaluateDifferential(input, { evaluatedAt: fixedTimestamp }),
      );

      for (let i = 0; i < 50; i++) {
        const nextJson = JSON.stringify(
          engine.evaluateDifferential(input, { evaluatedAt: fixedTimestamp }),
        );
        expect(nextJson).toBe(baselineJson);
      }
    });

    it('should mandate doctor review and have engineVersion 1.0.0', () => {
      const result = engine.evaluateDifferential({
        findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
      });

      expect(result.requiresDoctorReview).toBe(true);
      expect(result.engineVersion).toBe('1.0.0');
    });
  });

  // =========================================================================
  // 8. DEDICATED TEST COVERAGE FOR ALL SIX PREDICATE TYPES
  // =========================================================================
  describe('8. Dedicated Comprehensive Test Coverage for All Six Predicate Types', () => {
    // 8.1 CONCEPT_STATUS
    describe('8.1 CONCEPT_STATUS Predicate', () => {
      it('evaluates PRESENT, ABSENT, UNCERTAIN, UNKNOWN, NOT_MENTIONED, NOT_ASSESSED', () => {
        const ctx = validateAndBuildEvaluationContext({
          findings: [
            { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Cough', status: EvaluationFindingStatus.ABSENT },
            { canonicalTerm: 'Headache', status: EvaluationFindingStatus.UNCERTAIN },
            { canonicalTerm: 'Nausea', status: EvaluationFindingStatus.UNKNOWN },
          ],
          assessments: [{ examination: 'EXAM-THROAT', status: 'NOT_ASSESSED' }],
        });

        // Valid PRESENT
        const predFever: any = { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' };
        expect(evaluateAst(predFever, ctx).result).toBe(PredicateEvaluationResult.TRUE);
        expect(evaluateAst(predFever, ctx).satisfied).toBe(true);

        // Valid ABSENT
        const predCoughAbsent: any = { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'ABSENT' };
        expect(evaluateAst(predCoughAbsent, ctx).result).toBe(PredicateEvaluationResult.TRUE);

        // Mismatch: expected PRESENT but actual ABSENT
        const predCoughPresent: any = { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' };
        expect(evaluateAst(predCoughPresent, ctx).result).toBe(PredicateEvaluationResult.FALSE);
        expect(evaluateAst(predCoughPresent, ctx).satisfied).toBe(false);

        // UNCERTAIN
        const predHeadache: any = { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' };
        const resHeadache = evaluateAst(predHeadache, ctx);
        expect(resHeadache.result).toBe(PredicateEvaluationResult.UNCERTAIN);
        expect(resHeadache.satisfied).toBe(false);

        // UNKNOWN: Verify explanation is accurate status undetermined
        const predNausea: any = { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' };
        const resNausea = evaluateAst(predNausea, ctx);
        expect(resNausea.result).toBe(PredicateEvaluationResult.UNKNOWN);
        expect(resNausea.satisfied).toBe(false);
        expect(resNausea.explanation).toContain('status cannot be determined');

        // NOT_MENTIONED
        const predWeakness: any = { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' };
        expect(evaluateAst(predWeakness, ctx).result).toBe(PredicateEvaluationResult.NOT_MENTIONED);

        // NOT_ASSESSED via examination
        const predThroat: any = { type: 'CONCEPT_STATUS', canonicalTerm: 'EXAM-THROAT', expectedStatus: 'PRESENT' };
        expect(evaluateAst(predThroat, ctx).result).toBe(PredicateEvaluationResult.NOT_ASSESSED);
      });
    });

    // 8.2 NUMERIC_PARAM
    describe('8.2 NUMERIC_PARAM Predicate', () => {
      const ctx = validateAndBuildEvaluationContext({
        findings: [],
        vitals: {
          temperatureC: 38.5,
          systolicBp: 140,
          spO2: 95,
        },
      });

      it('evaluates all numeric comparison operators and boundary conditions', () => {
        // GREATER_THAN
        const gtPass: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN', value: 38.0 };
        expect(evaluateAst(gtPass, ctx).satisfied).toBe(true);

        const gtFailBoundary: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN', value: 38.5 };
        expect(evaluateAst(gtFailBoundary, ctx).satisfied).toBe(false);

        // GREATER_THAN_OR_EQUAL
        const gteBoundary: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.5 };
        expect(evaluateAst(gteBoundary, ctx).satisfied).toBe(true);

        // LESS_THAN
        const ltPass: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_SPO2', operator: 'LESS_THAN', value: 98 };
        expect(evaluateAst(ltPass, ctx).satisfied).toBe(true);

        const ltFailBoundary: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_SPO2', operator: 'LESS_THAN', value: 95 };
        expect(evaluateAst(ltFailBoundary, ctx).satisfied).toBe(false);

        // LESS_THAN_OR_EQUAL
        const lteBoundary: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_BP_SYSTOLIC', operator: 'LESS_THAN_OR_EQUAL', value: 140 };
        expect(evaluateAst(lteBoundary, ctx).satisfied).toBe(true);

        // EQUAL
        const eqPass: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_BP_SYSTOLIC', operator: 'EQUAL', value: 140 };
        expect(evaluateAst(eqPass, ctx).satisfied).toBe(true);

        // BETWEEN
        const betweenPass: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'BETWEEN', value: 38.0, maxValue: 39.0 };
        expect(evaluateAst(betweenPass, ctx).satisfied).toBe(true);

        const betweenFail: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'BETWEEN', value: 39.0, maxValue: 40.0 };
        expect(evaluateAst(betweenFail, ctx).satisfied).toBe(false);

        // Missing / unrecorded parameter
        const missingParam: any = { type: 'NUMERIC_PARAM', parameter: 'VITAL_PULSE', operator: 'GREATER_THAN', value: 100 };
        const missingRes = evaluateAst(missingParam, ctx);
        expect(missingRes.satisfied).toBe(false);
        expect(missingRes.result).toBe(PredicateEvaluationResult.NOT_MENTIONED);
      });
    });

    // 8.3 TEMPORAL_DURATION
    describe('8.3 TEMPORAL_DURATION Predicate', () => {
      it('evaluates symptom duration in days with minDays, maxDays and boundaries', () => {
        const ctx = validateAndBuildEvaluationContext({
          findings: [
            { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT, durationDays: 5 },
            { canonicalTerm: 'Cough', status: EvaluationFindingStatus.PRESENT }, // durationDays undefined
          ],
        });

        // Valid: 5 days within [2, 7]
        const durPass: any = { type: 'TEMPORAL_DURATION', canonicalTerm: 'Fever', minDays: 2, maxDays: 7 };
        expect(evaluateAst(durPass, ctx).satisfied).toBe(true);

        // Boundary: exactly minDays (5)
        const durMinBoundary: any = { type: 'TEMPORAL_DURATION', canonicalTerm: 'Fever', minDays: 5, maxDays: 10 };
        expect(evaluateAst(durMinBoundary, ctx).satisfied).toBe(true);

        // Boundary: exactly maxDays (5)
        const durMaxBoundary: any = { type: 'TEMPORAL_DURATION', canonicalTerm: 'Fever', minDays: 1, maxDays: 5 };
        expect(evaluateAst(durMaxBoundary, ctx).satisfied).toBe(true);

        // Below minDays: requires min 7, actual 5
        const durBelow: any = { type: 'TEMPORAL_DURATION', canonicalTerm: 'Fever', minDays: 7 };
        expect(evaluateAst(durBelow, ctx).satisfied).toBe(false);

        // Above maxDays: requires max 3, actual 5
        const durAbove: any = { type: 'TEMPORAL_DURATION', canonicalTerm: 'Fever', maxDays: 3 };
        expect(evaluateAst(durAbove, ctx).satisfied).toBe(false);

        // Missing duration on finding
        const durMissing: any = { type: 'TEMPORAL_DURATION', canonicalTerm: 'Cough', minDays: 2 };
        const resMissing = evaluateAst(durMissing, ctx);
        expect(resMissing.satisfied).toBe(false);
        expect(resMissing.result).toBe(PredicateEvaluationResult.NOT_MENTIONED);

        // Missing concept altogether
        const durNoConcept: any = { type: 'TEMPORAL_DURATION', canonicalTerm: 'Headache', minDays: 1 };
        expect(evaluateAst(durNoConcept, ctx).result).toBe(PredicateEvaluationResult.NOT_MENTIONED);
      });
    });

    // 8.4 SEVERITY_LEVEL
    describe('8.4 SEVERITY_LEVEL Predicate', () => {
      it('evaluates symptom severity levels and handles missing severity', () => {
        const ctx = validateAndBuildEvaluationContext({
          findings: [
            { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT, severity: 'SEVERE' },
            { canonicalTerm: 'Headache', status: EvaluationFindingStatus.PRESENT }, // severity undefined
          ],
        });

        // Exact match
        const sevMatch: any = { type: 'SEVERITY_LEVEL', canonicalTerm: 'Chest pain', level: 'SEVERE' };
        expect(evaluateAst(sevMatch, ctx).satisfied).toBe(true);

        // Severity mismatch
        const sevMismatch: any = { type: 'SEVERITY_LEVEL', canonicalTerm: 'Chest pain', level: 'MILD' };
        expect(evaluateAst(sevMismatch, ctx).satisfied).toBe(false);

        // Missing severity on finding
        const sevMissing: any = { type: 'SEVERITY_LEVEL', canonicalTerm: 'Headache', level: 'MODERATE' };
        const resMissing = evaluateAst(sevMissing, ctx);
        expect(resMissing.satisfied).toBe(false);
        expect(resMissing.result).toBe(PredicateEvaluationResult.NOT_MENTIONED);

        // Omitted concept
        const sevNoConcept: any = { type: 'SEVERITY_LEVEL', canonicalTerm: 'Back pain', level: 'SEVERE' };
        expect(evaluateAst(sevNoConcept, ctx).result).toBe(PredicateEvaluationResult.NOT_MENTIONED);
      });
    });

    // 8.5 PATIENT_DEMOGRAPHIC
    describe('8.5 PATIENT_DEMOGRAPHIC Predicate', () => {
      it('evaluates age thresholds, gender filtering and handles missing demographics', () => {
        const ctxAdultFemale = validateAndBuildEvaluationContext({
          findings: [],
          demographics: { ageYears: 35, gender: 'FEMALE' },
        });

        // Valid age in [18, 65] and female
        const demoPass: any = { type: 'PATIENT_DEMOGRAPHIC', minAgeYears: 18, maxAgeYears: 65, gender: 'FEMALE' };
        expect(evaluateAst(demoPass, ctxAdultFemale).satisfied).toBe(true);

        // Gender ALL matches any gender
        const demoAllGender: any = { type: 'PATIENT_DEMOGRAPHIC', minAgeYears: 18, gender: 'ALL' };
        expect(evaluateAst(demoAllGender, ctxAdultFemale).satisfied).toBe(true);

        // Gender mismatch
        const demoGenderMismatch: any = { type: 'PATIENT_DEMOGRAPHIC', gender: 'MALE' };
        expect(evaluateAst(demoGenderMismatch, ctxAdultFemale).satisfied).toBe(false);

        // Age boundary: exactly minAge
        const demoMinBoundary: any = { type: 'PATIENT_DEMOGRAPHIC', minAgeYears: 35 };
        expect(evaluateAst(demoMinBoundary, ctxAdultFemale).satisfied).toBe(true);

        // Age boundary: exactly maxAge
        const demoMaxBoundary: any = { type: 'PATIENT_DEMOGRAPHIC', maxAgeYears: 35 };
        expect(evaluateAst(demoMaxBoundary, ctxAdultFemale).satisfied).toBe(true);

        // Age below minAge (requires 40, actual 35)
        const demoTooYoung: any = { type: 'PATIENT_DEMOGRAPHIC', minAgeYears: 40 };
        expect(evaluateAst(demoTooYoung, ctxAdultFemale).satisfied).toBe(false);

        // Age above maxAge (requires max 30, actual 35)
        const demoTooOld: any = { type: 'PATIENT_DEMOGRAPHIC', maxAgeYears: 30 };
        expect(evaluateAst(demoTooOld, ctxAdultFemale).satisfied).toBe(false);

        // Context with missing age
        const ctxNoAge = validateAndBuildEvaluationContext({ findings: [] });
        const demoRequiresAge: any = { type: 'PATIENT_DEMOGRAPHIC', minAgeYears: 18 };
        expect(evaluateAst(demoRequiresAge, ctxNoAge).satisfied).toBe(false);
      });
    });

    // 8.6 ASSESSMENT_STATE
    describe('8.6 ASSESSMENT_STATE Predicate', () => {
      it('evaluates objective clinical examination states (PERFORMED, NOT_ASSESSED, DEFERRED)', () => {
        const ctx = validateAndBuildEvaluationContext({
          findings: [],
          assessments: [
            { examination: 'EXAM-CHEST', status: 'PERFORMED' },
            { examination: 'EXAM-ABDOMEN', status: 'NOT_ASSESSED', reason: 'Patient refused' },
            { examination: 'EXAM-NEURO', status: 'DEFERRED' },
          ],
        });

        // Expected PERFORMED matches actual PERFORMED
        const examPerf: any = { type: 'ASSESSMENT_STATE', examination: 'EXAM-CHEST', expectedState: 'PERFORMED' };
        expect(evaluateAst(examPerf, ctx).satisfied).toBe(true);

        // Expected NOT_ASSESSED matches actual NOT_ASSESSED
        const examNotAssessed: any = { type: 'ASSESSMENT_STATE', examination: 'EXAM-ABDOMEN', expectedState: 'NOT_ASSESSED' };
        const resNotAssessed = evaluateAst(examNotAssessed, ctx);
        expect(resNotAssessed.satisfied).toBe(true);
        expect(resNotAssessed.result).toBe(PredicateEvaluationResult.NOT_ASSESSED);

        // Expected DEFERRED matches actual DEFERRED
        const examDeferred: any = { type: 'ASSESSMENT_STATE', examination: 'EXAM-NEURO', expectedState: 'DEFERRED' };
        expect(evaluateAst(examDeferred, ctx).satisfied).toBe(true);

        // Mismatch: expected PERFORMED, actual NOT_ASSESSED
        const examMismatch: any = { type: 'ASSESSMENT_STATE', examination: 'EXAM-ABDOMEN', expectedState: 'PERFORMED' };
        expect(evaluateAst(examMismatch, ctx).satisfied).toBe(false);

        // Examination omitted entirely from encounter
        const examOmitted: any = { type: 'ASSESSMENT_STATE', examination: 'EXAM-EYE', expectedState: 'PERFORMED' };
        const resOmitted = evaluateAst(examOmitted, ctx);
        expect(resOmitted.satisfied).toBe(false);
        expect(resOmitted.result).toBe(PredicateEvaluationResult.NOT_MENTIONED);
      });
    });
  });

  // =========================================================================
  // 9. INDEPENDENT EVALUATION & SAFETY COVERAGE FOR ALL FOUR RED FLAGS
  // =========================================================================
  describe('9. Independent Evaluation & Safety Coverage for All Four Red Flags', () => {
    // 9.1 RF-QSOFA-SEPSIS
    describe('9.1 RF-QSOFA-SEPSIS (Explicit Infection Suspicion, Age Gating & Safety Hardening)', () => {
      it('Fever alone does not enable qSOFA', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95, temperatureC: 39.0 },
          demographics: { ageYears: 45 },
          infectionSuspicion: InfectionSuspicionState.UNKNOWN,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(true);
        // Must NOT be a qSOFA sepsis screening alert
        expect(sepsis?.title).not.toContain('Potential Sepsis Screening Alert');
        // Must be the differentiated high-risk physiology advisory
        expect(sepsis?.title).toContain('High-Risk Hemodynamic / Respiratory Compromise Alert');
        expect(sepsis?.title).toContain('Non-Sepsis Physiology Advisory');
        expect(sepsis?.gatingExplanation).toContain('Supporting signs detected');
        expect(sepsis?.gatingExplanation).toContain('qSOFA sepsis screening strictly requires explicit clinician-documented SUSPECTED infection');
        expect(sepsis?.supportingInfectionEvidence).toBeDefined();
        expect(sepsis?.supportingInfectionEvidence?.length).toBeGreaterThan(0);
      });

      it('Chills alone do not enable qSOFA', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Chills', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95 },
          demographics: { ageYears: 45 },
          infectionSuspicion: InfectionSuspicionState.UNKNOWN,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(true);
        expect(sepsis?.title).toContain('High-Risk Hemodynamic / Respiratory Compromise Alert');
        expect(sepsis?.title).not.toContain('Potential Sepsis Screening Alert');
      });

      it('Infection-related concept alone does not enable qSOFA', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Pneumonia', conceptId: 'pneumonia', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95 },
          demographics: { ageYears: 55 },
          infectionSuspicion: InfectionSuspicionState.UNKNOWN,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(true);
        expect(sepsis?.title).toContain('High-Risk Hemodynamic / Respiratory Compromise Alert');
        expect(sepsis?.title).not.toContain('Potential Sepsis Screening Alert');
      });

      it('Explicit SUSPECTED enables adult qSOFA evaluation', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95 },
          demographics: { ageYears: 45 },
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(true);
        expect(sepsis?.title).toContain('Potential Sepsis Screening Alert (Provisional qSOFA Criteria in Suspected Infection)');
        expect(sepsis?.clinicalAction).toContain('satisfy provisional qSOFA criteria');
        expect(sepsis?.clinicalAction).toContain('does NOT constitute a definitive diagnosis of sepsis');
        expect(sepsis?.clinicalAction).toContain('attending clinician\'s assessment and decision');
        expect(sepsis?.isProvisional).toBe(true);
        expect(sepsis?.quarantinedPredicates).toContain('Dizziness');
        expect(sepsis?.disclaimer).toContain('Does not constitute a prescription');
        expect(sepsis?.clinicalContextNotice).toContain('Explicit clinician-documented infection suspicion state is SUSPECTED');
        expect(sepsis?.gatingExplanation).toContain('Adult patient (age >= 18) with explicitly documented SUSPECTED infection');
        expect(sepsis?.infectionSuspicionState).toBe(InfectionSuspicionState.SUSPECTED);
      });

      it('NOT_SUSPECTED, UNKNOWN, and NOT_ASSESSED do not enable it', () => {
        const baseVitals = { respiratoryRate: 24, systolicBp: 95 };
        const demographics = { ageYears: 45 };

        // 1. NOT_SUSPECTED
        const resNotSuspected = engine.evaluateDifferential({
          findings: [],
          vitals: baseVitals,
          demographics,
          infectionSuspicion: InfectionSuspicionState.NOT_SUSPECTED,
        });
        const flagNotSuspected = resNotSuspected.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(flagNotSuspected?.triggered).toBe(true);
        expect(flagNotSuspected?.title).toContain('Non-Sepsis Physiology Advisory');
        expect(flagNotSuspected?.title).not.toContain('Potential Sepsis Screening Alert');

        // 2. UNKNOWN
        const resUnknown = engine.evaluateDifferential({
          findings: [],
          vitals: baseVitals,
          demographics,
          infectionSuspicion: InfectionSuspicionState.UNKNOWN,
        });
        const flagUnknown = resUnknown.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(flagUnknown?.triggered).toBe(true);
        expect(flagUnknown?.title).toContain('Non-Sepsis Physiology Advisory');
        expect(flagUnknown?.title).not.toContain('Potential Sepsis Screening Alert');

        // 3. NOT_ASSESSED
        const resNotAssessed = engine.evaluateDifferential({
          findings: [],
          vitals: baseVitals,
          demographics,
          infectionSuspicion: InfectionSuspicionState.NOT_ASSESSED,
        });
        const flagNotAssessed = resNotAssessed.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(flagNotAssessed?.triggered).toBe(true);
        expect(flagNotAssessed?.title).toContain('Non-Sepsis Physiology Advisory');
        expect(flagNotAssessed?.title).not.toContain('Potential Sepsis Screening Alert');
      });

      it('Missing and invalid age do not enable adult qSOFA', () => {
        // Missing age in demographics object
        const resMissingAge = engine.evaluateDifferential({
          findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95 },
          demographics: {},
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        });
        const flagMissingAge = resMissingAge.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(flagMissingAge?.triggered).toBe(false);
        expect(flagMissingAge?.title).toContain('Adult qSOFA Inapplicable — Patient Age Unrecorded');
        expect(flagMissingAge?.gatingExplanation).toContain('Patient age is unrecorded or invalid');

        // Demographics omitted entirely
        const resNoDemographics = engine.evaluateDifferential({
          findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95 },
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        });
        const flagNoDemographics = resNoDemographics.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(flagNoDemographics?.triggered).toBe(false);
        expect(flagNoDemographics?.title).toContain('Adult qSOFA Inapplicable — Patient Age Unrecorded');
      });

      it('Pediatric patients never receive adult qSOFA', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 28, systolicBp: 85 },
          demographics: { ageYears: 8 }, // Pediatric patient
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(false);
        expect(sepsis?.title).toContain('qSOFA Inapplicable — Pediatric Context');
        expect(sepsis?.clinicalAction).toContain('Adult qSOFA criteria (RR >= 22, SBP <= 100) are clinically invalid in pediatric patients');
        expect(sepsis?.clinicalAction).toContain('Adult qSOFA screening logic was not applied');
        expect(sepsis?.clinicalContextNotice).toContain('Pediatric Context');
        expect(sepsis?.gatingExplanation).toContain('Adult qSOFA criteria are clinically invalid in pediatric patients (< 18 years)');
      });

      it('Non-sepsis physiology advisory remains functional', () => {
        const input: ClinicalEvaluationInput = {
          findings: [],
          vitals: { respiratoryRate: 26, systolicBp: 88 },
          demographics: { ageYears: 50 },
          infectionSuspicion: InfectionSuspicionState.NOT_SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(true);
        expect(sepsis?.title).toBe('High-Risk Hemodynamic / Respiratory Compromise Alert (Non-Sepsis Physiology Advisory)');
        expect(sepsis?.urgencyLevel).toBe('IMMEDIATE');
        expect(sepsis?.clinicalAction).toContain('indicate acute physiological compromise and hemodynamic instability');
        expect(sepsis?.clinicalAction).toContain('without clinician-documented suspected infection');
        expect(sepsis?.clinicalAction).toContain('rather than a qSOFA sepsis screen');
        expect(sepsis?.clinicalContextNotice).toContain('Infection Suspicion State: NOT_SUSPECTED');
      });

      it('Existing dizziness quarantine remains functional', () => {
        // RR 23 (1 criterion), SBP 120 (0 criterion), Dizziness PRESENT (0 criterion - quarantined)
        const input: ClinicalEvaluationInput = {
          findings: [
            { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Dizziness', status: EvaluationFindingStatus.PRESENT },
          ],
          vitals: { respiratoryRate: 23, systolicBp: 120 },
          demographics: { ageYears: 30 },
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(false);
        const dizzinessChild = sepsis?.evaluatedAstDetail.children?.find(
          (c) => c.canonicalTerm === 'Dizziness',
        );
        expect(dizzinessChild?.satisfied).toBe(false);
        expect(dizzinessChild?.explanation).toContain('QUARANTINED LEGACY PREDICATE');
        expect(sepsis?.quarantinedPredicates).toContain('Dizziness');
      });

      it('SBP + dizziness does not trigger (dizziness contributes 0 criteria, score = 1)', () => {
        const input: ClinicalEvaluationInput = {
          findings: [
            { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Dizziness', status: EvaluationFindingStatus.PRESENT },
          ],
          vitals: { respiratoryRate: 16, systolicBp: 95 },
          demographics: { ageYears: 40 },
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(false);
      });

      it('Dizziness alone does not trigger (score = 0)', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Dizziness', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 16, systolicBp: 120, diastolicBp: 80 },
          demographics: { ageYears: 25 },
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(false);
      });

      it('missing altered-mentation assessment is explicitly reported in machine-readable warnings', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95 },
          demographics: { ageYears: 42 },
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.missingAssessmentNotice).toBeDefined();
        expect(sepsis?.missingAssessmentNotice).toContain('Altered Mental Status');
        expect(sepsis?.missingAssessmentNotice).toContain('missing');
        expect(result.warnings.some((w) => w.includes('PROVISIONAL QSOFA WARNING'))).toBe(true);
      });

      it('API-facing serialization preserves the relevant context, gating explanation, and warnings', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT }],
          vitals: { respiratoryRate: 24, systolicBp: 95, temperatureC: 38.8 },
          demographics: { ageYears: 45 },
          infectionSuspicion: InfectionSuspicionState.SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const serialized = JSON.stringify(result);
        const parsed: DifferentialEvaluationResult = JSON.parse(serialized);

        expect(parsed.infectionSuspicion).toBe(InfectionSuspicionState.SUSPECTED);
        const qsofa = parsed.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(qsofa).toBeDefined();
        expect(qsofa?.triggered).toBe(true);
        expect(qsofa?.infectionSuspicionState).toBe(InfectionSuspicionState.SUSPECTED);
        expect(qsofa?.gatingExplanation).toBeDefined();
        expect(qsofa?.gatingExplanation).toContain('Adult patient (age >= 18) with explicitly documented SUSPECTED infection');
        expect(qsofa?.provisionalWarning).toBeDefined();
        expect(qsofa?.quarantinedPredicates).toEqual(['Dizziness']);
        expect(qsofa?.clinicalContextNotice).toBeDefined();
        expect(qsofa?.supportingInfectionEvidence).toBeDefined();
        expect(qsofa?.supportingInfectionEvidence?.length).toBeGreaterThan(0);
        expect(parsed.warnings.some((w) => w.includes('PROVISIONAL QSOFA WARNING'))).toBe(true);
      });

      it('negative case: normal vitals and no dizziness', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Dizziness', status: EvaluationFindingStatus.ABSENT }],
          vitals: { respiratoryRate: 16, systolicBp: 120, diastolicBp: 80 },
          demographics: { ageYears: 35 },
          infectionSuspicion: InfectionSuspicionState.NOT_SUSPECTED,
        };
        const result = engine.evaluateDifferential(input);
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(false);
      });

      it('missing-data case: vitals completely unrecorded and findings empty', () => {
        const result = engine.evaluateDifferential({ findings: [] });
        const sepsis = result.redFlags.find((rf) => rf.flagCode === 'RF-QSOFA-SEPSIS');
        expect(sepsis?.triggered).toBe(false);
      });
    });

    // 9.2 RF-ACS-ISCHEMIA
    describe('9.2 RF-ACS-ISCHEMIA (Acute Coronary Syndrome Alert)', () => {
      it('positive case with breathlessness: triggers with neutral escalation language', () => {
        const input: ClinicalEvaluationInput = {
          findings: [
            { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT },
          ],
        };
        const result = engine.evaluateDifferential(input);
        const acs = result.redFlags.find((rf) => rf.flagCode === 'RF-ACS-ISCHEMIA');
        expect(acs?.triggered).toBe(true);
        expect(acs?.clinicalAction).toContain('Clinical Escalation Advisory');
        expect(acs?.clinicalAction).toContain('attending physician assessment and decision');
        expect(acs?.clinicalAction).not.toMatch(/\badminister\b/i);
        expect(acs?.disclaimer).toContain('Does not constitute a prescription');
      });

      it('positive case with weakness: triggers when Chest pain AND Weakness PRESENT', () => {
        const input: ClinicalEvaluationInput = {
          findings: [
            { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Weakness', status: EvaluationFindingStatus.PRESENT },
          ],
        };
        const result = engine.evaluateDifferential(input);
        const acs = result.redFlags.find((rf) => rf.flagCode === 'RF-ACS-ISCHEMIA');
        expect(acs?.triggered).toBe(true);
      });

      it('positive case with nausea: triggers when Chest pain AND Nausea PRESENT', () => {
        const input: ClinicalEvaluationInput = {
          findings: [
            { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Nausea', status: EvaluationFindingStatus.PRESENT },
          ],
        };
        const result = engine.evaluateDifferential(input);
        const acs = result.redFlags.find((rf) => rf.flagCode === 'RF-ACS-ISCHEMIA');
        expect(acs?.triggered).toBe(true);
      });

      it('incomplete case: Chest pain alone without breathlessness/weakness/nausea does not trigger', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT }],
        };
        const result = engine.evaluateDifferential(input);
        const acs = result.redFlags.find((rf) => rf.flagCode === 'RF-ACS-ISCHEMIA');
        expect(acs?.triggered).toBe(false);
      });

      it('incomplete case: Breathlessness alone without chest pain does not trigger', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT }],
        };
        const result = engine.evaluateDifferential(input);
        const acs = result.redFlags.find((rf) => rf.flagCode === 'RF-ACS-ISCHEMIA');
        expect(acs?.triggered).toBe(false);
      });

      it('negative case: no cardiac symptoms reported', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.ABSENT }],
        };
        const result = engine.evaluateDifferential(input);
        const acs = result.redFlags.find((rf) => rf.flagCode === 'RF-ACS-ISCHEMIA');
        expect(acs?.triggered).toBe(false);
      });
    });

    // 9.3 RF-RESP-FAILURE
    describe('9.3 RF-RESP-FAILURE (Acute Hypoxemic Respiratory Failure)', () => {
      it('positive case: triggers with neutral escalation language', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT }],
          vitals: { spO2: 88 },
        };
        const result = engine.evaluateDifferential(input);
        const resp = result.redFlags.find((rf) => rf.flagCode === 'RF-RESP-FAILURE');
        expect(resp?.triggered).toBe(true);
        expect(resp?.clinicalAction).toContain('Clinical Escalation Advisory');
        expect(resp?.clinicalAction).toContain('attending clinician assessment and decision');
        expect(resp?.clinicalAction).not.toMatch(/\badminister supplemental high-flow oxygen\b/i);
        expect(resp?.clinicalAction).not.toMatch(/\bmaintain airway\b/i);
      });

      it('boundary case: SpO2 exactly 89% triggers (operator LESS_THAN 90)', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT }],
          vitals: { spO2: 89 },
        };
        const result = engine.evaluateDifferential(input);
        const resp = result.redFlags.find((rf) => rf.flagCode === 'RF-RESP-FAILURE');
        expect(resp?.triggered).toBe(true);
      });

      it('boundary case: SpO2 exactly 90% does NOT trigger (strict LESS_THAN 90)', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT }],
          vitals: { spO2: 90 },
        };
        const result = engine.evaluateDifferential(input);
        const resp = result.redFlags.find((rf) => rf.flagCode === 'RF-RESP-FAILURE');
        expect(resp?.triggered).toBe(false);
      });

      it('incomplete case: SpO2 85% but Breathlessness ABSENT does not trigger', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.ABSENT }],
          vitals: { spO2: 85 },
        };
        const result = engine.evaluateDifferential(input);
        const resp = result.redFlags.find((rf) => rf.flagCode === 'RF-RESP-FAILURE');
        expect(resp?.triggered).toBe(false);
      });

      it('incomplete case: Breathlessness PRESENT but SpO2 missing does not trigger', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT }],
        };
        const result = engine.evaluateDifferential(input);
        const resp = result.redFlags.find((rf) => rf.flagCode === 'RF-RESP-FAILURE');
        expect(resp?.triggered).toBe(false);
      });

      it('negative case: normal SpO2 (98%) and breathlessness absent', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.ABSENT }],
          vitals: { spO2: 98 },
        };
        const result = engine.evaluateDifferential(input);
        const resp = result.redFlags.find((rf) => rf.flagCode === 'RF-RESP-FAILURE');
        expect(resp?.triggered).toBe(false);
      });
    });

    // 9.4 RF-HYPERTENSIVE-CRISIS
    describe('9.4 RF-HYPERTENSIVE-CRISIS (Target-Organ Assessment & Clinician-Directed Disposition)', () => {
      it('severe-range BP without documented target-organ damage: requires assessment, does NOT mandate ER referral', () => {
        const input: ClinicalEvaluationInput = {
          findings: [],
          vitals: { systolicBp: 185, diastolicBp: 105 },
        };
        const result = engine.evaluateDifferential(input);
        const htn = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
        expect(htn?.triggered).toBe(true);
        expect(htn?.title).toBe('Severe Blood Pressure Elevation Advisory (Severe-Range BP; Requires Target-Organ Evaluation)');
        expect(htn?.clinicalAction).toContain('Severe-range blood pressure elevation alone does not establish a diagnosis of hypertensive emergency');
        expect(htn?.clinicalAction).toContain('Disposition—including outpatient oral medication titration versus emergency department referral—depends entirely on the presence of acute target-organ compromise');
        // Confirms it does not automatically order ER referral
        expect(htn?.clinicalAction).not.toMatch(/\barrange immediate emergency department referral\b/i);
      });

      it('severe-range BP with acute target-organ symptoms (chest pain): notes suspected hypertensive emergency', () => {
        const input: ClinicalEvaluationInput = {
          findings: [{ canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT }],
          vitals: { systolicBp: 185, diastolicBp: 105 },
        };
        const result = engine.evaluateDifferential(input);
        const htn = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
        expect(htn?.triggered).toBe(true);
        expect(htn?.title).toBe('Severe Blood Pressure Elevation with Acute Symptoms (Suspected Target-Organ Involvement)');
        expect(htn?.clinicalAction).toContain('suspected hypertensive emergency');
        expect(htn?.clinicalAction).toContain('attending clinician evaluation is warranted to assess cardiovascular/pulmonary status and establish emergency disposition');
      });

      it('positive SBP boundary: triggers when Systolic BP exactly 180 mmHg', () => {
        const input: ClinicalEvaluationInput = {
          findings: [],
          vitals: { systolicBp: 180, diastolicBp: 100 },
        };
        const result = engine.evaluateDifferential(input);
        const htn = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
        expect(htn?.triggered).toBe(true);
      });

      it('positive DBP boundary: triggers when Diastolic BP exactly 120 mmHg', () => {
        const input: ClinicalEvaluationInput = {
          findings: [],
          vitals: { systolicBp: 160, diastolicBp: 120 },
        };
        const result = engine.evaluateDifferential(input);
        const htn = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
        expect(htn?.triggered).toBe(true);
      });

      it('boundary case: SBP 179 and DBP 119 does NOT trigger (sub-threshold)', () => {
        const input: ClinicalEvaluationInput = {
          findings: [],
          vitals: { systolicBp: 179, diastolicBp: 119 },
        };
        const result = engine.evaluateDifferential(input);
        const htn = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
        expect(htn?.triggered).toBe(false);
      });

      it('negative case: Stage 1 hypertension (SBP 135, DBP 88) does not trigger red flag', () => {
        const input: ClinicalEvaluationInput = {
          findings: [],
          vitals: { systolicBp: 135, diastolicBp: 88 },
        };
        const result = engine.evaluateDifferential(input);
        const htn = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
        expect(htn?.triggered).toBe(false);
      });

      it('missing-data case: Blood pressure completely omitted does not trigger', () => {
        const result = engine.evaluateDifferential({ findings: [] });
        const htn = result.redFlags.find((rf) => rf.flagCode === 'RF-HYPERTENSIVE-CRISIS');
        expect(htn?.triggered).toBe(false);
      });
    });

    // 9.5 Red-Flag Escalation Governance & API Exposure Audit
    describe('9.5 Red-Flag Escalation Governance & Zero-Intervention Command Audit', () => {
      it('all four red-flag output strings contain zero imperative therapeutic commands or drug dosages', () => {
        const input: ClinicalEvaluationInput = {
          findings: [
            { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Breathlessness', status: EvaluationFindingStatus.PRESENT },
          ],
          vitals: {
            respiratoryRate: 24,
            systolicBp: 185,
            diastolicBp: 120,
            spO2: 88,
          },
          demographics: { ageYears: 55 },
        };
        const result = engine.evaluateDifferential(input);

        // Check every red flag output
        for (const rf of result.redFlags) {
          // 1. No autonomous prescription or drug dosages
          expect(rf.clinicalAction).not.toMatch(/\b\d+\s*mg\b/i);
          expect(rf.clinicalAction).not.toMatch(/\baspirin\b/i);
          expect(rf.clinicalAction).not.toMatch(/\bantimicrobial/i);

          // 2. No imperative procedural commands
          expect(rf.clinicalAction).not.toMatch(/\badminister high-flow oxygen\b/i);
          expect(rf.clinicalAction).not.toMatch(/\binitiate supplemental oxygen\b/i);
          expect(rf.clinicalAction).not.toMatch(/\bmaintain airway\b/i);
          expect(rf.clinicalAction).not.toMatch(/\badminister medication\b/i);
          expect(rf.clinicalAction).not.toMatch(/\binitiate iv\b/i);

          // 3. Every string must explicitly state attending clinician assessment/decision is required
          expect(rf.clinicalAction).toMatch(/attending clinician|attending physician/i);
          expect(rf.clinicalAction).toMatch(/assessment and decision|clinical judgment|evaluation/i);

          // 4. Regulatory disclaimer must be attached
          expect(rf.disclaimer).toBeDefined();
          expect(rf.disclaimer).toContain('Does not constitute a prescription');
        }
      });

      it('guarantees stable, deterministic output across consecutive evaluations', () => {
        const input: ClinicalEvaluationInput = {
          findings: [
            { canonicalTerm: 'Fever', status: EvaluationFindingStatus.PRESENT },
            { canonicalTerm: 'Chest pain', status: EvaluationFindingStatus.PRESENT },
          ],
          vitals: {
            respiratoryRate: 24,
            systolicBp: 95,
          },
          demographics: { ageYears: 40 },
        };
        const fixedTimestamp = '2026-10-30T17:00:00.000Z';
        const baseline = JSON.stringify(engine.evaluateDifferential(input, { evaluatedAt: fixedTimestamp }));

        for (let i = 0; i < 20; i++) {
          const run = JSON.stringify(engine.evaluateDifferential(input, { evaluatedAt: fixedTimestamp }));
          expect(run).toBe(baseline);
        }
      });
    });
  });
});
