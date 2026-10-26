import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/queue/models/check_in_request.dart';
import 'package:doctor_opd_mobile/features/queue/models/queue_entry.dart';
import 'package:doctor_opd_mobile/features/queue/models/update_queue_status_request.dart';
import 'package:doctor_opd_mobile/features/queue/services/queue_service.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _mockResponse(dynamic data, {String path = '/'}) {
  return Response(
    requestOptions: RequestOptions(path: path),
    statusCode: 200,
    data: data,
  );
}

void main() {
  late MockApiClient mockApiClient;
  late QueueService queueService;

  const validClinicId = 'c1111111-1111-1111-1111-111111111111';
  const validPatientId = 'b1111111-1111-1111-1111-111111111111';
  const validDoctorId = 'd1111111-1111-1111-1111-111111111111';
  const validApptId = 'a1111111-1111-1111-1111-111111111111';
  const validEntryId = 'e1111111-1111-1111-1111-111111111111';

  final sampleEntryJson = {
    'id': validEntryId,
    'clinicId': validClinicId,
    'patientId': validPatientId,
    'doctorId': validDoctorId,
    'appointmentId': validApptId,
    'serviceDate': '2026-10-26',
    'tokenNumber': 7,
    'status': 'WAITING',
    'priority': 0,
    'checkInTime': '2026-10-26T08:30:00.000Z',
    'createdAt': '2026-10-26T08:30:00.000Z',
    'updatedAt': '2026-10-26T08:30:00.000Z',
    'patient': {
      'id': validPatientId,
      'uhid': 'UHID-001',
      'fullName': 'Meera Sen',
    },
    'doctor': {
      'userId': validDoctorId,
      'role': 'DOCTOR',
      'user': {
        'id': validDoctorId,
        'fullName': 'Dr. Sharma',
      },
    },
  };

  setUp(() {
    mockApiClient = MockApiClient();
    queueService = QueueService(apiClient: mockApiClient);
  });

  group('QueueService.getQueue', () {
    test('calls GET /queue with required serviceDate and optional status filter',
        () async {
      when(() => mockApiClient.get(
            '/queue',
            queryParameters: {
              'serviceDate': '2026-10-26',
              'status': 'WAITING',
            },
          )).thenAnswer((_) async => _mockResponse({
            'data': [sampleEntryJson],
            'total': 1,
          }, path: '/queue'));

      final response = await queueService.getQueue(
        serviceDate: '2026-10-26',
        status: QueueStatus.waiting,
      );

      expect(response.total, 1);
      expect(response.data.length, 1);
      expect(response.data.first.tokenNumber, 7);
      expect(response.data.first.status, QueueStatus.waiting);
      expect(response.data.first.patient?.fullName, 'Meera Sen');

      verify(() => mockApiClient.get(
            '/queue',
            queryParameters: {
              'serviceDate': '2026-10-26',
              'status': 'WAITING',
            },
          )).called(1);
    });

    test('calls GET /queue with doctorId when provided', () async {
      when(() => mockApiClient.get(
            '/queue',
            queryParameters: {
              'serviceDate': '2026-10-26',
              'doctorId': validDoctorId,
            },
          )).thenAnswer((_) async => _mockResponse({
            'data': [sampleEntryJson],
            'total': 1,
          }, path: '/queue'));

      final response = await queueService.getQueue(
        serviceDate: '2026-10-26',
        doctorId: validDoctorId,
      );

      expect(response.total, 1);
      expect(response.data.first.doctorId, validDoctorId);
    });

    test('handles items array fallback if backend returns items instead of data',
        () async {
      when(() => mockApiClient.get(
            '/queue',
            queryParameters: {'serviceDate': '2026-10-26'},
          )).thenAnswer((_) async => _mockResponse({
            'items': [sampleEntryJson],
            'total': 1,
          }, path: '/queue'));

      final response = await queueService.getQueue(serviceDate: '2026-10-26');
      expect(response.total, 1);
      expect(response.data.length, 1);
    });

    test('propagates ApiException when backend returns error', () async {
      when(() => mockApiClient.get(
            '/queue',
            queryParameters: any(named: 'queryParameters'),
          )).thenThrow(ApiException(statusCode: 403, message: 'Forbidden tenant'));

      expect(
        () => queueService.getQueue(serviceDate: '2026-10-26'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 403)),
      );
    });
  });

  group('QueueService.checkIn', () {
    test('submits valid appointment check-in with idempotencyKey', () async {
      when(() => mockApiClient.post(
            '/queue/check-in',
            data: any(named: 'data'),
          )).thenAnswer((_) async => _mockResponse(sampleEntryJson, path: '/queue/check-in'));

      final req = CheckInRequest.forAppointment(
        validApptId,
        idempotencyKey: 'idem-test-key',
      );

      final result = await queueService.checkIn(req);

      expect(result.id, validEntryId);
      expect(result.tokenNumber, 7);

      verify(() => mockApiClient.post(
            '/queue/check-in',
            data: {
              'appointmentId': validApptId,
              'priority': 0,
              'idempotencyKey': 'idem-test-key',
            },
          )).called(1);
    });

    test('submits valid walk-in check-in with patientId, doctorId, priority',
        () async {
      when(() => mockApiClient.post(
            '/queue/check-in',
            data: any(named: 'data'),
          )).thenAnswer((_) async => _mockResponse(sampleEntryJson, path: '/queue/check-in'));

      final req = CheckInRequest.forWalkIn(
        patientId: validPatientId,
        doctorId: validDoctorId,
        priority: 5,
        serviceDate: '2026-10-26',
      );

      final result = await queueService.checkIn(req);

      expect(result.id, validEntryId);
      verify(() => mockApiClient.post(
            '/queue/check-in',
            data: any(
              named: 'data',
              that: isA<Map<String, dynamic>>()
                  .having((m) => m['patientId'], 'patientId', validPatientId)
                  .having((m) => m['doctorId'], 'doctorId', validDoctorId)
                  .having((m) => m['priority'], 'priority', 5)
                  .having((m) => m['serviceDate'], 'serviceDate', '2026-10-26')
                  .having((m) => m.containsKey('idempotencyKey'), 'hasIdem', isTrue),
            ),
          )).called(1);
    });

    test('validates request before submitting and throws ApiException on invalid input',
        () async {
      const invalidReq = CheckInRequest(appointmentId: '');

      expect(
        () => queueService.checkIn(invalidReq),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 400)),
      );

      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });

    test('propagates 409 Conflict if appointment already checked in', () async {
      when(() => mockApiClient.post(
            '/queue/check-in',
            data: any(named: 'data'),
          )).thenThrow(ApiException(
        statusCode: 409,
        message: 'Appointment already checked in for today',
      ));

      final req = CheckInRequest.forAppointment(validApptId);

      expect(
        () => queueService.checkIn(req),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });
  });

  group('QueueService.updateStatus', () {
    test('calls PATCH /queue/:id/status with serialized status', () async {
      when(() => mockApiClient.patch(
            '/queue/$validEntryId/status',
            data: {'status': 'CALLED'},
          )).thenAnswer((_) async => _mockResponse({
            ...sampleEntryJson,
            'status': 'CALLED',
            'calledAt': '2026-10-26T08:45:00.000Z',
          }, path: '/queue/$validEntryId/status'));

      final updated = await queueService.updateStatus(
        validEntryId,
        UpdateQueueStatusRequest(status: QueueStatus.called),
      );

      expect(updated.status, QueueStatus.called);
      expect(updated.calledAt, isNotNull);

      verify(() => mockApiClient.patch(
            '/queue/$validEntryId/status',
            data: {'status': 'CALLED'},
          )).called(1);
    });

    test('propagates 403 Forbidden when unauthorized role attempts transition',
        () async {
      when(() => mockApiClient.patch(
            '/queue/$validEntryId/status',
            data: any(named: 'data'),
          )).thenThrow(ApiException(
        statusCode: 403,
        message: 'Only the attending doctor can complete consultation',
      ));

      expect(
        () => queueService.updateStatus(
          validEntryId,
          UpdateQueueStatusRequest(status: QueueStatus.completed),
        ),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 403)),
      );
    });
  });
}
