/// Appointment Summary model for dashboard representation
class AppointmentSummary {
  final String id;
  final String serviceDate;
  final String? startTime;
  final String? endTime;
  final String type;
  final String status;
  final String? chiefComplaint;
  final String patientName;
  final String patientUhid;
  final String? doctorName;

  const AppointmentSummary({
    required this.id,
    required this.serviceDate,
    this.startTime,
    this.endTime,
    required this.type,
    required this.status,
    this.chiefComplaint,
    required this.patientName,
    required this.patientUhid,
    this.doctorName,
  });

  factory AppointmentSummary.fromJson(Map<String, dynamic> json) {
    final patientMap = json['patient'] as Map<String, dynamic>?;
    final doctorMap = json['doctor'] as Map<String, dynamic>?;
    final doctorUserMap = doctorMap?['user'] as Map<String, dynamic>?;

    return AppointmentSummary(
      id: json['id'] as String? ?? '',
      serviceDate: json['serviceDate'] as String? ?? '',
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
      type: json['type'] as String? ?? 'SCHEDULED',
      status: json['status'] as String? ?? 'SCHEDULED',
      chiefComplaint: json['chiefComplaint'] as String?,
      patientName: patientMap?['fullName'] as String? ?? 'Unknown Patient',
      patientUhid: patientMap?['uhid'] as String? ?? 'N/A',
      doctorName: doctorUserMap?['fullName'] as String?,
    );
  }
}
