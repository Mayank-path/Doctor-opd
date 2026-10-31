/// Registration request payload matching backend POST /api/v1/auth/register-clinic
class RegisterClinicRequest {
  final String fullName;
  final String email;
  final String password;
  final String confirmPassword;
  final String clinicName;
  final String? clinicAddress;
  final String? phone;

  const RegisterClinicRequest({
    required this.fullName,
    required this.email,
    required this.password,
    required this.confirmPassword,
    required this.clinicName,
    this.clinicAddress,
    this.phone,
  });

  Map<String, dynamic> toJson() {
    return {
      'fullName': fullName.trim(),
      'email': email.trim().toLowerCase(),
      'password': password,
      'confirmPassword': confirmPassword,
      'clinicName': clinicName.trim(),
      if (clinicAddress != null && clinicAddress!.trim().isNotEmpty)
        'clinicAddress': clinicAddress!.trim(),
      if (phone != null && phone!.trim().isNotEmpty)
        'phone': phone!.trim(),
    };
  }

  /// Client-side validation
  String? validate() {
    final trimmedName = fullName.trim();
    if (trimmedName.isEmpty) {
      return 'Full name is required';
    }
    if (trimmedName.length < 2) {
      return 'Full name must be at least 2 characters';
    }

    final trimmedEmail = email.trim();
    if (trimmedEmail.isEmpty) {
      return 'Work email is required';
    }
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$',
    );
    if (!emailRegex.hasMatch(trimmedEmail)) {
      return 'Please enter a valid work email address';
    }

    final trimmedClinicName = clinicName.trim();
    if (trimmedClinicName.isEmpty) {
      return 'Clinic name is required';
    }
    if (trimmedClinicName.length < 2) {
      return 'Clinic name must be at least 2 characters';
    }

    if (password.isEmpty) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (confirmPassword.isEmpty) {
      return 'Please confirm your password';
    }
    if (password != confirmPassword) {
      return 'Passwords do not match';
    }

    return null;
  }
}

