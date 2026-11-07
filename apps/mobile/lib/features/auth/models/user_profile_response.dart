import 'auth_clinic.dart';
import 'auth_user.dart';

/// User profile and authoritative clinic context payload from GET /api/v1/auth/me
class UserProfileResponse {
  final AuthUser user;
  final AuthClinic? clinic;
  final List<AuthClinic> clinics;

  const UserProfileResponse({
    required this.user,
    this.clinic,
    this.clinics = const [],
  });

  factory UserProfileResponse.fromJson(Map<String, dynamic> json) {
    AuthClinic? parsedClinic;
    if (json['clinic'] != null && json['clinic'] is Map<String, dynamic>) {
      parsedClinic =
          AuthClinic.fromJson(json['clinic'] as Map<String, dynamic>);
    }

    final parsedClinics = <AuthClinic>[];
    if (json['clinics'] != null && json['clinics'] is List) {
      for (final item in json['clinics'] as List) {
        if (item is Map<String, dynamic>) {
          parsedClinics.add(AuthClinic.fromJson(item));
        }
      }
    }

    return UserProfileResponse(
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>? ?? {}),
      clinic: parsedClinic,
      clinics: parsedClinics,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user': user.toJson(),
      if (clinic != null) 'clinic': clinic!.toJson(),
      'clinics': clinics.map((c) => c.toJson()).toList(),
    };
  }
}

