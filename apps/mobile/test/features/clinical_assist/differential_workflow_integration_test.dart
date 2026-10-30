import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/doctor_extraction_review.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/screens/structured_extraction_review_screen.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/differential_evaluation_models.dart';

void main() {
  final samplePatient = Patient(
    id: 'p1111111-1111-1111-1111-111111111111',
    clinicId: 'c1111111-1111-1111-1111-111111111111',
    uhid: 'UHID-000042',
    fullName: 'Rajesh Sharma',
    gender: 'MALE',
    dateOfBirth: '1980-01-01',
    phone: '+919876543210',
    isActive: true,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  const sampleSourceText = 'Patient reports acute abdominal pain and fever.';

  final sampleFinding = StructuredClinicalFinding(
    id: 'finding-1',
    canonicalTermId: 'abdominal_pain',
    canonicalDisplayName: 'Abdominal Pain',
    originalExpression: 'abdominal pain',
    conceptCategory: ExtractedConceptCategory.symptom,
    status: ClinicalFindingStatus.present,
    certainty: 'EXPLICIT',
    bodyLocation: const ClinicalBodyLocation(name: 'Abdomen', isDefault: false),
    severityAssessment: const ClinicalSeverityAssessment(
      state: SeverityAssessmentState.assessed,
      level: SymptomSeverityLevel.moderate,
      evidence: EvidenceSpan(startIndex: 21, endIndex: 35, text: 'abdominal pain'),
    ),
    temporalStatements: const [
      ClinicalTemporalStatement(
        statementId: 'stmt-1',
        temporalAnchor: 'CURRENT',
        status: ClinicalFindingStatus.present,
        evidence: EvidenceSpan(startIndex: 21, endIndex: 35, text: 'abdominal pain'),
      ),
    ],
    chronologicalRelationships: const [],
    provenance: const [
      ClinicalProvenance(
        ruleId: 'RULE-01',
        ruleDescription: 'Primary mapping',
        engineVersion: '5B.1',
        evidence: EvidenceSpan(startIndex: 21, endIndex: 35, text: 'abdominal pain'),
      ),
    ],
    validationWarnings: const [],
  );

  final sampleExtractionResult = StructuredClinicalExtractionResult(
    schemaVersion: '5B.1',
    extractionEngineVersion: '1.0.0',
    normalizationEngineVersion: '5A.1',
    source: const ExtractionSource(
      originalDoctorConfirmedText: sampleSourceText,
      detectedLanguage: 'ENGLISH',
      characterCount: 47,
    ),
    findings: [sampleFinding],
    clinicalAssessments: const [],
    unmappedExpressions: const [],
    summaryCounts: const StructuredExtractionSummaryCounts(
      totalFindings: 1,
      presentCount: 1,
      absentCount: 0,
      uncertainCount: 0,
      unknownCount: 0,
      unmappedCount: 0,
      clinicalAssessmentsCount: 0,
    ),
    review: const ClinicalReviewMetadata(
      requiresDoctorReview: true,
      reviewStatus: 'PENDING_REVIEW',
      systemSafetyNotice: 'Clinical verification required.',
    ),
  );

  group('Workflow A Integration Tests (Voice Symptoms -> Differential)', () {
    testWidgets('StructuredExtractionReviewScreen exposes Differential Diagnosis action and formats diagnosis',
        (tester) async {
      tester.view.physicalSize = const Size(1200, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      ClinicalExtractionFormattingResult? returnedResult;

      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              final res = await Navigator.of(context).push<ClinicalExtractionFormattingResult?>(
                MaterialPageRoute(
                  builder: (_) => StructuredExtractionReviewScreen(
                    patient: samplePatient,
                    extractionResult: sampleExtractionResult,
                    sourceTranscript: sampleSourceText,
                  ),
                ),
              );
              returnedResult = res;
            },
            child: const Text('Open Review'),
          ),
        ),
      ));

      await tester.tap(find.text('Open Review'));
      await tester.pumpAndSettle();

      // Verify that the 'Evaluate Differential Diagnosis' button is rendered
      expect(find.text('Evaluate Differential Diagnosis'), findsOneWidget);
      expect(find.text('Insert into Consultation'), findsOneWidget);

      // Verify human-in-the-loop: doctor confirms and inserts without differential
      await tester.tap(find.text('Insert into Consultation'));
      await tester.pumpAndSettle();

      // Dialog opens
      expect(find.text('Confirm Insertion'), findsOneWidget);
      expect(find.textContaining('SYMPTOMS & HISTORY:'), findsOneWidget);

      // Confirm dialog
      await tester.tap(find.text('Confirm & Insert'));
      await tester.pumpAndSettle();

      expect(returnedResult, isNotNull);
      expect(returnedResult!.formattedSymptoms, contains('Abdominal Pain: PRESENT'));
      expect(returnedResult!.formattedDiagnosis, isNull);
    });

    test('ClinicalExtractionConsultationFormatter attaches differential diagnosis result when present',
        () {
      final sampleDifferentialResult = DoctorDifferentialReviewResult(
        decisions: {
          'COND-01': const DoctorCandidateDecision(
            conditionCode: 'COND-01',
            conditionDisplayName: 'Acute Appendicitis',
            tier: DifferentialMatchTier.strongMatch,
            action: DoctorCandidateAction.acceptedAsPrimary,
          ),
          'COND-02': const DoctorCandidateDecision(
            conditionCode: 'COND-02',
            conditionDisplayName: 'Mesenteric Lymphadenitis',
            tier: DifferentialMatchTier.possibleMatch,
            action: DoctorCandidateAction.acceptedAsDifferential,
          ),
        },
      );

      final formatted = ClinicalExtractionConsultationFormatter.format(
        extractionResult: sampleExtractionResult,
        findingDecisions: {
          'finding-1': FindingReviewDecision.fromFinding(sampleFinding),
        },
        assessmentInclusions: {},
        unmappedInclusions: {},
        differentialResult: sampleDifferentialResult,
      );

      expect(formatted.formattedSymptoms, contains('Abdominal Pain: PRESENT'));
      expect(formatted.formattedDiagnosis,
          'Acute Appendicitis (Differential: Mesenteric Lymphadenitis)');
      expect(formatted.differentialResult, isNotNull);
      expect(formatted.differentialResult!.primaryDiagnosis?.conditionDisplayName,
          'Acute Appendicitis');
    });
  });

  group('Workflow B Integration Tests (Manual Entry -> Differential Diagnosis Format)', () {
    test('DoctorDifferentialReviewResult generates clean consultation diagnosis text',
        () {
      // 1. Primary + Differential
      final withPrimaryAndDiff = DoctorDifferentialReviewResult(
        decisions: {
          'COND-01': const DoctorCandidateDecision(
            conditionCode: 'COND-01',
            conditionDisplayName: 'Community Acquired Pneumonia',
            tier: DifferentialMatchTier.strongMatch,
            action: DoctorCandidateAction.acceptedAsPrimary,
          ),
          'COND-02': const DoctorCandidateDecision(
            conditionCode: 'COND-02',
            conditionDisplayName: 'Acute Bronchitis',
            tier: DifferentialMatchTier.moderateMatch,
            action: DoctorCandidateAction.acceptedAsDifferential,
          ),
        },
      );

      expect(
        withPrimaryAndDiff.formatForConsultationDiagnosis(),
        'Community Acquired Pneumonia (Differential: Acute Bronchitis)',
      );

      // 2. Differential Only
      final diffOnly = DoctorDifferentialReviewResult(
        decisions: {
          'COND-03': const DoctorCandidateDecision(
            conditionCode: 'COND-03',
            conditionDisplayName: 'Viral Gastroenteritis',
            tier: DifferentialMatchTier.possibleMatch,
            action: DoctorCandidateAction.acceptedAsDifferential,
          ),
        },
      );

      expect(
        diffOnly.formatForConsultationDiagnosis(),
        'Differential: Viral Gastroenteritis',
      );

      // 3. Rejected or Deferred only: returns empty string so no unwanted diagnosis is forced
      final noneAccepted = DoctorDifferentialReviewResult(
        decisions: {
          'COND-04': const DoctorCandidateDecision(
            conditionCode: 'COND-04',
            conditionDisplayName: 'Unconfirmed Syndrome',
            tier: DifferentialMatchTier.contradicted,
            action: DoctorCandidateAction.rejected,
          ),
          'COND-05': const DoctorCandidateDecision(
            conditionCode: 'COND-05',
            conditionDisplayName: 'Rare Condition',
            tier: DifferentialMatchTier.unmatched,
            action: DoctorCandidateAction.deferredForInvestigation,
          ),
        },
      );

      expect(noneAccepted.formatForConsultationDiagnosis(), '');
      expect(noneAccepted.hasSelections, isFalse);
    });
  });
}
