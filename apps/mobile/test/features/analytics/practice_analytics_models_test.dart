import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/analytics/models/practice_analytics.dart';

void main() {
  group('Practice Analytics Models Serialization Tests', () {
    test('PracticeOverview.fromJson parses valid payload with numerical safety', () {
      final json = {
        'period': '30d',
        'startDate': '2026-10-09T00:00:00.000Z',
        'endDate': '2026-11-07T23:59:59.999Z',
        'totalPatients': 120,
        'newPatients': 15,
        'returningPatients': 8,
        'uniquePatientsSeen': 23,
        'totalConsultations': 35,
        'averagePatientsPerDay': 1.2,
        'todayRevenue': 1500.50,
        'periodRevenue': 24500.0,
        'totalSuccessfulPayments': 42,
      };

      final overview = PracticeOverview.fromJson(json);

      expect(overview.period, '30d');
      expect(overview.totalPatients, 120);
      expect(overview.newPatients, 15);
      expect(overview.returningPatients, 8);
      expect(overview.uniquePatientsSeen, 23);
      expect(overview.totalConsultations, 35);
      expect(overview.averagePatientsPerDay, 1.2);
      expect(overview.todayRevenue, 1500.50);
      expect(overview.periodRevenue, 24500.0);
      expect(overview.totalSuccessfulPayments, 42);
    });

    test('PatientAnalytics.fromJson parses daily registration and consultation trends', () {
      final json = {
        'period': '7d',
        'startDate': '2026-11-01T00:00:00.000Z',
        'endDate': '2026-11-07T23:59:59.999Z',
        'totalPatients': 50,
        'newPatients': 5,
        'returningPatients': 3,
        'uniquePatientsSeen': 8,
        'totalConsultations': 10,
        'averagePatientsPerDay': 1.1,
        'dailyRegistrations': [
          {'date': '2026-11-01', 'count': 2},
          {'date': '2026-11-02', 'count': 3},
        ],
        'dailyConsultations': [
          {'date': '2026-11-01', 'consultationCount': 4, 'uniquePatientCount': 3},
          {'date': '2026-11-02', 'consultationCount': 6, 'uniquePatientCount': 5},
        ],
      };

      final patientAnalytics = PatientAnalytics.fromJson(json);

      expect(patientAnalytics.dailyRegistrations, hasLength(2));
      expect(patientAnalytics.dailyRegistrations[0].date, '2026-11-01');
      expect(patientAnalytics.dailyRegistrations[0].count, 2);
      expect(patientAnalytics.dailyConsultations, hasLength(2));
      expect(patientAnalytics.dailyConsultations[1].consultationCount, 6);
      expect(patientAnalytics.dailyConsultations[1].uniquePatientCount, 5);
    });

    test('RevenueAnalytics.fromJson parses revenue timelines and payment method breakdown', () {
      final json = {
        'period': '30d',
        'startDate': '2026-10-09T00:00:00.000Z',
        'endDate': '2026-11-07T23:59:59.999Z',
        'todayRevenue': 500.0,
        'periodRevenue': 10000.0,
        'last7DaysRevenue': 3000.0,
        'last30DaysRevenue': 10000.0,
        'monthlyRevenue': 8000.0,
        'totalSuccessfulPayments': 20,
        'dailyRevenue': [
          {'date': '2026-11-01', 'amount': 2000.0, 'transactionCount': 4},
        ],
        'weeklyRevenue': [
          {'week': '2026-W44', 'startDate': '2026-10-27', 'amount': 5000.0, 'transactionCount': 10},
        ],
        'monthlyRevenueTrend': [
          {'month': '2026-11', 'amount': 10000.0, 'transactionCount': 20},
        ],
        'paymentMethodDistribution': [
          {'method': 'UPI', 'amount': 7000.0, 'count': 14, 'percentage': 70.0},
          {'method': 'CASH', 'amount': 3000.0, 'count': 6, 'percentage': 30.0},
        ],
      };

      final revenueAnalytics = RevenueAnalytics.fromJson(json);

      expect(revenueAnalytics.periodRevenue, 10000.0);
      expect(revenueAnalytics.todayRevenue, 500.0);
      expect(revenueAnalytics.totalSuccessfulPayments, 20);
      expect(revenueAnalytics.paymentMethodDistribution, hasLength(2));
      expect(revenueAnalytics.paymentMethodDistribution[0].method, 'UPI');
      expect(revenueAnalytics.paymentMethodDistribution[0].percentage, 70.0);
      expect(revenueAnalytics.dailyRevenue, hasLength(1));
      expect(revenueAnalytics.dailyRevenue[0].amount, 2000.0);
    });
  });
}

