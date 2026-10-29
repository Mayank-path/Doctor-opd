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
    final bp = json['bloodPressure'] as String? ??
        (json['bpSystolic'] != null && json['bpDiastolic'] != null
            ? '${json['bpSystolic']}/${json['bpDiastolic']} mmHg'
            : (json['bpSystolic'] != null ? '${json['bpSystolic']}/- mmHg' : null));
    final hr = (json['heartRate'] as num?)?.toInt() ??
        (json['pulse'] as num?)?.toInt();
    final plan = json['plan'] as String? ?? json['treatmentPlan'] as String?;
    final notes = json['clinicalNotes'] as String? ??
        json['symptoms'] as String? ??
        json['examination'] as String?;

    return PatientConsultationSummary(
      id: json['id'] as String? ?? '',
      encounterDate: json['encounterDate'] as String? ?? '',
      status: json['status'] as String? ?? 'DRAFT',
      chiefComplaint: json['chiefComplaint'] as String?,
      diagnosis: json['diagnosis'] as String?,
      clinicalNotes: notes,
      plan: plan,
      bloodPressure: bp,
      heartRate: hr,
      finalizedAt: json['finalizedAt'] as String?,
    );
  }
}
