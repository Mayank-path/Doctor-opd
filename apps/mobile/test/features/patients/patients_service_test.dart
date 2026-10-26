import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/patients/models/create_patient_request.dart';
import 'package:doctor_opd_mobile/features/patients/models/update_patient_request.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late PatientsService patientsService;

  final samplePatientJson = {
    'id': 'pat-1',
    'clinicId': 'clinic-1',
    'uhid': 'UHID-000001',
    'fullName': 'Aarav Sharma',
    'gender': 'MALE',
    'phone': '+919876543210',
    'isActive': true,
    'createdAt': '2026-10-24T10:00:00.000Z',
    'updatedAt': '2026-10-24T10:00:00.000Z',
  };

  setUp(() {
    mockApiClient = MockApiClient();
    patientsService = PatientsService(apiClient: mockApiClient);
  });

  group('PatientsService Tests', () {
    test('getPatients omits q parameter when query is less than 2 characters', () async {
      when(() => mockApiClient.get('/patients', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients'),
                statusCode: 200,
                data: {
                  'data': [samplePatientJson],
                  'meta': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
                },
              ));

      final res = await patientsService.getPatients(page: 1, limit: 20, query: 'A');

      expect(res.data.length, equals(1));
      expect(res.data.first.fullName, equals('Aarav Sharma'));

      final captured = verify(
        () => mockApiClient.get(
          '/patients',
          queryParameters: captureAny(named: 'queryParameters'),
        ),
      ).captured;

      final queryParams = captured.first as Map<String, dynamic>;
      expect(queryParams.containsKey('q'), isFalse);
    });

    test('getPatients sends q parameter when query is at least 2 characters', () async {
      when(() => mockApiClient.get('/patients', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients'),
                statusCode: 200,
                data: {
                  'data': [samplePatientJson],
                  'meta': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
                },
              ));

      await patientsService.getPatients(page: 1, limit: 20, query: 'Aarav');

      final captured = verify(
        () => mockApiClient.get(
          '/patients',
          queryParameters: captureAny(named: 'queryParameters'),
        ),
      ).captured;

      final queryParams = captured.first as Map<String, dynamic>;
      expect(queryParams['q'], equals('Aarav'));
    });

    test('getPatientById retrieves existing patient entity', () async {
      when(() => mockApiClient.get('/patients/pat-1'))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients/pat-1'),
                statusCode: 200,
                data: samplePatientJson,
              ));

      final patient = await patientsService.getPatientById('pat-1');

      expect(patient.id, equals('pat-1'));
      expect(patient.uhid, equals('UHID-000001'));
      expect(patient.fullName, equals('Aarav Sharma'));
    });

    test('createPatient succeeds and returns patient with server allocated UHID', () async {
      when(() => mockApiClient.post('/patients', data: any(named: 'data')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients'),
                statusCode: 201,
                data: samplePatientJson,
              ));

      const request = CreatePatientRequest(
        fullName: 'Aarav Sharma',
        gender: 'MALE',
        phone: '+919876543210',
      );

      final created = await patientsService.createPatient(request);

      expect(created.uhid, equals('UHID-000001'));
      expect(created.fullName, equals('Aarav Sharma'));
    });

    test('createPatient fails client-side validation without hitting network on invalid request', () async {
      const invalidRequest = CreatePatientRequest(
        fullName: '',
        gender: 'MALE',
        phone: '123',
      );

      expect(
        () => patientsService.createPatient(invalidRequest),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 400)),
      );

      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });

    test('updatePatient sends PATCH request and returns updated model', () async {
      when(() => mockApiClient.patch('/patients/pat-1', data: any(named: 'data')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients/pat-1'),
                statusCode: 200,
                data: {
                  ...samplePatientJson,
                  'city': 'Chennai',
                },
              ));

      const updateRequest = UpdatePatientRequest(city: 'Chennai');
      final updated = await patientsService.updatePatient('pat-1', updateRequest);

      expect(updated.city, equals('Chennai'));
    });

    test('getPatientConsultationHistory parses consultations for DOCTOR', () async {
      when(() => mockApiClient.get('/patients/pat-1/consultations', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients/pat-1/consultations'),
                statusCode: 200,
                data: {
                  'data': [
                    {
                      'id': 'cons-1',
                      'encounterDate': '2026-10-26T04:00:00.000Z',
                      'status': 'FINALIZED',
                      'chiefComplaint': 'Persistent cough',
                      'diagnosis': 'Acute bronchitis',
                    }
                  ],
                },
              ));

      final history = await patientsService.getPatientConsultationHistory('pat-1');

      expect(history.length, equals(1));
      expect(history.first.diagnosis, equals('Acute bronchitis'));
      expect(history.first.status, equals('FINALIZED'));
    });
  });
}
