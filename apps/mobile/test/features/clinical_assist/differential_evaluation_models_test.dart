import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/differential_evaluation_models.dart';

void main() {
  group('Differential Evaluation Request Models', () {
    test('DifferentialFindingInput serializes and deserializes correctly', () {
      const input = DifferentialFindingInput(
        canonicalTerm: 'Fever',
        conceptId: 'C-FEVER',
        status: EvaluationFindingStatus.present,
        durationDays: 4,
        severity: 'MODERATE',
        bodyLocation: 'Systemic',
      );

      final json = input.toJson();
      expect(json['canonicalTerm'], 'Fever');
      expect(json['conceptId'], 'C-FEVER');
      expect(json['status'], 'PRESENT');
      expect(json['durationDays'], 4);
      expect(json['severity'], 'MODERATE');
      expect(json['bodyLocation'], 'Systemic');

      final deserialized = DifferentialFindingInput.fromJson(json);
      expect(deserialized.canonicalTerm, 'Fever');
      expect(deserialized.conceptId, 'C-FEVER');
      expect(deserialized.status, EvaluationFindingStatus.present);
      expect(deserialized.durationDays, 4);
      expect(deserialized.severity, 'MODERATE');
      expect(deserialized.bodyLocation, 'Systemic');
    });

    test('DifferentialVitalsInput serializes non-null fields only', () {
      const vitals = DifferentialVitalsInput(
        temperatureC: 38.5,
        systolicBp: 120,
        diastolicBp: 80,
        pulse: 92,
        spO2: 98,
        respiratoryRate: 20,
      );

      final json = vitals.toJson();
      expect(json['temperatureC'], 38.5);
      expect(json['systolicBp'], 120);
      expect(json['diastolicBp'], 80);
      expect(json['pulse'], 92);
      expect(json['spO2'], 98);
      expect(json['respiratoryRate'], 20);

      const emptyVitals = DifferentialVitalsInput();
      expect(emptyVitals.isEmpty, isTrue);
      expect(emptyVitals.toJson().isEmpty, isTrue);
    });

    test('EvaluateDifferentialRequest serializes top-level request correctly', () {
      const req = EvaluateDifferentialRequest(
        patientId: 'p-1234',
        consultationId: 'c-5678',
        domain: 'GENERAL_MEDICINE',
        findings: [
          DifferentialFindingInput(
            canonicalTerm: 'Cough',
            status: EvaluationFindingStatus.present,
          ),
        ],
        vitals: DifferentialVitalsInput(temperatureC: 38.0),
        infectionSuspicion: InfectionSuspicionState.suspected,
        assessments: [
          DifferentialAssessmentInput(
            examination: 'Chest auscultation',
            status: AssessmentStatus.performed,
          ),
        ],
      );

      final json = req.toJson();
      expect(json['patientId'], 'p-1234');
      expect(json['consultationId'], 'c-5678');
      expect(json['domain'], 'GENERAL_MEDICINE');
      expect((json['findings'] as List).length, 1);
      expect(json['vitals']['temperatureC'], 38.0);
      expect(json['infectionSuspicion'], 'SUSPECTED');
      expect((json['assessments'] as List).length, 1);
    });
  });

  group('Differential Evaluation Response Models', () {
    test('DifferentialEvaluationResponse parses EVALUATED response accurately', () {
      final json = {
        'status': 'EVALUATED',
        'evaluatedAt': '2026-10-31T00:00:00.000Z',
        'engineVersion': '1.0.0',
        'knowledgePack': {
          'domain': 'GENERAL_MEDICINE',
          'version': '1.0.0',
          'releaseStatus': 'RELEASED',
          'releaseScope': 'GLOBAL',
          'checksumSha256': 'abc123sha',
        },
        'patientContext': {
          'patientId': 'p-1234',
          'resolvedAgeYears': 32,
          'ageSource': 'PATIENT_DOB',
          'gender': 'MALE',
        },
        'infectionSuspicion': 'SUSPECTED',
        'hasUrgentRedFlags': true,
        'redFlags': [
          {
            'flagCode': 'RF-QSOFA-SEPSIS',
            'title': 'qSOFA Sepsis Screening Alert',
            'urgencyLevel': 'IMMEDIATE',
            'triggered': true,
            'clinicalAction': 'Immediate senior clinical review and lactate evaluation.',
            'disclaimer': 'qSOFA is an assistive bedside screening tool.',
            'isProvisional': true,
            'quarantinedPredicates': ['Dizziness'],
            'missingAssessmentNotice': 'Altered mentation not assessed',
            'gatingExplanation': 'Evaluated for adult patient with suspected infection',
          }
        ],
        'candidateMatches': [
          {
            'conditionCode': 'COND-APP-01',
            'conditionDisplayName': 'Acute Appendicitis',
            'category': 'Gastroenterology',
            'ruleCode': 'R-APP-01',
            'ruleTitle': 'Acute Appendicitis Rule',
            'tier': 'STRONG_MATCH',
            'minMajorCount': 2,
            'majorSupportingMatchedCount': 2,
            'mandatoryResult': {
              'satisfied': true,
              'result': 'SATISFIED',
              'explanation': 'Abdominal pain present',
            },
            'majorSupportingResults': [
              {
                'satisfied': true,
                'result': 'SATISFIED',
                'explanation': 'RLQ localized pain',
              },
            ],
            'minorSupportingResults': [],
            'contradictionResults': [],
            'contradictionTriggered': false,
            'missingInformation': [
              {
                'prompt': 'Check rebound tenderness',
                'reason': 'Increases diagnostic certainty',
              }
            ],
            'unperformedAssessments': [
              {
                'examination': 'Digital Rectal Exam',
                'prompt': 'Not assessed',
                'reason': 'Clinician deferred',
              }
            ],
            'suggestedInvestigations': ['Ultrasound Abdomen', 'Complete Blood Count'],
            'isComplete': true,
            'rationale': 'Deterministic criteria for strong match fully met.',
          }
        ],
        'tierSummary': {
          'strongMatchCount': 1,
          'moderateMatchCount': 0,
          'possibleMatchCount': 0,
          'contradictedMatchCount': 0,
          'unmatchedCount': 0,
        },
        'warnings': ['Adult qSOFA gating active'],
        'requiresDoctorReview': true,
        'disclaimer': 'Decision support tool only.',
      };

      final resp = DifferentialEvaluationResponse.fromJson(json);

      expect(resp.isEvaluated, isTrue);
      expect(resp.isUnavailable, isFalse);
      expect(resp.engineVersion, '1.0.0');
      expect(resp.knowledgePack?.version, '1.0.0');
      expect(resp.patientContext?.resolvedAgeYears, 32);
      expect(resp.infectionSuspicion, InfectionSuspicionState.suspected);
      expect(resp.hasUrgentRedFlags, isTrue);
      expect(resp.redFlags.length, 1);

      final flag = resp.redFlags.first;
      expect(flag.flagCode, 'RF-QSOFA-SEPSIS');
      expect(flag.urgencyLevel, RedFlagUrgency.immediate);
      expect(flag.triggered, isTrue);
      expect(flag.isProvisional, isTrue);
      expect(flag.quarantinedPredicates, contains('Dizziness'));

      expect(resp.candidateMatches.length, 1);
      final cand = resp.candidateMatches.first;
      expect(cand.conditionCode, 'COND-APP-01');
      expect(cand.tier, DifferentialMatchTier.strongMatch);
      expect(cand.mandatoryResult?.satisfied, isTrue);
      expect(cand.missingInformation.length, 1);
      expect(cand.unperformedAssessments.length, 1);
      expect(cand.suggestedInvestigations, contains('Ultrasound Abdomen'));
      expect(resp.tierSummary?.strongMatchCount, 1);
    });

    test('DifferentialEvaluationResponse parses UNAVAILABLE state safely', () {
      final json = {
        'status': 'UNAVAILABLE',
        'evaluatedAt': '2026-10-31T00:00:00.000Z',
        'engineVersion': '1.0.0',
        'patientContext': {
          'patientId': 'p-1234',
          'ageSource': 'UNRECORDED',
        },
        'infectionSuspicion': 'UNKNOWN',
        'hasUrgentRedFlags': false,
        'redFlags': [],
        'candidateMatches': [],
        'warnings': [],
        'requiresDoctorReview': true,
        'disclaimer': 'Decision support tool only.',
        'message': 'No eligible released knowledge pack found for domain GENERAL_MEDICINE',
      };

      final resp = DifferentialEvaluationResponse.fromJson(json);

      expect(resp.isEvaluated, isFalse);
      expect(resp.isUnavailable, isTrue);
      expect(resp.candidateMatches, isEmpty);
      expect(resp.message, contains('No eligible released knowledge pack'));
    });
  });

  group('Doctor Decision Result Formatting', () {
    test('formats primary and differential diagnoses accurately', () {
      final result = DoctorDifferentialReviewResult(
        decisions: {
          'COND-01': const DoctorCandidateDecision(
            conditionCode: 'COND-01',
            conditionDisplayName: 'Acute Appendicitis',
            tier: DifferentialMatchTier.strongMatch,
            action: DoctorCandidateAction.acceptedAsPrimary,
          ),
          'COND-02': const DoctorCandidateDecision(
            conditionCode: 'COND-02',
            conditionDisplayName: 'Mesenteric Adenitis',
            tier: DifferentialMatchTier.possibleMatch,
            action: DoctorCandidateAction.acceptedAsDifferential,
          ),
          'COND-03': const DoctorCandidateDecision(
            conditionCode: 'COND-03',
            conditionDisplayName: 'Gastroenteritis',
            tier: DifferentialMatchTier.possibleMatch,
            action: DoctorCandidateAction.acceptedAsDifferential,
          ),
          'COND-04': const DoctorCandidateDecision(
            conditionCode: 'COND-04',
            conditionDisplayName: 'Renal Colic',
            tier: DifferentialMatchTier.contradicted,
            action: DoctorCandidateAction.rejected,
          ),
        },
      );

      expect(result.primaryDiagnosis?.conditionDisplayName, 'Acute Appendicitis');
      expect(result.differentialDiagnoses.length, 2);
      expect(result.rejectedDiagnoses.length, 1);
      expect(result.hasSelections, isTrue);

      final text = result.formatForConsultationDiagnosis();
      expect(text, 'Acute Appendicitis (Differential: Mesenteric Adenitis, Gastroenteritis)');
    });

    test('formats differential diagnoses when no primary is selected', () {
      final result = DoctorDifferentialReviewResult(
        decisions: {
          'COND-02': const DoctorCandidateDecision(
            conditionCode: 'COND-02',
            conditionDisplayName: 'Acute Bronchitis',
            tier: DifferentialMatchTier.moderateMatch,
            action: DoctorCandidateAction.acceptedAsDifferential,
          ),
        },
      );

      expect(result.primaryDiagnosis, isNull);
      expect(result.differentialDiagnoses.length, 1);
      final text = result.formatForConsultationDiagnosis();
      expect(text, 'Differential: Acute Bronchitis');
    });
  });
}
