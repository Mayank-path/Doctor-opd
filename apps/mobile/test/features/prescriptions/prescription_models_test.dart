import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/amend_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/approve_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/create_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/paginated_prescriptions_response.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/prescription.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/prescription_item.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/update_prescription_request.dart';

void main() {
  group('PrescriptionItem Model Tests', () {
    test('serializes and deserializes valid PrescriptionItem JSON', () {
      final json = {
        'id': 'item-101',
        'prescriptionId': 'rx-501',
        'medicationName': 'Amoxicillin',
        'brandName': 'Mox 500',
        'dosageForm': 'CAPSULE',
        'strength': '500 mg',
        'route': 'ORAL',
        'frequency': '1-0-1',
        'durationValue': 7,
        'durationUnit': 'DAYS',
        'timing': 'AFTER_FOOD',
        'specialInstructions': 'Take after meals with water',
        'sortOrder': 0,
      };

      final item = PrescriptionItem.fromJson(json);

      expect(item.id, 'item-101');
      expect(item.prescriptionId, 'rx-501');
      expect(item.medicationName, 'Amoxicillin');
      expect(item.brandName, 'Mox 500');
      expect(item.dosageForm, DosageForm.capsule);
      expect(item.strength, '500 mg');
      expect(item.route, MedicationRoute.oral);
      expect(item.frequency, '1-0-1');
      expect(item.durationValue, 7);
      expect(item.durationUnit, 'DAYS');
      expect(item.timing, MedicationTiming.afterMeals);
      expect(item.specialInstructions, 'Take after meals with water');
      expect(item.sortOrder, 0);

      final outJson = item.toJson();
      expect(outJson['medicationName'], 'Amoxicillin');
      expect(outJson['dosageForm'], 'CAPSULE');
      expect(outJson['route'], 'ORAL');
      expect(outJson['timing'], 'AFTER_MEALS');
      expect(outJson['durationValue'], 7);
    });

    test('validates required fields correctly', () {
      final validItem = const PrescriptionItem(
        medicationName: 'Paracetamol',
        dosageForm: DosageForm.tablet,
        strength: '650 mg',
        route: MedicationRoute.oral,
        frequency: 'SOS',
        durationValue: 3,
        durationUnit: 'DAYS',
        timing: MedicationTiming.asNeeded,
      );
      expect(validItem.validate(), isEmpty);

      final invalidName = validItem.copyWith(medicationName: ' ');
      expect(invalidName.validate()['medicationName'], isNotNull);

      final invalidStrength = validItem.copyWith(strength: '');
      expect(invalidStrength.validate()['strength'], isNotNull);

      final invalidDuration = validItem.copyWith(durationValue: 0);
      expect(invalidDuration.validate()['durationValue'], isNotNull);

      final negativeDuration = validItem.copyWith(durationValue: -5);
      expect(negativeDuration.validate()['durationValue'], isNotNull);

      final emptyFrequency = validItem.copyWith(frequency: '');
      expect(emptyFrequency.validate()['frequency'], isNotNull);
    });

    test('enum parsing handles lowercase and unexpected strings safely', () {
      expect(DosageForm.fromString('TABLET'), DosageForm.tablet);
      expect(DosageForm.fromString('syrup'), DosageForm.syrup);
      expect(DosageForm.fromString('UNKNOWN_FORM'), DosageForm.tablet);

      expect(MedicationRoute.fromString('ORAL'), MedicationRoute.oral);
      expect(MedicationRoute.fromString('topical'), MedicationRoute.topical);
      expect(MedicationRoute.fromString('UNKNOWN_ROUTE'), MedicationRoute.oral);

      expect(MedicationTiming.fromString('BEFORE_MEALS'), MedicationTiming.beforeMeals);
      expect(MedicationTiming.fromString('BEFORE_FOOD'), MedicationTiming.beforeMeals);
      expect(MedicationTiming.fromString('AFTER_MEALS'), MedicationTiming.afterMeals);
      expect(MedicationTiming.fromString('AFTER_FOOD'), MedicationTiming.afterMeals);
      expect(MedicationTiming.fromString('WITH_MEALS'), MedicationTiming.withMeals);
      expect(MedicationTiming.fromString('EMPTY_STOMACH'), MedicationTiming.emptyStomach);
      expect(MedicationTiming.fromString('AS_NEEDED'), MedicationTiming.asNeeded);
    });

    test('copyWith produces exact copy with modified fields', () {
      const item = PrescriptionItem(
        medicationName: 'Azithromycin',
        dosageForm: DosageForm.tablet,
        strength: '500 mg',
        route: MedicationRoute.oral,
        frequency: '1-0-0',
        durationValue: 3,
        durationUnit: 'DAYS',
        timing: MedicationTiming.beforeMeals,
      );

      final updated = item.copyWith(
        strength: '250 mg',
        durationValue: 5,
      );

      expect(updated.medicationName, 'Azithromycin');
      expect(updated.strength, '250 mg');
      expect(updated.durationValue, 5);
      expect(updated.frequency, '1-0-0');
      expect(updated.dosageForm, DosageForm.tablet);
    });
  });

  group('Prescription Model Tests', () {
    test('parses full Prescription JSON with patient, doctor and items', () {
      final json = {
        'id': 'rx-001',
        'clinicId': 'clinic-99',
        'patientId': 'pat-10',
        'consultationId': 'con-20',
        'doctorId': 'doc-30',
        'versionNumber': 2,
        'status': 'APPROVED',
        'supersedesPrescriptionId': 'rx-000',
        'amendmentReason': 'Dosage adjusted due to mild dizziness',
        'notes': 'Take with plenty of fluids',
        'approvedAt': '2026-10-27T10:00:00.000Z',
        'createdAt': '2026-10-27T09:30:00.000Z',
        'updatedAt': '2026-10-27T10:00:00.000Z',
        'patient': {
          'id': 'pat-10',
          'uhid': 'UHID-2026-001',
          'fullName': 'Rahul Roy',
          'phone': '+919876543210',
          'gender': 'MALE',
          'dateOfBirth': '1990-01-01',
        },
        'doctor': {
          'id': 'doc-30',
          'fullName': 'Dr. Sharma',
          'email': 'sharma@opd.local',
        },
        'items': [
          {
            'id': 'item-1',
            'medicationName': 'Metformin',
            'dosageForm': 'TABLET',
            'strength': '500 mg',
            'route': 'ORAL',
            'frequency': '1-0-1',
            'durationValue': 30,
            'durationUnit': 'DAYS',
            'timing': 'AFTER_FOOD',
          }
        ],
      };

      final rx = Prescription.fromJson(json);

      expect(rx.id, 'rx-001');
      expect(rx.clinicId, 'clinic-99');
      expect(rx.patientId, 'pat-10');
      expect(rx.consultationId, 'con-20');
      expect(rx.doctorId, 'doc-30');
      expect(rx.versionNumber, 2);
      expect(rx.amendmentVersion, 2);
      expect(rx.status, PrescriptionStatus.approved);
      expect(rx.supersedesPrescriptionId, 'rx-000');
      expect(rx.amendmentReason, 'Dosage adjusted due to mild dizziness');
      expect(rx.notes, 'Take with plenty of fluids');
      expect(rx.isApproved, isTrue);
      expect(rx.isDraft, isFalse);
      expect(rx.isSuperseded, isFalse);
      expect(rx.patient?.fullName, 'Rahul Roy');
      expect(rx.doctor?.fullName, 'Dr. Sharma');
      expect(rx.items.length, 1);
      expect(rx.items.first.medicationName, 'Metformin');
    });

    test('correctly maps status enum helpers', () {
      final draftRx = Prescription(
        id: 'rx-draft',
        clinicId: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: PrescriptionStatus.draft,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(draftRx.isDraft, isTrue);
      expect(draftRx.isApproved, isFalse);
      expect(draftRx.isSuperseded, isFalse);

      final approvedRx = Prescription(
        id: 'rx-approved',
        clinicId: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: PrescriptionStatus.approved,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(approvedRx.isApproved, isTrue);
      expect(approvedRx.isDraft, isFalse);

      final supersededRx = Prescription(
        id: 'rx-superseded',
        clinicId: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: PrescriptionStatus.superseded,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(supersededRx.isSuperseded, isTrue);
    });
  });

  group('Request DTO Validation Tests', () {
    const validItem = PrescriptionItem(
      medicationName: 'Cetirizine',
      dosageForm: DosageForm.tablet,
      strength: '10 mg',
      route: MedicationRoute.oral,
      frequency: '0-0-1',
      durationValue: 5,
      durationUnit: 'DAYS',
      timing: MedicationTiming.afterMeals,
    );

    test('CreatePrescriptionRequest validation requires patient and at least 1 item', () {
      final validReq = const CreatePrescriptionRequest(
        patientId: 'pat-1',
        items: [validItem],
      );
      expect(validReq.validate(), isEmpty);

      final emptyPatientReq = const CreatePrescriptionRequest(
        patientId: '',
        items: [validItem],
      );
      expect(emptyPatientReq.validate()['patientId'], isNotNull);

      final noItemsReq = const CreatePrescriptionRequest(
        patientId: 'pat-1',
        items: [],
      );
      expect(noItemsReq.validate()['items'], isNotNull);

      final invalidNestedItemReq = const CreatePrescriptionRequest(
        patientId: 'pat-1',
        items: [
          PrescriptionItem(
            medicationName: '',
            dosageForm: DosageForm.tablet,
            strength: '',
            route: MedicationRoute.oral,
            frequency: '',
            durationValue: 0,
            durationUnit: 'DAYS',
            timing: MedicationTiming.afterMeals,
          )
        ],
      );
      expect(invalidNestedItemReq.validate(), isNotEmpty);
    });

    test('UpdatePrescriptionRequest requires at least 1 item and validates notes', () {
      final validReq = const UpdatePrescriptionRequest(
        notes: 'Take with warm water',
        items: [validItem],
      );
      expect(validReq.validate(), isEmpty);

      final emptyItemsReq = const UpdatePrescriptionRequest(items: []);
      expect(emptyItemsReq.validate()['items'], isNotNull);

      final longNotes = 'N' * 2001;
      final longNotesReq = UpdatePrescriptionRequest(
        notes: longNotes,
        items: const [validItem],
      );
      expect(longNotesReq.validate()['notes'], isNotNull);
    });

    test('ApprovePrescriptionRequest strictly enforces confirmApproval=true', () {
      const validReq = ApprovePrescriptionRequest(
        confirmApproval: true,
        doctorNotes: 'Prescription reviewed and verified.',
      );
      expect(validReq.validate(), isEmpty);

      const invalidReq = ApprovePrescriptionRequest(confirmApproval: false);
      expect(invalidReq.validate()['confirmApproval'], isNotNull);
    });

    test('AmendPrescriptionRequest requires amendmentReason with min 5 characters', () {
      final validReq = const AmendPrescriptionRequest(
        amendmentReason: 'Patient had nausea on 500mg, reduced to 250mg',
        items: [validItem],
      );
      expect(validReq.validate(), isEmpty);

      final shortReasonReq = const AmendPrescriptionRequest(
        amendmentReason: 'Bad',
        items: [validItem],
      );
      expect(shortReasonReq.validate()['amendmentReason'], isNotNull);

      final emptyReasonReq = const AmendPrescriptionRequest(
        amendmentReason: '     ',
        items: [validItem],
      );
      expect(emptyReasonReq.validate()['amendmentReason'], isNotNull);

      final noItemsReq = const AmendPrescriptionRequest(
        amendmentReason: 'Clinical medication update',
        items: [],
      );
      expect(noItemsReq.validate()['items'], isNotNull);
    });

    test('PaginatedPrescriptionsResponse parses list and pagination metadata', () {
      final json = {
        'data': [
          {
            'id': 'rx-1',
            'clinicId': 'c1',
            'patientId': 'p1',
            'doctorId': 'd1',
            'status': 'APPROVED',
            'createdAt': '2026-10-27T00:00:00.000Z',
            'updatedAt': '2026-10-27T00:00:00.000Z',
            'items': [],
          }
        ],
        'meta': {
          'total': 45,
          'page': 2,
          'limit': 10,
          'totalPages': 5,
        }
      };

      final res = PaginatedPrescriptionsResponse.fromJson(json);
      expect(res.data.length, 1);
      expect(res.items.length, 1);
      expect(res.total, 45);
      expect(res.page, 2);
      expect(res.limit, 10);
      expect(res.totalPages, 5);
    });
  });
}
