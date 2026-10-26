/// OPD Queue Entry Summary model for dashboard representation
class QueueSummary {
  final String id;
  final int tokenNumber;
  final String status;
  final int priority;
  final String? checkInTime;
  final String patientName;
  final String patientUhid;
  final String? doctorName;

  const QueueSummary({
    required this.id,
    required this.tokenNumber,
    required this.status,
    required this.priority,
    this.checkInTime,
    required this.patientName,
    required this.patientUhid,
    this.doctorName,
  });

  factory QueueSummary.fromJson(Map<String, dynamic> json) {
    final patientMap = json['patient'] as Map<String, dynamic>?;
    final doctorMap = json['doctor'] as Map<String, dynamic>?;
    final doctorUserMap = doctorMap?['user'] as Map<String, dynamic>?;

    return QueueSummary(
      id: json['id'] as String? ?? '',
      tokenNumber: (json['tokenNumber'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'WAITING',
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      checkInTime: json['checkInTime'] as String?,
      patientName: patientMap?['fullName'] as String? ?? 'Unknown Patient',
      patientUhid: patientMap?['uhid'] as String? ?? 'N/A',
      doctorName: doctorUserMap?['fullName'] as String?,
    );
  }
}
