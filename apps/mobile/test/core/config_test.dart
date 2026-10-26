import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/config/app_config.dart';

void main() {
  group('AppConfig Environment Tests', () {
    test('provides safe default emulator base URL when not overridden', () {
      expect(AppConfig.defaultEmulatorBaseUrl, 'http://10.0.2.2:3000/api/v1');
      expect(AppConfig.apiBaseUrl, isNotEmpty);
      expect(AppConfig.apiBaseUrl, contains('/api/v1'));
    });

    test('defines reasonable connection and receive timeouts', () {
      expect(AppConfig.connectTimeoutMs, greaterThanOrEqualTo(5000));
      expect(AppConfig.receiveTimeoutMs, greaterThanOrEqualTo(5000));
    });

    test('correctly identifies cleartext vs https endpoints', () {
      if (AppConfig.apiBaseUrl.startsWith('http://')) {
        expect(AppConfig.isCleartext, isTrue);
      } else {
        expect(AppConfig.isCleartext, isFalse);
      }
    });
  });
}
