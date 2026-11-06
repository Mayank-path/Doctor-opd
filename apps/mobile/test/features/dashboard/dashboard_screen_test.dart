import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/clinic_dashboard_stats.dart';
import 'package:doctor_opd_mobile/features/dashboard/models/patient_summary.dart';
import 'package:doctor_opd_mobile/features/dashboard/services/dashboard_service.dart';
import 'package:doctor_opd_mobile/features/dashboard/ui/dashboard_screen.dart';

class MockAuthService extends Mock implements AuthService {}

class MockDashboardService extends Mock implements DashboardService {}

void main() {
  late MockAuthService mockAuthService;
  late MockDashboardService mockDashboardService;

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

      // OPD Queue & Appointments Overviews are removed
      expect(find.text("Today's OPD Queue"), findsNothing);
      expect(find.text("Today's Appointments"), findsNothing);

      // Registered Patients Overview
      expect(find.text('Registered Patients'), findsOneWidget);
      expect(find.text('1 total'), findsOneWidget);

      // Clinical Privacy Card
      expect(find.text('Clinical Records Privacy'), findsOneWidget);

      // System status
      expect(find.text('API ONLINE'), findsOneWidget);
    });

    testWidgets('renders empty state when patients are empty',
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

      expect(find.text('No patients registered in this clinic yet'), findsOneWidget);
      expect(find.text("Today's OPD Queue"), findsNothing);
      expect(find.text("Today's Appointments"), findsNothing);
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

      // Tap on Consultations quick action (still upcoming module for non-doctor)
      await tester.tap(find.text('Consultations').first);
      await tester.pumpAndSettle();

      expect(find.text('Clinical Consultations'), findsOneWidget);
      expect(find.text('Upcoming OPD Module'), findsOneWidget);
      expect(find.text('Understood'), findsOneWidget);

      await tester.tap(find.text('Understood'));
      await tester.pumpAndSettle();

      expect(find.text('Clinical Consultations'), findsNothing);
    });

    testWidgets('verifies Appointments, OPD Queue, and Voice Symptoms quick actions are absent from dashboard',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => testStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      expect(find.text('Appointments'), findsNothing);
      expect(find.text('OPD Queue'), findsNothing);
      expect(find.text('Voice Symptoms'), findsNothing);
      expect(find.text('Patients'), findsOneWidget);
      expect(find.text('Consultations'), findsOneWidget);
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

      // Tap logout icon in AppBar
      await tester.tap(find.byIcon(Icons.logout_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Are you sure you want to end this clinical session? Your secure session tokens will be cleared.'), findsOneWidget);

      // Confirm logout
      await tester.tap(find.widgetWithText(ElevatedButton, 'Log Out'));
      await tester.pumpAndSettle();

      verify(() => mockAuthService.logout()).called(1);
    });

    testWidgets('renders anchor navigation button to scroll down to dashboard overview',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => testStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      // Tap Go to Dashboard
      await tester.tap(find.text('Continue to Dashboard'));
      await tester.pumpAndSettle();

      // The section header should be rendered
      expect(find.text('OPD CLINICAL DASHBOARD'), findsOneWidget);
      expect(find.text('LIVE SYNC'), findsOneWidget);
    });

    testWidgets('navigation drawer opens and displays navigation targets without removed features',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => testStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      // Open drawer using the scaffold state
      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      // Verify drawer contents
      final drawerFinder = find.byType(Drawer);
      expect(drawerFinder, findsOneWidget);
      expect(find.descendant(of: drawerFinder, matching: find.text('Dashboard')), findsOneWidget);
      expect(find.descendant(of: drawerFinder, matching: find.text('OPD Queue')), findsNothing);
      expect(find.descendant(of: drawerFinder, matching: find.text('Appointments')), findsNothing);
      expect(find.descendant(of: drawerFinder, matching: find.text('Voice Symptoms')), findsNothing);
      expect(find.descendant(of: drawerFinder, matching: find.text('Patients')), findsOneWidget);
      expect(find.descendant(of: drawerFinder, matching: find.text('Active Clinic Context')), findsOneWidget);
      expect(find.descendant(of: drawerFinder, matching: find.text(testClinicId)), findsOneWidget);
      expect(find.descendant(of: drawerFinder, matching: find.text('Log Out')), findsOneWidget);
    });

    testWidgets('restores active clinic context on load and renders live dashboard metrics',
        (tester) async {
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => testStats);

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      // Verifies session active clinic was queried
      verify(() => mockAuthService.getActiveClinicId()).called(1);

      // Verifies backend stats were requested for the restored clinic
      verify(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).called(1);

      // Verifies live cards are present
      expect(find.text("Today's OPD Queue"), findsNothing);
      expect(find.text("Today's Appointments"), findsNothing);
      expect(find.text('Registered Patients'), findsOneWidget);
    });

    testWidgets('role detection sets DOCTOR badge and unlocks Consultations quick action for verified doctor',
        (tester) async {
      final doctorStats = ClinicDashboardStats(
        clinicId: testClinicId,
        serviceDate: '2026-10-26',
        totalPatients: 1,
        recentPatients: testStats.recentPatients,
        isDoctor: true,
        detectedRole: 'DOCTOR',
        consultationRestrictionMessage: null,
        healthStatus: 'online',
        lastRefreshed: DateTime.now(),
      );

      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: testClinicId,
            serviceDate: any(named: 'serviceDate'),
          )).thenAnswer((_) async => doctorStats);
      when(() => mockAuthService.updateUserRole('DOCTOR'))
          .thenAnswer((_) async {});

      await tester.pumpWidget(buildTestWidget(clinicId: testClinicId));
      await tester.pumpAndSettle();

      // Badge should display DOCTOR
      expect(find.text('DOCTOR'), findsOneWidget);
      // Role update was dispatched to auth service
      verify(() => mockAuthService.updateUserRole('DOCTOR')).called(1);

      // Consultations action should display 'Doctor visits' instead of 'Protected'
      expect(find.text('Doctor visits'), findsOneWidget);
      expect(find.text('Protected'), findsNothing);

      // Prescriptions quick action is exposed; Differential Dx and Voice Symptoms are removed
      expect(find.text('Prescriptions'), findsOneWidget);
      expect(find.text('Differential Dx'), findsNothing);
      expect(find.text('Voice Symptoms'), findsNothing);

      // Open drawer and verify clinical assist routes
      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      final drawerFinder = find.byType(Drawer);
      expect(find.descendant(of: drawerFinder, matching: find.text('Differential Diagnosis')), findsNothing);
      expect(find.descendant(of: drawerFinder, matching: find.text('Voice Symptoms')), findsNothing);
      expect(find.descendant(of: drawerFinder, matching: find.text('Prescriptions')), findsOneWidget);
    });

    testWidgets('profile badge shows PENDING instead of ADMIN fallback when role is not yet established',
        (tester) async {
      const userWithoutRole = AuthUser(
        id: 'user-no-role',
        email: 'doc@opd.local',
        fullName: 'Dr. New Provider',
      );

      when(() => mockAuthService.getActiveClinicId())
          .thenAnswer((_) async => null);
      when(() => mockAuthService.currentUser).thenReturn(userWithoutRole);

      await tester.pumpWidget(MaterialApp(
        home: DashboardScreen(
          authService: mockAuthService,
          user: userWithoutRole,
          dashboardService: mockDashboardService,
        ),
      ));
      await tester.pumpAndSettle();

      // Should display PENDING, never hardcoded ADMIN
      expect(find.text('PENDING'), findsOneWidget);
      expect(find.text('ADMIN'), findsNothing);
    });

    testWidgets('validation failure displays actual API error and keeps clinic selector editable for recovery',
        (tester) async {
      when(() => mockAuthService.setActiveClinic(any()))
          .thenAnswer((_) async {});
      when(() => mockDashboardService.fetchDashboardStats(
            clinicId: 'invalid-clinic-uuid',
            serviceDate: any(named: 'serviceDate'),
          )).thenThrow(const ApiException(
        statusCode: 403,
        message: 'Tenant authorization failed: Membership inactive in requested clinic',
      ));

      await tester.pumpWidget(buildTestWidget(clinicId: null));
      await tester.pumpAndSettle();

      // Enter invalid clinic ID
      final textField = find.byType(TextField);
      await tester.enterText(textField, 'invalid-clinic-uuid');
      await tester.pumpAndSettle();

      // Tap Save
      await tester.tap(find.widgetWithText(ElevatedButton, 'Save'));
      await tester.pumpAndSettle();

      // Should show the actual API error in the validation box
      expect(
        find.text('Tenant authorization failed: Membership inactive in requested clinic'),
        findsOneWidget,
      );

      // The text field should remain visible and editable for recovery
      expect(find.byType(TextField), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Save'), findsOneWidget);
    });
  });
}
