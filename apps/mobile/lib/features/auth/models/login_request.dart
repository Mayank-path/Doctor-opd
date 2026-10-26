/// Login request payload matching backend POST /api/v1/auth/login
class LoginRequest {
  final String email;
  final String password;

  const LoginRequest({
    required this.email,
    required this.password,
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email.trim().toLowerCase(),
      'password': password,
    };
  }

  /// Client-side validation
  String? validate() {
    final trimmedEmail = email.trim();
    if (trimmedEmail.isEmpty) {
      return 'Email address is required';
    }
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$',
    );
    if (!emailRegex.hasMatch(trimmedEmail)) {
      return 'Please enter a valid email address';
    }
    if (password.isEmpty) {
      return 'Password is required';
    }
    return null;
  }
}
