import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/clinic_dashboard_stats.dart';
import 'package:doctor_opd_mobile/features/dashboard/services/dashboard_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/ui/dashboard_screen.dart';
import 'package:doctor_opd_mobile/features/patients/models/create_patient_request.dart';
import 'package:doctor_opd_mobile/features/patients/models/paginated_patients_response.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient_consultation_summary.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';
import 'package:doctor_opd_mobile/features/patients/ui/patient_details_screen.dart';
import 'package:doctor_opd_mobile/features/patients/ui/patient_list_screen.dart';
import 'package:doctor_opd_mobile/features/patients/ui/patient_registration_screen.dart';

class MockAuthService extends Mock implements AuthService {}

class MockPatientsService extends Mock implements PatientsService {}

class MockDashboardService extends Mock implements DashboardService {}

void main() {
  late MockAuthService mockAuthService;
  late MockPatientsService mockPatientsService;

  const testUser = AuthUser(
    id: 'user-admin-1',
    email: 'admin@clinic.in',
    fullName: 'Dr. System Administrator',
    role: 'ADMIN',
  );

  final samplePatient = Patient(
    id: 'pat-1',
    clinicId: 'clinic-1',
    uhid: 'UHID-000001',
    fullName: 'Aarav Sharma',
    gender: 'MALE',
    dateOfBirth: '1990-05-15T00:00:00.000Z',
    phone: '+919876543210',
    email: 'aarav@health.in',
    city: 'Mumbai',
    isActive: true,
    createdAt: DateTime(2026, 10, 24),
    updatedAt: DateTime(2026, 10, 24),
  );

  setUpAll(() {
    registerFallbackValue(const CreatePatientRequest(
      fullName: 'Fallback',
      gender: 'MALE',
      phone: '+919876543210',
    ));
  });

  setUp(() {
    mockAuthService = MockAuthService();
    mockPatientsService = MockPatientsService();
    when(() => mockAuthService.currentUser).thenReturn(testUser);
  });

  group('PatientListScreen Widget Tests', () {
    testWidgets('renders patient list with name, UHID, and phone', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: any(named: 'page'),
            limit: any(named: 'limit'),
            query: any(named: 'query'),
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [samplePatient],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      await tester.pumpWidget(MaterialApp(
        home: PatientListScreen(
          authService: mockAuthService,
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Patient Directory'), findsOneWidget);
      expect(find.text('Aarav Sharma'), findsOneWidget);
      expect(find.text('UHID-000001'), findsOneWidget);
      expect(find.text('+919876543210'), findsOneWidget);
      expect(find.text('Register Patient'), findsOneWidget);
    });

    testWidgets('displays empty state when no patients are returned', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: any(named: 'page'),
            limit: any(named: 'limit'),
            query: any(named: 'query'),
          )).thenAnswer((_) async => PaginatedPatientsResponse.empty());

      await tester.pumpWidget(MaterialApp(
        home: PatientListScreen(
          authService: mockAuthService,
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('No patients registered in this clinic yet'), findsOneWidget);
      expect(find.text('Register New Patient'), findsOneWidget);
    });

    testWidgets('displays error banner and retry button on network failure', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: any(named: 'page'),
            limit: any(named: 'limit'),
            query: any(named: 'query'),
          )).thenThrow(const ApiException(message: 'Connection failed to server', statusCode: 503));

      await tester.pumpWidget(MaterialApp(
        home: PatientListScreen(
          authService: mockAuthService,
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Connection failed to server'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });

  group('PatientRegistrationScreen Widget Tests', () {
    testWidgets('shows validation errors when submitting blank form', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: PatientRegistrationScreen(
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      // Ensure button is visible in scrollview then tap
      final submitButton = find.text('Register & Generate UHID');
      await tester.ensureVisible(submitButton);
      await tester.tap(submitButton);
      await tester.pumpAndSettle();

      expect(find.text('Full name is required'), findsOneWidget);
      expect(find.text('Phone number is required'), findsOneWidget);
      verifyNever(() => mockPatientsService.createPatient(any()));
    });

    testWidgets('submits valid form and invokes createPatient service', (tester) async {
      when(() => mockPatientsService.createPatient(any()))
          .thenAnswer((_) async => samplePatient);

      await tester.pumpWidget(MaterialApp(
        home: PatientRegistrationScreen(
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Full Name *'),
        'Aarav Sharma',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Primary Phone Number *'),
        '+919876543210',
      );

      final submitButton = find.text('Register & Generate UHID');
      await tester.ensureVisible(submitButton);
      await tester.tap(submitButton);
      await tester.pumpAndSettle();

      verify(() => mockPatientsService.createPatient(any())).called(1);
    });

    testWidgets('displays inline error banner when backend returns 403 Forbidden', (tester) async {
      when(() => mockPatientsService.createPatient(any()))
          .thenThrow(const ApiException(statusCode: 403, message: 'Access Denied'));

      await tester.pumpWidget(MaterialApp(
        home: PatientRegistrationScreen(
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Full Name *'),
        'Aarav Sharma',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Primary Phone Number *'),
        '+919876543210',
      );

      final submitButton = find.text('Register & Generate UHID');
      await tester.ensureVisible(submitButton);
      await tester.tap(submitButton);
      await tester.pumpAndSettle();

      expect(find.textContaining('Access Denied: You do not have permissions'), findsOneWidget);
    });
  });

  group('PatientDetailsScreen Widget Tests', () {
    testWidgets('renders patient demographics and privacy protection for non-doctor', (tester) async {
      when(() => mockPatientsService.getPatientById('pat-1'))
          .thenAnswer((_) async => samplePatient);
      // Non-doctor role throws 403 on consultations endpoint
      when(() => mockPatientsService.getPatientConsultationHistory('pat-1'))
          .thenThrow(const ApiException(statusCode: 403, message: 'Forbidden'));

      await tester.pumpWidget(MaterialApp(
        home: PatientDetailsScreen(
          patientId: 'pat-1',
          authService: mockAuthService,
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Aarav Sharma'), findsWidgets);
      expect(find.text('UHID-000001'), findsOneWidget);
      expect(find.text('+919876543210'), findsOneWidget);
      expect(find.text('Mumbai'), findsOneWidget);
      expect(find.text('Clinical Consultations Protected'), findsOneWidget);
    });

    testWidgets('renders clinical visit history when user is a DOCTOR', (tester) async {
      when(() => mockPatientsService.getPatientById('pat-1'))
          .thenAnswer((_) async => samplePatient);
      when(() => mockPatientsService.getPatientConsultationHistory('pat-1'))
          .thenAnswer((_) async => const [
                PatientConsultationSummary(
                  id: 'cons-1',
                  encounterDate: '2026-10-25T00:00:00.000Z',
                  status: 'FINALIZED',
                  chiefComplaint: 'Fever and chills',
                  diagnosis: 'Viral pharyngitis',
                ),
              ]);

      await tester.pumpWidget(MaterialApp(
        home: PatientDetailsScreen(
          patientId: 'pat-1',
          authService: mockAuthService,
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      // Scroll down to reveal consultation section
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
      await tester.pumpAndSettle();

      expect(find.text('Clinical Visit History (Doctor View)'), findsOneWidget);
      expect(find.textContaining('Fever and chills'), findsOneWidget);
      expect(find.textContaining('Viral pharyngitis'), findsOneWidget);
    });

    testWidgets('renders not found state when patient is archived or 404', (tester) async {
      when(() => mockPatientsService.getPatientById('unknown-id'))
          .thenThrow(const ApiException(statusCode: 404, message: 'Patient not found'));

      await tester.pumpWidget(MaterialApp(
        home: PatientDetailsScreen(
          patientId: 'unknown-id',
          authService: mockAuthService,
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Patient Not Found'), findsOneWidget);
      expect(find.textContaining('not found in active clinic or has been archived'), findsOneWidget);
    });
  });

  group('Dashboard to Patient Navigation Widget Tests', () {
    testWidgets('tapping Patients quick action opens PatientListScreen', (tester) async {
      final mockDashboardService = MockDashboardService();
      when(() => mockAuthService.getActiveClinicId())
          .thenAnswer((_) async => 'clinic-1');
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: any(named: 'clinicId'),
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => ClinicDashboardStats.empty(clinicId: 'clinic-1'));

      when(() => mockPatientsService.getPatients(
            page: any(named: 'page'),
            limit: any(named: 'limit'),
            query: any(named: 'query'),
          )).thenAnswer((_) async => PaginatedPatientsResponse.empty());

      await tester.pumpWidget(MaterialApp(
        home: DashboardScreen(
          authService: mockAuthService,
          user: testUser,
          dashboardService: mockDashboardService,
          patientsService: mockPatientsService,
        ),
      ));
      await tester.pumpAndSettle();

      // Tap on Patients quick action
      await tester.tap(find.text('Patients').first);
      await tester.pumpAndSettle();

      expect(find.text('Patient Directory'), findsOneWidget);
    });
  });
}
