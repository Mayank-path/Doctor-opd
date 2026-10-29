import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  late MockApiClient mockApiClient;
  late MockSecureStorageService mockStorageService;
  late AuthService authService;

  const mockUser = AuthUser(
    id: 'user-uuid-1',
    email: 'doctor@clinic.com',
    fullName: 'Dr. Vikram Sharma',
  );

  final mockSuccessResponseData = {
    'accessToken': 'mock-jwt-token-xyz',
    'tokenType': 'Bearer',
    'expiresIn': '1h',
    'user': {
      'id': 'user-uuid-1',
      'email': 'doctor@clinic.com',
      'fullName': 'Dr. Vikram Sharma',
    },
  };

  setUpAll(() {
    registerFallbackValue(mockUser);
  });

  setUp(() {
    mockApiClient = MockApiClient();
    mockStorageService = MockSecureStorageService();
    authService = AuthService(
      apiClient: mockApiClient,
      storageService: mockStorageService,
    );
  });

  group('AuthService State & Flow Tests', () {
    test('initial state is unauthenticated and uninitialized', () {
      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      expect(authService.isInitialized, isFalse);
      expect(authService.isLoading, isFalse);
      expect(authService.errorMessage, isNull);
    });

    test('initialize restores session when valid token exists in storage', () async {
      when(() => mockStorageService.getAccessToken())
          .thenAnswer((_) async => 'stored-jwt-token');
      when(() => mockStorageService.getUser())
          .thenAnswer((_) async => mockUser);

      await authService.initialize();

      expect(authService.isInitialized, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.currentUser?.fullName, 'Dr. Vikram Sharma');
      verify(() => mockStorageService.getAccessToken()).called(1);
      verify(() => mockStorageService.getUser()).called(1);
    });

    test('initialize starts unauthenticated when no token is in storage', () async {
      when(() => mockStorageService.getAccessToken())
          .thenAnswer((_) async => null);

      await authService.initialize();

      expect(authService.isInitialized, isTrue);
      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      verify(() => mockStorageService.getAccessToken()).called(1);
      verifyNever(() => mockStorageService.getUser());
    });

    test('login succeeds with valid credentials, persisting token and user', () async {
      when(() => mockApiClient.post(
            '/auth/login',
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: mockSuccessResponseData,
        ),
      );

      when(() => mockStorageService.saveAccessToken(any()))
          .thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any()))
          .thenAnswer((_) async {});

      final success = await authService.login(
        'doctor@clinic.com',
        'ValidPassword123!',
      );

      expect(success, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.currentUser?.id, 'user-uuid-1');
      expect(authService.errorMessage, isNull);

      verify(() => mockStorageService.saveAccessToken('mock-jwt-token-xyz'))
          .called(1);
      verify(() => mockStorageService.saveUser(any())).called(1);
    });

    test('login fails when backend returns 401 Unauthorized', () async {
      when(() => mockApiClient.post(
            '/auth/login',
            data: any(named: 'data'),
          )).thenThrow(
        const UnauthorizedException(message: 'Invalid email or password'),
      );

      final success = await authService.login(
        'doctor@clinic.com',
        'WrongPassword!',
      );

      expect(success, isFalse);
      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      expect(authService.errorMessage, 'Invalid email or password');

      verifyNever(() => mockStorageService.saveAccessToken(any()));
    });

    test('login fails fast with client validation error without hitting network', () async {
      final success = await authService.login(
        'invalid-email',
        'SomePassword',
      );

      expect(success, isFalse);
      expect(authService.errorMessage, 'Please enter a valid email address');
      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });

    test('logout clears secure storage and resets auth state while preserving active clinic by default', () async {
      when(() => mockStorageService.clearAuth(clearClinic: false)).thenAnswer((_) async {});

      await authService.logout();

      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      expect(authService.errorMessage, isNull);
      verify(() => mockStorageService.clearAuth(clearClinic: false)).called(1);
    });

    test('logout clears active clinic when clearClinic is true', () async {
      when(() => mockStorageService.clearAuth(clearClinic: true)).thenAnswer((_) async {});

      await authService.logout(clearClinic: true);

      expect(authService.isAuthenticated, isFalse);
      expect(authService.activeClinicId, isNull);
      verify(() => mockStorageService.clearAuth(clearClinic: true)).called(1);
    });

    test('initialize restores activeClinicId alongside token and user', () async {
      const testClinicId = 'ab1aa951-7907-445f-b2f3-b0a072d053af';
      when(() => mockStorageService.getAccessToken())
          .thenAnswer((_) async => 'stored-jwt-token');
      when(() => mockStorageService.getUser())
          .thenAnswer((_) async => mockUser);
      when(() => mockStorageService.getActiveClinicId())
          .thenAnswer((_) async => testClinicId);

      await authService.initialize();

      expect(authService.isInitialized, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.activeClinicId, equals(testClinicId));
      verify(() => mockStorageService.getActiveClinicId()).called(1);
    });

    test('setActiveClinic persists clinic ID and updates activeClinicId getter', () async {
      const testClinicId = 'ab1aa951-7907-445f-b2f3-b0a072d053af';
      when(() => mockStorageService.saveActiveClinicId(testClinicId))
          .thenAnswer((_) async {});

      await authService.setActiveClinic(testClinicId);

      expect(authService.activeClinicId, equals(testClinicId));
      verify(() => mockStorageService.saveActiveClinicId(testClinicId)).called(1);
    });

    test('updateUserRole updates currentUser role and persists user', () async {
      when(() => mockStorageService.getAccessToken())
          .thenAnswer((_) async => 'stored-jwt-token');
      when(() => mockStorageService.getUser())
          .thenAnswer((_) async => mockUser);
      when(() => mockStorageService.getActiveClinicId())
          .thenAnswer((_) async => 'clinic-1');
      when(() => mockStorageService.saveUser(any()))
          .thenAnswer((_) async {});

      await authService.initialize();
      expect(authService.currentUser?.role, isNull);

      await authService.updateUserRole('DOCTOR');

      expect(authService.currentUser?.role, equals('DOCTOR'));
      verify(() => mockStorageService.saveUser(any(
            that: isA<AuthUser>().having((u) => u.role, 'role', 'DOCTOR'),
          ))).called(1);
    });
  });
}

