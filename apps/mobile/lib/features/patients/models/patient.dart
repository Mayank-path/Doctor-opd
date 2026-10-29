/// Domain Patient model reflecting backend PostgreSQL Patient entity.
class Patient {
  final String id;
  final String clinicId;
  final String uhid;
  final String fullName;
  final String gender;
  final String? dateOfBirth; // Stored in YYYY-MM-DD or ISO
  final String phone;
  final String? alternatePhone;
  final String? email;
  final String? address;
  final String? city;
  final String? pincode;
  final bool isActive;
  final String? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Patient({
    required this.id,
    required this.clinicId,
    required this.uhid,
    required this.fullName,
    required this.gender,
    this.dateOfBirth,
    required this.phone,
    this.alternatePhone,
    this.email,
    this.address,
    this.city,
    this.pincode,
    required this.isActive,
    this.deletedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Formatted date of birth in YYYY-MM-DD
  String? get formattedDob {
    if (dateOfBirth == null || dateOfBirth!.isEmpty) return null;
    if (dateOfBirth!.length >= 10) {
      return dateOfBirth!.substring(0, 10);
    }
    return dateOfBirth;
  }

  /// Calculates approximate age from dateOfBirth if available
  int? get age {
    final dobStr = formattedDob;
    if (dobStr == null) return null;
    try {
      final dob = DateTime.parse(dobStr);
      final today = DateTime.now();
      int calculatedAge = today.year - dob.year;
      if (today.month < dob.month || (today.month == dob.month && today.day < dob.day)) {
        calculatedAge--;
      }
      return calculatedAge >= 0 ? calculatedAge : null;
    } catch (_) {
      return null;
    }
  }

  /// Alias for age
  int? get ageYears => age;

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'] as String? ?? '',
      clinicId: json['clinicId'] as String? ?? '',
      uhid: json['uhid'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      gender: json['gender'] as String? ?? 'OTHER',
      dateOfBirth: json['dateOfBirth'] as String?,
      phone: json['phone'] as String? ?? '',
      alternatePhone: json['alternatePhone'] as String?,
      email: json['email'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      pincode: json['pincode'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      deletedAt: json['deletedAt'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'clinicId': clinicId,
      'uhid': uhid,
      'fullName': fullName,
      'gender': gender,
      'dateOfBirth': dateOfBirth,
      'phone': phone,
      'alternatePhone': alternatePhone,
      'email': email,
      'address': address,
      'city': city,
      'pincode': pincode,
      'isActive': isActive,
      'deletedAt': deletedAt,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
