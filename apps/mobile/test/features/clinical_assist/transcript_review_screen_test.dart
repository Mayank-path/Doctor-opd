import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/transcription_response.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/screens/transcript_review_screen.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/services/clinical_assist_service.dart';

class MockClinicalAssistService extends Mock implements ClinicalAssistService {}

void main() {
  late MockClinicalAssistService mockClinicalAssistService;

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

  const sampleResponse = TranscriptionResponse(
    transcript: 'Mareez ko do din se tez bukhar aur gale me dard hai.',
    languageHint: 'hi-IN',
    detectedLanguage: 'hi',
    durationSeconds: 4.8,
    provider: 'openai',
    model: 'gpt-4o-transcribe',
  );

  setUp(() {
    mockClinicalAssistService = MockClinicalAssistService();
  });

  Widget createTestWidget({ClinicalAssistService? service}) {
    return MaterialApp(
      home: TranscriptReviewScreen(
        patient: samplePatient,
        response: sampleResponse,
        clinicalAssistService: service ?? mockClinicalAssistService,
      ),
    );
  }

  group('TranscriptReviewScreen Tests', () {
    testWidgets('renders patient identity, metadata chips, and raw transcript', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Review Transcript'), findsOneWidget);
      expect(find.text('Rajesh Sharma'), findsOneWidget);
      expect(find.textContaining('UHID: UHID-000042'), findsOneWidget);
      expect(find.text('CONSENT VERIFIED'), findsOneWidget);

      expect(find.text('Detected: hi'), findsOneWidget);
      expect(find.text('Hint: hi-IN'), findsOneWidget);
      expect(find.text('4.8s audio'), findsOneWidget);
      expect(find.text('openai (gpt-4o-transcribe)'), findsOneWidget);

      expect(find.text('Mareez ko do din se tez bukhar aur gale me dard hai.'), findsOneWidget);
      expect(find.text('Extract Clinical Findings'), findsOneWidget);
      expect(find.text('Confirm Final Transcript (Plain Text)'), findsOneWidget);
    });

    testWidgets('allows editing the transcript and restores raw text via Reset', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final textField = find.byType(TextField);
      expect(textField, findsOneWidget);

      // Edit text
      await tester.enterText(textField, 'Updated clinical symptom text by clinician');
      await tester.pumpAndSettle();

      expect(find.text('Updated clinical symptom text by clinician'), findsOneWidget);
      expect(find.text('Reset to Raw'), findsOneWidget);

      // Tap Reset to Raw
      await tester.tap(find.text('Reset to Raw'));
      await tester.pumpAndSettle();

      expect(find.text('Mareez ko do din se tez bukhar aur gale me dard hai.'), findsOneWidget);
    });

    testWidgets('shows warning snackbar when attempting to confirm an empty transcript', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final textField = find.byType(TextField);
      await tester.enterText(textField, '   '); // Empty whitespace
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Confirm Final Transcript (Plain Text)'));
      await tester.tap(find.text('Confirm Final Transcript (Plain Text)'));
      await tester.pumpAndSettle();

      expect(find.text('Transcript cannot be empty. Please enter or speak symptoms.'), findsOneWidget);
    });

    testWidgets('confirms final transcript through explicit confirmation dialog (plain text fallback)', (tester) async {
      dynamic returnedResult;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                returnedResult = await Navigator.of(context).push<dynamic>(
                  MaterialPageRoute(
                    builder: (context) => TranscriptReviewScreen(
                      patient: samplePatient,
                      response: sampleResponse,
                      clinicalAssistService: mockClinicalAssistService,
                    ),
                  ),
                );
              },
              child: const Text('Open Review'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Open Review'));
      await tester.pumpAndSettle();

      // Edit text slightly
      await tester.enterText(
        find.byType(TextField),
        'Patient reports mild throat pain and fever.',
      );
      await tester.pumpAndSettle();

      // Tap Confirm Final Transcript (Plain Text)
      await tester.ensureVisible(find.text('Confirm Final Transcript (Plain Text)'));
      await tester.tap(find.text('Confirm Final Transcript (Plain Text)'));
      await tester.pumpAndSettle();

      expect(find.text('Confirm that you have reviewed and verified this transcript for clinical accuracy. This text will be returned to your consultation workflow.'), findsOneWidget);

      // Confirm dialog
      await tester.tap(find.widgetWithText(ElevatedButton, 'Confirm'));
      await tester.pumpAndSettle();

      expect(returnedResult, 'Patient reports mild throat pain and fever.');
    });

    testWidgets('extracts structured findings successfully and propagates result', (tester) async {
      final sampleExtraction = StructuredClinicalExtractionResult(
        schemaVersion: '5B.1',
        extractionEngineVersion: '1.0.0',
        normalizationEngineVersion: '5A.1',
        source: const ExtractionSource(
          originalDoctorConfirmedText: 'Mareez ko do din se tez bukhar aur gale me dard hai.',
          detectedLanguage: 'HINGLISH',
          characterCount: 52,
        ),
        findings: const [],
        clinicalAssessments: const [],
        unmappedExpressions: const [],
        summaryCounts: const StructuredExtractionSummaryCounts(
          totalFindings: 0,
          presentCount: 0,
          absentCount: 0,
          uncertainCount: 0,
          unknownCount: 0,
          unmappedCount: 0,
          clinicalAssessmentsCount: 0,
        ),
        review: const ClinicalReviewMetadata(
          requiresDoctorReview: true,
          reviewStatus: 'PENDING_REVIEW',
          systemSafetyNotice: 'Clinical finding extraction requires physician verification.',
        ),
      );

      when(() => mockClinicalAssistService.extractStructuredClinical(any()))
          .thenAnswer((_) async => sampleExtraction);

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                await Navigator.of(context).push<dynamic>(
                  MaterialPageRoute(
                    builder: (context) => TranscriptReviewScreen(
                      patient: samplePatient,
                      response: sampleResponse,
                      clinicalAssistService: mockClinicalAssistService,
                    ),
                  ),
                );
              },
              child: const Text('Open Review'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Open Review'));
      await tester.pumpAndSettle();

      // Tap 'Extract Clinical Findings' CTA
      await tester.ensureVisible(find.text('Extract Clinical Findings'));
      await tester.tap(find.text('Extract Clinical Findings'));
      await tester.pumpAndSettle();

      verify(() => mockClinicalAssistService.extractStructuredClinical(any())).called(1);

      // Should open StructuredExtractionReviewScreen
      expect(find.text('Review Clinical Findings'), findsOneWidget);
    });

    testWidgets('handles extraction API error safely without crashing and clears error on edit', (tester) async {
      when(() => mockClinicalAssistService.extractStructuredClinical(any()))
          .thenThrow(const ApiException(message: 'Extraction service unavailable', statusCode: 503));

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Tap Extract
      await tester.ensureVisible(find.text('Extract Clinical Findings'));
      await tester.tap(find.text('Extract Clinical Findings'));
      await tester.pumpAndSettle();

      // Verify error snackbar/banner
      expect(find.text('Extraction service unavailable'), findsWidgets);
      // Ensure transcript remains intact
      expect(find.text('Mareez ko do din se tez bukhar aur gale me dard hai.'), findsOneWidget);

      // Editing the text should clear the error banner
      final textField = find.byType(TextField);
      await tester.enterText(textField, 'New edits by doctor');
      await tester.pumpAndSettle();

      // Banner cleared
      expect(find.byIcon(Icons.error_outline_rounded), findsNothing);
    });

    testWidgets('discards transcript safely and pops with null', (tester) async {
      dynamic returnedResult = 'initial';

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                returnedResult = await Navigator.of(context).push<dynamic>(
                  MaterialPageRoute(
                    builder: (context) => TranscriptReviewScreen(
                      patient: samplePatient,
                      response: sampleResponse,
                      clinicalAssistService: mockClinicalAssistService,
                    ),
                  ),
                );
              },
              child: const Text('Open Review'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Open Review'));
      await tester.pumpAndSettle();

      // Tap Discard and Exit
      await tester.ensureVisible(find.text('Discard and Exit'));
      await tester.tap(find.text('Discard and Exit'));
      await tester.pumpAndSettle();

      expect(find.text('Discard Transcript?'), findsOneWidget);

      // Tap Discard in dialog
      await tester.tap(find.widgetWithText(ElevatedButton, 'Discard'));
      await tester.pumpAndSettle();

      expect(returnedResult, isNull);
    });
  });
}
