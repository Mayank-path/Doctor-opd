import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/doctor_extraction_review.dart';
import 'package:doctor_opd_mobile/features/consultations/services/consultations_service.dart';
import 'package:doctor_opd_mobile/features/consultations/ui/consultation_create_screen.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';

class MockConsultationsService extends Mock implements ConsultationsService {}
class MockSecureStorageService extends Mock implements SecureStorageService {}
class MockPatientsService extends Mock implements PatientsService {}

void main() {
  late MockConsultationsService mockConsultationsService;
  late MockSecureStorageService mockStorageService;
  late MockPatientsService mockPatientsService;

  const testDoctor = AuthUser(
    id: 'doc-1',
    email: 'doctor@opd.local',
    fullName: 'Dr. Ramesh Sharma',
    role: 'DOCTOR',
  );

  final samplePatient = Patient(
    id: 'p-1',
    clinicId: 'c-1',
    uhid: 'UHID-1001',
    fullName: 'Rajesh Sharma',
    gender: 'MALE',
    dateOfBirth: '1980-01-01',
    phone: '+919876543210',
    isActive: true,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  setUp(() {
    mockConsultationsService = MockConsultationsService();
    mockStorageService = MockSecureStorageService();
    mockPatientsService = MockPatientsService();

    when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctor);
  });

  Widget createWidget() {
    return MaterialApp(
      home: ConsultationCreateScreen(
        patientId: samplePatient.id,
        patientName: samplePatient.fullName,
        patientUhid: samplePatient.uhid,
        patientGender: samplePatient.gender,
        patientAge: 45,
        consultationsService: mockConsultationsService,
        storageService: mockStorageService,
        patientsService: mockPatientsService,
      ),
    );
  }

  group('Structured Clinical Extraction to Consultation Integration Tests', () {
    testWidgets('populates symptoms and examination controllers from structured formatting result', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      expect(find.text('Start Consultation'), findsOneWidget);
      expect(find.text('Symptoms / History of Present Illness'), findsOneWidget);
      expect(find.text('Physical Examination Findings'), findsOneWidget);

      // Verify Voice Symptoms icon button exists
      final micButton = find.byIcon(Icons.mic_rounded);
      expect(micButton, findsOneWidget);
    });

    testWidgets('applies structured formatting result safely with category separation and draft preservation', (tester) async {
      const formattingResult = ClinicalExtractionFormattingResult(
        formattedSymptoms: '[Reported Symptoms]\n• Fever: PRESENT (SEVERE)\n• Throat Pain: PRESENT',
        formattedExamination: '[Examinations & Procedures Omitted / Deferred]\n• Chest Examination: NOT PERFORMED (Reason: Not done)',
        includedFindingsCount: 2,
        excludedFindingsCount: 0,
        includedAssessmentsCount: 1,
        includedUnmappedCount: 0,
      );

      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      final state = tester.state<ConsultationCreateScreenState>(find.byType(ConsultationCreateScreen));

      state.applyStructuredExtractionForTest(formattingResult);
      await tester.pumpAndSettle();

      expect(find.textContaining('Fever: PRESENT (SEVERE)'), findsOneWidget);
      expect(find.textContaining('Chest Examination: NOT PERFORMED'), findsOneWidget);
      expect(find.text('Structured findings inserted into consultation draft'), findsOneWidget);

      // Duplicate insertion check: calling again should not duplicate identical text
      state.applyStructuredExtractionForTest(formattingResult);
      await tester.pumpAndSettle();

      // Only one occurrence of the block
      expect(find.textContaining('Fever: PRESENT (SEVERE)'), findsOneWidget);
    });
  });
}
