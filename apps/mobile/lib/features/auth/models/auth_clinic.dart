/// Authenticated clinic context entity matching backend clinic context contract
class AuthClinic {
  final String id;
  final String name;
  final String role;

  const AuthClinic({
    required this.id,
    required this.name,
    required this.role,
  });

  factory AuthClinic.fromJson(Map<String, dynamic> json) {
    return AuthClinic(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      role: json['role'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'role': role,
    };
  }

  AuthClinic copyWith({
    String? id,
    String? name,
    String? role,
  }) {
    return AuthClinic(
      id: id ?? this.id,
      name: name ?? this.name,
      role: role ?? this.role,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthClinic &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          name == other.name &&
          role == other.role;

  @override
  int get hashCode => Object.hash(id, name, role);

  @override
  String toString() => 'AuthClinic(id: $id, name: $name, role: $role)';
}

