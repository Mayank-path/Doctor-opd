import 'auth_clinic.dart';
import 'auth_user.dart';

/// Login response payload matching backend LoginResponse
class LoginResponse {
  final String accessToken;
  final String? refreshToken;
  final String tokenType;
  final String expiresIn;
  final AuthUser user;
  final AuthClinic? clinic;
  final List<AuthClinic> clinics;

  const LoginResponse({
    required this.accessToken,
    this.refreshToken,
    required this.tokenType,
    required this.expiresIn,
    required this.user,
    this.clinic,
    this.clinics = const [],
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
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

    return LoginResponse(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String?,
      tokenType: json['tokenType'] as String? ?? 'Bearer',
      expiresIn: json['expiresIn'] as String? ?? '1h',
      user: AuthUser.fromJson(
        json['user'] as Map<String, dynamic>? ?? {},
      ),
      clinic: parsedClinic,
      clinics: parsedClinics,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      if (refreshToken != null) 'refreshToken': refreshToken,
      'tokenType': tokenType,
      'expiresIn': expiresIn,
      'user': user.toJson(),
      if (clinic != null) 'clinic': clinic!.toJson(),
      'clinics': clinics.map((c) => c.toJson()).toList(),
    };
  }
}
