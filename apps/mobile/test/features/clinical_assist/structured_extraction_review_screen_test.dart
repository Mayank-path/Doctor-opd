import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/doctor_extraction_review.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/screens/structured_extraction_review_screen.dart';

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

  const sampleSourceText = 'Mareez ko do din se tez bukhar hai. Chest examination not done.';

  final sampleFinding = StructuredClinicalFinding(
    id: 'finding-1',
    canonicalTermId: 'fever',
    canonicalDisplayName: 'Fever',
    originalExpression: 'tez bukhar',
    conceptCategory: ExtractedConceptCategory.symptom,
    status: ClinicalFindingStatus.present,
    certainty: 'EXPLICIT',
    bodyLocation: const ClinicalBodyLocation(name: 'Systemic', isDefault: false),
    severityAssessment: const ClinicalSeverityAssessment(
      state: SeverityAssessmentState.assessed,
      level: SymptomSeverityLevel.severe,
      evidence: EvidenceSpan(startIndex: 20, endIndex: 23, text: 'tez'),
    ),
    temporalStatements: const [
      ClinicalTemporalStatement(
        statementId: 'stmt-1',
        temporalAnchor: 'CURRENT',
        status: ClinicalFindingStatus.present,
        evidence: EvidenceSpan(startIndex: 20, endIndex: 30, text: 'tez bukhar'),
      ),
    ],
    chronologicalRelationships: const [],
    provenance: const [
      ClinicalProvenance(
        ruleId: 'RULE-01',
        ruleDescription: 'Primary mapping',
        engineVersion: '5B.1',
        evidence: EvidenceSpan(startIndex: 20, endIndex: 30, text: 'tez bukhar'),
      ),
    ],
    validationWarnings: const [],
  );

  final sampleAssessment = const ClinicalAssessmentRecord(
    id: 'assess-1',
    assessmentScope: 'SYSTEM_EXAMINATION',
    targetSystemOrExam: 'Chest Examination',
    status: ClinicalAssessmentStatus.notAssessed,
    reason: 'Not performed during this encounter',
    evidence: EvidenceSpan(
      startIndex: 37,
      endIndex: 63,
      text: 'Chest examination not done',
    ),
    provenance: [],
  );

  final sampleExtraction = StructuredClinicalExtractionResult(
    schemaVersion: '5B.1',
    extractionEngineVersion: '1.0.0',
    normalizationEngineVersion: '5A.1',
    source: ExtractionSource(
      originalDoctorConfirmedText: sampleSourceText,
      detectedLanguage: 'HINGLISH',
      characterCount: sampleSourceText.length,
    ),
    findings: [sampleFinding],
    clinicalAssessments: [sampleAssessment],
    unmappedExpressions: const [],
    summaryCounts: const StructuredExtractionSummaryCounts(
      totalFindings: 1,
      presentCount: 1,
      absentCount: 0,
      uncertainCount: 0,
      unknownCount: 0,
      unmappedCount: 0,
      clinicalAssessmentsCount: 1,
    ),
    review: const ClinicalReviewMetadata(
      requiresDoctorReview: true,
      reviewStatus: 'PENDING_REVIEW',
      systemSafetyNotice: 'Clinical finding extraction requires physician verification.',
    ),
  );

  Widget createWidget({
    void Function(ClinicalExtractionFormattingResult?)? onPopped,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              final result = await Navigator.of(context).push<ClinicalExtractionFormattingResult?>(
                MaterialPageRoute(
                  builder: (context) => StructuredExtractionReviewScreen(
                    patient: samplePatient,
                    extractionResult: sampleExtraction,
                    sourceTranscript: sampleSourceText,
                  ),
                ),
              );
              onPopped?.call(result);
            },
            child: const Text('Open Review Screen'),
          ),
        ),
      ),
    );
  }

  group('StructuredExtractionReviewScreen Widget Tests', () {
    testWidgets('renders patient demographics, summary badges, findings, and assessments', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Review Screen'));
      await tester.pumpAndSettle();

      expect(find.text('Review Clinical Findings'), findsOneWidget);
      expect(find.text('Rajesh Sharma'), findsOneWidget);
      expect(find.textContaining('UHID: UHID-000042'), findsOneWidget);
      expect(find.text('CONSENT OK'), findsOneWidget);

      expect(find.text('Confirmed Source Transcript'), findsOneWidget);
      expect(find.textContaining('${sampleSourceText.length} chars'), findsOneWidget);

      // Summary Badges
      expect(find.text('Total: '), findsOneWidget);
      expect(find.text('Present: '), findsOneWidget);
      expect(find.text('Assessments: '), findsOneWidget);

      // Finding Card
      expect(find.text('Fever'), findsOneWidget);
      expect(find.text('PRESENT'), findsOneWidget);

      // Assessment Section
      expect(find.text('Chest Examination'), findsOneWidget);
      expect(find.text('NOT_ASSESSED'), findsOneWidget);
    });

    testWidgets('overriding status updates the summary badge counts', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Review Screen'));
      await tester.pumpAndSettle();

      // Tap 'Absent' status chip to override Fever
      await tester.tap(find.text('Absent'));
      await tester.pumpAndSettle();

      // Absent badge should now be 1
      expect(find.text('Absent: '), findsOneWidget);
      expect(find.text('1'), findsWidgets);
    });

    testWidgets('tapping Insert into Consultation shows preview and returns formatting result on confirm', (tester) async {
      ClinicalExtractionFormattingResult? returnedResult;

      await tester.pumpWidget(createWidget(
        onPopped: (res) => returnedResult = res,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Review Screen'));
      await tester.pumpAndSettle();

      // Scroll down and tap 'Insert into Consultation' CTA
      final insertBtn = find.text('Insert into Consultation');
      await tester.ensureVisible(insertBtn);
      await tester.pumpAndSettle();
      await tester.tap(insertBtn);
      await tester.pumpAndSettle();

      // Verify insertion preview confirmation dialog
      expect(find.text('Confirm Insertion'), findsOneWidget);
      expect(find.text('SYMPTOMS & HISTORY:'), findsOneWidget);
      expect(find.text('EXAMINATION & ASSESSMENTS:'), findsOneWidget);
      expect(find.textContaining('Fever: PRESENT'), findsOneWidget);
      expect(find.textContaining('Chest Examination: NOT PERFORMED'), findsOneWidget);

      // Confirm dialog
      await tester.tap(find.widgetWithText(ElevatedButton, 'Confirm & Insert'));
      await tester.pumpAndSettle();

      expect(returnedResult, isNotNull);
      expect(returnedResult!.formattedSymptoms, contains('Fever: PRESENT'));
      expect(returnedResult!.formattedExamination, contains('Chest Examination: NOT PERFORMED'));
      expect(returnedResult!.includedFindingsCount, 1);
      expect(returnedResult!.includedAssessmentsCount, 1);
    });

    testWidgets('tapping Discard Structured Extraction confirms and returns null', (tester) async {
      ClinicalExtractionFormattingResult? returnedResult = const ClinicalExtractionFormattingResult(
        formattedSymptoms: 'initial',
        formattedExamination: 'initial',
        includedFindingsCount: 1,
        excludedFindingsCount: 0,
        includedAssessmentsCount: 0,
        includedUnmappedCount: 0,
      );

      await tester.pumpWidget(createWidget(
        onPopped: (res) => returnedResult = res,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Review Screen'));
      await tester.pumpAndSettle();

      // Scroll down and tap Discard Structured Extraction
      final discardBtn = find.text('Discard Structured Extraction');
      await tester.ensureVisible(discardBtn);
      await tester.pumpAndSettle();
      await tester.tap(discardBtn);
      await tester.pumpAndSettle();

      expect(find.text('Discard Structured Extraction?'), findsOneWidget);

      // Confirm Discard
      await tester.tap(find.widgetWithText(ElevatedButton, 'Discard'));
      await tester.pumpAndSettle();

      expect(returnedResult, isNull);
    });
  });
}
