import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/analytics/services/analytics_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late AnalyticsService service;

  setUp(() {
    mockApiClient = MockApiClient();
    service = AnalyticsService(apiClient: mockApiClient);
  });

  group('AnalyticsService Unit Tests', () {
    test('fetchOverview queries /analytics/overview and parses PracticeOverview', () async {
      when(() => mockApiClient.get(
            '/analytics/overview',
            queryParameters: {'period': '30d'},
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/analytics/overview'),
          statusCode: 200,
          data: {
            'period': '30d',
            'startDate': '2026-10-09T00:00:00.000Z',
            'endDate': '2026-11-07T23:59:59.999Z',
            'totalPatients': 100,
            'newPatients': 10,
            'returningPatients': 5,
            'uniquePatientsSeen': 15,
            'totalConsultations': 20,
            'averagePatientsPerDay': 0.5,
            'todayRevenue': 1000.0,
            'periodRevenue': 15000.0,
            'totalSuccessfulPayments': 30,
          },
        ),
      );

      final res = await service.fetchOverview(period: '30d');

      expect(res.totalPatients, 100);
      expect(res.periodRevenue, 15000.0);
      expect(res.todayRevenue, 1000.0);
      verify(() => mockApiClient.get(
            '/analytics/overview',
            queryParameters: {'period': '30d'},
          )).called(1);
    });

    test('fetchPatientAnalytics queries /analytics/patients with custom date range', () async {
      final start = DateTime(2026, 11, 1);
      final end = DateTime(2026, 11, 5);

      when(() => mockApiClient.get(
            '/analytics/patients',
            queryParameters: {
              'period': 'custom',
              'startDate': start.toIso8601String(),
              'endDate': end.toIso8601String(),
            },
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/analytics/patients'),
          statusCode: 200,
          data: {
            'period': 'custom',
            'startDate': start.toIso8601String(),
            'endDate': end.toIso8601String(),
            'totalPatients': 50,
            'newPatients': 5,
            'returningPatients': 2,
            'uniquePatientsSeen': 7,
            'totalConsultations': 9,
            'averagePatientsPerDay': 1.8,
            'dailyRegistrations': [],
            'dailyConsultations': [],
          },
        ),
      );

      final res = await service.fetchPatientAnalytics(
        period: 'custom',
        startDate: start,
        endDate: end,
      );

      expect(res.period, 'custom');
      expect(res.uniquePatientsSeen, 7);
    });

    test('fetchRevenueAnalytics queries /analytics/revenue and parses breakdown', () async {
      when(() => mockApiClient.get(
            '/analytics/revenue',
            queryParameters: {'period': '7d'},
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/analytics/revenue'),
          statusCode: 200,
          data: {
            'period': '7d',
            'startDate': '2026-11-01T00:00:00.000Z',
            'endDate': '2026-11-07T23:59:59.999Z',
            'todayRevenue': 500.0,
            'periodRevenue': 3500.0,
            'last7DaysRevenue': 3500.0,
            'last30DaysRevenue': 14000.0,
            'monthlyRevenue': 3500.0,
            'totalSuccessfulPayments': 7,
            'dailyRevenue': [],
            'weeklyRevenue': [],
            'monthlyRevenueTrend': [],
            'paymentMethodDistribution': [
              {'method': 'UPI', 'amount': 2500.0, 'count': 5, 'percentage': 71.4},
              {'method': 'CASH', 'amount': 1000.0, 'count': 2, 'percentage': 28.6},
            ],
          },
        ),
      );

      final res = await service.fetchRevenueAnalytics(period: '7d');

      expect(res.periodRevenue, 3500.0);
      expect(res.paymentMethodDistribution, hasLength(2));
      expect(res.paymentMethodDistribution[0].method, 'UPI');
    });

    test('recordPayment sends POST /payments and parses created response', () async {
      when(() => mockApiClient.post(
            '/payments',
            data: {
              'amount': 500.0,
              'method': 'UPI',
              'status': 'COMPLETED',
              'consultationId': 'c-1',
              'patientId': 'p-1',
            },
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/payments'),
          statusCode: 201,
          data: {
            'id': 'pay-1',
            'amount': 500.0,
            'method': 'UPI',
            'status': 'COMPLETED',
          },
        ),
      );

      final res = await service.recordPayment(
        consultationId: 'c-1',
        patientId: 'p-1',
        amount: 500.0,
        method: 'UPI',
      );

      expect(res['id'], 'pay-1');
    });

    test('handles 403 Forbidden safely without crashing', () async {
      when(() => mockApiClient.get(
            '/analytics/overview',
            queryParameters: any(named: 'queryParameters'),
          )).thenThrow(
        const ApiException(
          message: 'Access restricted: DOCTOR role required',
          statusCode: 403,
        ),
      );

      expect(
        () => service.fetchOverview(),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 403)),
      );
    });
  });
}

