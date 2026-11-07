import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/analytics/models/practice_analytics.dart';
import 'package:doctor_opd_mobile/features/analytics/services/analytics_service.dart';
import 'package:doctor_opd_mobile/features/analytics/ui/practice_analytics_screen.dart';

class MockAnalyticsService extends Mock implements AnalyticsService {}

void main() {
  late MockAnalyticsService mockService;

  const mockOverview = PracticeOverview(
    period: '30d',
    startDate: '2026-10-09T00:00:00.000Z',
    endDate: '2026-11-07T23:59:59.999Z',
    totalPatients: 150,
    newPatients: 25,
    returningPatients: 10,
    uniquePatientsSeen: 35,
    totalConsultations: 40,
    averagePatientsPerDay: 1.2,
    todayRevenue: 1200.0,
    periodRevenue: 18000.0,
    totalSuccessfulPayments: 36,
  );

  const mockPatientAnalytics = PatientAnalytics(
    period: '30d',
    startDate: '2026-10-09T00:00:00.000Z',
    endDate: '2026-11-07T23:59:59.999Z',
    totalPatients: 150,
    newPatients: 25,
    returningPatients: 10,
    uniquePatientsSeen: 35,
    totalConsultations: 40,
    averagePatientsPerDay: 1.2,
    dailyRegistrations: [
      DateBucketCount(date: '2026-11-01', count: 5),
      DateBucketCount(date: '2026-11-02', count: 8),
    ],
    dailyConsultations: [
      DailyConsultationTrend(date: '2026-11-01', consultationCount: 6, uniquePatientCount: 5),
      DailyConsultationTrend(date: '2026-11-02', consultationCount: 12, uniquePatientCount: 9),
    ],
  );

  const mockRevenueAnalytics = RevenueAnalytics(
    period: '30d',
    startDate: '2026-10-09T00:00:00.000Z',
    endDate: '2026-11-07T23:59:59.999Z',
    todayRevenue: 1200.0,
    periodRevenue: 18000.0,
    last7DaysRevenue: 4500.0,
    last30DaysRevenue: 18000.0,
    monthlyRevenue: 12000.0,
    totalSuccessfulPayments: 36,
    dailyRevenue: [
      DailyRevenueTrend(date: '2026-11-01', amount: 3000.0, transactionCount: 6),
      DailyRevenueTrend(date: '2026-11-02', amount: 6000.0, transactionCount: 12),
    ],
    weeklyRevenue: [
      WeeklyRevenueTrend(week: '2026-W44', startDate: '2026-10-27', amount: 9000.0, transactionCount: 18),
    ],
    monthlyRevenueTrend: [
      MonthlyRevenueTrend(month: '2026-11', amount: 18000.0, transactionCount: 36),
    ],
    paymentMethodDistribution: [
      PaymentMethodBreakdown(method: 'UPI', amount: 12000.0, count: 24, percentage: 66.7),
      PaymentMethodBreakdown(method: 'CASH', amount: 6000.0, count: 12, percentage: 33.3),
    ],
  );

  setUp(() {
    mockService = MockAnalyticsService();

    when(() => mockService.fetchOverview(
          period: any(named: 'period'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
        )).thenAnswer((_) async => mockOverview);

    when(() => mockService.fetchPatientAnalytics(
          period: any(named: 'period'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
        )).thenAnswer((_) async => mockPatientAnalytics);

    when(() => mockService.fetchRevenueAnalytics(
          period: any(named: 'period'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
        )).thenAnswer((_) async => mockRevenueAnalytics);
  });

  Widget createWidget() {
    return MaterialApp(
      home: PracticeAnalyticsScreen(analyticsService: mockService),
    );
  }

  group('PracticeAnalyticsScreen Widget Tests', () {
    testWidgets('renders overview cards with patient and revenue stats', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      expect(find.text('Practice Analytics'), findsOneWidget);
      expect(find.text('Overview'), findsOneWidget);
      expect(find.text('Patients'), findsOneWidget);
      expect(find.text('Revenue'), findsOneWidget);

      // Stat cards in Overview tab
      expect(find.text("Today's Revenue"), findsOneWidget);
      expect(find.text('₹1200.00'), findsOneWidget);
      expect(find.text('Selected Period'), findsOneWidget);
      expect(find.text('₹18000.00'), findsOneWidget);
      expect(find.text('Total Patients'), findsOneWidget);
      expect(find.text('150'), findsOneWidget);
      expect(find.text('New Patients'), findsOneWidget);
      expect(find.text('25'), findsOneWidget);
      expect(find.text('Returning Patients'), findsOneWidget);
      expect(find.text('10'), findsOneWidget);
      expect(find.text('Total Consultations'), findsOneWidget);
      expect(find.text('40'), findsOneWidget);
    });

    testWidgets('switches to Patients tab and renders patient trend charts', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      // Tap Patients tab
      await tester.tap(find.text('Patients'));
      await tester.pumpAndSettle();

      expect(find.text('Daily Patient Consultations'), findsOneWidget);
      expect(find.text('Daily New Patient Registrations'), findsOneWidget);
    });

    testWidgets('switches to Revenue tab and renders daily trend and payment breakdown', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      // Tap Revenue tab
      await tester.tap(find.text('Revenue'));
      await tester.pumpAndSettle();

      expect(find.text('Daily Revenue Trend (₹)'), findsOneWidget);
      expect(find.text('Payment Methods Breakdown'), findsOneWidget);
      expect(find.text('UPI'), findsOneWidget);
      expect(find.text('CASH'), findsOneWidget);
      expect(find.text('₹12000.00'), findsWidgets);
      expect(find.text('₹6000.00'), findsOneWidget);
    });

    testWidgets('switching period chips triggers data re-fetch with new period', (tester) async {
      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      // Tap 'Last 7 Days' chip
      await tester.tap(find.text('Last 7 Days'));
      await tester.pumpAndSettle();

      verify(() => mockService.fetchOverview(period: '7d', startDate: null, endDate: null)).called(1);
    });

    testWidgets('displays error state with retry button when loading fails and retries on tap', (tester) async {
      when(() => mockService.fetchOverview(
            period: any(named: 'period'),
            startDate: any(named: 'startDate'),
            endDate: any(named: 'endDate'),
          )).thenThrow(
        const ApiException(
          message: 'Unable to reach analytics service',
          statusCode: 503,
        ),
      );

      await tester.pumpWidget(createWidget());
      await tester.pumpAndSettle();

      expect(find.text('Unable to reach analytics service'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      // Now reset to success and tap Retry
      when(() => mockService.fetchOverview(
            period: any(named: 'period'),
            startDate: any(named: 'startDate'),
            endDate: any(named: 'endDate'),
          )).thenAnswer((_) async => mockOverview);

      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      expect(find.text('₹1200.00'), findsOneWidget);
    });
  });
}
