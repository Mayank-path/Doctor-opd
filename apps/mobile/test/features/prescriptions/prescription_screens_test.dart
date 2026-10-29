import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/patients/models/paginated_patients_response.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/services/patients_service.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/amend_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/approve_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/create_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/paginated_prescriptions_response.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/prescription.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/prescription_item.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/update_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/services/prescriptions_service.dart';
import 'package:doctor_opd_mobile/features/prescriptions/ui/components/medication_item_card.dart';
import 'package:doctor_opd_mobile/features/prescriptions/ui/prescription_create_screen.dart';
import 'package:doctor_opd_mobile/features/prescriptions/ui/prescription_details_screen.dart';
import 'package:doctor_opd_mobile/features/prescriptions/ui/prescription_list_screen.dart';

class MockPrescriptionsService extends Mock implements PrescriptionsService {}

class MockPatientsService extends Mock implements PatientsService {}

class FakeCreatePrescriptionRequest extends Fake
    implements CreatePrescriptionRequest {}

class FakeUpdatePrescriptionRequest extends Fake
    implements UpdatePrescriptionRequest {}

class FakeApprovePrescriptionRequest extends Fake
    implements ApprovePrescriptionRequest {}

class FakeAmendPrescriptionRequest extends Fake
    implements AmendPrescriptionRequest {}

