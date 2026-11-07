import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
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

  group('Consultation Voice Removal & Manual Workflow Verification', () {
    testWidgets('confirms voice recording UI and mic buttons are completely removed from consultation create', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      expect(find.text('Start Consultation'), findsOneWidget);
      expect(find.text('Symptoms / History of Present Illness'), findsOneWidget);
      expect(find.text('Physical Examination Findings'), findsOneWidget);
      expect(find.text('Clinical Diagnosis / Impression'), findsOneWidget);

      // Verify Voice Symptoms icon button and tooltip do NOT exist
      expect(find.byIcon(Icons.mic_rounded), findsNothing);
      expect(find.byTooltip('Capture Voice Symptoms'), findsNothing);
    });

    testWidgets('supports direct manual entry for symptoms, examination, and diagnosis without voice dependency', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      // Enter manual clinical symptoms
      final symptomsFinder = find.widgetWithText(TextFormField, 'Symptoms / History of Present Illness');
      expect(symptomsFinder, findsOneWidget);
      await tester.enterText(symptomsFinder, 'Patient presents with mild fever and sore throat.');
      await tester.pumpAndSettle();

      // Enter manual physical examination findings
      final examFinder = find.widgetWithText(TextFormField, 'Physical Examination Findings');
      expect(examFinder, findsOneWidget);
      await tester.enterText(examFinder, 'Throat hyperemic, tonsils enlarged.');
      await tester.pumpAndSettle();

      // Enter manual clinical diagnosis
      final diagFinder = find.widgetWithText(TextFormField, 'Clinical Diagnosis / Impression');
      expect(diagFinder, findsOneWidget);
      await tester.enterText(diagFinder, 'Acute Pharyngitis');
      await tester.pumpAndSettle();

      expect(find.text('Patient presents with mild fever and sore throat.'), findsOneWidget);
      expect(find.text('Throat hyperemic, tonsils enlarged.'), findsOneWidget);
      expect(find.text('Acute Pharyngitis'), findsOneWidget);
    });
  });
}
