/// Request DTO for updating an existing clinical consultation draft matching backend UpdateConsultationDto
class UpdateConsultationRequest {
  final String? chiefComplaint;
  final String? symptoms;
  final String? examination;
  final String? diagnosis;
  final String? treatmentPlan;
  final String? followUpDate;

  // Vitals
  final int? bpSystolic;
  final int? bpDiastolic;
  final int? pulse;
  final double? temperature;
  final double? weightKg;
  final double? heightCm;
  final int? spo2;
  final int? respiratoryRate;

  const UpdateConsultationRequest({
    this.chiefComplaint,
    this.symptoms,
    this.examination,
    this.diagnosis,
    this.treatmentPlan,
    this.followUpDate,
    this.bpSystolic,
    this.bpDiastolic,
    this.pulse,
    this.temperature,
    this.weightKg,
    this.heightCm,
    this.spo2,
    this.respiratoryRate,
  });

  bool get hasUpdates =>
      chiefComplaint != null ||
      symptoms != null ||
      examination != null ||
      diagnosis != null ||
      treatmentPlan != null ||
      followUpDate != null ||
      bpSystolic != null ||
      bpDiastolic != null ||
      pulse != null ||
      temperature != null ||
      weightKg != null ||
      heightCm != null ||
      spo2 != null ||
      respiratoryRate != null;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};

    if (chiefComplaint != null) map['chiefComplaint'] = chiefComplaint!.trim();
    if (symptoms != null) map['symptoms'] = symptoms!.trim().isEmpty ? null : symptoms!.trim();
    if (examination != null) map['examination'] = examination!.trim().isEmpty ? null : examination!.trim();
    if (diagnosis != null) map['diagnosis'] = diagnosis!.trim().isEmpty ? null : diagnosis!.trim();
    if (treatmentPlan != null) map['treatmentPlan'] = treatmentPlan!.trim().isEmpty ? null : treatmentPlan!.trim();
    if (followUpDate != null) map['followUpDate'] = followUpDate!.trim().isEmpty ? null : followUpDate!.trim();

    if (bpSystolic != null) map['bpSystolic'] = bpSystolic;
    if (bpDiastolic != null) map['bpDiastolic'] = bpDiastolic;
    if (pulse != null) map['pulse'] = pulse;
    if (temperature != null) map['temperature'] = temperature;
    if (weightKg != null) map['weightKg'] = weightKg;
    if (heightCm != null) map['heightCm'] = heightCm;
    if (spo2 != null) map['spo2'] = spo2;
    if (respiratoryRate != null) map['respiratoryRate'] = respiratoryRate;

    return map;
  }

  /// Client-side validation matching backend UpdateConsultationDto rules
  Map<String, String> validate() {
    final errors = <String, String>{};

    if (!hasUpdates) {
      errors['general'] = 'At least one field must be provided for update';
    }

    if (chiefComplaint != null) {
      if (chiefComplaint!.trim().isEmpty) {
        errors['chiefComplaint'] = 'chiefComplaint cannot be empty';
      } else if (chiefComplaint!.trim().length > 500) {
        errors['chiefComplaint'] =
            'chiefComplaint exceeds maximum length of 500 characters';
      }
    }

    if (symptoms != null && symptoms!.length > 5000) {
      errors['symptoms'] = 'symptoms exceeds maximum length of 5000 characters';
    }

    if (examination != null && examination!.length > 5000) {
      errors['examination'] =
          'examination exceeds maximum length of 5000 characters';
    }

    if (diagnosis != null && diagnosis!.length > 5000) {
      errors['diagnosis'] =
          'diagnosis exceeds maximum length of 5000 characters';
    }

    if (treatmentPlan != null && treatmentPlan!.length > 5000) {
      errors['treatmentPlan'] =
          'treatmentPlan exceeds maximum length of 5000 characters';
    }

    if (followUpDate != null && followUpDate!.trim().isNotEmpty) {
      final dateRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');
      if (!dateRegex.hasMatch(followUpDate!.trim())) {
        errors['followUpDate'] =
            'followUpDate must be in YYYY-MM-DD calendar date format';
      }
    }

    if (bpSystolic != null && (bpSystolic! < 40 || bpSystolic! > 300)) {
      errors['bpSystolic'] = 'bpSystolic must be between 40 and 300 mmHg';
    }

    if (bpDiastolic != null && (bpDiastolic! < 20 || bpDiastolic! > 200)) {
      errors['bpDiastolic'] = 'bpDiastolic must be between 20 and 200 mmHg';
    }

    if (pulse != null && (pulse! < 30 || pulse! > 300)) {
      errors['pulse'] = 'pulse must be between 30 and 300 bpm';
    }

    if (temperature != null && (temperature! < 70.0 || temperature! > 115.0)) {
      errors['temperature'] = 'temperature must be between 70.0 and 115.0 °F';
    }

    if (weightKg != null && (weightKg! < 0.5 || weightKg! > 500.0)) {
      errors['weightKg'] = 'weightKg must be between 0.5 and 500.0 kg';
    }

    if (heightCm != null && (heightCm! < 20.0 || heightCm! > 300.0)) {
      errors['heightCm'] = 'heightCm must be between 20.0 and 300.0 cm';
    }

    if (spo2 != null && (spo2! < 50 || spo2! > 100)) {
      errors['spo2'] = 'spo2 must be between 50 and 100%';
    }

    if (respiratoryRate != null &&
        (respiratoryRate! < 5 || respiratoryRate! > 100)) {
      errors['respiratoryRate'] =
          'respiratoryRate must be between 5 and 100 breaths/min';
    }

    return errors;
  }
}
