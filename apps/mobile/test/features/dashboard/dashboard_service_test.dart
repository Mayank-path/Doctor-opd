import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/dashboard/services/dashboard_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late DashboardService dashboardService;

  const testClinicId = '550e8400-e29b-41d4-a716-446655440000';

  setUp(() {
    mockApiClient = MockApiClient();
    dashboardService = DashboardService(apiClient: mockApiClient);
  });

  group('DashboardService Unit Tests', () {
    test('getClinicLocalDate correctly formats Asia/Kolkata date', () {
      // 2026-10-25 20:00:00 UTC is 2026-10-26 01:30:00 Asia/Kolkata
      final utcNight = DateTime.utc(2026, 10, 25, 20, 0);
      final dateStr = DashboardService.getClinicLocalDate(utcNight);
      expect(dateStr, equals('2026-10-26'));

      // Regular morning
      final utcMorning = DateTime.utc(2026, 10, 26, 6, 0);
      expect(DashboardService.getClinicLocalDate(utcMorning), equals('2026-10-26'));
    });

    test('fetchDashboardStats successfully aggregates data for ADMIN user', () async {
      // 1. Mock Patients endpoint
      when(() => mockApiClient.get('/patients', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients'),
                statusCode: 200,
                data: {
                  'data': [
                    {
                      'id': 'pat-1',
                      'uhid': 'UHID-2026-0001',
                      'fullName': 'Aarav Patel',
                      'gender': 'MALE',
                      'phone': '+919876543210',
                      'createdAt': '2026-10-26T04:00:00.000Z',
                    }
                  ],
                  'meta': {
                    'page': 1,
                    'limit': 5,
                    'total': 1,
                    'totalPages': 1,
                  },
                },
              ));

      // 2. Mock Appointments endpoint
      when(() => mockApiClient.get('/appointments', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/appointments'),
                statusCode: 200,
                data: {
                  'data': [
                    {
                      'id': 'apt-1',
                      'serviceDate': '2026-10-26T00:00:00.000Z',
                      'startTime': '2026-10-26T05:00:00.000Z',
                      'endTime': '2026-10-26T05:15:00.000Z',
                      'type': 'SCHEDULED',
                      'status': 'SCHEDULED',
                      'patient': {
                        'id': 'pat-1',
                        'uhid': 'UHID-2026-0001',
                        'fullName': 'Aarav Patel',
                      },
                      'doctor': {
                        'userId': 'doc-1',
                        'role': 'DOCTOR',
                        'user': {'fullName': 'Dr. Sharma'},
                      },
                    }
                  ],
                  'meta': {
                    'page': 1,
                    'limit': 10,
                    'total': 1,
                    'totalPages': 1,
                  },
                },
              ));

      // 3. Mock Queue endpoint with multiple statuses
      when(() => mockApiClient.get('/queue', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/queue'),
                statusCode: 200,
                data: {
                  'total': 3,
                  'data': [
                    {
                      'id': 'q-1',
                      'tokenNumber': 1,
                      'status': 'WAITING',
                      'priority': 0,
                      'patient': {'fullName': 'Aarav Patel', 'uhid': 'UHID-001'},
                    },
                    {
                      'id': 'q-2',
                      'tokenNumber': 2,
                      'status': 'CALLED',
                      'priority': 1,
                      'patient': {'fullName': 'Sunita Rao', 'uhid': 'UHID-002'},
                    },
                    {
                      'id': 'q-3',
                      'tokenNumber': 3,
                      'status': 'COMPLETED',
                      'priority': 0,
                      'patient': {'fullName': 'Mohan Das', 'uhid': 'UHID-003'},
                    },
                  ],
                },
              ));

      // 4. Mock Consultations endpoint: throws 403 role ADMIN not authorized
      when(() => mockApiClient.get('/consultations', queryParameters: any(named: 'queryParameters')))
          .thenThrow(const ApiException(
            statusCode: 403,
            message: 'Access denied: role ADMIN is not authorized for this operation',
          ));

      // 5. Mock Health endpoint
      when(() => mockApiClient.get('/health'))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/health'),
                statusCode: 200,
                data: {'status': 'ok'},
              ));

      final stats = await dashboardService.fetchDashboardStats(
        clinicId: testClinicId,
        serviceDate: '2026-10-26',
      );

      expect(stats.clinicId, equals(testClinicId));
      expect(stats.serviceDate, equals('2026-10-26'));
      expect(stats.totalPatients, equals(1));
      expect(stats.recentPatients.length, equals(1));
      expect(stats.recentPatients.first.fullName, equals('Aarav Patel'));
      expect(stats.totalAppointmentsToday, equals(1));
      expect(stats.appointmentsToday.first.patientName, equals('Aarav Patel'));
      expect(stats.totalQueueToday, equals(3));
      expect(stats.queueWaitingCount, equals(1));
      expect(stats.queueCalledCount, equals(1));
      expect(stats.queueCompletedCount, equals(1));
      expect(stats.isDoctor, isFalse);
      expect(stats.detectedRole, equals('ADMIN'));
      expect(stats.consultationRestrictionMessage, contains('Doctor role'));
      expect(stats.healthStatus, equals('online'));
    });

    test('fetchDashboardStats detects DOCTOR role when consultations endpoint succeeds', () async {
      when(() => mockApiClient.get('/patients', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/patients'),
                statusCode: 200,
                data: {'data': [], 'meta': {'total': 0}},
              ));
      when(() => mockApiClient.get('/appointments', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/appointments'),
                statusCode: 200,
                data: {'data': [], 'meta': {'total': 0}},
              ));
      when(() => mockApiClient.get('/queue', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/queue'),
                statusCode: 200,
                data: {'total': 0, 'data': []},
              ));
      when(() => mockApiClient.get('/consultations', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/consultations'),
                statusCode: 200,
                data: {'data': []},
              ));
      when(() => mockApiClient.get('/health'))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/health'),
                statusCode: 200,
                data: {'status': 'ok'},
              ));

      final stats = await dashboardService.fetchDashboardStats(clinicId: testClinicId);

      expect(stats.isDoctor, isTrue);
      expect(stats.detectedRole, equals('DOCTOR'));
      expect(stats.consultationRestrictionMessage, isNull);
    });

    test('fetchDashboardStats rethrows 403 Forbidden when user is not a member of the clinic', () async {
      when(() => mockApiClient.get('/patients', queryParameters: any(named: 'queryParameters')))
          .thenThrow(const ApiException(
            statusCode: 403,
            message: 'Access denied: user is not a member of the requested clinic',
          ));

      expect(
        () => dashboardService.fetchDashboardStats(clinicId: 'unauthorized-clinic'),
        throwsA(isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('not a member'),
        )),
      );
    });
  });
}
