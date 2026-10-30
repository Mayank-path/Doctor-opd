import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';

void main() {
  group('Structured Clinical Extraction Model Deserialization & Serialization', () {
    test('deserializes complete canonical extraction response correctly', () {
      final json = {
        'schemaVersion': '1.0.0',
        'extractionEngineVersion': '1.0.0',
        'normalizationEngineVersion': '1.0.0',
        'source': {
          'originalDoctorConfirmedText':
              'Mareez ko 3 din se tez bukhar hai, khansi nahi hai. Chest examination not performed.',
          'detectedLanguage': 'HINGLISH',
          'characterCount': 84,
        },
        'findings': [
          {
            'id': 'finding-fever-0',
            'canonicalTermId': 'SYM-FEVER',
            'canonicalDisplayName': 'Fever',
            'originalExpression': 'bukhar',
            'conceptCategory': 'SYMPTOM',
            'status': 'PRESENT',
            'certainty': 'CONFIRMED',
            'temporalStatements': [
              {
                'statementId': 'stmt-fever-0',
                'temporalAnchor': 'CURRENT',
                'status': 'PRESENT',
                'evidence': {
                  'text': '3 din se tez bukhar hai',
                  'startIndex': 10,
                  'endIndex': 33,
                  'sourceField': 'originalDoctorConfirmedText',
                },
                'duration': {
                  'raw': '3 din se',
                  'value': 3,
                  'unit': 'DAYS',
                },
                'onset': null,
              }
            ],
            'chronologicalRelationships': [],
            'severityAssessment': {
              'state': 'ASSESSED',
              'level': 'SEVERE',
              'evidence': {
                'text': 'tez',
                'startIndex': 20,
                'endIndex': 23,
                'sourceField': 'originalDoctorConfirmedText',
              },
            },
            'bodyLocation': {
              'name': null,
              'isDefault': false,
              'evidenceSpan': null,
            },
            'provenance': [
              {
                'ruleId': 'RULE-STATUS-PRESENT-001',
                'ruleDescription': 'Positive polarity with confirmed certainty',
                'matchedAlias': 'bukhar',
                'canonicalTermId': 'SYM-FEVER',
                'evidence': {
                  'text': '3 din se tez bukhar hai',
                  'startIndex': 10,
                  'endIndex': 33,
                  'sourceField': 'originalDoctorConfirmedText',
                },
                'engineVersion': '1.0.0',
              }
            ],
            'validationWarnings': [],
          },
          {
            'id': 'finding-cough-1',
            'canonicalTermId': 'SYM-COUGH',
            'canonicalDisplayName': 'Cough',
            'originalExpression': 'khansi',
            'conceptCategory': 'SYMPTOM',
            'status': 'ABSENT',
            'certainty': 'CONFIRMED',
            'temporalStatements': [],
            'chronologicalRelationships': [],
            'severityAssessment': {
              'state': 'NOT_MENTIONED',
              'level': null,
              'evidence': null,
            },
            'bodyLocation': {
              'name': null,
              'isDefault': false,
              'evidenceSpan': null,
            },
            'provenance': [],
            'validationWarnings': [],
          }
        ],
        'clinicalAssessments': [
          {
            'id': 'assess-chest-exam-0',
            'assessmentScope': 'SYSTEM_EXAMINATION',
            'targetSystemOrExam': 'Respiratory / Chest Examination',
            'status': 'NOT_ASSESSED',
            'reason': null,
            'evidence': {
              'text': 'Chest examination not performed',
              'startIndex': 52,
              'endIndex': 83,
              'sourceField': 'originalDoctorConfirmedText',
            },
            'provenance': [],
          }
        ],
        'unmappedExpressions': [
          {
            'expression': 'chills',
            'category': 'SUBJECTIVE_SENSATION',
            'reason': 'Quarantined patient cold sensation',
            'evidence': {
              'text': 'chills',
              'startIndex': null,
              'endIndex': null,
              'sourceField': 'originalDoctorConfirmedText',
            },
            'provenanceRule': 'RULE-CONCEPT-SENSATION-ISOLATION-006',
          }
        ],
        'summaryCounts': {
          'totalFindings': 2,
          'presentCount': 1,
          'absentCount': 1,
          'uncertainCount': 0,
          'unknownCount': 0,
          'unmappedCount': 1,
          'clinicalAssessmentsCount': 1,
        },
        'review': {
          'requiresDoctorReview': true,
          'reviewStatus': 'PENDING_REVIEW',
          'systemSafetyNotice': 'Extraction is an assistive aid only.',
        },
      };

      final result = StructuredClinicalExtractionResult.fromJson(json);

      expect(result.schemaVersion, '1.0.0');
      expect(result.source.characterCount, 84);
      expect(result.findings.length, 2);

      final fever = result.findings[0];
      expect(fever.canonicalDisplayName, 'Fever');
      expect(fever.status, ClinicalFindingStatus.present);
      expect(fever.severityAssessment.state, SeverityAssessmentState.assessed);
      expect(fever.severityAssessment.level, SymptomSeverityLevel.severe);
      expect(fever.temporalStatements.first.duration?.value, 3);
      expect(fever.temporalStatements.first.duration?.unit, 'DAYS');

      final cough = result.findings[1];
      expect(cough.canonicalDisplayName, 'Cough');
      expect(cough.status, ClinicalFindingStatus.absent);

      expect(result.clinicalAssessments.length, 1);
      final exam = result.clinicalAssessments.first;
      expect(exam.status, ClinicalAssessmentStatus.notAssessed);
      expect(exam.targetSystemOrExam, 'Respiratory / Chest Examination');

      expect(result.unmappedExpressions.length, 1);
      final unmapped = result.unmappedExpressions.first;
      expect(unmapped.category, ExtractedConceptCategory.subjectiveSensation);
      expect(unmapped.expression, 'chills');

      expect(result.summaryCounts.totalFindings, 2);
      expect(result.summaryCounts.presentCount, 1);
      expect(result.summaryCounts.absentCount, 1);
      expect(result.review.requiresDoctorReview, isTrue);

      // Verify serialization roundtrip
      final serialized = result.toJson();
      expect(serialized['schemaVersion'], '1.0.0');
      expect((serialized['findings'] as List).length, 2);
    });

    test('parses all 4 clinical finding statuses and handles unknown fallbacks safely', () {
      expect(ClinicalFindingStatus.fromString('PRESENT'), ClinicalFindingStatus.present);
      expect(ClinicalFindingStatus.fromString('ABSENT'), ClinicalFindingStatus.absent);
      expect(ClinicalFindingStatus.fromString('UNCERTAIN'), ClinicalFindingStatus.uncertain);
      expect(ClinicalFindingStatus.fromString('UNKNOWN'), ClinicalFindingStatus.unknown);
      expect(ClinicalFindingStatus.fromString('UNRECOGNIZED_VALUE'), ClinicalFindingStatus.unknown);
      expect(ClinicalFindingStatus.fromString(null), ClinicalFindingStatus.unknown);
    });

    test('parses all concept categories and severity states safely', () {
      expect(ExtractedConceptCategory.fromString('SYMPTOM'), ExtractedConceptCategory.symptom);
      expect(ExtractedConceptCategory.fromString('SUBJECTIVE_SENSATION'),
          ExtractedConceptCategory.subjectiveSensation);
      expect(ExtractedConceptCategory.fromString('CLINICAL_SIGN'),
          ExtractedConceptCategory.clinicalSign);
      expect(ExtractedConceptCategory.fromString('DIAGNOSIS_OR_CONDITION'),
          ExtractedConceptCategory.diagnosisOrCondition);
      expect(ExtractedConceptCategory.fromString('TEMPORAL_DESCRIPTOR'),
          ExtractedConceptCategory.temporalDescriptor);
      expect(ExtractedConceptCategory.fromString('INVALID'),
          ExtractedConceptCategory.unclassifiedExpression);

      expect(SeverityAssessmentState.fromString('NOT_MENTIONED'),
          SeverityAssessmentState.notMentioned);
      expect(SeverityAssessmentState.fromString('EXPLICITLY_UNCLEAR'),
          SeverityAssessmentState.explicitlyUnclear);
      expect(SeverityAssessmentState.fromString('ASSESSED'),
          SeverityAssessmentState.assessed);
      expect(SeverityAssessmentState.fromString('UNKNOWN'),
          SeverityAssessmentState.notMentioned);
    });

    test('parses chronological transition types accurately', () {
      expect(ChronologicalTransitionType.fromString('IMPROVED'),
          ChronologicalTransitionType.improved);
      expect(ChronologicalTransitionType.fromString('RESOLVED'),
          ChronologicalTransitionType.resolved);
      expect(ChronologicalTransitionType.fromString('RECURRED'),
          ChronologicalTransitionType.recurred);
      expect(ChronologicalTransitionType.fromString('WORSENED'),
          ChronologicalTransitionType.worsened);
      expect(ChronologicalTransitionType.fromString('NEW_ONSET'),
          ChronologicalTransitionType.newOnset);
      expect(ChronologicalTransitionType.fromString('AMBIGUOUS'),
          ChronologicalTransitionType.ambiguous);
      expect(ChronologicalTransitionType.fromString('INVALID'),
          ChronologicalTransitionType.ambiguous);
    });

    test('verifies UTF-16 slice invariant for ASCII, Devanagari, and surrogate pairs', () {
      // 1. ASCII Slice
      const asciiText = 'Patient reports high fever for 3 days';
      const asciiSpan = EvidenceSpan(text: 'high fever', startIndex: 16, endIndex: 26);
      expect(asciiSpan.isSliceVerified(asciiText), isTrue);

      // 2. Devanagari with Nukta & Matras (Length 31)
      const devanagariText = 'मरीज़ को ३ दिन से तेज़ बुखार है';
      expect(devanagariText.length, 31);
      const span1 = EvidenceSpan(text: '३ दिन', startIndex: 9, endIndex: 14);
      const span2 = EvidenceSpan(text: 'तेज़ बुखार', startIndex: 18, endIndex: 28);
      expect(span1.isSliceVerified(devanagariText), isTrue);
      expect(span2.isSliceVerified(devanagariText), isTrue);

      // 3. Surrogate pairs / Emojis (🩺 has length 2 in UTF-16)
      const emojiText = '🩺 Mareez ko bukhar hai';
      const bukharSpan = EvidenceSpan(text: 'bukhar', startIndex: 13, endIndex: 19);
      expect(bukharSpan.isSliceVerified(emojiText), isTrue);

      // 4. Invalid offsets safely return false without crashing
      const invalidSpan1 = EvidenceSpan(text: 'fever', startIndex: -1, endIndex: 5);
      const invalidSpan2 = EvidenceSpan(text: 'fever', startIndex: 50, endIndex: 60);
      const invalidSpan3 = EvidenceSpan(text: 'fever', startIndex: null, endIndex: null);
      expect(invalidSpan1.isSliceVerified(asciiText), isFalse);
      expect(invalidSpan2.isSliceVerified(asciiText), isFalse);
      expect(invalidSpan3.isSliceVerified(asciiText), isFalse);
    });

    test('handles missing optional fields and empty arrays gracefully', () {
      final minimalJson = {
        'source': {
          'originalDoctorConfirmedText': 'fever',
        },
      };

      final result = StructuredClinicalExtractionResult.fromJson(minimalJson);
      expect(result.schemaVersion, '1.0.0');
      expect(result.source.originalDoctorConfirmedText, 'fever');
      expect(result.findings, isEmpty);
      expect(result.clinicalAssessments, isEmpty);
      expect(result.unmappedExpressions, isEmpty);
      expect(result.summaryCounts.totalFindings, 0);
      expect(result.review.requiresDoctorReview, isTrue);
    });
  });
}
