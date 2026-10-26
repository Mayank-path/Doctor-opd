import 'create_patient_request.dart';

/// Request payload for updating an existing patient, matching backend UpdatePatientDto.
class UpdatePatientRequest {
  final String? fullName;
  final String? gender;
  final String? phone;
  final String? dateOfBirth; // YYYY-MM-DD
  final String? alternatePhone;
  final String? email;
  final String? address;
  final String? city;
  final String? pincode;

  const UpdatePatientRequest({
    this.fullName,
    this.gender,
    this.phone,
    this.dateOfBirth,
    this.alternatePhone,
    this.email,
    this.address,
    this.city,
    this.pincode,
  });

  /// Validates updated fields against backend UpdatePatientDto rules.
  Map<String, String> validate() {
    final errors = <String, String>{};

    if (fullName != null) {
      final trimmed = fullName!.trim();
      if (trimmed.isEmpty) {
        errors['fullName'] = 'Full name cannot be empty';
      } else if (trimmed.length > 128) {
        errors['fullName'] = 'Full name cannot exceed 128 characters';
      }
    }

    if (gender != null && !const ['MALE', 'FEMALE', 'OTHER'].contains(gender)) {
      errors['gender'] = 'Gender must be MALE, FEMALE, or OTHER';
    }

    if (phone != null) {
      final trimmed = phone!.trim();
      if (trimmed.isEmpty) {
        errors['phone'] = 'Phone cannot be empty';
      } else if (!CreatePatientRequest.phoneRegex.hasMatch(trimmed)) {
        errors['phone'] = 'Phone must be between 7 and 20 valid telephone characters';
      }
    }

    if (alternatePhone != null && alternatePhone!.trim().isNotEmpty) {
      final trimmed = alternatePhone!.trim();
      if (!CreatePatientRequest.phoneRegex.hasMatch(trimmed)) {
        errors['alternatePhone'] =
            'Alternate phone must be between 7 and 20 valid telephone characters';
      }
    }

    if (dateOfBirth != null && dateOfBirth!.trim().isNotEmpty) {
      final trimmedDob = dateOfBirth!.trim();
      if (!CreatePatientRequest.dobRegex.hasMatch(trimmedDob)) {
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
      final trimmed = email!.trim();
      if (trimmed.length > 254) {
        errors['email'] = 'Email exceeds maximum length of 254 characters';
      } else if (!CreatePatientRequest.emailRegex.hasMatch(trimmed)) {
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

  bool get hasUpdates =>
      fullName != null ||
      gender != null ||
      phone != null ||
      dateOfBirth != null ||
      alternatePhone != null ||
      email != null ||
      address != null ||
      city != null ||
      pincode != null;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};

    if (fullName != null) map['fullName'] = fullName!.trim();
    if (gender != null) map['gender'] = gender;
    if (phone != null) map['phone'] = phone!.trim();
    if (dateOfBirth != null) {
      map['dateOfBirth'] = dateOfBirth!.trim().isEmpty ? null : dateOfBirth!.trim();
    }
    if (alternatePhone != null) {
      map['alternatePhone'] =
          alternatePhone!.trim().isEmpty ? null : alternatePhone!.trim();
    }
    if (email != null) {
      map['email'] = email!.trim().isEmpty ? null : email!.trim().toLowerCase();
    }
    if (address != null) {
      map['address'] = address!.trim().isEmpty ? null : address!.trim();
    }
    if (city != null) {
      map['city'] = city!.trim().isEmpty ? null : city!.trim();
    }
    if (pincode != null) {
      map['pincode'] = pincode!.trim().isEmpty ? null : pincode!.trim();
    }

    return map;
  }
}
