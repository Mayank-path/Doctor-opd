import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/consultations/models/consultation.dart';
import 'package:doctor_opd_mobile/features/consultations/models/create_consultation_request.dart';
import 'package:doctor_opd_mobile/features/consultations/models/update_consultation_request.dart';
import 'package:doctor_opd_mobile/features/consultations/models/paginated_consultations_response.dart';

void main() {
  group('Consultation Models Tests', () {
    const validClinicId = '11111111-1111-1111-1111-111111111111';
    const validPatientId = '22222222-2222-2222-2222-222222222222';
    const validDoctorId = '33333333-3333-3333-3333-333333333333';
    const validConsultationId = '44444444-4444-4444-4444-444444444444';

    final sampleDraftJson = {
      'id': validConsultationId,
      'clinicId': validClinicId,
      'patientId': validPatientId,
      'clinicianId': validDoctorId,
      'encounterDate': '2026-10-26T10:00:00.000Z',
      'chiefComplaint': 'Persistent fever with chills for 4 days',
      'symptoms': 'Headache, fatigue, body aches',
      'examination': 'Temperature elevated, throat mildly congested',
      'diagnosis': 'Viral Fever (URTI)',
      'treatmentPlan': 'Paracetamol 650mg TDS x 3 days, rest, plenty of fluids',
      'followUpDate': '2026-10-30',
      'status': 'DRAFT',
      'bpSystolic': 120,
      'bpDiastolic': 80,
      'pulse': 78,
      'temperature': 100.4,
      'weightKg': 72.5,
      'heightCm': 175.0,
      'spo2': 98,
      'respiratoryRate': 18,
      'finalizedAt': null,
      'createdAt': '2026-10-26T10:00:00.000Z',
      'updatedAt': '2026-10-26T10:05:00.000Z',
      'patient': {
        'id': validPatientId,
        'uhid': 'UHID-2026-009',
        'fullName': 'Aarav Patel',
        'gender': 'Male',
        'dateOfBirth': '1990-05-15',
      },
      'clinician': {
        'id': validDoctorId,
        'fullName': 'Dr. Sharma',
        'email': 'sharma@opd.local',
      },
    };

    test('parses DRAFT consultation JSON correctly with all vitals and relations', () {
      final consultation = Consultation.fromJson(sampleDraftJson);

      expect(consultation.id, validConsultationId);
      expect(consultation.clinicId, validClinicId);
      expect(consultation.patientId, validPatientId);
      expect(consultation.clinicianId, validDoctorId);
      expect(consultation.status, ConsultationStatus.draft);
      expect(consultation.isDraft, isTrue);
      expect(consultation.isFinalized, isFalse);
      expect(consultation.chiefComplaint, 'Persistent fever with chills for 4 days');
      expect(consultation.bpSystolic, 120);
      expect(consultation.bpDiastolic, 80);
      expect(consultation.bloodPressureFormatted, '120/80 mmHg');
      expect(consultation.pulse, 78);
      expect(consultation.temperature, 100.4);
      expect(consultation.weightKg, 72.5);
      expect(consultation.heightCm, 175.0);
      expect(consultation.bmi, 23.7);
      expect(consultation.spo2, 98);
      expect(consultation.respiratoryRate, 18);
      expect(consultation.finalizedAt, isNull);
      expect(consultation.patient?.fullName, 'Aarav Patel');
      expect(consultation.patient?.uhid, 'UHID-2026-009');
    });

    test('parses FINALIZED consultation JSON and sets immutability state', () {
      final finalizedJson = Map<String, dynamic>.from(sampleDraftJson);
      finalizedJson['status'] = 'FINALIZED';
      finalizedJson['finalizedAt'] = '2026-10-26T10:30:00.000Z';

      final consultation = Consultation.fromJson(finalizedJson);

      expect(consultation.status, ConsultationStatus.finalized);
      expect(consultation.isFinalized, isTrue);
      expect(consultation.isDraft, isFalse);
      expect(consultation.finalizedAt, isNotNull);
      expect(consultation.formattedFinalizedAt, isNotEmpty);
    });

    test('canEdit and canFinalize ownership checks', () {
      final draft = Consultation.fromJson(sampleDraftJson);

      // 1. Assigned Doctor: can edit and finalize draft
      expect(draft.canEdit(validDoctorId, 'DOCTOR'), isTrue);
      expect(draft.canFinalize(validDoctorId, 'DOCTOR'), isTrue);

      // 1b. Assigned Doctor with null cached role: can edit and finalize
      expect(draft.canEdit(validDoctorId, null), isTrue);
      expect(draft.canFinalize(validDoctorId, null), isTrue);

      // 2. Different Doctor: cannot edit or finalize another doctor's draft (403 ownership)
      const otherDoctorId = '99999999-9999-9999-9999-999999999999';
      expect(draft.canEdit(otherDoctorId, 'DOCTOR'), isFalse);
      expect(draft.canFinalize(otherDoctorId, 'DOCTOR'), isFalse);

      // 3. Admin / Receptionist / Staff: cannot edit or finalize clinical consultations
      expect(draft.canEdit(validDoctorId, 'ADMIN'), isFalse);
      expect(draft.canEdit(validDoctorId, 'RECEPTIONIST'), isFalse);
      expect(draft.canEdit(validDoctorId, 'STAFF'), isFalse);

      // 4. Finalized record: immutable even for the assigned doctor
      final finalizedJson = Map<String, dynamic>.from(sampleDraftJson);
      finalizedJson['status'] = 'FINALIZED';
      finalizedJson['finalizedAt'] = '2026-10-26T10:30:00.000Z';
      final finalized = Consultation.fromJson(finalizedJson);

      expect(finalized.canEdit(validDoctorId, 'DOCTOR'), isFalse);
      expect(finalized.canFinalize(validDoctorId, 'DOCTOR'), isFalse);
      expect(finalized.canEdit(validDoctorId, null), isFalse);
      expect(finalized.canFinalize(validDoctorId, null), isFalse);
    });

    test('copyWith updates specified fields while preserving existing attributes', () {
      final draft = Consultation.fromJson(sampleDraftJson);
      final updated = draft.copyWith(
        chiefComplaint: 'Updated complaint',
        pulse: 88,
        status: ConsultationStatus.finalized,
      );

      expect(updated.id, draft.id);
      expect(updated.chiefComplaint, 'Updated complaint');
      expect(updated.pulse, 88);
      expect(updated.bpSystolic, draft.bpSystolic);
      expect(updated.status, ConsultationStatus.finalized);
      expect(updated.patient?.fullName, draft.patient?.fullName);
    });

    group('CreateConsultationRequest validation', () {
      test('valid request passes validation', () {
        final req = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Severe migraine for 2 days',
          symptoms: 'Nausea, photophobia',
          examination: 'Pupils equal and reactive',
          diagnosis: 'Migraine without aura',
          treatmentPlan: 'Sumatriptan 50mg SOS',
          followUpDate: '2026-11-02',
          bpSystolic: 118,
          bpDiastolic: 76,
          pulse: 72,
          temperature: 98.6,
          weightKg: 65.0,
          heightCm: 168.0,
          spo2: 99,
          respiratoryRate: 16,
        );

        final errors = req.validate();
        expect(errors, isEmpty);
      });

      test('validates required patientId UUID format', () {
        final emptyReq = CreateConsultationRequest(
          patientId: '',
          chiefComplaint: 'Fever',
        );
        expect(emptyReq.validate()['patientId'], contains('required'));

        final invalidUuidReq = CreateConsultationRequest(
          patientId: 'invalid-uuid-string',
          chiefComplaint: 'Fever',
        );
        expect(invalidUuidReq.validate()['patientId'], contains('UUID'));
      });

      test('validates required chiefComplaint and max length (500)', () {
        final emptyReq = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: '   ',
        );
        expect(emptyReq.validate()['chiefComplaint'], contains('required'));

        final longReq = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'A' * 501,
        );
        expect(longReq.validate()['chiefComplaint'], contains('500'));
      });

      test('validates vitals boundaries according to clinical DTO', () {
        // bpSystolic: 40..300
        final lowBp = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Checkup',
          bpSystolic: 39,
        );
        expect(lowBp.validate()['bpSystolic'], isNotNull);

        // bpDiastolic: 20..200
        final highBpDia = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Checkup',
          bpDiastolic: 205,
        );
        expect(highBpDia.validate()['bpDiastolic'], isNotNull);

        // temperature: 70..115
        final coldTemp = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Hypothermia',
          temperature: 68.0,
        );
        expect(coldTemp.validate()['temperature'], isNotNull);

        // pulse: 30..300
        final fastPulse = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Tachycardia',
          pulse: 350,
        );
        expect(fastPulse.validate()['pulse'], isNotNull);

        // spo2: 50..100
        final lowSpo2 = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Dyspnea',
          spo2: 45,
        );
        expect(lowSpo2.validate()['spo2'], isNotNull);

        // respiratoryRate: 5..100
        final lowResp = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Checkup',
          respiratoryRate: 2,
        );
        expect(lowResp.validate()['respiratoryRate'], isNotNull);
      });

      test('validates followUpDate YYYY-MM-DD format', () {
        final invalidDate = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Checkup',
          followUpDate: '26-10-2026',
        );
        expect(invalidDate.validate()['followUpDate'], contains('YYYY-MM-DD'));
      });

      test('toJson includes only provided non-null/non-empty fields', () {
        final req = CreateConsultationRequest(
          patientId: validPatientId,
          chiefComplaint: 'Mild headache',
          bpSystolic: 120,
        );
        final json = req.toJson();

        expect(json['patientId'], validPatientId);
        expect(json['chiefComplaint'], 'Mild headache');
        expect(json['bpSystolic'], 120);
        expect(json.containsKey('symptoms'), isFalse);
        expect(json.containsKey('bpDiastolic'), isFalse);
      });
    });

    group('UpdateConsultationRequest validation', () {
      test('hasUpdates returns false when no fields provided', () {
        const emptyUpdate = UpdateConsultationRequest();
        expect(emptyUpdate.hasUpdates, isFalse);
      });

      test('hasUpdates returns true when any clinical note or vital provided', () {
        const updateWithNotes = UpdateConsultationRequest(
          diagnosis: 'Acute Bronchitis',
        );
        expect(updateWithNotes.hasUpdates, isTrue);

        const updateWithVitals = UpdateConsultationRequest(
          temperature: 99.1,
        );
        expect(updateWithVitals.hasUpdates, isTrue);
      });

      test('toJson includes modified fields', () {
        const update = UpdateConsultationRequest(
          diagnosis: 'Hypertension Stage 1',
          bpSystolic: 135,
          bpDiastolic: 88,
        );
        final json = update.toJson();

        expect(json['diagnosis'], 'Hypertension Stage 1');
        expect(json['bpSystolic'], 135);
        expect(json['bpDiastolic'], 88);
        expect(json.containsKey('symptoms'), isFalse);
      });
    });

    group('PaginatedConsultationsResponse', () {
      test('parses metadata and items list correctly', () {
        final paginatedJson = {
          'data': [sampleDraftJson],
          'meta': {
            'total': 1,
            'page': 1,
            'limit': 10,
            'totalPages': 1,
          },
        };

        final response = PaginatedConsultationsResponse.fromJson(paginatedJson);

        expect(response.total, 1);
        expect(response.page, 1);
        expect(response.limit, 10);
        expect(response.totalPages, 1);
        expect(response.data.length, 1);
        expect(response.data.first.id, validConsultationId);
      });
    });
  });
}
