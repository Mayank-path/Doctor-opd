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

class MockConsultationsService extends Mock implements ConsultationsService {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

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
