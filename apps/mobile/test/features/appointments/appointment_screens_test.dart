import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/appointments/models/appointment.dart';
import 'package:doctor_opd_mobile/features/appointments/models/cancel_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/models/create_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/models/paginated_appointments_response.dart';
import 'package:doctor_opd_mobile/features/appointments/models/reschedule_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/services/appointments_service.dart';
import 'package:doctor_opd_mobile/features/appointments/ui/appointment_create_screen.dart';
import 'package:doctor_opd_mobile/features/appointments/ui/appointment_details_screen.dart';
import 'package:doctor_opd_mobile/features/appointments/ui/appointment_list_screen.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/appointment_summary.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/clinic_dashboard_stats.dart';
import 'package:doctor_opd_mobile/features/dashboard/services/dashboard_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/ui/dashboard_screen.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';

class MockAppointmentsService extends Mock implements AppointmentsService {}

class MockPatientsService extends Mock implements PatientsService {}

class MockAuthService extends Mock implements AuthService {}

class MockDashboardService extends Mock implements DashboardService {}

void main() {
  late MockAppointmentsService mockAppointmentsService;
  late MockPatientsService mockPatientsService;
  late MockAuthService mockAuthService;
  late MockDashboardService mockDashboardService;

  const testUser = AuthUser(
    id: 'd1111111-1111-1111-1111-111111111111',
    email: 'doctor@clinic.in',
    fullName: 'Dr. Priya Sharma',
    role: 'DOCTOR',
  );

  final samplePatient = Patient(
    id: 'b1111111-1111-1111-1111-111111111111',
    clinicId: 'c1111111-1111-1111-1111-111111111111',
    uhid: 'UHID-000001',
    fullName: 'Aarav Patel',
    gender: 'MALE',
    dateOfBirth: '1990-05-15T00:00:00.000Z',
    phone: '9876543210',
    email: 'aarav@health.in',
    city: 'Mumbai',
    isActive: true,
    createdAt: DateTime(2026, 10, 24),
    updatedAt: DateTime(2026, 10, 24),
  );

  final sampleAppointment = Appointment(
    id: 'a1111111-1111-1111-1111-111111111111',
    clinicId: 'c1111111-1111-1111-1111-111111111111',
    patientId: 'b1111111-1111-1111-1111-111111111111',
    doctorId: 'd1111111-1111-1111-1111-111111111111',
    serviceDate: '2026-10-26T00:00:00.000Z',
    startTime: '2026-10-26T04:30:00.000Z',
    endTime: '2026-10-26T05:00:00.000Z',
    type: AppointmentType.scheduled,
    status: AppointmentStatus.scheduled,
    chiefComplaint: 'Persistent headache',
    notes: 'Follow up needed',
    createdAt: '2026-10-26T04:00:00.000Z',
    updatedAt: '2026-10-26T04:00:00.000Z',
    patient: const AppointmentPatientSummary(
      id: 'b1111111-1111-1111-1111-111111111111',
      uhid: 'UHID-000001',
      fullName: 'Aarav Patel',
      phone: '9876543210',
    ),
    doctor: const AppointmentDoctorSummary(
      userId: 'd1111111-1111-1111-1111-111111111111',
      role: 'DOCTOR',
      fullName: 'Dr. Priya Sharma',
      email: 'priya@clinic.in',
    ),
  );

  setUpAll(() {
    registerFallbackValue(const CreateAppointmentRequest(
      patientId: 'b1111111-1111-1111-1111-111111111111',
      doctorId: 'd1111111-1111-1111-1111-111111111111',
      serviceDate: '2026-10-26',
      startTime: '2026-10-26T10:00:00+05:30',
    ));
    registerFallbackValue(const RescheduleAppointmentRequest(
      serviceDate: '2026-10-27',
      startTime: '2026-10-27T11:00:00+05:30',
    ));
    registerFallbackValue(const CancelAppointmentRequest(
      cancellationReason: 'Doctor unavailable',
    ));
  });

  setUp(() {
    mockAppointmentsService = MockAppointmentsService();
    mockPatientsService = MockPatientsService();
    mockAuthService = MockAuthService();
    mockDashboardService = MockDashboardService();
  });

  group('AppointmentListScreen Widget Tests', () {
    testWidgets('renders appointment list with time, patient name, UHID and status',
        (tester) async {
      when(() => mockAppointmentsService.getAppointments(
            serviceDate: any(named: 'serviceDate'),
            doctorId: any(named: 'doctorId'),
            status: any(named: 'status'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => PaginatedAppointmentsResponse(
            data: [sampleAppointment],
            meta: const AppointmentPaginationMeta(
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            ),
          ));

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentListScreen(
            initialDate: '2026-10-26',
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Appointments'), findsOneWidget);
      expect(find.text('Aarav Patel'), findsOneWidget);
      expect(find.textContaining('UHID-000001'), findsOneWidget);
      expect(find.textContaining('Dr. Priya Sharma'), findsOneWidget);
      expect(find.text('Scheduled'), findsWidgets);
      expect(find.text('Book Appointment'), findsOneWidget);
    });

    testWidgets('displays empty state when no appointments exist',
        (tester) async {
      when(() => mockAppointmentsService.getAppointments(
            serviceDate: any(named: 'serviceDate'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => PaginatedAppointmentsResponse.empty());

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentListScreen(
            initialDate: '2026-10-26',
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No appointments scheduled'), findsOneWidget);
      expect(find.text('Book New Appointment'), findsOneWidget);
    });

    testWidgets('displays error banner and retry button on fetch failure',
        (tester) async {
      when(() => mockAppointmentsService.getAppointments(
            serviceDate: any(named: 'serviceDate'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenThrow(
        ApiException(message: 'Connection timed out', statusCode: 504),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentListScreen(
            initialDate: '2026-10-26',
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Connection timed out'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('navigates previous and next day on date button tap',
        (tester) async {
      when(() => mockAppointmentsService.getAppointments(
            serviceDate: any(named: 'serviceDate'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => PaginatedAppointmentsResponse.empty());

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentListScreen(
            initialDate: '2026-10-26',
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap previous day
      await tester.tap(find.byIcon(Icons.chevron_left_rounded));
      await tester.pumpAndSettle();

      verify(() => mockAppointmentsService.getAppointments(
            serviceDate: '2026-10-25',
            page: 1,
            limit: 20,
          )).called(1);
    });
  });

  group('AppointmentCreateScreen Widget Tests', () {
    testWidgets('shows validation error when submitting without selecting patient',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentCreateScreen(
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      final submitBtn = find.text('Confirm & Book Appointment');
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(find.text('Please select a patient'), findsOneWidget);
    });

    testWidgets('submits valid appointment form and invokes createAppointment',
        (tester) async {
      when(() => mockAppointmentsService.createAppointment(any()))
          .thenAnswer((_) async => sampleAppointment);

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentCreateScreen(
            initialPatient: samplePatient,
            initialDoctorId: 'd1111111-1111-1111-1111-111111111111',
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Aarav Patel'), findsOneWidget);
      expect(find.textContaining('UHID-000001'), findsOneWidget);

      final submitBtn = find.text('Confirm & Book Appointment');
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      verify(() => mockAppointmentsService.createAppointment(any())).called(1);
    });

    testWidgets('displays error banner when backend returns 409 Conflict',
        (tester) async {
      when(() => mockAppointmentsService.createAppointment(any())).thenThrow(
        ApiException(
          message: 'Appointment conflicts with existing booking for this doctor',
          statusCode: 409,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentCreateScreen(
            initialPatient: samplePatient,
            initialDoctorId: 'd1111111-1111-1111-1111-111111111111',
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      final submitBtn = find.text('Confirm & Book Appointment');
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(
        find.text('Appointment conflicts with existing booking for this doctor'),
        findsOneWidget,
      );
    });
  });

  group('AppointmentDetailsScreen Widget Tests', () {
    testWidgets('renders appointment details correctly', (tester) async {
      when(() => mockAppointmentsService.getAppointmentById('a1111111-1111-1111-1111-111111111111'))
          .thenAnswer((_) async => sampleAppointment);

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentDetailsScreen(
            appointmentId: 'a1111111-1111-1111-1111-111111111111',
            initialAppointment: sampleAppointment,
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Appointment Details'), findsOneWidget);
      expect(find.text('Aarav Patel'), findsOneWidget);
      expect(find.textContaining('UHID-000001'), findsOneWidget);
      expect(find.textContaining('Dr. Priya Sharma'), findsOneWidget);
      expect(find.text('Reschedule'), findsOneWidget);
      expect(find.text('Cancel Visit'), findsOneWidget);
    });

    testWidgets('tapping Cancel Visit opens cancel confirmation dialog',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentDetailsScreen(
            appointmentId: 'a1111111-1111-1111-1111-111111111111',
            initialAppointment: sampleAppointment,
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      final cancelBtn = find.text('Cancel Visit');
      await tester.ensureVisible(cancelBtn);
      await tester.tap(cancelBtn);
      await tester.pumpAndSettle();

      expect(find.text('Cancel Appointment'), findsOneWidget);
      expect(find.text('Cancellation Reason *'), findsOneWidget);
      expect(find.text('Confirm Cancel'), findsOneWidget);
    });
  });

  group('Dashboard to Appointments Navigation Widget Tests', () {
    testWidgets('tapping Appointments quick action opens AppointmentListScreen',
        (tester) async {
      final dashboardStats = ClinicDashboardStats(
        clinicId: 'c1111111-1111-1111-1111-111111111111',
        serviceDate: '2026-10-26',
        totalPatients: 1,
        recentPatients: [],
        totalAppointmentsToday: 1,
        appointmentsToday: [
          AppointmentSummary(
            id: 'a1111111-1111-1111-1111-111111111111',
            serviceDate: '2026-10-26',
            type: 'SCHEDULED',
            patientName: 'Aarav Patel',
            patientUhid: 'UHID-000001',
            status: 'SCHEDULED',
            startTime: '2026-10-26T04:30:00.000Z',
            doctorName: 'Dr. Priya Sharma',
          ),
        ],
        totalQueueToday: 0,
        queueWaitingCount: 0,
        queueCalledCount: 0,
        queueInConsultationCount: 0,
        queueCompletedCount: 0,
        queueEntriesToday: [],
        isDoctor: true,
        detectedRole: 'DOCTOR',
        healthStatus: 'online',
        lastRefreshed: DateTime.now(),
      );

      when(() => mockAuthService.getActiveClinicId())
          .thenAnswer((_) async => 'c1111111-1111-1111-1111-111111111111');
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: any(named: 'clinicId'),
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => dashboardStats);
      when(() => mockAppointmentsService.getAppointments(
            serviceDate: any(named: 'serviceDate'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => PaginatedAppointmentsResponse.empty());

      await tester.pumpWidget(
        MaterialApp(
          home: DashboardScreen(
            authService: mockAuthService,
            user: testUser,
            dashboardService: mockDashboardService,
            appointmentsService: mockAppointmentsService,
            patientsService: mockPatientsService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap on Appointments quick action
      final aptAction = find.text('Appointments');
      expect(aptAction, findsWidgets);
      await tester.tap(aptAction.first);
      await tester.pumpAndSettle();

      expect(find.byType(AppointmentListScreen), findsOneWidget);
    });
  });
}
