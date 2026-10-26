/// Request DTO for rescheduling an appointment matching backend RescheduleAppointmentDto
class RescheduleAppointmentRequest {
  final String serviceDate;
  final String startTime;
  final String? endTime;
  final String? notes;

  const RescheduleAppointmentRequest({
    required this.serviceDate,
    required this.startTime,
    this.endTime,
    this.notes,
  });

  /// Client-side validation matching backend constraints
  Map<String, String> validate() {
    final errors = <String, String>{};

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

    if (notes != null && notes!.trim().length > 2000) {
      errors['notes'] = 'Notes cannot exceed 2000 characters';
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      'serviceDate': serviceDate.trim(),
      'startTime': startTime.trim(),
      if (endTime != null && endTime!.trim().isNotEmpty) 'endTime': endTime!.trim(),
      if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
    };
  }
}
