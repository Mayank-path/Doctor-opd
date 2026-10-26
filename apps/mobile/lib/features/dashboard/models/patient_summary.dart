/// Patient Summary model for dashboard representation
class PatientSummary {
  final String id;
  final String uhid;
  final String fullName;
  final String gender;
  final String phone;
  final String? createdAt;

  const PatientSummary({
    required this.id,
    required this.uhid,
    required this.fullName,
    required this.gender,
    required this.phone,
    this.createdAt,
  });

  factory PatientSummary.fromJson(Map<String, dynamic> json) {
    return PatientSummary(
      id: json['id'] as String? ?? '',
      uhid: json['uhid'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      gender: json['gender'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      createdAt: json['createdAt'] as String?,
    );
  }
}