void main() {
  setUpAll(() {
    registerFallbackValue(FakeCreatePrescriptionRequest());
    registerFallbackValue(FakeUpdatePrescriptionRequest());
    registerFallbackValue(FakeApprovePrescriptionRequest());
    registerFallbackValue(FakeAmendPrescriptionRequest());
  });

  late MockPrescriptionsService mockPrescriptionsService;
  late MockPatientsService mockPatientsService;

  const validClinicId = '11111111-1111-1111-1111-111111111111';
  const validPatientId = '22222222-2222-2222-2222-222222222222';
  const validDoctorId = '33333333-3333-3333-3333-333333333333';
  const validPrescriptionId = '44444444-4444-4444-4444-444444444444';

  final testPatient = Patient(
    id: validPatientId,
    clinicId: validClinicId,
    uhid: 'UHID-2026-001',
    fullName: 'Sunita Rao',
    gender: 'FEMALE',
    dateOfBirth: '1988-06-15',
    phone: '+919876543210',
    isActive: true,
    createdAt: DateTime.parse('2026-01-01T00:00:00.000Z'),
    updatedAt: DateTime.parse('2026-01-01T00:00:00.000Z'),
  );

  const testItem = PrescriptionItem(
    id: 'item-1',
    medicationName: 'Amoxicillin',
    brandName: 'Mox 500',
    dosageForm: DosageForm.capsule,
    strength: '500 mg',
    route: MedicationRoute.oral,
    frequency: '1-0-1',
    durationValue: 5,
    durationUnit: 'DAYS',
    timing: MedicationTiming.afterMeals,
    specialInstructions: 'Drink with full glass of water',
  );

  final draftPrescription = Prescription(
    id: validPrescriptionId,
    clinicId: validClinicId,
    patientId: validPatientId,
    doctorId: validDoctorId,
    versionNumber: 1,
    status: PrescriptionStatus.draft,
    notes: 'Rest for 3 days and drink warm fluids',
    createdAt: DateTime.parse('2026-10-27T08:00:00.000Z'),
    updatedAt: DateTime.parse('2026-10-27T08:10:00.000Z'),
    patient: testPatient,
    doctor: const PrescriptionDoctorSummary(fullName: 'Dr. Ramesh Sharma'),
    items: const [testItem],
  );

  final approvedPrescription = Prescription(
    id: validPrescriptionId,
    clinicId: validClinicId,
    patientId: validPatientId,
    doctorId: validDoctorId,
    versionNumber: 1,
    status: PrescriptionStatus.approved,
    approvedAt: DateTime.parse('2026-10-27T08:30:00.000Z'),
    createdAt: DateTime.parse('2026-10-27T08:00:00.000Z'),
    updatedAt: DateTime.parse('2026-10-27T08:30:00.000Z'),
    patient: testPatient,
    doctor: const PrescriptionDoctorSummary(fullName: 'Dr. Ramesh Sharma'),
    items: const [testItem],
  );

  setUp(() {
    mockPrescriptionsService = MockPrescriptionsService();
    mockPatientsService = MockPatientsService();

    when(() => mockPatientsService.getPatientById(validPatientId))
        .thenAnswer((_) async => testPatient);

    when(() => mockPatientsService.getPatients(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
          query: any(named: 'query'),
        )).thenAnswer((_) async => PaginatedPatientsResponse(
          data: [testPatient],
          meta: const PaginationMeta(total: 1, page: 1, limit: 10, totalPages: 1),
        ));

    when(() => mockPrescriptionsService.getPrescriptions(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
          patientId: any(named: 'patientId'),
          consultationId: any(named: 'consultationId'),
          status: any(named: 'status'),
        )).thenAnswer((_) async => PaginatedPrescriptionsResponse(
          data: [draftPrescription],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        ));
  });

  Widget buildTestableWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  group('PrescriptionCreateScreen Tests', () {
    testWidgets('Mode A (Consultation-linked) displays distinct prefilled context banner', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionCreateScreen(
            consultationId: 'con-123',
            prefilledPatientId: validPatientId,
            prefilledPatientName: 'Sunita Rao',
            prefilledPatientDetails: 'FEMALE, 38 yrs • +919876543210',
            prefilledConsultationContext: 'Diagnosis: Acute Bronchitis | Complaint: Cough x 3 days',
            prescriptionsService: mockPrescriptionsService,
            patientsService: mockPatientsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify visibly distinct prefilled consultation context header
      expect(find.text('PREFILLED CONSULTATION CONTEXT'), findsOneWidget);
      expect(find.text('Sunita Rao'), findsOneWidget);
      expect(find.text('FEMALE, 38 yrs • +919876543210'), findsOneWidget);
      expect(find.text('Diagnosis: Acute Bronchitis | Complaint: Cough x 3 days'), findsOneWidget);

      // Verify that NO medication items are silently populated
      expect(find.text('No medications prescribed yet'), findsOneWidget);
      expect(find.byType(MedicationItemCard), findsNothing);
    });

    testWidgets('Mode B (Standalone) displays PatientSearchSelector and requires patient selection', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionCreateScreen(
            prescriptionsService: mockPrescriptionsService,
            patientsService: mockPatientsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('SELECT PATIENT *'), findsOneWidget);
      expect(find.text('Search by name, UHID or phone number'), findsOneWidget);

      // Attempting to save without selecting a patient shows error
      await tester.tap(find.byKey(const Key('saveDraftPrescriptionButton')));
      await tester.pumpAndSettle();

      expect(find.text('Please select a patient before saving'), findsOneWidget);
    });

    testWidgets('Adding and removing medication items dynamically updates draft list', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionCreateScreen(
            prefilledPatientId: validPatientId,
            prefilledPatientName: 'Sunita Rao',
            prescriptionsService: mockPrescriptionsService,
            patientsService: mockPatientsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No medications prescribed yet'), findsOneWidget);

      // Tap 'Add Medication' button
      await tester.tap(find.byKey(const Key('addMedicationButton')));
      await tester.pumpAndSettle();

      // Verify bottom sheet appears
      expect(find.text('Add Medication'), findsWidgets);

      // Enter Medication Name and Strength
      await tester.enterText(
        find.byKey(const Key('medicationNameInput')),
        'Paracetamol',
      );
      await tester.enterText(
        find.byKey(const Key('medicationStrengthInput')),
        '650 mg',
      );

      // Save item
      await tester.ensureVisible(find.byKey(const Key('submitMedicationButton')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('submitMedicationButton')));
      await tester.pumpAndSettle();

      // Verify item card is displayed in builder
      expect(find.byType(MedicationItemCard), findsOneWidget);
      expect(find.text('Paracetamol'), findsOneWidget);
      expect(find.text('650 mg'), findsOneWidget);

      // Tap Delete icon on the medication item card
      await tester.tap(find.byKey(const Key('deleteMedication_Paracetamol')));
      await tester.pumpAndSettle();

      // Verify item removed and undo snackbar displayed
      expect(find.byType(MedicationItemCard), findsNothing);
      expect(find.text('Removed Paracetamol'), findsOneWidget);

      // Tap UNDO
      await tester.tap(find.text('UNDO'));
      await tester.pumpAndSettle();

      // Verify item restored
      expect(find.byType(MedicationItemCard), findsOneWidget);
      expect(find.text('Paracetamol'), findsOneWidget);
    });

    testWidgets('Prior Prescriptions Reference Sheet is strictly read-only with no auto-copying', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionCreateScreen(
            prefilledPatientId: validPatientId,
            prefilledPatientName: 'Sunita Rao',
            prescriptionsService: mockPrescriptionsService,
            patientsService: mockPatientsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Prior Prescriptions' reference button
      await tester.tap(find.byKey(const Key('priorPrescriptionsButton')));
      await tester.pumpAndSettle();

      // Verify safety warning banner
      expect(find.text('CLINICAL REFERENCE ONLY (NO AUTO-COPY)'), findsOneWidget);
      expect(
        find.textContaining('Medications are never automatically copied into new orders'),
        findsOneWidget,
      );

      // Close sheet
      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();

      // Verify builder is STILL empty (no silent copying occurred)
      expect(find.text('No medications prescribed yet'), findsOneWidget);
      expect(find.byType(MedicationItemCard), findsNothing);
    });

    testWidgets('PopScope triggers discard confirmation dialog when unsaved changes exist', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionCreateScreen(
            prefilledPatientId: validPatientId,
            prefilledPatientName: 'Sunita Rao',
            initialItems: const [testItem],
            prescriptionsService: mockPrescriptionsService,
            patientsService: mockPatientsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Type in notes to mark unsaved changes
      await tester.enterText(find.byKey(const Key('prescriptionNotesField')), 'Take rest');
      await tester.pumpAndSettle();

      // Trigger back navigation
      final dynamic widgetsAppState = tester.state(find.byType(WidgetsApp));
      await widgetsAppState.didPopRoute();
      await tester.pumpAndSettle();

      // Verify discard dialog appears
      expect(find.text('Discard Prescription Draft?'), findsOneWidget);
      expect(find.text('Stay'), findsOneWidget);
      expect(find.text('Discard'), findsOneWidget);
    });

    testWidgets('Review and Approve enforces explicit confirmation before API invocation', (tester) async {
      when(() => mockPrescriptionsService.createDraft(any()))
          .thenAnswer((_) async => draftPrescription);

      when(() => mockPrescriptionsService.approve(any(), any()))
          .thenAnswer((_) async => approvedPrescription);

      when(() => mockPrescriptionsService.getPrescriptionById(any()))
          .thenAnswer((_) async => approvedPrescription);

      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionCreateScreen(
            prefilledPatientId: validPatientId,
            prefilledPatientName: 'Sunita Rao',
            initialItems: const [testItem],
            prescriptionsService: mockPrescriptionsService,
            patientsService: mockPatientsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Review & Approve'
      await tester.tap(find.byKey(const Key('reviewAndApproveButton')));
      await tester.pumpAndSettle();

      // Verify approval dialog appears
      expect(find.text('Approve Prescription'), findsOneWidget);
      expect(find.textContaining('IMMUTABILITY NOTICE'), findsOneWidget);

      // Confirm button should be disabled initially (checkbox not checked)
      final confirmBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('confirmApprovalButton')),
      );
      expect(confirmBtn.onPressed, isNull);

      // Check affirmation checkbox
      await tester.tap(find.byKey(const Key('approvalConfirmCheckboxTile')));
      await tester.pumpAndSettle();

      // Confirm button is now active
      final activeConfirmBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('confirmApprovalButton')),
      );
      expect(activeConfirmBtn.onPressed, isNotNull);

      // Tap confirm approval
      await tester.tap(find.byKey(const Key('confirmApprovalButton')));
      await tester.pumpAndSettle();

      // Verify both createDraft and approve were called with exact payload
      verify(() => mockPrescriptionsService.createDraft(any())).called(1);
      verify(() => mockPrescriptionsService.approve(
            validPrescriptionId,
            any(that: isA<ApprovePrescriptionRequest>().having(
              (r) => r.confirmApproval,
              'confirmApproval',
              isTrue,
            )),
          )).called(1);
    });
  });

  group('PrescriptionDetailsScreen Tests', () {
    testWidgets('Draft view displays editable items, Save Changes and Approve & Lock buttons', (tester) async {
      when(() => mockPrescriptionsService.getPrescriptionById(validPrescriptionId))
          .thenAnswer((_) async => draftPrescription);

      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionDetailsScreen(
            prescriptionId: validPrescriptionId,
            initialPrescription: draftPrescription,
            prescriptionsService: mockPrescriptionsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('DRAFT PRESCRIPTION (UNAPPROVED)'), findsOneWidget);
      expect(find.byKey(const Key('saveDraftChangesButton')), findsOneWidget);
      expect(find.byKey(const Key('approveDraftPrescriptionButton')), findsOneWidget);
      expect(find.byKey(const Key('addMedicationDraftButton')), findsOneWidget);

      // Medication card should have edit and delete buttons
      expect(find.byKey(const Key('editMedication_Amoxicillin')), findsOneWidget);
      expect(find.byKey(const Key('deleteMedication_Amoxicillin')), findsOneWidget);
    });

    testWidgets('Approved view renders strictly as immutable read-only record', (tester) async {
      when(() => mockPrescriptionsService.getPrescriptionById(validPrescriptionId))
          .thenAnswer((_) async => approvedPrescription);

      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionDetailsScreen(
            prescriptionId: validPrescriptionId,
            initialPrescription: approvedPrescription,
            prescriptionsService: mockPrescriptionsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify status banner
      expect(find.text('APPROVED RECORD (IMMUTABLE)'), findsOneWidget);

      // Draft actions must be hidden
      expect(find.byKey(const Key('saveDraftChangesButton')), findsNothing);
      expect(find.byKey(const Key('approveDraftPrescriptionButton')), findsNothing);
      expect(find.byKey(const Key('addMedicationDraftButton')), findsNothing);

      // Medication card edit/delete buttons must NOT exist
      expect(find.byKey(const Key('editMedication_Amoxicillin')), findsNothing);
      expect(find.byKey(const Key('deleteMedication_Amoxicillin')), findsNothing);

      // Approved actions must be visible
      expect(find.byKey(const Key('printPdfButton')), findsOneWidget);
      expect(find.byKey(const Key('amendPrescriptionButton')), findsOneWidget);
    });

    testWidgets('Tapping Amend opens PrescriptionAmendDialog and enforces clinical justification', (tester) async {
      when(() => mockPrescriptionsService.getPrescriptionById(validPrescriptionId))
          .thenAnswer((_) async => approvedPrescription);

      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionDetailsScreen(
            prescriptionId: validPrescriptionId,
            initialPrescription: approvedPrescription,
            prescriptionsService: mockPrescriptionsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Amend button
      await tester.tap(find.byKey(const Key('amendPrescriptionButton')));
      await tester.pumpAndSettle();

      // Verify amendment dialog appears
      expect(find.text('Create Amendment (v2)'), findsOneWidget);

      // Try to submit with short reason
      await tester.enterText(find.byKey(const Key('amendmentReasonField')), 'Bad');
      await tester.tap(find.byKey(const Key('confirmAmendmentButton')));
      await tester.pumpAndSettle();

      expect(find.text('Reason must be at least 5 characters'), findsOneWidget);

      // Enter valid clinical justification
      await tester.enterText(
        find.byKey(const Key('amendmentReasonField')),
        'Patient developed rash on Amoxicillin, switching medication',
      );
      await tester.tap(find.byKey(const Key('confirmAmendmentButton')));
      await tester.pumpAndSettle();

      // Verify navigates to PrescriptionCreateScreen in Amendment mode
      expect(find.text('Amend Prescription (v2)'), findsOneWidget);
      expect(find.textContaining('AMENDMENT IN PROGRESS'), findsOneWidget);
    });

    testWidgets('Handles 409 Conflict gracefully when draft edit is rejected on locked record', (tester) async {
      when(() => mockPrescriptionsService.getPrescriptionById(validPrescriptionId))
          .thenAnswer((_) async => draftPrescription);

      when(() => mockPrescriptionsService.updateDraft(any(), any()))
          .thenThrow(const ConflictException(
            message: 'Prescription has already been approved and is now immutable.',
          ));

      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionDetailsScreen(
            prescriptionId: validPrescriptionId,
            initialPrescription: draftPrescription,
            prescriptionsService: mockPrescriptionsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Save Changes
      await tester.tap(find.byKey(const Key('saveDraftChangesButton')));
      await tester.pumpAndSettle();

      // Verify conflict notice is displayed
      expect(
        find.textContaining('Conflict: This prescription has already been approved'),
        findsOneWidget,
      );
    });
  });

  group('PrescriptionListScreen Tests', () {
    testWidgets('Lists prescriptions with status badges and filter chips', (tester) async {
      when(() => mockPrescriptionsService.getPrescriptions(
            page: any(named: 'page'),
            limit: any(named: 'limit'),
            patientId: any(named: 'patientId'),
            consultationId: any(named: 'consultationId'),
            status: any(named: 'status'),
          )).thenAnswer((_) async => PaginatedPrescriptionsResponse(
            data: [draftPrescription, approvedPrescription],
            total: 2,
            page: 1,
            limit: 20,
            totalPages: 1,
          ));

      await tester.pumpWidget(
        buildTestableWidget(
          PrescriptionListScreen(
            prescriptionsService: mockPrescriptionsService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Prescriptions'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Draft'), findsOneWidget);
      expect(find.text('Approved'), findsOneWidget);
      expect(find.text('Superseded'), findsOneWidget);

      expect(find.text('DRAFT'), findsOneWidget);
      expect(find.text('APPROVED'), findsOneWidget);
      expect(find.byKey(const Key('newPrescriptionFab')), findsOneWidget);

      // Tap 'Draft' filter chip
      await tester.tap(find.text('Draft'));
      await tester.pumpAndSettle();

      verify(() => mockPrescriptionsService.getPrescriptions(
            page: 1,
            limit: 20,
            status: PrescriptionStatus.draft,
          )).called(1);
    });
  });
}
