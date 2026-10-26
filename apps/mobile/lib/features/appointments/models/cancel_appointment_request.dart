/// Request DTO for cancelling an appointment matching backend CancelAppointmentDto
class CancelAppointmentRequest {
  final String cancellationReason;

  const CancelAppointmentRequest({
    required this.cancellationReason,
  });

  /// Client-side validation matching backend constraints
  Map<String, String> validate() {
    final errors = <String, String>{};

    if (cancellationReason.trim().isEmpty) {
      errors['cancellationReason'] = 'Cancellation reason is required';
    } else if (cancellationReason.trim().length > 500) {
      errors['cancellationReason'] = 'Cancellation reason cannot exceed 500 characters';
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      'cancellationReason': cancellationReason.trim(),
    };
  }
}
