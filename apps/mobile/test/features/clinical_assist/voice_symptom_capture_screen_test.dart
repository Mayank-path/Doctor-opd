import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/transcription_response.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/screens/voice_symptom_capture_screen.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/services/audio_recording_service.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/services/clinical_assist_service.dart';

class MockPatientsService extends Mock implements PatientsService {}
class MockClinicalAssistService extends Mock implements ClinicalAssistService {}
class MockAudioRecordingService extends Mock implements AudioRecordingService {}

void main() {
  late MockPatientsService mockPatientsService;
  late MockClinicalAssistService mockClinicalAssistService;
  late MockAudioRecordingService mockAudioRecordingService;
  late Directory tempDir;
  late File sampleAudioFile;

  final samplePatient = Patient(
    id: 'p1111111-1111-1111-1111-111111111111',
    clinicId: 'c1111111-1111-1111-1111-111111111111',
    uhid: 'UHID-000042',
    fullName: 'Ananya Verma',
    gender: 'FEMALE',
    phone: '+919876543210',
    isActive: true,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  setUpAll(() {
    registerFallbackValue(samplePatient);
  });

  setUp(() {
    mockPatientsService = MockPatientsService();
    mockClinicalAssistService = MockClinicalAssistService();
    mockAudioRecordingService = MockAudioRecordingService();

    tempDir = Directory.systemTemp.createTempSync('capture_test_');
    sampleAudioFile = File('${tempDir.path}/recorded.m4a')
      ..writeAsStringSync('dummy audio bytes');

    // Default mocks
    when(() => mockAudioRecordingService.hasPermission()).thenAnswer((_) async => true);
    when(() => mockAudioRecordingService.startRecording(any())).thenAnswer((_) async {});
    when(() => mockAudioRecordingService.pauseRecording()).thenAnswer((_) async {});
    when(() => mockAudioRecordingService.resumeRecording()).thenAnswer((_) async {});
    when(() => mockAudioRecordingService.stopRecording()).thenAnswer((_) async => sampleAudioFile.path);
    when(() => mockAudioRecordingService.getAmplitudeNormalized()).thenAnswer((_) async => 0.5);
    when(() => mockAudioRecordingService.deleteAudioFile(any())).thenAnswer((_) async {});
    when(() => mockAudioRecordingService.dispose()).thenAnswer((_) async {});
    when(() => mockAudioRecordingService.stopPlayback()).thenAnswer((_) async {});
    when(() => mockAudioRecordingService.playAudio(any(), onComplete: any(named: 'onComplete')))
        .thenAnswer((_) async {});
  });

  tearDown(() {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  Future<void> pumpScreen(WidgetTester tester, {Patient? initialPatient}) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await tester.pumpWidget(
      MaterialApp(
        home: VoiceSymptomCaptureScreen(
          initialPatient: initialPatient,
          patientsService: mockPatientsService,
          clinicalAssistService: mockClinicalAssistService,
          audioRecordingService: mockAudioRecordingService,
          tempDirectoryProvider: () async => tempDir.path,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('VoiceSymptomCaptureScreen Widget Tests', () {
    testWidgets('requires patient selection before recording can begin', (tester) async {
      await pumpScreen(tester, initialPatient: null);

      expect(find.text('Voice Symptom Capture'), findsOneWidget);
      expect(find.text('Target Patient'), findsOneWidget);

      // Tap microphone without selecting patient
      await tester.tap(find.byIcon(Icons.mic_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Please select a registered patient before recording audio.'), findsOneWidget);
      verifyNever(() => mockAudioRecordingService.startRecording(any()));
    });

    testWidgets('shows error banner when microphone permission is denied', (tester) async {
      when(() => mockAudioRecordingService.hasPermission()).thenAnswer((_) async => false);

      await pumpScreen(tester, initialPatient: samplePatient);

      await tester.tap(find.byIcon(Icons.mic_rounded));
      await tester.pumpAndSettle();

      expect(find.textContaining('Microphone permission is required to record voice symptoms'), findsOneWidget);
      verifyNever(() => mockAudioRecordingService.startRecording(any()));
    });

    testWidgets('supports full recording lifecycle: start, pause, resume, stop, and playback', (tester) async {
      await pumpScreen(tester, initialPatient: samplePatient);

      // 1. Tap to Start Recording
      await tester.tap(find.byIcon(Icons.mic_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('RECORDING LIVE'), findsOneWidget);
      expect(find.text('Pause'), findsOneWidget);
      expect(find.text('Stop & Save'), findsOneWidget);
      verify(() => mockAudioRecordingService.startRecording(any())).called(1);

      // 2. Tap Pause
      await tester.tap(find.text('Pause'));
      await tester.pump();

      expect(find.text('RECORDING PAUSED'), findsOneWidget);
      expect(find.text('Resume'), findsOneWidget);
      verify(() => mockAudioRecordingService.pauseRecording()).called(1);

      // 3. Tap Resume
      await tester.tap(find.text('Resume'));
      await tester.pump();

      expect(find.text('RECORDING LIVE'), findsOneWidget);
      verify(() => mockAudioRecordingService.resumeRecording()).called(1);

      // 4. Tap Stop & Save
      await tester.tap(find.text('Stop & Save'));
      await tester.pump();
      await tester.pumpAndSettle();

      expect(find.text('RECORDING READY FOR REVIEW'), findsOneWidget);
      expect(find.text('Play Audio'), findsOneWidget);
      expect(find.text('Re-record'), findsOneWidget);
      expect(find.text('Upload & Transcribe Audio'), findsOneWidget);
      verify(() => mockAudioRecordingService.stopRecording()).called(1);

      // 5. Toggle Playback Preview
      await tester.tap(find.text('Play Audio'));
      await tester.pump();
      expect(find.text('Stop Preview'), findsOneWidget);
      verify(() => mockAudioRecordingService.playAudio(any(), onComplete: any(named: 'onComplete'))).called(1);

      await tester.tap(find.text('Stop Preview'));
      await tester.pump();
      expect(find.text('Play Audio'), findsOneWidget);
      verify(() => mockAudioRecordingService.stopPlayback()).called(1);
    });

    testWidgets('allows changing language hint chip selection', (tester) async {
      await pumpScreen(tester, initialPatient: samplePatient);

      expect(find.text('Auto-Detect'), findsOneWidget);
      expect(find.text('Hindi / Hinglish'), findsOneWidget);

      await tester.tap(find.text('Hindi / Hinglish'));
      await tester.pumpAndSettle();

      final chip = tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Hindi / Hinglish'));
      expect(chip.selected, true);
    });

    testWidgets('discards recorded audio safely and resets controls to idle', (tester) async {
      await pumpScreen(tester, initialPatient: samplePatient);

      // Start and Stop
      await tester.tap(find.byIcon(Icons.mic_rounded));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.text('Stop & Save'));
      await tester.pumpAndSettle();

      expect(find.text('Re-record'), findsOneWidget);

      // Tap Re-record (Discard)
      await tester.tap(find.text('Re-record'));
      await tester.pumpAndSettle();

      expect(find.text('TAP MIC TO RECORD SYMPTOMS'), findsOneWidget);
      expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
      verify(() => mockAudioRecordingService.deleteAudioFile(any())).called(1);
    });

    testWidgets('enforces patient consent confirmation before uploading audio', (tester) async {
      when(() => mockClinicalAssistService.transcribeAudio(
            audioPath: any(named: 'audioPath'),
            patientId: any(named: 'patientId'),
            patientConsentVerified: any(named: 'patientConsentVerified'),
            languageHint: any(named: 'languageHint'),
          )).thenAnswer((_) async => const TranscriptionResponse(
            transcript: 'Mareez ko tez bukhar hai.',
            provider: 'openai',
            model: 'gpt-4o-transcribe',
          ));

      await pumpScreen(tester, initialPatient: samplePatient);

      // Record audio
      await tester.tap(find.byIcon(Icons.mic_rounded));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.text('Stop & Save'));
      await tester.pumpAndSettle();

      // Tap Upload & Transcribe
      await tester.tap(find.text('Upload & Transcribe Audio'));
      await tester.pumpAndSettle();

      // Consent Dialog should appear
      expect(find.text('Patient Consent Required'), findsOneWidget);
      expect(find.text('Confirm & Proceed'), findsOneWidget);

      // Confirm consent
      await tester.tap(find.text('Confirm & Proceed'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Verify transcribe API was invoked with verified consent = true
      verify(() => mockClinicalAssistService.transcribeAudio(
            audioPath: any(named: 'audioPath'),
            patientId: samplePatient.id,
            patientConsentVerified: true,
            languageHint: any(named: 'languageHint'),
          )).called(1);

      // Should open TranscriptReviewScreen with the received transcript
      expect(find.text('Review Transcript'), findsOneWidget);
      expect(find.text('Mareez ko tez bukhar hai.'), findsOneWidget);
    });

    testWidgets('displays error banner when transcription API fails with ApiException', (tester) async {
      when(() => mockClinicalAssistService.transcribeAudio(
            audioPath: any(named: 'audioPath'),
            patientId: any(named: 'patientId'),
            patientConsentVerified: any(named: 'patientConsentVerified'),
            languageHint: any(named: 'languageHint'),
          )).thenThrow(const BadRequestException(message: 'Unsupported audio format from device.'));

      await pumpScreen(tester, initialPatient: samplePatient);

      // Record audio
      await tester.tap(find.byIcon(Icons.mic_rounded));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.text('Stop & Save'));
      await tester.pumpAndSettle();

      // Tap Upload & Transcribe
      await tester.tap(find.text('Upload & Transcribe Audio'));
      await tester.pumpAndSettle();

      // Confirm consent
      await tester.tap(find.text('Confirm & Proceed'));
      await tester.pumpAndSettle();

      // Should show the specific API error banner
      expect(find.text('Unsupported audio format from device.'), findsOneWidget);
    });
  });
}
