import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/auth/models/login_request.dart';

void main() {
  group('LoginRequest Validation & Serialization Tests', () {
    test('normalizes email by trimming and lowercasing in toJson()', () {
      const request = LoginRequest(
        email: '  Doctor.Vikram@Clinic.Com  ',
        password: 'Password123!',
      );

      final json = request.toJson();

      expect(json['email'], 'doctor.vikram@clinic.com');
      expect(json['password'], 'Password123!');
    });

    test('rejects empty email', () {
      const request = LoginRequest(
        email: '',
        password: 'Password123!',
      );

      final error = request.validate();
      expect(error, 'Email address is required');
    });

    test('rejects malformed email format', () {
      const request = LoginRequest(
        email: 'not-an-email',
        password: 'Password123!',
      );

      final error = request.validate();
      expect(error, 'Please enter a valid email address');
    });

    test('rejects empty password', () {
      const request = LoginRequest(
        email: 'doctor@clinic.com',
        password: '',
      );

      final error = request.validate();
      expect(error, 'Password is required');
    });

    test('passes validation for valid credentials', () {
      const request = LoginRequest(
        email: 'admin@clinic.com',
        password: 'SecurePassword123!',
      );

      final error = request.validate();
      expect(error, isNull);
    });
  });
}
