/// Summary of a patient's consultation visit for authorized Doctor view.
class PatientConsultationSummary {
  final String id;
  final String encounterDate;
  final String status;
  final String? chiefComplaint;
  final String? diagnosis;
  final String? clinicalNotes;
  final String? plan;
  final String? bloodPressure;
  final int? heartRate;
  final String? finalizedAt;

  const PatientConsultationSummary({
    required this.id,
    required this.encounterDate,
    required this.status,
    this.chiefComplaint,
    this.diagnosis,
    this.clinicalNotes,
    this.plan,
    this.bloodPressure,
    this.heartRate,
    this.finalizedAt,
  });

  factory PatientConsultationSummary.fromJson(Map<String, dynamic> json) {
    return PatientConsultationSummary(
      id: json['id'] as String? ?? '',
      encounterDate: json['encounterDate'] as String? ?? '',
      status: json['status'] as String? ?? 'DRAFT',
      chiefComplaint: json['chiefComplaint'] as String?,
      diagnosis: json['diagnosis'] as String?,
      clinicalNotes: json['clinicalNotes'] as String?,
      plan: json['plan'] as String?,
      bloodPressure: json['bloodPressure'] as String?,
      heartRate: (json['heartRate'] as num?)?.toInt(),
      finalizedAt: json['finalizedAt'] as String?,
    );
  }
}
