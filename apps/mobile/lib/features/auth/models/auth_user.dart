/// Authenticated user profile entity matching backend user response
class AuthUser {
  final String id;
  final String? email;
  final String fullName;
  final String? role;

  const AuthUser({
    required this.id,
    this.email,
    required this.fullName,
    this.role,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String? ?? '',
      email: json['email'] as String?,
      fullName: json['fullName'] as String? ?? 'Clinician',
      role: json['role'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'fullName': fullName,
      if (role != null) 'role': role,
    };
  }

  AuthUser copyWith({
    String? id,
    String? email,
    String? fullName,
    String? role,
  }) {
    return AuthUser(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
    );
  }

  @override
  String toString() => 'AuthUser(id: $id, fullName: $fullName, email: $email, role: $role)';
}
