import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/appointment_summary.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/clinic_dashboard_stats.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/patient_summary.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/queue_summary.dart';
import 'package:doctor_opd_mobile/features/dashboard/services/dashboard_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/ui/dashboard_screen.dart';
import 'package:doctor_opd_mobile/features/queue/models/queue_list_response.dart';
import 'package:doctor_opd_mobile/features/queue/services/queue_service.dart';

class MockAuthService extends Mock implements AuthService {}

class MockDashboardService extends Mock implements DashboardService {}

class MockQueueService extends Mock implements QueueService {}

void main() {
  late MockAuthService mockAuthService;
  late MockDashboardService mockDashboardService;
  late MockQueueService mockQueueService;

  const testUser = AuthUser(
    id: 'user-admin-123',
    email: 'admin@opd.local',
    fullName: 'Dr. System Administrator',
    role: 'ADMIN',
  );

  const testClinicId = '550e8400-e29b-41d4-a716-446655440000';

  final testStats = ClinicDashboardStats(
    clinicId: testClinicId,
    serviceDate: '2026-10-26',
    totalPatients: 1,
    recentPatients: const [
      PatientSummary(
        id: 'pat-1',
        uhid: 'UHID-2026-0001',
        fullName: 'Aarav Patel',
        gender: 'MALE',
        phone: '+919876543210',
      ),
    ],
    totalAppointmentsToday: 1,
    appointmentsToday: const [
      AppointmentSummary(
        id: 'apt-1',
        serviceDate: '2026-10-26T00:00:00.000Z',
        startTime: '2026-10-26T05:00:00.000Z',
        type: 'SCHEDULED',
        status: 'SCHEDULED',
        patientName: 'Aarav Patel',
        patientUhid: 'UHID-2026-0001',
        doctorName: 'Dr. Sharma',
      ),
    ],
    totalQueueToday: 2,
    queueWaitingCount: 1,
    queueCalledCount: 1,
    queueInConsultationCount: 0,
    queueCompletedCount: 0,
    queueEntriesToday: const [
      QueueSummary(
        id: 'q-1',
        tokenNumber: 1,
        status: 'WAITING',
        priority: 0,
        patientName: 'Aarav Patel',
        patientUhid: 'UHID-2026-0001',
      ),
      QueueSummary(
        id: 'q-2',
        tokenNumber: 2,
        status: 'CALLED',
        priority: 1,
        patientName: 'Sunita Rao',
        patientUhid: 'UHID-2026-0002',
      ),
    ],
    isDoctor: false,
    detectedRole: 'ADMIN',
    consultationRestrictionMessage:
        'Clinical consultation records are restricted to Doctor role under clinical privacy rules.',
    healthStatus: 'online',
    lastRefreshed: DateTime.now(),
  );

  setUp(() {
    mockAuthService = MockAuthService();
    mockDashboardService = MockDashboardService();
    mockQueueService = MockQueueService();

    when(() => mockQueueService.getQueue(
          serviceDate: any(named: 'serviceDate'),
          doctorId: any(named: 'doctorId'),
          status: any(named: 'status'),
        )).thenAnswer((_) async => const QueueListResponse(data: [], total: 0));
  });

  Widget buildTestWidget({String? clinicId}) {
    when(() => mockAuthService.getActiveClinicId())
        .thenAnswer((_) async => clinicId);
    when(() => mockAuthService.currentUser).thenReturn(testUser);

    return MaterialApp(
      home: DashboardScreen(
        authService: mockAuthService,
        user: testUser,
        dashboardService: mockDashboardService,
        queueService: mockQueueService,
      ),
    );
  }

  group('DashboardScreen Widget Tests', () {
    testWidgets('renders prompt to select clinic when no active clinic context is set',
        (tester) async {
      await tester.pumpWidget(buildTestWidget(clinicId: null));
      await tester.pumpAndSettle();

      expect(find.text('DOCTOR-OPD'), findsOneWidget);
      expect(find.text('Dr. System Administrator'), findsOneWidget);
      expect(find.text('admin@opd.local'), findsOneWidget);
      expect(find.text('Select Active Clinic'), findsOneWidget);
      expect(find.text('Clinic context required'), findsOneWidget);
    });

    testWidgets('loads and renders real overview cards when active clinic is present',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => testStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      // Branding & User
      expect(find.text('DOCTOR-OPD'), findsOneWidget);
      expect(find.text('Dr. System Administrator'), findsOneWidget);

      // OPD Queue Overview
      expect(find.text("Today's OPD Queue"), findsOneWidget);
      expect(find.text('#1'), findsOneWidget);
      expect(find.text('#2'), findsOneWidget);
      expect(find.text('Aarav Patel'), findsWidgets);

      // Appointments Overview
      expect(find.text("Today's Appointments"), findsOneWidget);
      expect(find.text('1 booked'), findsOneWidget);

      // Registered Patients Overview
      expect(find.text('Registered Patients'), findsOneWidget);
      expect(find.text('1 total'), findsOneWidget);

      // Clinical Privacy Card
      expect(find.text('Clinical Records Privacy'), findsOneWidget);

      // System status
      expect(find.text('API ONLINE'), findsOneWidget);
    });

    testWidgets('renders empty states when queue, appointments, and patients are empty',
        (tester) async {
      final emptyStats = ClinicDashboardStats.empty(
        clinicId: testClinicId,
        serviceDate: '2026-10-26',
      );

      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => emptyStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      expect(find.text('No patients currently in OPD queue today'), findsOneWidget);
      expect(find.text('No appointments scheduled for today'), findsOneWidget);
      expect(find.text('No patients registered in this clinic yet'), findsOneWidget);
    });

    testWidgets('displays error banner and retry button on fetch failure',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenThrow(const ApiException(
        statusCode: 403,
        message: 'Access denied: user is not a member of the requested clinic',
      ));

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      expect(find.text('Dashboard Fetch Issue'), findsOneWidget);
      expect(find.text('Access denied for the selected clinic tenant.'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('tapping quick action opens upcoming module bottom sheet',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => testStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      // Tap on Consultations quick action (still upcoming module)
      await tester.tap(find.text('Consultations').first);
      await tester.pumpAndSettle();

      expect(find.text('Clinical Consultations'), findsOneWidget);
      expect(find.text('Upcoming OPD Module'), findsOneWidget);
      expect(find.text('Understood'), findsOneWidget);

      await tester.tap(find.text('Understood'));
      await tester.pumpAndSettle();

      expect(find.text('Clinical Consultations'), findsNothing);
    });

    testWidgets('tapping OPD Queue quick action navigates to QueueScreen',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => testStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      // Tap on OPD Queue quick action
      await tester.tap(find.text('OPD Queue').first);
      await tester.pumpAndSettle();

      // Should be on QueueScreen
      expect(find.text('OPD Queue is Empty'), findsOneWidget);
    });

    testWidgets('tapping logout button displays confirmation dialog and calls logout',
        (tester) async {
      when(() => mockAuthService.getActiveClinicId())
          .thenAnswer((_) async => null);
      when(() => mockAuthService.currentUser).thenReturn(testUser);
      when(() => mockAuthService.logout()).thenAnswer((_) async {});

      await tester.pumpWidget(MaterialApp(
        home: DashboardScreen(
          authService: mockAuthService,
          user: testUser,
          dashboardService: mockDashboardService,
        ),
      ));
      await tester.pumpAndSettle();

      // Tap on logout icon in app bar
      await tester.tap(find.byIcon(Icons.logout_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Are you sure you want to end this clinical session? Your secure session tokens will be cleared.'),
          findsOneWidget);

      // Confirm logout
      await tester.tap(find.widgetWithText(ElevatedButton, 'Log Out'));
      await tester.pumpAndSettle();

      verify(() => mockAuthService.logout()).called(1);
    });
  });
}
