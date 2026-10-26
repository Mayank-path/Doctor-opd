import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/appointments/models/appointment.dart';
import 'package:doctor_opd_mobile/features/appointments/models/cancel_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/models/create_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/models/reschedule_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/services/appointments_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late AppointmentsService appointmentsService;

  final sampleAppointmentJson = <String, dynamic>{
    'id': 'a1111111-1111-1111-1111-111111111111',
    'clinicId': 'c1111111-1111-1111-1111-111111111111',
    'patientId': 'b1111111-1111-1111-1111-111111111111',
    'doctorId': 'd1111111-1111-1111-1111-111111111111',
    'serviceDate': '2026-10-26T00:00:00.000Z',
    'startTime': '2026-10-26T04:30:00.000Z',
    'endTime': '2026-10-26T05:00:00.000Z',
    'type': 'SCHEDULED',
    'status': 'SCHEDULED',
    'chiefComplaint': 'Routine checkup',
    'notes': 'No critical symptoms',
    'createdAt': '2026-10-26T04:00:00.000Z',
    'updatedAt': '2026-10-26T04:00:00.000Z',
    'patient': {
      'id': 'b1111111-1111-1111-1111-111111111111',
      'uhid': 'UHID-000001',
      'fullName': 'Aarav Patel',
    },
    'doctor': {
      'userId': 'd1111111-1111-1111-1111-111111111111',
      'role': 'DOCTOR',
      'user': {
        'id': 'd1111111-1111-1111-1111-111111111111',
        'fullName': 'Dr. Sharma',
      },
    },
  };

  setUp(() {
    mockApiClient = MockApiClient();
    appointmentsService = AppointmentsService(apiClient: mockApiClient);
  });

  group('AppointmentsService getAppointments Tests', () {
    test('sends required serviceDate and parses response', () async {
      when(() => mockApiClient.get(
            '/appointments',
            queryParameters: any(named: 'queryParameters'),
          )).thenAnswer((_) async => Response(
            requestOptions: RequestOptions(path: '/appointments'),
            statusCode: 200,
            data: {
              'data': [sampleAppointmentJson],
              'meta': {
                'page': 1,
                'limit': 20,
                'total': 1,
                'totalPages': 1,
              },
            },
          ));

      final result = await appointmentsService.getAppointments(
        serviceDate: '2026-10-26',
        doctorId: 'd1111111-1111-1111-1111-111111111111',
        status: AppointmentStatus.scheduled,
      );

      expect(result.data.length, 1);
      expect(result.data.first.id, 'a1111111-1111-1111-1111-111111111111');

      verify(() => mockApiClient.get(
            '/appointments',
            queryParameters: {
              'serviceDate': '2026-10-26',
              'page': 1,
              'limit': 20,
              'doctorId': 'd1111111-1111-1111-1111-111111111111',
              'status': 'SCHEDULED',
            },
          )).called(1);
    });
  });

  group('AppointmentsService getAppointmentById Tests', () {
    test('retrieves single appointment by ID', () async {
      when(() => mockApiClient.get('/appointments/a1111111-1111-1111-1111-111111111111'))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/appointments/a1111111-1111-1111-1111-111111111111'),
                statusCode: 200,
                data: sampleAppointmentJson,
              ));

      final apt = await appointmentsService.getAppointmentById('a1111111-1111-1111-1111-111111111111');

      expect(apt.id, 'a1111111-1111-1111-1111-111111111111');
      expect(apt.patient?.fullName, 'Aarav Patel');
    });

    test('rethrows 404 ApiException when appointment is not found', () async {
      when(() => mockApiClient.get(any())).thenThrow(
        const NotFoundException(message: 'Appointment not found'),
      );

      expect(
        () => appointmentsService.getAppointmentById('non-existent'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404)),
      );
    });
  });

  group('AppointmentsService createAppointment Tests', () {
    test('validates client-side before sending network request', () async {
      const invalidReq = CreateAppointmentRequest(
        patientId: 'bad-uuid',
        doctorId: '',
        serviceDate: '',
        startTime: '',
      );

      expect(
        () => appointmentsService.createAppointment(invalidReq),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 400)),
      );

      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });

    test('successfully sends POST /appointments and returns created entity', () async {
      const req = CreateAppointmentRequest(
        patientId: 'b1111111-1111-1111-1111-111111111111',
        doctorId: 'd1111111-1111-1111-1111-111111111111',
        serviceDate: '2026-10-26',
        startTime: '2026-10-26T10:00:00+05:30',
        endTime: '2026-10-26T10:30:00+05:30',
      );

      when(() => mockApiClient.post('/appointments', data: any(named: 'data')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/appointments'),
                statusCode: 201,
                data: sampleAppointmentJson,
              ));

      final created = await appointmentsService.createAppointment(req);

      expect(created.id, 'a1111111-1111-1111-1111-111111111111');
      verify(() => mockApiClient.post('/appointments', data: any(named: 'data'))).called(1);
    });
  });

  group('AppointmentsService rescheduleAppointment Tests', () {
    test('successfully posts reschedule request and returns replacement', () async {
      const req = RescheduleAppointmentRequest(
        serviceDate: '2026-10-27',
        startTime: '2026-10-27T11:00:00+05:30',
        endTime: '2026-10-27T11:30:00+05:30',
        notes: 'Rescheduled',
      );

      when(() => mockApiClient.post(
            '/appointments/a1111111-1111-1111-1111-111111111111/reschedule',
            data: any(named: 'data'),
          )).thenAnswer((_) async => Response(
            requestOptions: RequestOptions(path: '/reschedule'),
            statusCode: 200,
            data: sampleAppointmentJson,
          ));

      final replacement = await appointmentsService.rescheduleAppointment(
        'a1111111-1111-1111-1111-111111111111',
        req,
      );

      expect(replacement.id, 'a1111111-1111-1111-1111-111111111111');
    });

    test('rethrows 409 Conflict when appointment cannot be rescheduled', () async {
      const req = RescheduleAppointmentRequest(
        serviceDate: '2026-10-27',
        startTime: '2026-10-27T11:00:00+05:30',
      );

      when(() => mockApiClient.post(any(), data: any(named: 'data'))).thenThrow(
        ApiException(
          message: 'Cannot reschedule a checked-in appointment',
          statusCode: 409,
        ),
      );

      expect(
        () => appointmentsService.rescheduleAppointment('checked-in-id', req),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });
  });

  group('AppointmentsService cancelAppointment Tests', () {
    test('validates non-empty cancellationReason before sending network request', () async {
      const emptyReq = CancelAppointmentRequest(cancellationReason: '   ');

      expect(
        () => appointmentsService.cancelAppointment('a1', emptyReq),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 400)),
      );

      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });

    test('successfully sends cancel request and returns updated appointment', () async {
      const req = CancelAppointmentRequest(cancellationReason: 'Patient cancelled');
      final cancelledJson = Map<String, dynamic>.from(sampleAppointmentJson)
        ..['status'] = 'CANCELLED'
        ..['cancellationReason'] = 'Patient cancelled';

      when(() => mockApiClient.post(
            '/appointments/a1111111-1111-1111-1111-111111111111/cancel',
            data: any(named: 'data'),
          )).thenAnswer((_) async => Response(
            requestOptions: RequestOptions(path: '/cancel'),
            statusCode: 200,
            data: cancelledJson,
          ));

      final cancelled = await appointmentsService.cancelAppointment(
        'a1111111-1111-1111-1111-111111111111',
        req,
      );

      expect(cancelled.status, AppointmentStatus.cancelled);
      expect(cancelled.cancellationReason, 'Patient cancelled');
    });
  });
}
