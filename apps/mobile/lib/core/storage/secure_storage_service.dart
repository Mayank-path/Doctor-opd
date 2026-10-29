import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../features/auth/models/auth_user.dart';

/// Secure Storage Service wrapping Android Keystore / EncryptedSharedPreferences.
///
/// Security rules:
/// - Plaintext passwords are NEVER stored.
/// - Tokens and sensitive identifiers are encrypted at rest.
class SecureStorageService {
  static const String _keyAccessToken = 'opd_access_token';
  static const String _keyActiveClinicId = 'opd_active_clinic_id';
  static const String _keyCachedUser = 'opd_cached_user';

  final FlutterSecureStorage _storage;

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
                resetOnError: true,
              ),
            );

  /// Saves the authenticated JWT access token.
  Future<void> saveAccessToken(String token) async {
    await _storage.write(key: _keyAccessToken, value: token);
  }

  /// Retrieves the stored access token, if any.
  Future<String?> getAccessToken() async {
    return _storage.read(key: _keyAccessToken);
  }

  /// Saves the active clinic ID selector for multi-tenant requests.
  Future<void> saveActiveClinicId(String clinicId) async {
    await _storage.write(key: _keyActiveClinicId, value: clinicId);
  }

  /// Retrieves the selected clinic ID.
  Future<String?> getActiveClinicId() async {
    return _storage.read(key: _keyActiveClinicId);
  }

  /// Saves the authenticated user's profile information.
  Future<void> saveUser(AuthUser user) async {
    await _storage.write(
      key: _keyCachedUser,
      value: jsonEncode(user.toJson()),
    );
  }

  /// Retrieves the cached authenticated user.
  Future<AuthUser?> getUser() async {
    final raw = await _storage.read(key: _keyCachedUser);
    if (raw == null) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return AuthUser.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  /// Clears authentication tokens and cached user data (logout).
  /// Preserves the selected active clinic identifier across logout sessions by default,
  /// ensuring that clinical devices retain their configured clinic context.
  Future<void> clearAuth({bool clearClinic = false}) async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyCachedUser);
    if (clearClinic) {
      await _storage.delete(key: _keyActiveClinicId);
    }
  }

  /// Explicitly removes the active clinic identifier from secure storage.
  Future<void> clearActiveClinicId() async {
    await _storage.delete(key: _keyActiveClinicId);
  }
}
