import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/patients/models/paginated_patients_response.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';
import 'package:doctor_opd_mobile/features/consultations/ui/components/patient_search_selector.dart';

class MockPatientsService extends Mock implements PatientsService {}

void main() {
  late MockPatientsService mockPatientsService;

  final testPatient1 = Patient(
    id: '11111111-1111-1111-1111-111111111111',
    clinicId: 'clinic-1',
    uhid: 'UHID-000001',
    fullName: 'Pathania Jii',
    gender: 'MALE',
    dateOfBirth: '1992-05-10',
    phone: '+919876543210',
    isActive: true,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  final testPatient2 = Patient(
    id: '22222222-2222-2222-2222-222222222222',
    clinicId: 'clinic-1',
    uhid: 'UHID-000002',
    fullName: 'Rohit Sharma',
    gender: 'MALE',
    dateOfBirth: '1987-04-30',
    phone: '+919811223344',
    isActive: true,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  setUp(() {
    mockPatientsService = MockPatientsService();
  });

  Widget buildTestWidget({
    Patient? selectedPatient,
    ValueChanged<Patient?>? onPatientSelected,
    bool isLocked = false,
    String? lockReason,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) {
            Patient? current = selectedPatient;
            return PatientSearchSelector(
              patientsService: mockPatientsService,
              selectedPatient: current,
              onPatientSelected: onPatientSelected ??
                  (p) {
                    setState(() {
                      current = p;
                    });
                  },
              isLocked: isLocked,
              lockReason: lockReason,
            );
          },
        ),
      ),
    );
  }

  group('PatientSearchSelector Widget Tests', () {
    testWidgets('renders search input with prompt and clear action', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Search Patient'), findsNWidgets(2)); // Title & Label
      expect(find.byKey(const Key('patientSearchInput')), findsOneWidget);
      expect(
        find.text('Enter patient name, UHID, or phone number to find record'),
        findsOneWidget,
      );
    });

    testWidgets('searches patients by name with debouncing', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'Pathania',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [testPatient1],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'Pathania');
      // Before debounce fires
      verifyNever(() => mockPatientsService.getPatients(query: any(named: 'query')));

      // Fast forward past debounce duration
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      verify(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'Pathania',
          )).called(1);

      expect(find.text('Pathania Jii'), findsOneWidget);
      expect(find.text('UHID-000001'), findsOneWidget);
      expect(find.textContaining('+919876543210'), findsOneWidget);
    });

    testWidgets('searches patients by UHID and displays results', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'UHID-000002',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [testPatient2],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'UHID-000002');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      verify(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'UHID-000002',
          )).called(1);

      expect(find.text('Rohit Sharma'), findsOneWidget);
      expect(find.byKey(Key('patientResult_${testPatient2.id}')), findsOneWidget);
    });

    testWidgets('searches patients by phone number', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: '9811223344',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [testPatient2],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('patientSearchInput')), '9811223344');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.text('Rohit Sharma'), findsOneWidget);
    });

    testWidgets('displays empty state when no matching patients found', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'Nonexistent',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [],
            meta: const PaginationMeta(page: 1, limit: 20, total: 0, totalPages: 1),
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'Nonexistent');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('patientSearchEmptyState')), findsOneWidget);
      expect(find.textContaining('No patients found matching "Nonexistent"'), findsOneWidget);
    });

    testWidgets('displays error state and allows retry on API failure', (tester) async {
      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'ServerError',
          )).thenThrow(ApiException(message: 'Failed to fetch patients', statusCode: 500));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'ServerError');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.text('Failed to fetch patients'), findsOneWidget);
      expect(find.byKey(const Key('retrySearchButton')), findsOneWidget);

      // Now set mock to succeed on retry
      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'ServerError',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [testPatient1],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      await tester.tap(find.byKey(const Key('retrySearchButton')));
      await tester.pumpAndSettle();

      expect(find.text('Pathania Jii'), findsOneWidget);
    });

    testWidgets('stale search responses do not overwrite newer results', (tester) async {
      final slowCompleter = Completer<PaginatedPatientsResponse>();

      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'FirstQuery',
          )).thenAnswer((_) => slowCompleter.future);

      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'SecondQuery',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [testPatient2],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Trigger first search
      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'FirstQuery');
      await tester.pump(const Duration(milliseconds: 400));

      // Trigger second search before first completes
      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'SecondQuery');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      // Second query finished and shows testPatient2
      expect(find.text('Rohit Sharma'), findsOneWidget);

      // Now resolve the older/slower first query
      slowCompleter.complete(PaginatedPatientsResponse(
        data: [testPatient1],
        meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
      ));
      await tester.pumpAndSettle();

      // Stale first query results are discarded! testPatient2 remains displayed!
      expect(find.text('Rohit Sharma'), findsOneWidget);
      expect(find.text('Pathania Jii'), findsNothing);
    });

    testWidgets('selecting patient invokes callback with patient object and renders card without UUID', (tester) async {
      Patient? selected;

      when(() => mockPatientsService.getPatients(
            page: 1,
            limit: 20,
            query: 'Pathania',
          )).thenAnswer((_) async => PaginatedPatientsResponse(
            data: [testPatient1],
            meta: const PaginationMeta(page: 1, limit: 20, total: 1, totalPages: 1),
          ));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return PatientSearchSelector(
                  patientsService: mockPatientsService,
                  selectedPatient: selected,
                  onPatientSelected: (p) {
                    setState(() {
                      selected = p;
                    });
                  },
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('patientSearchInput')), 'Pathania');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(Key('patientResult_${testPatient1.id}')));
      await tester.pumpAndSettle();

      expect(selected, isNotNull);
      expect(selected!.id, equals('11111111-1111-1111-1111-111111111111'));
      expect(selected!.uhid, equals('UHID-000001'));

      // Selected card is visible
      expect(find.text('Selected Patient'), findsOneWidget);
      expect(find.text('Pathania Jii'), findsOneWidget);
      expect(find.text('UHID: UHID-000001'), findsOneWidget);
      expect(find.textContaining('+919876543210'), findsOneWidget);

      // Confirm raw internal UUID is NOT rendered anywhere as text
      expect(find.text('11111111-1111-1111-1111-111111111111'), findsNothing);
      expect(find.byKey(const Key('changePatientButton')), findsOneWidget);
    });

    testWidgets('tapping Change Patient clears selection and restores search input', (tester) async {
      Patient? selected = testPatient1;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return PatientSearchSelector(
                  patientsService: mockPatientsService,
                  selectedPatient: selected,
                  onPatientSelected: (p) {
                    setState(() {
                      selected = p;
                    });
                  },
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pathania Jii'), findsOneWidget);
      expect(find.byKey(const Key('changePatientButton')), findsOneWidget);

      await tester.tap(find.byKey(const Key('changePatientButton')));
      await tester.pumpAndSettle();

      expect(selected, isNull);
      expect(find.byKey(const Key('patientSearchInput')), findsOneWidget);
    });

    testWidgets('when isLocked is true, Change Patient button is hidden and lockReason is displayed', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        selectedPatient: testPatient1,
        isLocked: true,
        lockReason: 'Active OPD Queue Encounter',
      ));
      await tester.pumpAndSettle();

      expect(find.text('Pathania Jii'), findsOneWidget);
      expect(find.text('Active OPD Queue Encounter'), findsOneWidget);
      expect(find.byKey(const Key('changePatientButton')), findsNothing);
    });
  });
}
