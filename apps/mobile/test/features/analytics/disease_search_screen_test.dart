import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/analytics/models/disease_search.dart';
import 'package:doctor_opd_mobile/features/analytics/services/analytics_service.dart';
import 'package:doctor_opd_mobile/features/analytics/ui/disease_search_screen.dart';

class MockAnalyticsService extends Mock implements AnalyticsService {}

void main() {
  late MockAnalyticsService mockService;

  final sampleResponse = DiseaseSearchResponse(
    searchTerm: 'fever',
    totalConsultations: 2,
    uniquePatients: 2,
    diagnosisMatchesCount: 1,
    clinicalNoteMatchesCount: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
    results: [
      DiseaseSearchResultItem(
        consultationId: 'c-101',
        consultationDate: DateTime(2026, 11, 7, 10, 30),
        patientId: 'p-1',
        patientName: 'Mayan Kumar',
        patientUhid: 'UHID-001',
        recordedDiagnosis: 'Viral Fever with URTI',
        matchCategory: MatchCategory.both,
        matchedFields: ['Diagnosis', 'Chief Complaint'],
        snippet: '...complaints of High fever...',
        status: 'FINALIZED',
      ),
      DiseaseSearchResultItem(
        consultationId: 'c-102',
        consultationDate: DateTime(2026, 11, 6, 14, 0),
        patientId: 'p-2',
        patientName: 'Priya Sharma',
        patientUhid: 'UHID-002',
        recordedDiagnosis: 'Acute Bronchitis',
        matchCategory: MatchCategory.clinicalNote,
        matchedFields: ['Symptoms'],
        snippet: '...mild fever and persistent cough...',
        status: 'FINALIZED',
      ),
    ],
  );

  setUp(() {
    mockService = MockAnalyticsService();
    when(() => mockService.fetchDiseaseSuggestions(q: any(named: 'q')))
        .thenAnswer((_) async => ['Acute URTI', 'Viral Fever', 'Hypertension']);
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: DiseaseSearchScreen(analyticsService: mockService),
    );
  }

  group('DiseaseSearchScreen Widget Tests', () {
    testWidgets('renders initial prompt state and suggestion chips', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Disease Search'), findsOneWidget);
      expect(find.text('Search Historical Consultations'), findsOneWidget);
      expect(find.text('Recorded Diagnoses in Practice'), findsOneWidget);
      expect(find.text('Viral Fever'), findsOneWidget);
      expect(find.text('Hypertension'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('executes search and renders aggregation banner and result cards', (tester) async {
      when(() => mockService.searchDiseases(
            q: any(named: 'q'),
            period: any(named: 'period'),
            startDate: any(named: 'startDate'),
            endDate: any(named: 'endDate'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => sampleResponse);

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Enter search term and submit
      await tester.enterText(find.byType(TextField), 'fever');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      // Verify aggregation banner
      expect(find.text('Results for "fever"'), findsOneWidget);
      expect(find.text('2 Consultations'), findsOneWidget);
      expect(find.text('Unique Patients'), findsOneWidget);
      expect(find.text('Diagnosis Matches'), findsOneWidget);
      expect(find.text('Clinical Note Matches'), findsOneWidget);

      // Verify patient names and UHIDs
      expect(find.text('Mayan Kumar'), findsOneWidget);
      expect(find.text('Priya Sharma'), findsOneWidget);

      // Verify match category badges
      expect(find.text('Diagnosis & Note Match'), findsOneWidget);
      expect(find.text('Clinical Note Match'), findsOneWidget);

      // Verify clinical diagnosis truthfulness: Priya's diagnosis is Acute Bronchitis
      expect(find.text('Acute Bronchitis'), findsOneWidget);
      expect(find.text('Viral Fever with URTI'), findsOneWidget);
    });

    testWidgets('renders zero results empty state properly', (tester) async {
      const emptyResponse = DiseaseSearchResponse(
        searchTerm: 'nonexistent',
        totalConsultations: 0,
        uniquePatients: 0,
        diagnosisMatchesCount: 0,
        clinicalNoteMatchesCount: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        results: [],
      );

      when(() => mockService.searchDiseases(
            q: any(named: 'q'),
            period: any(named: 'period'),
            startDate: any(named: 'startDate'),
            endDate: any(named: 'endDate'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenAnswer((_) async => emptyResponse);

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'nonexistent');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      expect(find.text('No consultations found matching "nonexistent"'), findsOneWidget);
    });

    testWidgets('handles error state and allows retry', (tester) async {
      when(() => mockService.searchDiseases(
            q: any(named: 'q'),
            period: any(named: 'period'),
            startDate: any(named: 'startDate'),
            endDate: any(named: 'endDate'),
            page: any(named: 'page'),
            limit: any(named: 'limit'),
          )).thenThrow(const ApiException(message: 'Connection timed out', statusCode: 504));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'fever');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      expect(find.text('Connection timed out'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}

