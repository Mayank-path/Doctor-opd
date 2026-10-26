import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/appointments/models/appointment.dart';
import 'package:doctor_opd_mobile/features/appointments/models/cancel_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/models/create_appointment_request.dart';
import 'package:doctor_opd_mobile/features/appointments/models/paginated_appointments_response.dart';
import 'package:doctor_opd_mobile/features/appointments/models/reschedule_appointment_request.dart';

void main() {
  group('Appointment Model Parsing & Serialization Tests', () {
    final validJson = <String, dynamic>{
      'id': 'a1111111-1111-1111-1111-111111111111',
      'clinicId': 'c1111111-1111-1111-1111-111111111111',
      'patientId': 'b1111111-1111-1111-1111-111111111111',
      'doctorId': 'd1111111-1111-1111-1111-111111111111',
      'serviceDate': '2026-10-26T00:00:00.000Z',
      'startTime': '2026-10-26T04:30:00.000Z',
      'endTime': '2026-10-26T05:00:00.000Z',
      'type': 'SCHEDULED',
      'status': 'SCHEDULED',
      'chiefComplaint': 'Persistent headache and dizziness',
      'notes': 'Follow up in 2 weeks',
      'cancellationReason': null,
      'cancelledAt': null,
      'rescheduledFromId': null,
      'createdAt': '2026-10-26T04:00:00.000Z',
      'updatedAt': '2026-10-26T04:00:00.000Z',
      'patient': {
        'id': 'b1111111-1111-1111-1111-111111111111',
        'uhid': 'UHID-000001',
        'fullName': 'Aarav Patel',
        'gender': 'MALE',
        'phone': '9876543210',
      },
      'doctor': {
        'userId': 'd1111111-1111-1111-1111-111111111111',
        'role': 'DOCTOR',
        'user': {
          'id': 'd1111111-1111-1111-1111-111111111111',
          'fullName': 'Dr. Priya Sharma',
          'email': 'priya.sharma@example.com',
        },
      },
      'queueEntry': null,
    };

    test('parses complete Appointment JSON correctly', () {
      final apt = Appointment.fromJson(validJson);

      expect(apt.id, 'a1111111-1111-1111-1111-111111111111');
      expect(apt.type, AppointmentType.scheduled);
      expect(apt.status, AppointmentStatus.scheduled);
      expect(apt.patient?.fullName, 'Aarav Patel');
      expect(apt.patient?.uhid, 'UHID-000001');
      expect(apt.doctor?.fullName, 'Dr. Priya Sharma');
      expect(apt.canReschedule, isTrue);
      expect(apt.canCancel, isTrue);
      expect(apt.formattedServiceDate, contains('2026'));
      expect(apt.formattedTimeRange, isNotEmpty);
    });

    test('handles checked-in status and disables reschedule and cancel', () {
      final checkedInJson = Map<String, dynamic>.from(validJson)
        ..['status'] = 'CHECKED_IN'
        ..['queueEntry'] = {
          'id': 'q1111111-1111-1111-1111-111111111111',
          'tokenNumber': 7,
          'status': 'WAITING',
          'checkInTime': '2026-10-26T04:35:00.000Z',
        };

      final apt = Appointment.fromJson(checkedInJson);

      expect(apt.status, AppointmentStatus.checkedIn);
      expect(apt.queueEntry?.tokenNumber, 7);
      expect(apt.canReschedule, isFalse);
      expect(apt.canCancel, isFalse);
    });

    test('handles cancelled status correctly with cancellation metadata', () {
      final cancelledJson = Map<String, dynamic>.from(validJson)
        ..['status'] = 'CANCELLED'
        ..['cancellationReason'] = 'Patient requested cancellation'
        ..['cancelledAt'] = '2026-10-26T04:20:00.000Z';

      final apt = Appointment.fromJson(cancelledJson);

      expect(apt.status, AppointmentStatus.cancelled);
      expect(apt.cancellationReason, 'Patient requested cancellation');
      expect(apt.cancelledAt, isNotNull);
      expect(apt.canReschedule, isFalse);
      expect(apt.canCancel, isFalse);
    });

    test('serializes back to JSON matching API schema', () {
      final apt = Appointment.fromJson(validJson);
      final json = apt.toJson();

      expect(json['id'], apt.id);
      expect(json['type'], 'SCHEDULED');
      expect(json['status'], 'SCHEDULED');
      expect(json['patient']['uhid'], 'UHID-000001');
      expect(json['doctor']['user']['fullName'], 'Dr. Priya Sharma');
    });

    test('parses PaginatedAppointmentsResponse correctly', () {
      final responseJson = {
        'data': [validJson],
        'items': [validJson],
        'meta': {
          'page': 1,
          'limit': 20,
          'total': 1,
          'totalPages': 1,
        },
      };

      final paginated = PaginatedAppointmentsResponse.fromJson(responseJson);

      expect(paginated.data.length, 1);
      expect(paginated.meta.total, 1);
      expect(paginated.meta.totalPages, 1);
      expect(paginated.meta.hasNextPage, isFalse);
    });

    test('AppointmentType and AppointmentStatus enum mappings', () {
      expect(AppointmentType.fromString('WALK_IN'), AppointmentType.walkIn);
      expect(AppointmentType.fromString('FOLLOW_UP'), AppointmentType.followUp);
      expect(AppointmentType.fromString('EMERGENCY'), AppointmentType.emergency);
      expect(AppointmentType.fromString('SCHEDULED'), AppointmentType.scheduled);

      expect(AppointmentStatus.fromString('CONFIRMED'), AppointmentStatus.confirmed);
      expect(AppointmentStatus.fromString('CHECKED_IN'), AppointmentStatus.checkedIn);
      expect(AppointmentStatus.fromString('IN_CONSULTATION'), AppointmentStatus.inConsultation);
      expect(AppointmentStatus.fromString('COMPLETED'), AppointmentStatus.completed);
      expect(AppointmentStatus.fromString('CANCELLED'), AppointmentStatus.cancelled);
      expect(AppointmentStatus.fromString('RESCHEDULED'), AppointmentStatus.rescheduled);
      expect(AppointmentStatus.fromString('NO_SHOW'), AppointmentStatus.noShow);
    });
  });

  group('CreateAppointmentRequest Validation Tests', () {
    test('passes validation for valid request', () {
      const req = CreateAppointmentRequest(
        patientId: 'b1111111-1111-1111-1111-111111111111',
        doctorId: 'd1111111-1111-1111-1111-111111111111',
        serviceDate: '2026-10-26',
        startTime: '2026-10-26T10:00:00+05:30',
        endTime: '2026-10-26T10:30:00+05:30',
        type: AppointmentType.scheduled,
        chiefComplaint: 'Mild fever',
      );

      final errors = req.validate();
      expect(errors, isEmpty);
    });

    test('validates required fields and UUID formats', () {
      const req = CreateAppointmentRequest(
        patientId: 'not-a-uuid',
        doctorId: '',
        serviceDate: 'invalid-date',
        startTime: '',
      );

      final errors = req.validate();
      expect(errors.containsKey('patientId'), isTrue);
      expect(errors.containsKey('doctorId'), isTrue);
      expect(errors.containsKey('serviceDate'), isTrue);
      expect(errors.containsKey('startTime'), isTrue);
    });

    test('validates endTime must be after startTime', () {
      const req = CreateAppointmentRequest(
        patientId: 'b1111111-1111-1111-1111-111111111111',
        doctorId: 'd1111111-1111-1111-1111-111111111111',
        serviceDate: '2026-10-26',
        startTime: '2026-10-26T10:30:00+05:30',
        endTime: '2026-10-26T10:00:00+05:30',
      );

      final errors = req.validate();
      expect(errors['endTime'], 'End time must be after start time');
    });
  });

  group('RescheduleAppointmentRequest Validation Tests', () {
    test('passes validation for valid parameters', () {
      const req = RescheduleAppointmentRequest(
        serviceDate: '2026-10-27',
        startTime: '2026-10-27T11:00:00+05:30',
        endTime: '2026-10-27T11:30:00+05:30',
        notes: 'Rescheduled to Tuesday',
      );

      final errors = req.validate();
      expect(errors, isEmpty);
    });

    test('validates invalid service date and times', () {
      const req = RescheduleAppointmentRequest(
        serviceDate: '',
        startTime: 'bad-time',
      );

      final errors = req.validate();
      expect(errors.containsKey('serviceDate'), isTrue);
      expect(errors.containsKey('startTime'), isTrue);
    });
  });

  group('CancelAppointmentRequest Validation Tests', () {
    test('passes validation with non-empty reason', () {
      const req = CancelAppointmentRequest(
        cancellationReason: 'Doctor unavailable due to emergency surgery',
      );

      final errors = req.validate();
      expect(errors, isEmpty);
    });

    test('fails validation when reason is empty or whitespace', () {
      const req = CancelAppointmentRequest(cancellationReason: '   ');
      final errors = req.validate();
      expect(errors.containsKey('cancellationReason'), isTrue);
    });

    test('fails validation when reason exceeds 500 characters', () {
      final longReason = 'A' * 501;
      final req = CancelAppointmentRequest(cancellationReason: longReason);
      final errors = req.validate();
      expect(errors['cancellationReason'], contains('500 characters'));
    });
  });
}
