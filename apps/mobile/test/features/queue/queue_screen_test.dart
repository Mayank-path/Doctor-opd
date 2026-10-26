import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';
import 'package:doctor_opd_mobile/features/appointments/services/appointments_service.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';
import 'package:doctor_opd_mobile/features/queue/models/check_in_request.dart';
import 'package:doctor_opd_mobile/features/queue/models/queue_entry.dart';
import 'package:doctor_opd_mobile/features/queue/models/queue_list_response.dart';
import 'package:doctor_opd_mobile/features/queue/models/update_queue_status_request.dart';
import 'package:doctor_opd_mobile/features/queue/services/queue_service.dart';
import 'package:doctor_opd_mobile/features/queue/ui/queue_screen.dart';

class MockQueueService extends Mock implements QueueService {}

class MockAppointmentsService extends Mock implements AppointmentsService {}

class MockPatientsService extends Mock implements PatientsService {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  late MockQueueService mockQueueService;
  late MockAppointmentsService mockAppointmentsService;
  late MockPatientsService mockPatientsService;
  late MockSecureStorageService mockStorageService;

  const testDoctorUser = AuthUser(
    id: 'doc-user-1',
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

  final testWaitingEntry = QueueEntry(
    id: 'qe-1',
    clinicId: 'clinic-1',
    patientId: 'pat-1',
    doctorId: 'doc-user-1',
    serviceDate: '2026-10-26',
    tokenNumber: 1,
    status: QueueStatus.waiting,
    priority: 0,
    checkInTime: '2026-10-26T09:00:00.000Z',
    createdAt: '2026-10-26T09:00:00.000Z',
    updatedAt: '2026-10-26T09:00:00.000Z',
    patient: const QueuePatientSummary(
      id: 'pat-1',
      uhid: 'UHID-2026-0001',
      fullName: 'Aarav Patel',
      gender: 'MALE',
      dateOfBirth: '1995-01-01',
    ),
    doctor: const QueueDoctorSummary(
      userId: 'doc-user-1',
      role: 'DOCTOR',
      fullName: 'Dr. Ramesh Sharma',
    ),
  );

  final testCalledEntry = QueueEntry(
    id: 'qe-2',
    clinicId: 'clinic-1',
    patientId: 'pat-2',
    doctorId: 'doc-user-1',
    serviceDate: '2026-10-26',
    tokenNumber: 2,
    status: QueueStatus.called,
    priority: 5,
    checkInTime: '2026-10-26T09:10:00.000Z',
    calledAt: '2026-10-26T09:20:00.000Z',
    createdAt: '2026-10-26T09:10:00.000Z',
    updatedAt: '2026-10-26T09:20:00.000Z',
    patient: const QueuePatientSummary(
      id: 'pat-2',
      uhid: 'UHID-2026-0002',
      fullName: 'Sunita Rao',
      gender: 'FEMALE',
    ),
    doctor: const QueueDoctorSummary(
      userId: 'doc-user-1',
      role: 'DOCTOR',
      fullName: 'Dr. Ramesh Sharma',
    ),
  );

  final testInConsultEntry = QueueEntry(
    id: 'qe-3',
    clinicId: 'clinic-1',
    patientId: 'pat-3',
    doctorId: 'doc-user-1',
    serviceDate: '2026-10-26',
    tokenNumber: 3,
    status: QueueStatus.inConsultation,
    priority: 0,
    checkInTime: '2026-10-26T09:15:00.000Z',
    calledAt: '2026-10-26T09:22:00.000Z',
    consultationStartTime: '2026-10-26T09:25:00.000Z',
    createdAt: '2026-10-26T09:15:00.000Z',
    updatedAt: '2026-10-26T09:25:00.000Z',
    patient: const QueuePatientSummary(
      id: 'pat-3',
      uhid: 'UHID-2026-0003',
      fullName: 'Vikram Mehta',
    ),
    doctor: const QueueDoctorSummary(
      userId: 'doc-user-1',
      role: 'DOCTOR',
      fullName: 'Dr. Ramesh Sharma',
    ),
  );

  setUpAll(() {
    registerFallbackValue(CheckInRequest.forAppointment('dummy-apt'));
    registerFallbackValue(
      UpdateQueueStatusRequest(status: QueueStatus.called),
    );
  });

  setUp(() {
    mockQueueService = MockQueueService();
    mockAppointmentsService = MockAppointmentsService();
    mockPatientsService = MockPatientsService();
    mockStorageService = MockSecureStorageService();
  });

  Widget buildTestWidget({AuthUser? user, String date = '2026-10-26'}) {
    when(() => mockStorageService.getUser())
        .thenAnswer((_) async => user ?? testDoctorUser);

    return MaterialApp(
      home: QueueScreen(
        queueService: mockQueueService,
        appointmentsService: mockAppointmentsService,
        patientsService: mockPatientsService,
        storageService: mockStorageService,
        initialDate: date,
      ),
    );
  }

  group('QueueScreen Widget Tests', () {
    testWidgets('renders queue list with token badges, patient details, and metrics',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => QueueListResponse(
            total: 3,
            data: [testWaitingEntry, testCalledEntry, testInConsultEntry],
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('OPD Queue'), findsOneWidget);
      expect(find.text('#1'), findsOneWidget);
      expect(find.text('#2'), findsOneWidget);
      expect(find.text('#3'), findsOneWidget);

      expect(find.text('Aarav Patel'), findsOneWidget);
      expect(find.text('Sunita Rao'), findsOneWidget);
      expect(find.text('Vikram Mehta'), findsOneWidget);

      expect(find.text('UHID: UHID-2026-0001 • MALE • 31 yrs'), findsOneWidget);
      expect(find.text('PRIORITY'), findsOneWidget);

      // Metrics bar
      expect(find.text('Waiting'), findsWidgets);
      expect(find.text('Called'), findsWidgets);
      expect(find.text('Consulting'), findsWidgets);
    });

    testWidgets('renders empty state when queue is empty for date',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => const QueueListResponse(
            total: 0,
            data: [],
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('OPD Queue is Empty'), findsOneWidget);
      expect(
        find.text('No patients have been checked in for 2026-10-26.'),
        findsOneWidget,
      );
    });

    testWidgets('renders error banner and retry button on fetch failure',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenThrow(ApiException(statusCode: 500, message: 'Server database offline'));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Unable to load OPD Queue'), findsOneWidget);
      expect(find.text('Server database offline'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);
    });

    testWidgets('calling patient triggers updateStatus to CALLED',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => QueueListResponse(
            total: 1,
            data: [testWaitingEntry],
          ));

      when(() => mockQueueService.updateStatus(
            'qe-1',
            any(),
          )).thenAnswer((_) async => testWaitingEntry);

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Find Call Patient button
      final callButton = find.byKey(const Key('callButton_qe-1'));
      expect(callButton, findsOneWidget);

      await tester.tap(callButton);
      await tester.pumpAndSettle();

      verify(() => mockQueueService.updateStatus(
            'qe-1',
            any(
              that: isA<UpdateQueueStatusRequest>().having(
                (r) => r.status,
                'status',
                QueueStatus.called,
              ),
            ),
          )).called(1);
    });

    testWidgets('start consultation is visible only for assigned doctor',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => QueueListResponse(
            total: 1,
            data: [testCalledEntry],
          ));

      // As assigned DOCTOR
      await tester.pumpWidget(buildTestWidget(user: testDoctorUser));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('startConsultButton_qe-2')), findsOneWidget);
    });

    testWidgets('start consultation is hidden for non-doctor role',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => QueueListResponse(
            total: 1,
            data: [testCalledEntry],
          ));

      // As ADMIN
      await tester.pumpWidget(buildTestWidget(user: testAdminUser));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('startConsultButton_qe-2')), findsNothing);
      expect(find.byKey(const Key('reCallButton_qe-2')), findsOneWidget);
      expect(find.byKey(const Key('skipButton_qe-2')), findsOneWidget);
    });

    testWidgets('complete consultation is visible for assigned doctor',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => QueueListResponse(
            total: 1,
            data: [testInConsultEntry],
          ));

      // As assigned DOCTOR
      await tester.pumpWidget(buildTestWidget(user: testDoctorUser));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('completeButton_qe-3')), findsOneWidget);
    });

    testWidgets('complete consultation shows privacy lock message for non-doctor',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => QueueListResponse(
            total: 1,
            data: [testInConsultEntry],
          ));

      // As ADMIN
      await tester.pumpWidget(buildTestWidget(user: testAdminUser));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('completeButton_qe-3')), findsNothing);
      expect(
        find.textContaining('Only the attending doctor can complete'),
        findsOneWidget,
      );
    });

    testWidgets('cancelling queue entry shows confirmation dialog',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => QueueListResponse(
            total: 1,
            data: [testWaitingEntry],
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Tap cancel icon on the card
      await tester.tap(find.byTooltip('Cancel Token'));
      await tester.pumpAndSettle();

      expect(find.text('Cancel Queue Token'), findsOneWidget);
      expect(find.textContaining('Token #1'), findsWidgets);
      expect(find.text('Keep in Queue'), findsOneWidget);
      expect(find.text('Confirm Cancel'), findsOneWidget);
    });

    testWidgets('tapping check-in FAB opens check-in bottom sheet menu',
        (tester) async {
      when(() => mockQueueService.getQueue(
            serviceDate: '2026-10-26',
            status: null,
          )).thenAnswer((_) async => const QueueListResponse(
            total: 0,
            data: [],
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('queueCheckInFab')));
      await tester.pumpAndSettle();

      expect(find.text('Check-In Scheduled Appointment'), findsOneWidget);
      expect(find.text('Walk-In Patient Check-In'), findsOneWidget);
    });
  });
}
