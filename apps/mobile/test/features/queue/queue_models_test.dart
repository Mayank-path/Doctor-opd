import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/queue/models/check_in_request.dart';
import 'package:doctor_opd_mobile/features/queue/models/queue_entry.dart';
import 'package:doctor_opd_mobile/features/queue/models/queue_list_response.dart';
import 'package:doctor_opd_mobile/features/queue/models/update_queue_status_request.dart';

void main() {
  group('QueueStatus Enum Tests', () {
    test('parses all valid backend strings and defaults to waiting', () {
      expect(QueueStatus.fromString('WAITING'), QueueStatus.waiting);
      expect(QueueStatus.fromString('CALLED'), QueueStatus.called);
      expect(QueueStatus.fromString('IN_CONSULTATION'), QueueStatus.inConsultation);
      expect(QueueStatus.fromString('COMPLETED'), QueueStatus.completed);
      expect(QueueStatus.fromString('SKIPPED'), QueueStatus.skipped);
      expect(QueueStatus.fromString('CANCELLED'), QueueStatus.cancelled);
      expect(QueueStatus.fromString('UNKNOWN'), QueueStatus.waiting);
      expect(QueueStatus.fromString(null), QueueStatus.waiting);
    });

    test('serializes accurately to backend enum string values', () {
      expect(QueueStatus.waiting.toBackendString(), 'WAITING');
      expect(QueueStatus.called.toBackendString(), 'CALLED');
      expect(QueueStatus.inConsultation.toBackendString(), 'IN_CONSULTATION');
      expect(QueueStatus.completed.toBackendString(), 'COMPLETED');
      expect(QueueStatus.skipped.toBackendString(), 'SKIPPED');
      expect(QueueStatus.cancelled.toBackendString(), 'CANCELLED');
    });

    test('provides human-readable labels and UI properties', () {
      expect(QueueStatus.waiting.label, 'Waiting');
      expect(QueueStatus.called.label, 'Called');
      expect(QueueStatus.inConsultation.label, 'In Consultation');
      expect(QueueStatus.completed.label, 'Completed');
      expect(QueueStatus.skipped.label, 'Skipped');
      expect(QueueStatus.cancelled.label, 'Cancelled');

      for (final s in QueueStatus.values) {
        expect(s.color, isNotNull);
        expect(s.icon, isNotNull);
      }
    });
  });

  group('QueueEntry Model Parsing & Methods', () {
    final sampleJson = {
      'id': 'a1111111-1111-1111-1111-111111111111',
      'clinicId': 'c1111111-1111-1111-1111-111111111111',
      'patientId': 'b1111111-1111-1111-1111-111111111111',
      'doctorId': 'd1111111-1111-1111-1111-111111111111',
      'appointmentId': 'e1111111-1111-1111-1111-111111111111',
      'idempotencyKey': 'idem-1',
      'serviceDate': '2026-10-26',
      'tokenNumber': 14,
      'status': 'CALLED',
      'priority': 5,
      'checkInTime': '2026-10-26T09:00:00.000Z',
      'calledAt': '2026-10-26T09:15:00.000Z',
      'consultationStartTime': '2026-10-26T09:20:00.000Z',
      'consultationEndTime': '2026-10-26T09:35:00.000Z',
      'createdAt': '2026-10-26T09:00:00.000Z',
      'updatedAt': '2026-10-26T09:35:00.000Z',
      'patient': {
        'id': 'b1111111-1111-1111-1111-111111111111',
        'uhid': 'UHID-2026-0001',
        'fullName': 'Aarav Patel',
        'gender': 'MALE',
        'dateOfBirth': '1990-05-15',
        'phone': '+919876543210',
      },
      'doctor': {
        'userId': 'd1111111-1111-1111-1111-111111111111',
        'role': 'DOCTOR',
        'user': {
          'id': 'd1111111-1111-1111-1111-111111111111',
          'fullName': 'Dr. Sharma',
          'email': 'sharma@opd.local',
        },
      },
      'appointment': {
        'id': 'e1111111-1111-1111-1111-111111111111',
        'startTime': '2026-10-26T09:00:00.000Z',
        'endTime': '2026-10-26T09:30:00.000Z',
        'type': 'SCHEDULED',
        'status': 'CHECKED_IN',
        'chiefComplaint': 'Routine Checkup',
      },
    };

    test('parses from full JSON response correctly', () {
      final entry = QueueEntry.fromJson(sampleJson);

      expect(entry.id, 'a1111111-1111-1111-1111-111111111111');
      expect(entry.clinicId, 'c1111111-1111-1111-1111-111111111111');
      expect(entry.patientId, 'b1111111-1111-1111-1111-111111111111');
      expect(entry.doctorId, 'd1111111-1111-1111-1111-111111111111');
      expect(entry.appointmentId, 'e1111111-1111-1111-1111-111111111111');
      expect(entry.idempotencyKey, 'idem-1');
      expect(entry.serviceDate, '2026-10-26');
      expect(entry.tokenNumber, 14);
      expect(entry.status, QueueStatus.called);
      expect(entry.priority, 5);
      expect(entry.isAppointmentCheckIn, isTrue);

      expect(entry.patient, isNotNull);
      expect(entry.patient!.fullName, 'Aarav Patel');
      expect(entry.patient!.uhid, 'UHID-2026-0001');
      expect(entry.patient!.ageYears, isNotNull);

      expect(entry.doctor, isNotNull);
      expect(entry.doctor!.fullName, 'Dr. Sharma');
      expect(entry.doctor!.userId, 'd1111111-1111-1111-1111-111111111111');

      expect(entry.appointment, isNotNull);
      expect(entry.appointment!.formattedTimeRange, contains('PM'));

      expect(entry.formattedCheckInTime, isNotEmpty);
      expect(entry.formattedCalledAt, isNotNull);
      expect(entry.formattedConsultationStartTime, isNotNull);
      expect(entry.formattedConsultationEndTime, isNotNull);
    });

    test('serializes back to JSON correctly', () {
      final entry = QueueEntry.fromJson(sampleJson);
      final json = entry.toJson();

      expect(json['id'], 'a1111111-1111-1111-1111-111111111111');
      expect(json['status'], 'CALLED');
      expect(json['tokenNumber'], 14);
      expect(json['patient'], isNotNull);
      expect(json['doctor'], isNotNull);
      expect(json['appointment'], isNotNull);
    });

    test('permission boundaries enforce role and attending doctor strictly', () {
      final entryCalled = QueueEntry.fromJson(sampleJson);

      // Only DOCTOR with matching userId can start consultation
      expect(
        entryCalled.canStartConsultation(
          'd1111111-1111-1111-1111-111111111111',
          'DOCTOR',
        ),
        isTrue,
      );
      expect(
        entryCalled.canStartConsultation(
          'd1111111-1111-1111-1111-111111111111',
          'doctor',
        ),
        isTrue,
      );
      expect(entryCalled.canStartConsultation('other-doc', 'DOCTOR'), isFalse);
      expect(
        entryCalled.canStartConsultation(
          'd1111111-1111-1111-1111-111111111111',
          'ADMIN',
        ),
        isFalse,
      );
      expect(
        entryCalled.canStartConsultation(
          'd1111111-1111-1111-1111-111111111111',
          'RECEPTIONIST',
        ),
        isFalse,
      );

      final entryConsulting = QueueEntry.fromJson({
        ...sampleJson,
        'status': 'IN_CONSULTATION',
      });

      // Only DOCTOR with matching userId can complete consultation
      expect(
        entryConsulting.canComplete(
          'd1111111-1111-1111-1111-111111111111',
          'DOCTOR',
        ),
        isTrue,
      );
      expect(entryConsulting.canComplete('other-doc', 'DOCTOR'), isFalse);
      expect(
        entryConsulting.canComplete(
          'd1111111-1111-1111-1111-111111111111',
          'ADMIN',
        ),
        isFalse,
      );

      // Terminal checks
      final entryCompleted = QueueEntry.fromJson({
        ...sampleJson,
        'status': 'COMPLETED',
      });
      expect(entryCompleted.isTerminal, isTrue);
      expect(entryCompleted.canCancel, isFalse);
      expect(entryCompleted.canCall, isFalse);

      final entryCancelled = QueueEntry.fromJson({
        ...sampleJson,
        'status': 'CANCELLED',
      });
      expect(entryCancelled.isTerminal, isTrue);
      expect(entryCancelled.canCancel, isFalse);
    });
  });

  group('CheckInRequest DTO Tests', () {
    const validApptId = 'e1111111-1111-1111-1111-111111111111';
    const validPatientId = 'b1111111-1111-1111-1111-111111111111';
    const validDoctorId = 'd1111111-1111-1111-1111-111111111111';

    test('creates valid appointment check-in request', () {
      final req = CheckInRequest.forAppointment(
        validApptId,
        idempotencyKey: 'idem-fixed',
      );

      expect(req.appointmentId, validApptId);
      expect(req.patientId, isNull);
      expect(req.doctorId, isNull);
      expect(req.idempotencyKey, 'idem-fixed');

      final json = req.toJson();
      expect(json['appointmentId'], validApptId);
      expect(json.containsKey('patientId'), isFalse);
      expect(json.containsKey('doctorId'), isFalse);
      expect(req.validate().isEmpty, isTrue);
    });

    test('creates valid walk-in check-in request', () {
      final req = CheckInRequest.forWalkIn(
        patientId: validPatientId,
        doctorId: validDoctorId,
        priority: 5,
        serviceDate: '2026-10-26',
      );

      expect(req.patientId, validPatientId);
      expect(req.doctorId, validDoctorId);
      expect(req.priority, 5);
      expect(req.serviceDate, '2026-10-26');

      final json = req.toJson();
      expect(json['patientId'], validPatientId);
      expect(json['doctorId'], validDoctorId);
      expect(json['priority'], 5);
      expect(json['serviceDate'], '2026-10-26');
      expect(req.validate().isEmpty, isTrue);
    });

    test('validates required fields and priority bounds', () {
      const invalidAppt = CheckInRequest(appointmentId: '');
      expect(invalidAppt.validate().isNotEmpty, isTrue);

      const invalidWalkIn = CheckInRequest(
        patientId: validPatientId,
        doctorId: '',
      );
      expect(invalidWalkIn.validate().isNotEmpty, isTrue);

      const invalidPriority = CheckInRequest(
        patientId: validPatientId,
        doctorId: validDoctorId,
        priority: 15,
      );
      expect(
        invalidPriority.validate()['priority'],
        'Priority must be between 0 and 10',
      );
    });
  });

  group('UpdateQueueStatusRequest DTO Tests', () {
    test('serializes status enum properly', () {
      final req = UpdateQueueStatusRequest(status: QueueStatus.inConsultation);
      expect(req.toJson(), {'status': 'IN_CONSULTATION'});
    });
  });

  group('QueueListResponse Model Tests', () {
    test('calculates correct status breakdown metrics', () {
      final res = QueueListResponse(
        total: 5,
        data: [
          _createSampleEntry('q-1', 1, QueueStatus.waiting),
          _createSampleEntry('q-2', 2, QueueStatus.called),
          _createSampleEntry('q-3', 3, QueueStatus.inConsultation),
          _createSampleEntry('q-4', 4, QueueStatus.completed),
          _createSampleEntry('q-5', 5, QueueStatus.skipped),
        ],
      );

      expect(res.total, 5);
      expect(res.waitingCount, 1);
      expect(res.calledCount, 1);
      expect(res.inConsultationCount, 1);
      expect(res.completedCount, 1);
      expect(res.skippedCount, 1);
      expect(res.cancelledCount, 0);
    });
  });
}

QueueEntry _createSampleEntry(String id, int token, QueueStatus status) {
  return QueueEntry(
    id: id,
    clinicId: 'c-1',
    patientId: 'p-1',
    doctorId: 'd-1',
    serviceDate: '2026-10-26',
    tokenNumber: token,
    status: status,
    priority: 0,
    checkInTime: '2026-10-26T09:00:00.000Z',
    createdAt: '2026-10-26T09:00:00.000Z',
    updatedAt: '2026-10-26T09:00:00.000Z',
  );
}
