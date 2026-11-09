import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/analytics/ui/widgets/analytics_charts.dart';

void main() {
  group('DailyBarChart Widget Tests', () {
    testWidgets('renders empty message when items list is empty', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DailyBarChart(
              title: 'Daily Patient Consultations',
              items: [],
              emptyMessage: 'No consultations recorded in this period',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Daily Patient Consultations'), findsOneWidget);
      expect(find.text('No consultations recorded in this period'), findsOneWidget);
    });

    testWidgets('renders single data point with bounded bar width and visible value and date', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DailyBarChart(
              title: 'Daily Patient Consultations',
              items: [
                DailyBarChartItem(label: '2026-11-07', value: 4.0),
              ],
              barColor: Colors.purple,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Daily Patient Consultations'), findsOneWidget);
      expect(find.text('Max: 4'), findsOneWidget);
      // Value above bar
      expect(find.text('4'), findsWidgets); // Can appear in Y-axis and on bar
      // Date label below bar
      expect(find.text('7 Nov'), findsOneWidget);
      // Y-axis tick values
      expect(find.text('0'), findsWidgets);
      expect(find.text('2'), findsWidgets);
    });

    testWidgets('renders single data point with max value 2 (New Registrations)', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DailyBarChart(
              title: 'Daily New Patient Registrations',
              items: [
                DailyBarChartItem(label: '2026-11-07', value: 2.0),
              ],
              barColor: Colors.teal,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Daily New Patient Registrations'), findsOneWidget);
      expect(find.text('Max: 2'), findsOneWidget);
      expect(find.text('2'), findsWidgets);
      expect(find.text('1'), findsWidgets);
      expect(find.text('0'), findsWidgets);
      expect(find.text('7 Nov'), findsOneWidget);
    });

    testWidgets('renders multiple items with proper scaling and values', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DailyBarChart(
              title: 'Daily Patient Consultations',
              items: [
                DailyBarChartItem(label: '2026-11-01', value: 1.0),
                DailyBarChartItem(label: '2026-11-02', value: 3.0),
                DailyBarChartItem(label: '2026-11-03', value: 0.0),
                DailyBarChartItem(label: '2026-11-04', value: 4.0),
              ],
              barColor: Colors.purple,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Daily Patient Consultations'), findsOneWidget);
      expect(find.text('Max: 4'), findsOneWidget);
      expect(find.text('1 Nov'), findsOneWidget);
      expect(find.text('2 Nov'), findsOneWidget);
      expect(find.text('3 Nov'), findsOneWidget);
      expect(find.text('4 Nov'), findsOneWidget);
    });

    testWidgets('renders zero maximum value cleanly without crashing', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DailyBarChart(
              title: 'Daily Patient Consultations',
              items: [
                DailyBarChartItem(label: '2026-11-07', value: 0.0),
              ],
              barColor: Colors.purple,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Daily Patient Consultations'), findsOneWidget);
      expect(find.text('Max: 0'), findsOneWidget);
      expect(find.text('7 Nov'), findsOneWidget);
    });

    testWidgets('renders currency prefix for revenue trend charts', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DailyBarChart(
              title: 'Daily Revenue Trend (₹)',
              items: [
                DailyBarChartItem(label: '2026-11-07', value: 1200.0),
              ],
              valuePrefix: '₹',
              barColor: Colors.green,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Daily Revenue Trend (₹)'), findsOneWidget);
      expect(find.text('Max: ₹1.2k'), findsOneWidget);
      expect(find.text('7 Nov'), findsOneWidget);
      expect(find.text('₹0'), findsOneWidget);
    });
  });
}

