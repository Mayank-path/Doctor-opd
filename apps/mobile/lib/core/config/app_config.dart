/// Application Configuration
///
/// Supports runtime environment configuration via `--dart-define`.
///
/// Example execution commands:
/// - Android Emulator (Default):
///   `flutter run`
/// - Physical Android Device:
///   `flutter run --dart-define=API_BASE_URL=http://192.168.1.50:3000/api/v1`
/// - Staging / Production:
///   `flutter run --dart-define=API_BASE_URL=https://api.clinic.domain/api/v1 --dart-define=APP_ENV=production`
class AppConfig {
  AppConfig._();

  /// Default API base URL for the Android Emulator loopback.
  static const String defaultEmulatorBaseUrl = 'http://10.0.2.2:3000/api/v1';

  /// Active API base URL derived from compile-time `--dart-define` or default emulator endpoint.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: defaultEmulatorBaseUrl,
  );

  /// Target environment: development, staging, or production.
  static const String environment = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  /// Connection timeout in milliseconds.
  static const int connectTimeoutMs = 15000;

  /// Receive timeout in milliseconds.
  static const int receiveTimeoutMs = 15000;

  /// Whether current build targets production.
  static bool get isProduction => environment == 'production';

  /// Whether current API base URL uses non-HTTPS scheme.
  static bool get isCleartext => apiBaseUrl.startsWith('http://');
}
