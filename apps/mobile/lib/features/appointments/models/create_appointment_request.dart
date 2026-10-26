import 'appointment.dart';

/// Request DTO for creating a new appointment matching backend CreateAppointmentDto
class CreateAppointmentRequest {
  final String patientId;
  final String doctorId;
  final String serviceDate;
  final String startTime;
  final String? endTime;
  final AppointmentType type;
  final String? chiefComplaint;
  final String? notes;

  const CreateAppointmentRequest({
    required this.patientId,
    required this.doctorId,
    required this.serviceDate,
    required this.startTime,
    this.endTime,
    this.type = AppointmentType.scheduled,
    this.chiefComplaint,
    this.notes,
  });

  /// Client-side validation matching backend class-validator constraints
  Map<String, String> validate() {
    final errors = <String, String>{};

    final uuidRegex = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );

    if (patientId.trim().isEmpty) {
      errors['patientId'] = 'Patient is required';
    } else if (!uuidRegex.hasMatch(patientId.trim())) {
      errors['patientId'] = 'Patient ID must be a valid UUID';
    }

    if (doctorId.trim().isEmpty) {
      errors['doctorId'] = 'Doctor is required';
    } else if (!uuidRegex.hasMatch(doctorId.trim())) {
      errors['doctorId'] = 'Doctor ID must be a valid UUID';
    }

    final dateRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');
    if (serviceDate.trim().isEmpty) {
      errors['serviceDate'] = 'Service date is required';
    } else if (!dateRegex.hasMatch(serviceDate.trim())) {
      errors['serviceDate'] = 'Service date must be in YYYY-MM-DD format';
    }

    DateTime? parsedStart;
    if (startTime.trim().isEmpty) {
      errors['startTime'] = 'Start time is required';
    } else {
      try {
        parsedStart = DateTime.parse(startTime);
      } catch (_) {
        errors['startTime'] = 'Start time must be a valid ISO 8601 datetime string';
      }
    }

    DateTime? parsedEnd;
    if (endTime != null && endTime!.trim().isNotEmpty) {
      try {
        parsedEnd = DateTime.parse(endTime!);
        if (parsedStart != null && !parsedEnd.isAfter(parsedStart)) {
          errors['endTime'] = 'End time must be after start time';
        }
      } catch (_) {
        errors['endTime'] = 'End time must be a valid ISO 8601 datetime string';
      }
    }

    if (chiefComplaint != null && chiefComplaint!.trim().length > 500) {
      errors['chiefComplaint'] = 'Chief complaint cannot exceed 500 characters';
    }

    if (notes != null && notes!.trim().length > 2000) {
      errors['notes'] = 'Notes cannot exceed 2000 characters';
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      'patientId': patientId.trim(),
      'doctorId': doctorId.trim(),
      'serviceDate': serviceDate.trim(),
      'startTime': startTime.trim(),
      if (endTime != null && endTime!.trim().isNotEmpty) 'endTime': endTime!.trim(),
      'type': type.toBackendString(),
      if (chiefComplaint != null && chiefComplaint!.trim().isNotEmpty)
        'chiefComplaint': chiefComplaint!.trim(),
      if (notes != null && notes!.trim().isNotEmpty)
        'notes': notes!.trim(),
    };
  }
}
