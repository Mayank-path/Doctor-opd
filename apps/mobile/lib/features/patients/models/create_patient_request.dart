/// Request payload for creating a new patient, matching backend CreatePatientDto.
class CreatePatientRequest {
  final String fullName;
  final String gender;
  final String phone;
  final String? dateOfBirth; // YYYY-MM-DD
  final String? alternatePhone;
  final String? email;
  final String? address;
  final String? city;
  final String? pincode;

  const CreatePatientRequest({
    required this.fullName,
    required this.gender,
    required this.phone,
    this.dateOfBirth,
    this.alternatePhone,
    this.email,
    this.address,
    this.city,
    this.pincode,
  });

  static final RegExp phoneRegex = RegExp(r'^[+]?[0-9\s\-()]{7,20}$');
  static final RegExp emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final RegExp dobRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');

  /// Validates request fields against backend CreatePatientDto rules.
  /// Returns a map of field name -> error message, or empty map if valid.
  Map<String, String> validate() {
    final errors = <String, String>{};

    final trimmedName = fullName.trim();
    if (trimmedName.isEmpty) {
      errors['fullName'] = 'Full name is required';
    } else if (trimmedName.length > 128) {
      errors['fullName'] = 'Full name cannot exceed 128 characters';
    }

    if (!const ['MALE', 'FEMALE', 'OTHER'].contains(gender)) {
      errors['gender'] = 'Gender must be MALE, FEMALE, or OTHER';
    }

    final trimmedPhone = phone.trim();
    if (trimmedPhone.isEmpty) {
      errors['phone'] = 'Phone number is required';
    } else if (!phoneRegex.hasMatch(trimmedPhone)) {
      errors['phone'] = 'Phone must be between 7 and 20 valid telephone characters';
    }

    if (alternatePhone != null && alternatePhone!.trim().isNotEmpty) {
      final trimmedAlt = alternatePhone!.trim();
      if (!phoneRegex.hasMatch(trimmedAlt)) {
        errors['alternatePhone'] =
            'Alternate phone must be between 7 and 20 valid telephone characters';
      }
    }

    if (dateOfBirth != null && dateOfBirth!.trim().isNotEmpty) {
      final trimmedDob = dateOfBirth!.trim();
      if (!dobRegex.hasMatch(trimmedDob)) {
        errors['dateOfBirth'] = 'Date of birth must be in YYYY-MM-DD format';
      } else {
        try {
          final parsed = DateTime.parse(trimmedDob);
          final today = DateTime.now();
          final todayUtc = DateTime.utc(today.year, today.month, today.day);
          final dobUtc = DateTime.utc(parsed.year, parsed.month, parsed.day);
          if (dobUtc.isAfter(todayUtc)) {
            errors['dateOfBirth'] = 'Date of birth cannot be in the future';
          }
        } catch (_) {
          errors['dateOfBirth'] = 'Invalid calendar date';
        }
      }
    }

    if (email != null && email!.trim().isNotEmpty) {
      final trimmedEmail = email!.trim();
      if (trimmedEmail.length > 254) {
        errors['email'] = 'Email exceeds maximum length of 254 characters';
      } else if (!emailRegex.hasMatch(trimmedEmail)) {
        errors['email'] = 'Please enter a valid email address';
      }
    }

    if (address != null && address!.trim().length > 500) {
      errors['address'] = 'Address cannot exceed 500 characters';
    }

    if (city != null && city!.trim().length > 100) {
      errors['city'] = 'City cannot exceed 100 characters';
    }

    if (pincode != null && pincode!.trim().length > 20) {
      errors['pincode'] = 'Pincode cannot exceed 20 characters';
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'fullName': fullName.trim(),
      'gender': gender,
      'phone': phone.trim(),
    };

    if (dateOfBirth != null && dateOfBirth!.trim().isNotEmpty) {
      map['dateOfBirth'] = dateOfBirth!.trim();
    }
    if (alternatePhone != null && alternatePhone!.trim().isNotEmpty) {
      map['alternatePhone'] = alternatePhone!.trim();
    }
    if (email != null && email!.trim().isNotEmpty) {
      map['email'] = email!.trim().toLowerCase();
    }
    if (address != null && address!.trim().isNotEmpty) {
      map['address'] = address!.trim();
    }
    if (city != null && city!.trim().isNotEmpty) {
      map['city'] = city!.trim();
    }
    if (pincode != null && pincode!.trim().isNotEmpty) {
      map['pincode'] = pincode!.trim();
    }

    return map;
  }
}
