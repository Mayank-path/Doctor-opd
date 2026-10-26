/// Request DTO for checking in an appointment or walk-in patient matching backend CheckInDto
class CheckInRequest {
  final String? appointmentId;
  final String? patientId;
  final String? doctorId;
  final String? serviceDate;
  final int? priority;
  final String? idempotencyKey;

  const CheckInRequest({
    this.appointmentId,
    this.patientId,
    this.doctorId,
    this.serviceDate,
    this.priority = 0,
    this.idempotencyKey,
  });

  /// Factory for checking in a scheduled or confirmed appointment
  factory CheckInRequest.forAppointment(String appointmentId, {String? idempotencyKey}) {
    return CheckInRequest(
      appointmentId: appointmentId,
      idempotencyKey: idempotencyKey,
    );
  }

  /// Factory for checking in a walk-in patient
  factory CheckInRequest.forWalkIn({
    required String patientId,
    required String doctorId,
    String? serviceDate,
    int priority = 0,
    String? idempotencyKey,
  }) {
    return CheckInRequest(
      patientId: patientId,
      doctorId: doctorId,
      serviceDate: serviceDate,
      priority: priority,
      idempotencyKey: idempotencyKey,
    );
  }

  /// Client-side validation matching backend CheckInDto rules
  Map<String, String> validate() {
    final errors = <String, String>{};

    final uuidRegex = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );

    final hasAppointment =
        appointmentId != null && appointmentId!.trim().isNotEmpty;
    final hasWalkIn = (patientId != null && patientId!.trim().isNotEmpty) &&
        (doctorId != null && doctorId!.trim().isNotEmpty);

    if (!hasAppointment && !hasWalkIn) {
      errors['general'] =
          'Either an appointment or both patient and doctor must be provided for check-in';
    }

    if (hasAppointment) {
      if (!uuidRegex.hasMatch(appointmentId!.trim())) {
        errors['appointmentId'] = 'Appointment ID must be a valid UUID';
      }
    } else {
      if (patientId == null || patientId!.trim().isEmpty) {
        errors['patientId'] = 'Patient is required for walk-in check-in';
      } else if (!uuidRegex.hasMatch(patientId!.trim())) {
        errors['patientId'] = 'Patient ID must be a valid UUID';
      }

      if (doctorId == null || doctorId!.trim().isEmpty) {
        errors['doctorId'] = 'Doctor is required for walk-in check-in';
      } else if (!uuidRegex.hasMatch(doctorId!.trim())) {
        errors['doctorId'] = 'Doctor ID must be a valid UUID';
      }
    }

    if (serviceDate != null && serviceDate!.trim().isNotEmpty) {
      final dateRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');
      if (!dateRegex.hasMatch(serviceDate!.trim())) {
        errors['serviceDate'] = 'Service date must be in YYYY-MM-DD format';
      }
    }

    if (priority != null && (priority! < 0 || priority! > 10)) {
      errors['priority'] = 'Priority must be between 0 and 10';
    }

    if (idempotencyKey != null && idempotencyKey!.trim().length > 100) {
      errors['idempotencyKey'] = 'Idempotency key cannot exceed 100 characters';
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      if (appointmentId != null && appointmentId!.trim().isNotEmpty)
        'appointmentId': appointmentId!.trim(),
      if (patientId != null && patientId!.trim().isNotEmpty)
        'patientId': patientId!.trim(),
      if (doctorId != null && doctorId!.trim().isNotEmpty)
        'doctorId': doctorId!.trim(),
      if (serviceDate != null && serviceDate!.trim().isNotEmpty)
        'serviceDate': serviceDate!.trim(),
      if (priority != null) 'priority': priority,
      if (idempotencyKey != null && idempotencyKey!.trim().isNotEmpty)
        'idempotencyKey': idempotencyKey!.trim(),
    };
  }
}
