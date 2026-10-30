import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/doctor_extraction_review.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';

void main() {
  group('Doctor Extraction Review & Formatter Tests', () {
    late StructuredClinicalExtractionResult sampleResult;

    setUp(() {
      sampleResult = const StructuredClinicalExtractionResult(
        schemaVersion: '1.0.0',
        extractionEngineVersion: '1.0.0',
        normalizationEngineVersion: '1.0.0',
        source: ExtractionSource(
          originalDoctorConfirmedText:
              'Mareez ko 3 din se tez bukhar hai, khansi nahi hai. Chest examination not performed. Patient reports chills.',
          detectedLanguage: 'HINGLISH',
          characterCount: 110,
        ),
        findings: [
          StructuredClinicalFinding(
            id: 'f-1',
            canonicalTermId: 'SYM-FEVER',
            canonicalDisplayName: 'Fever',
            originalExpression: 'tez bukhar',
            conceptCategory: ExtractedConceptCategory.symptom,
            status: ClinicalFindingStatus.present,
            certainty: 'CONFIRMED',
            temporalStatements: [
              ClinicalTemporalStatement(
                statementId: 'stmt-1',
                temporalAnchor: 'CURRENT',
                status: ClinicalFindingStatus.present,
                evidence: EvidenceSpan(text: '3 din se tez bukhar hai', startIndex: 10, endIndex: 33),
                duration: ClinicalDuration(raw: '3 din se', value: 3, unit: 'DAYS'),
                onset: null,
              ),
            ],
            chronologicalRelationships: [
              ChronologicalRelationship(
                relationshipId: 'rel-1',
                priorStatementId: 'stmt-0',
                subsequentStatementId: 'stmt-1',
                transitionType: ChronologicalTransitionType.improved,
                evidence: EvidenceSpan(text: 'kam ho gaya', startIndex: 0, endIndex: 11),
                confidence: 'EXPLICIT_IN_TEXT',
              ),
            ],
            severityAssessment: ClinicalSeverityAssessment(
              state: SeverityAssessmentState.assessed,
              level: SymptomSeverityLevel.severe,
              evidence: EvidenceSpan(text: 'tez', startIndex: 20, endIndex: 23),
            ),
            bodyLocation: ClinicalBodyLocation(),
            provenance: [],
            validationWarnings: [],
          ),
          StructuredClinicalFinding(
            id: 'f-2',
            canonicalTermId: 'SYM-COUGH',
            canonicalDisplayName: 'Cough',
            originalExpression: 'khansi',
            conceptCategory: ExtractedConceptCategory.symptom,
            status: ClinicalFindingStatus.absent,
            certainty: 'CONFIRMED',
            temporalStatements: [],
            chronologicalRelationships: [],
            severityAssessment: ClinicalSeverityAssessment(state: SeverityAssessmentState.notMentioned),
            bodyLocation: ClinicalBodyLocation(),
            provenance: [],
            validationWarnings: [],
          ),
          StructuredClinicalFinding(
            id: 'f-3',
            canonicalTermId: 'SYM-HEADACHE',
            canonicalDisplayName: 'Headache',
            originalExpression: 'sir dard',
            conceptCategory: ExtractedConceptCategory.symptom,
            status: ClinicalFindingStatus.uncertain,
            certainty: 'UNCERTAIN',
            temporalStatements: [],
            chronologicalRelationships: [],
            severityAssessment: ClinicalSeverityAssessment(state: SeverityAssessmentState.notMentioned),
            bodyLocation: ClinicalBodyLocation(),
            provenance: [],
            validationWarnings: [],
          ),
        ],
        clinicalAssessments: [
          ClinicalAssessmentRecord(
            id: 'a-1',
            assessmentScope: 'SYSTEM_EXAMINATION',
            targetSystemOrExam: 'Respiratory / Chest Examination',
            status: ClinicalAssessmentStatus.notAssessed,
            reason: 'patient uncooperative',
            evidence: EvidenceSpan(text: 'Chest examination not performed', startIndex: 52, endIndex: 83),
            provenance: [],
          ),
        ],
        unmappedExpressions: [
          UnmappedClinicalExpression(
            expression: 'chills',
            category: ExtractedConceptCategory.subjectiveSensation,
            reason: 'Quarantined patient cold sensation',
            evidence: EvidenceSpan(text: 'reports chills', startIndex: 85, endIndex: 99),
            provenanceRule: 'RULE-CONCEPT-SENSATION-ISOLATION-006',
          ),
        ],
        summaryCounts: StructuredExtractionSummaryCounts(
          totalFindings: 3,
          presentCount: 1,
          absentCount: 1,
          uncertainCount: 1,
          unknownCount: 0,
          unmappedCount: 1,
          clinicalAssessmentsCount: 1,
        ),
        review: ClinicalReviewMetadata(
          requiresDoctorReview: true,
          reviewStatus: 'PENDING_REVIEW',
          systemSafetyNotice: 'Notice',
        ),
      );
    });

    test('formats symptoms and examinations according to clinical categories and doctor decisions', () {
      final findingDecisions = {
        'f-1': const FindingReviewDecision(
          findingId: 'f-1',
          originalStatus: ClinicalFindingStatus.present,
          finalStatus: ClinicalFindingStatus.present,
          decisionType: DoctorDecisionType.approvedAsExtracted,
        ),
        'f-2': const FindingReviewDecision(
          findingId: 'f-2',
          originalStatus: ClinicalFindingStatus.absent,
          finalStatus: ClinicalFindingStatus.absent,
          decisionType: DoctorDecisionType.approvedAsExtracted,
        ),
        'f-3': const FindingReviewDecision(
          findingId: 'f-3',
          originalStatus: ClinicalFindingStatus.uncertain,
          finalStatus: ClinicalFindingStatus.uncertain,
          decisionType: DoctorDecisionType.approvedAsExtracted,
        ),
      };

      final assessmentInclusions = {'a-1': true};
      final unmappedInclusions = {'chills': true};

      final result = ClinicalExtractionConsultationFormatter.format(
        extractionResult: sampleResult,
        findingDecisions: findingDecisions,
        assessmentInclusions: assessmentInclusions,
        unmappedInclusions: unmappedInclusions,
      );

      // Verify Symptoms
      expect(result.formattedSymptoms, contains('[Reported Symptoms]'));
      expect(result.formattedSymptoms, contains('• Fever: PRESENT (SEVERE) [Duration: 3 din se] [Ref: "tez bukhar"]'));
      expect(result.formattedSymptoms, contains('Timeline: IMPROVED (kam ho gaya)'));

      expect(result.formattedSymptoms, contains('[Denied / Negative Symptoms]'));
      expect(result.formattedSymptoms, contains('• Cough: ABSENT [Ref: "khansi"]'));

      expect(result.formattedSymptoms, contains('[Clinically Uncertain Symptoms]'));
      expect(result.formattedSymptoms, contains('• Headache: UNCERTAIN [Ref: "sir dard"]'));

      expect(result.formattedSymptoms, contains('[Associated Patient Sensations]'));
      expect(result.formattedSymptoms, contains('• Associated subjective sensation: "chills" (SUBJECTIVE_SENSATION)'));

      // Verify Examinations
      expect(result.formattedExamination, contains('[Examinations & Procedures Omitted / Deferred]'));
      expect(
        result.formattedExamination,
        contains('• Respiratory / Chest Examination: NOT PERFORMED (Reason: patient uncooperative) [Evidence: "Chest examination not performed"]'),
      );
      expect(result.formattedExamination, isNot(contains('normal')));

      expect(result.includedFindingsCount, 3);
      expect(result.excludedFindingsCount, 0);
      expect(result.includedAssessmentsCount, 1);
      expect(result.includedUnmappedCount, 1);
    });

    test('excludes findings marked with DoctorDecisionType.excludedByDoctor from insertion', () {
      final findingDecisions = {
        'f-1': const FindingReviewDecision(
          findingId: 'f-1',
          originalStatus: ClinicalFindingStatus.present,
          finalStatus: ClinicalFindingStatus.present,
          decisionType: DoctorDecisionType.excludedByDoctor, // Excluded
        ),
        'f-2': const FindingReviewDecision(
          findingId: 'f-2',
          originalStatus: ClinicalFindingStatus.absent,
          finalStatus: ClinicalFindingStatus.absent,
          decisionType: DoctorDecisionType.approvedAsExtracted,
        ),
      };

      final result = ClinicalExtractionConsultationFormatter.format(
        extractionResult: sampleResult,
        findingDecisions: findingDecisions,
        assessmentInclusions: {},
        unmappedInclusions: {},
      );

      expect(result.formattedSymptoms, isNot(contains('Fever')));
      expect(result.formattedSymptoms, contains('• Cough: ABSENT'));
      expect(result.includedFindingsCount, 2); // Cough and Headache (default approved)
      expect(result.excludedFindingsCount, 1); // Fever excluded
    });

    test('supports doctor status override from PRESENT to ABSENT', () {
      final findingDecisions = {
        'f-1': const FindingReviewDecision(
          findingId: 'f-1',
          originalStatus: ClinicalFindingStatus.present,
          finalStatus: ClinicalFindingStatus.absent, // Overridden by doctor
          decisionType: DoctorDecisionType.statusOverridden,
          doctorNote: 'Clinician confirmed patient was afebrile',
        ),
      };

      final result = ClinicalExtractionConsultationFormatter.format(
        extractionResult: sampleResult,
        findingDecisions: findingDecisions,
        assessmentInclusions: {},
        unmappedInclusions: {},
      );

      expect(result.formattedSymptoms, isNot(contains('• Fever: PRESENT')));
      expect(result.formattedSymptoms, contains('• Fever: ABSENT'));
      expect(result.formattedSymptoms, contains('(Dr. Note: Clinician confirmed patient was afebrile)'));
    });
  });
}

