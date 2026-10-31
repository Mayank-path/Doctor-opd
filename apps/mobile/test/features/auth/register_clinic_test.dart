import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/auth/models/register_clinic_request.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';
import 'package:doctor_opd_mobile/features/auth/ui/login_screen.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  late MockApiClient mockApiClient;
  late MockSecureStorageService mockStorageService;
  late AuthService authService;

  const mockOwnerUser = AuthUser(
    id: 'owner-uuid-1',
    email: 'anita.desai@careclinic.in',
    fullName: 'Dr. Anita Desai',
  );

  final mockSuccessRegisterResponseData = {
    'accessToken': 'mock-owner-jwt-token',
    'tokenType': 'Bearer',
    'expiresIn': '1h',
    'user': {
      'id': 'owner-uuid-1',
      'email': 'anita.desai@careclinic.in',
      'fullName': 'Dr. Anita Desai',
    },
  };

  setUpAll(() {
    registerFallbackValue(mockOwnerUser);
  });

  setUp(() {
    mockApiClient = MockApiClient();
    mockStorageService = MockSecureStorageService();
    authService = AuthService(
      apiClient: mockApiClient,
      storageService: mockStorageService,
    );
  });

  group('RegisterClinicRequest Validation Tests', () {
    test('valid request passes validation', () {
      const request = RegisterClinicRequest(
        fullName: 'Dr. Anita Desai',
        email: 'anita@clinic.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        clinicName: 'Desai Care Clinic',
      );
      expect(request.validate(), isNull);
    });

    test('rejects empty or short full name', () {
      const requestEmpty = RegisterClinicRequest(
        fullName: '',
        email: 'anita@clinic.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        clinicName: 'Desai Care Clinic',
      );
      expect(requestEmpty.validate(), contains('Full name is required'));

      const requestShort = RegisterClinicRequest(
        fullName: 'A',
        email: 'anita@clinic.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        clinicName: 'Desai Care Clinic',
      );
      expect(requestShort.validate(), contains('at least 2 characters'));
    });

    test('rejects invalid email formats', () {
      const request = RegisterClinicRequest(
        fullName: 'Dr. Anita Desai',
        email: 'not-an-email',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        clinicName: 'Desai Care Clinic',
      );
      expect(request.validate(), contains('valid work email address'));
    });

    test('rejects empty or short clinic name', () {
      const request = RegisterClinicRequest(
        fullName: 'Dr. Anita Desai',
        email: 'anita@clinic.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        clinicName: 'D',
      );
      expect(request.validate(), contains('at least 2 characters'));
    });

    test('rejects weak password (< 8 chars)', () {
      const request = RegisterClinicRequest(
        fullName: 'Dr. Anita Desai',
        email: 'anita@clinic.com',
        password: 'short',
        confirmPassword: 'short',
        clinicName: 'Desai Care Clinic',
      );
      expect(request.validate(), contains('at least 8 characters long'));
    });

    test('rejects password mismatch', () {
      const request = RegisterClinicRequest(
        fullName: 'Dr. Anita Desai',
        email: 'anita@clinic.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
        clinicName: 'Desai Care Clinic',
      );
      expect(request.validate(), contains('Passwords do not match'));
    });
  });

  group('AuthService registerClinic Integration Tests', () {
    const validRequest = RegisterClinicRequest(
      fullName: 'Dr. Anita Desai',
      email: 'anita.desai@careclinic.in',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      clinicName: 'Desai Care Clinic',
    );

    test('registerClinic succeeds with valid payload and updates session', () async {
      when(() => mockApiClient.post(
            '/auth/register-clinic',
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/register-clinic'),
          statusCode: 201,
          data: mockSuccessRegisterResponseData,
        ),
      );

      when(() => mockStorageService.saveAccessToken(any()))
          .thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any()))
          .thenAnswer((_) async {});
      when(() => mockStorageService.getActiveClinicId())
          .thenAnswer((_) async => null);

      final success = await authService.registerClinic(validRequest);

      expect(success, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.currentUser?.fullName, 'Dr. Anita Desai');
      expect(authService.errorMessage, isNull);

      verify(() => mockStorageService.saveAccessToken('mock-owner-jwt-token')).called(1);
      verify(() => mockStorageService.saveUser(any())).called(1);
    });

    test('registerClinic handles duplicate email error correctly', () async {
      when(() => mockApiClient.post(
            '/auth/register-clinic',
            data: any(named: 'data'),
          )).thenThrow(
        const ApiException(
          statusCode: 409,
          message: 'An account with this email already exists',
        ),
      );

      final success = await authService.registerClinic(validRequest);

      expect(success, isFalse);
      expect(authService.isAuthenticated, isFalse);
      expect(authService.errorMessage, 'An account with this email already exists');
      verifyNever(() => mockStorageService.saveAccessToken(any()));
    });
  });

  group('LoginScreen Widget Tests for Tabs & Registration', () {
    testWidgets('renders Sign In and Create Clinic Account tabs', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(authService: authService),
        ),
      );

      expect(find.text('Sign In'), findsNWidgets(2)); // Tab and Card title
      expect(find.text('Create Clinic Account'), findsOneWidget); // Tab
      expect(find.text('DOCTOR-OPD'), findsOneWidget);

      // Tap 'Create Clinic Account' Tab
      await tester.tap(find.text('Create Clinic Account'));
      await tester.pumpAndSettle();

      expect(find.text('Clinic Owner Registration'), findsOneWidget);
      expect(find.text('Create Clinic & Register Owner'), findsOneWidget);
      expect(find.text('Full Name *'), findsOneWidget);
      expect(find.text('Work Email *'), findsOneWidget);
      expect(find.text('Clinic Name *'), findsOneWidget);
      expect(find.text('Confirm Password *'), findsOneWidget);
    });
  });
}
