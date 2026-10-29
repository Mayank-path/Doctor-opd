import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/consultations/models/consultation.dart';
import 'package:doctor_opd_mobile/features/consultations/models/create_consultation_request.dart';
import 'package:doctor_opd_mobile/features/consultations/models/update_consultation_request.dart';
import 'package:doctor_opd_mobile/features/consultations/models/paginated_consultations_response.dart';
import 'package:doctor_opd_mobile/features/consultations/services/consultations_service.dart';
import 'package:doctor_opd_mobile/features/consultations/ui/components/consultation_finalize_dialog.dart';
import 'package:doctor_opd_mobile/features/consultations/ui/consultation_create_screen.dart';
import 'package:doctor_opd_mobile/features/consultations/ui/consultation_details_screen.dart';
import 'package:doctor_opd_mobile/features/consultations/ui/consultation_list_screen.dart';
import 'package:doctor_opd_mobile/features/patients/models/paginated_patients_response.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';

class MockConsultationsService extends Mock implements ConsultationsService {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

class MockPatientsService extends Mock implements PatientsService {}

class FakeCreateConsultationRequest extends Fake
    implements CreateConsultationRequest {}

class FakeUpdateConsultationRequest extends Fake
    implements UpdateConsultationRequest {}

void main() {
  setUpAll(() {
    registerFallbackValue(FakeCreateConsultationRequest());
    registerFallbackValue(FakeUpdateConsultationRequest());
  });

  late MockConsultationsService mockConsultationsService;
  late MockSecureStorageService mockStorageService;
  late MockPatientsService mockPatientsService;

  const validClinicId = '11111111-1111-1111-1111-111111111111';
  const validPatientId = '22222222-2222-2222-2222-222222222222';
  const validDoctorId = '33333333-3333-3333-3333-333333333333';
  const validConsultationId = '44444444-4444-4444-4444-444444444444';

  const testDoctorUser = AuthUser(
    id: validDoctorId,
    email: 'dr.sharma@opd.local',
    fullName: 'Dr. Ramesh Sharma',
    role: 'DOCTOR',
  );

  const testAdminUser = AuthUser(
    id: 'admin-user-1',
    email: 'admin@opd.local',
    fullName: 'Admin User',
    role: 'ADMIN',
  );

  final testDraftConsultation = Consultation(
    id: validConsultationId,
    clinicId: validClinicId,
    patientId: validPatientId,
    clinicianId: validDoctorId,
    encounterDate: '2026-10-26T10:00:00.000Z',
    chiefComplaint: 'Acute chest pain with sweating',
    symptoms: 'Substernal pressure radiating to left arm',
    examination: 'Pulse 96 bpm, BP 140/90, pale diaphoresis',
    diagnosis: 'Suspected Angina / NSTEMI',
    treatmentPlan: 'ECG immediately, Aspirin 300mg chewable, Sublingual NTG',
    followUpDate: '2026-10-27',
    status: ConsultationStatus.draft,
    bpSystolic: 140,
    bpDiastolic: 90,
    pulse: 96,
    temperature: 98.4,
    weightKg: 80.0,
    heightCm: 175.0,
    spo2: 96,
    respiratoryRate: 20,
    finalizedAt: null,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:05:00.000Z',
    patient: const ConsultationPatientSummary(
      id: validPatientId,
      uhid: 'UHID-2026-009',
      fullName: 'Vikram Malhotra',
      gender: 'Male',
      dateOfBirth: '1975-04-12',
    ),
  );

  final testFinalizedConsultation = Consultation(
    id: validConsultationId,
    clinicId: validClinicId,
    patientId: validPatientId,
    clinicianId: validDoctorId,
    encounterDate: '2026-10-26T10:00:00.000Z',
    chiefComplaint: 'Acute chest pain with sweating',
    symptoms: 'Substernal pressure radiating to left arm',
    examination: 'Pulse 96 bpm, BP 140/90',
    diagnosis: 'Angina Pectoris (Stable)',
    treatmentPlan: 'Cardiology referral, Nitrates SOS',
    followUpDate: '2026-10-28',
    status: ConsultationStatus.finalized,
    bpSystolic: 140,
    bpDiastolic: 90,
    pulse: 96,
    temperature: 98.4,
    weightKg: 80.0,
    heightCm: 175.0,
    spo2: 96,
    respiratoryRate: 20,
    finalizedAt: '2026-10-26T10:30:00.000Z',
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:30:00.000Z',
    patient: const ConsultationPatientSummary(
      id: validPatientId,
      uhid: 'UHID-2026-009',
      fullName: 'Vikram Malhotra',
      gender: 'Male',
      dateOfBirth: '1975-04-12',
    ),
  );

  setUp(() {
    mockConsultationsService = MockConsultationsService();
    mockStorageService = MockSecureStorageService();
    mockPatientsService = MockPatientsService();
  });

  group('ConsultationListScreen Widget Tests', () {
    testWidgets('shows Access Restricted shield when non-doctor (ADMIN) opens screen', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testAdminUser);

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationListScreen(
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(
        find.textContaining('Consultation records contain sensitive clinical narratives'),
        findsOneWidget,
      );
      // Verify zero clinical consultation records are loaded or leaked
      verifyNever(() => mockConsultationsService.getConsultations(
            status: any(named: 'status'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          ));
    });

    testWidgets('loads and renders consultations for authorized DOCTOR user', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);
      when(() => mockConsultationsService.getConsultations(
            status: any(named: 'status'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer(
        (_) async => PaginatedConsultationsResponse(
          data: [testDraftConsultation],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationListScreen(
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Consultations'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Drafts'), findsOneWidget);
      expect(find.text('Finalized'), findsOneWidget);

      expect(find.text('Vikram Malhotra'), findsOneWidget);
      expect(find.text('UHID: UHID-2026-009'), findsOneWidget);
      expect(find.text('DRAFT'), findsOneWidget);
      expect(find.text('Acute chest pain with sweating'), findsOneWidget);
    });

    testWidgets('displays empty state when no consultations exist', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);
      when(() => mockConsultationsService.getConsultations(
            status: any(named: 'status'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer(
        (_) async => const PaginatedConsultationsResponse(
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationListScreen(
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No Consultations Found'), findsOneWidget);
    });
  });

  group('ConsultationCreateScreen Widget Tests', () {
    testWidgets('blocks non-doctor user with Doctor Role Required shield', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testAdminUser);

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationCreateScreen(
            patientId: validPatientId,
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Doctor Role Required'), findsOneWidget);
      expect(find.text('Go Back'), findsOneWidget);
      verifyNever(() => mockConsultationsService.createDraft(any()));
    });

    testWidgets('renders clinical create draft form and validates required fields for DOCTOR', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationCreateScreen(
            patientId: validPatientId,
            patientName: 'Vikram Malhotra',
            patientUhid: 'UHID-2026-009',
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Start Consultation'), findsOneWidget);
      expect(find.text('Vikram Malhotra'), findsOneWidget);
      expect(find.text('UHID: UHID-2026-009'), findsOneWidget);
      expect(find.text('Chief Complaint'), findsOneWidget);

      // Attempt submit without filling chief complaint
      await tester.tap(find.text('Create Draft'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Chief complaint is required'), findsOneWidget);
      verifyNever(() => mockConsultationsService.createDraft(any()));
    });

    testWidgets('when no patient is pre-selected, displays searchable patient selector and blocks submission if no patient is selected', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationCreateScreen(
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Start Consultation'), findsOneWidget);
      expect(find.byKey(const Key('patientSearchInput')), findsOneWidget);
      expect(find.text('Patient UUID *'), findsNothing); // Manual UUID input is eliminated!

      // Fill chief complaint but leave patient unselected
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Primary reason for visit (e.g. Acute high fever with cough for 3 days)...'),
        'Severe persistent migraine',
      );

      await tester.tap(find.text('Create Draft'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Please search and select a patient'), findsOneWidget);
      verifyNever(() => mockConsultationsService.createDraft(any()));
    });

    testWidgets('searching patient by UHID, selecting patient, filling chief complaint submits real UUID and not UHID', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);

      const targetPatientUuid = '55555555-5555-5555-5555-555555555555';
      final searchedPatient = Patient(
        id: targetPatientUuid,
        clinicId: validClinicId,
        uhid: 'UHID-000042',
        fullName: 'Meera Deshmukh',
        gender: 'FEMALE',
        dateOfBirth: '1995-08-12',
        phone: '+919876500000',
        isActive: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'UHID-000042',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [searchedPatient],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      when(() => mockConsultationsService.createDraft(any())).thenAnswer(
        (_) async => testDraftConsultation,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationCreateScreen(
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Search by UHID
      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'UHID-000042');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      // Verify search result appears
      expect(find.text('Meera Deshmukh'), findsOneWidget);
      expect(find.byKey(Key('patientResult_$targetPatientUuid')), findsOneWidget);

      // Select patient
      await tester.tap(find.byKey(Key('patientResult_$targetPatientUuid')));
      await tester.pumpAndSettle();

      // Patient card rendered, UUID is hidden from UI
      expect(find.text('Meera Deshmukh'), findsOneWidget);
      expect(find.text('UHID: UHID-000042'), findsOneWidget);
      expect(find.text(targetPatientUuid), findsNothing);

      // Enter chief complaint
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Primary reason for visit (e.g. Acute high fever with cough for 3 days)...'),
        'Acute viral bronchitis with chest discomfort',
      );

      // Submit form
      await tester.tap(find.text('Create Draft'));
      await tester.pumpAndSettle();

      // Verify createDraft was called with the actual UUID and NOT the UHID!
      final captured = verify(() => mockConsultationsService.createDraft(captureAny())).captured;
      expect(captured.length, equals(1));
      final request = captured.first as CreateConsultationRequest;

      expect(request.patientId, equals(targetPatientUuid));
      expect(request.patientId, isNot(equals('UHID-000042'))); // UHID must never be submitted!
      expect(request.chiefComplaint, equals('Acute viral bronchitis with chest discomfort'));
    });

    testWidgets('changing selected patient updates the real UUID submitted to createDraft', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);

      const patient1Uuid = '11111111-1111-1111-1111-111111111111';
      const patient2Uuid = '22222222-2222-2222-2222-222222222222';

      final patient1 = Patient(
        id: patient1Uuid,
        clinicId: validClinicId,
        uhid: 'UHID-000001',
        fullName: 'First Patient',
        gender: 'MALE',
        phone: '+919876543210',
        isActive: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final patient2 = Patient(
        id: patient2Uuid,
        clinicId: validClinicId,
        uhid: 'UHID-000002',
        fullName: 'Second Patient',
        gender: 'FEMALE',
        phone: '+919876543211',
        isActive: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'First',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [patient1],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'Second',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [patient2],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      when(() => mockConsultationsService.createDraft(any())).thenAnswer(
        (_) async => testDraftConsultation,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationCreateScreen(
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Search & select first patient
      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'First');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(Key('patientResult_$patient1Uuid')));
      await tester.pumpAndSettle();

      expect(find.text('First Patient'), findsOneWidget);

      // Change patient
      await tester.tap(find.byKey(const Key('changePatientButton')));
      await tester.pumpAndSettle();

      // Search & select second patient
      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'Second');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(Key('patientResult_$patient2Uuid')));
      await tester.pumpAndSettle();

      expect(find.text('Second Patient'), findsOneWidget);

      // Enter chief complaint & submit
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Primary reason for visit (e.g. Acute high fever with cough for 3 days)...'),
        'Follow-up review consultation',
      );
      await tester.tap(find.text('Create Draft'));
      await tester.pumpAndSettle();

      final captured = verify(() => mockConsultationsService.createDraft(captureAny())).captured;
      final request = captured.first as CreateConsultationRequest;
      expect(request.patientId, equals(patient2Uuid)); // Updated to second patient's UUID!
    });
  });

  group('ConsultationDetailsScreen Widget Tests', () {
    testWidgets('displays draft in editable mode with Save and Finalize actions for assigned clinician', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);
      when(() => mockConsultationsService.getConsultationById(validConsultationId)).thenAnswer(
        (_) async => testDraftConsultation,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationDetailsScreen(
            consultationId: validConsultationId,
            initialConsultation: testDraftConsultation,
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Consultation Note'), findsOneWidget);
      expect(find.text('Draft'), findsOneWidget);
      expect(find.byKey(const Key('saveDraftButton')), findsOneWidget);
      expect(find.byKey(const Key('finalizeConsultationButton')), findsOneWidget);

      expect(find.text('Vikram Malhotra'), findsOneWidget);
      expect(find.text('UHID: UHID-2026-009 • Male • 51 yrs'), findsOneWidget);
    });

    testWidgets('displays draft in editable mode with Save and Finalize actions for assigned clinician when user role is not yet populated in storage', (tester) async {
      const userWithoutRole = AuthUser(
        id: validDoctorId,
        email: 'dr.sharma@opd.local',
        fullName: 'Dr. Ramesh Sharma',
        role: null,
      );
      when(() => mockStorageService.getUser()).thenAnswer((_) async => userWithoutRole);
      when(() => mockConsultationsService.getConsultationById(validConsultationId)).thenAnswer(
        (_) async => testDraftConsultation,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationDetailsScreen(
            consultationId: validConsultationId,
            initialConsultation: testDraftConsultation,
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Consultation Note'), findsOneWidget);
      expect(find.text('Draft'), findsOneWidget);
      expect(find.byKey(const Key('saveDraftButton')), findsOneWidget);
      expect(find.byKey(const Key('finalizeConsultationButton')), findsOneWidget);
      expect(find.text('Vikram Malhotra'), findsOneWidget);
    });

    testWidgets('displays finalized consultation strictly read-only with no edit/finalize controls', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);
      when(() => mockConsultationsService.getConsultationById(validConsultationId)).thenAnswer(
        (_) async => testFinalizedConsultation,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationDetailsScreen(
            consultationId: validConsultationId,
            initialConsultation: testFinalizedConsultation,
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Finalized Consultation'), findsOneWidget);
      expect(find.text('Finalized'), findsOneWidget);
      expect(find.text('FINALIZED RECORD (IMMUTABLE)'), findsOneWidget);

      // Assert no edit or finalize action buttons are exposed
      expect(find.byKey(const Key('saveDraftButton')), findsNothing);
      expect(find.byKey(const Key('finalizeConsultationButton')), findsNothing);
    });

    testWidgets('safely handles HTTP 403 Forbidden without leaking clinical narratives', (tester) async {
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testDoctorUser);
      when(() => mockConsultationsService.getConsultationById(validConsultationId)).thenThrow(
        ApiException(
          message: 'Clinical record access restricted',
          statusCode: 403,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationDetailsScreen(
            consultationId: validConsultationId,
            consultationsService: mockConsultationsService,
            storageService: mockStorageService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(
        find.textContaining('Clinical consultation records are restricted to authorized Doctor memberships'),
        findsOneWidget,
      );
      // Sensitive clinical narratives must NOT be visible
      expect(find.text('Acute chest pain with sweating'), findsNothing);
      expect(find.text('Suspected Angina / NSTEMI'), findsNothing);
    });
  });

  group('ConsultationFinalizeDialog Tests', () {
    testWidgets('displays immutability warning and triggers finalize on confirmation', (tester) async {
      when(() => mockConsultationsService.finalize(validConsultationId)).thenAnswer(
        (_) async => testFinalizedConsultation,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ConsultationFinalizeDialog(
              consultation: testDraftConsultation,
              consultationsService: mockConsultationsService,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Finalize Consultation'), findsOneWidget);
      expect(find.textContaining('Are you ready to lock and finalize the consultation'), findsOneWidget);
      expect(find.text('Keep Editing'), findsOneWidget);
      expect(find.text('Confirm Finalize'), findsOneWidget);

      // Tap Finalize
      await tester.tap(find.byKey(const Key('confirmFinalizeButton')));
      await tester.pumpAndSettle();

      verify(() => mockConsultationsService.finalize(validConsultationId)).called(1);
    });
  });
}
