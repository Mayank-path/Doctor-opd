import 'package:flutter/material.dart';
import '../storage/secure_storage_service.dart';

/// Contract for reading and writing user theme preferences locally.
abstract class ThemePreferenceRepository {
  /// Reads the persisted theme mode. Defaults to [ThemeMode.light] if unset or invalid.
  Future<ThemeMode> getThemeMode();

  /// Persists the selected theme mode locally.
  Future<void> saveThemeMode(ThemeMode mode);
}

/// Secure storage implementation of [ThemePreferenceRepository].
///
/// Uses [SecureStorageService] so theme preference is encrypted at rest,
/// survives app restarts and logouts, and is never wiped by auth token revocation.
class SecureStorageThemePreferenceRepository implements ThemePreferenceRepository {
  final SecureStorageService _storageService;

  const SecureStorageThemePreferenceRepository({
    required SecureStorageService storageService,
  }) : _storageService = storageService;

  @override
  Future<ThemeMode> getThemeMode() async {
    try {
      final raw = await _storageService.getThemeMode();
      if (raw == 'dark') {
        return ThemeMode.dark;
      }
      if (raw == 'system') {
        return ThemeMode.system;
      }
      return ThemeMode.light;
    } catch (_) {
      return ThemeMode.light;
    }
  }

  @override
  Future<void> saveThemeMode(ThemeMode mode) async {
    try {
      final String value;
      switch (mode) {
        case ThemeMode.dark:
          value = 'dark';
          break;
        case ThemeMode.system:
          value = 'system';
          break;
        case ThemeMode.light:
          value = 'light';
          break;
      }
      await _storageService.saveThemeMode(value);
    } catch (_) {
      // Graceful fallback
    }
  }
}
