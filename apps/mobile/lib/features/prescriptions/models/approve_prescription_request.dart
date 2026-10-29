class ApprovePrescriptionRequest {
  final bool confirmApproval;
  final String? doctorNotes;

  const ApprovePrescriptionRequest({
    required this.confirmApproval,
    this.doctorNotes,
  });

  Map<String, dynamic> toJson() {
    return {
      'confirmApproval': confirmApproval,
      if (doctorNotes != null && doctorNotes!.trim().isNotEmpty)
        'doctorNotes': doctorNotes!.trim(),
    };
  }

  Map<String, String> validate() {
    final errors = <String, String>{};
    if (!confirmApproval) {
      errors['confirmApproval'] =
          'You must explicitly confirm approval to lock this prescription.';
    }
    if (doctorNotes != null && doctorNotes!.length > 1000) {
      errors['doctorNotes'] = 'Doctor notes cannot exceed 1000 characters';
    }
    return errors;
  }
}

