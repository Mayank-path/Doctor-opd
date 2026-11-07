import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_clinic.dart';
import 'package:doctor_opd_mobile/features/auth/models/auth_user.dart';
import 'package:doctor_opd_mobile/features/auth/models/login_response.dart';
import 'package:doctor_opd_mobile/features/auth/models/register_clinic_request.dart';
import 'package:doctor_opd_mobile/features/auth/services/auth_service.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  late MockApiClient mockApiClient;
  late MockSecureStorageService mockStorageService;
  late AuthService authService;

  const testUser = AuthUser(
    id: 'user-doc-123',
    email: 'dr.sharma@opd.local',
    fullName: 'Dr. Ramesh Sharma',
    role: 'DOCTOR',
  );

  const testClinicAlpha = AuthClinic(
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Apex Healthcare City Clinic',
    role: 'DOCTOR',
  );

  const testClinicBeta = AuthClinic(
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Downtown Medical Center',
    role: 'ADMIN',
  );

  setUpAll(() {
    registerFallbackValue(testUser);
    registerFallbackValue(RequestOptions(path: ''));
    registerFallbackValue(Options());
  });

  setUp(() {
    mockApiClient = MockApiClient();
    mockStorageService = MockSecureStorageService();
    authService = AuthService(
      apiClient: mockApiClient,
      storageService: mockStorageService,
    );
  });

  group('Phase 2B — Clinic Context & Authentication Integration Tests', () {
    // 1. Login response parsing with clinic
    test('1. parses login response with resolved clinic and clinics array', () {
      final json = {
        'accessToken': 'jwt-access-token-123',
        'refreshToken': 'jwt-refresh-token-456',
        'tokenType': 'Bearer',
        'expiresIn': '1h',
        'user': {
          'id': 'user-doc-123',
          'email': 'dr.sharma@opd.local',
          'fullName': 'Dr. Ramesh Sharma',
        },
        'clinic': {
          'id': '11111111-1111-4111-a111-111111111111',
          'name': 'Apex Healthcare City Clinic',
          'role': 'DOCTOR',
        },
        'clinics': [
          {
            'id': '11111111-1111-4111-a111-111111111111',
            'name': 'Apex Healthcare City Clinic',
            'role': 'DOCTOR',
          },
        ],
      };

      final response = LoginResponse.fromJson(json);

      expect(response.accessToken, 'jwt-access-token-123');
      expect(response.refreshToken, 'jwt-refresh-token-456');
      expect(response.user.id, 'user-doc-123');
      expect(response.clinic, isNotNull);
      expect(response.clinic!.id, testClinicAlpha.id);
      expect(response.clinic!.name, testClinicAlpha.name);
      expect(response.clinic!.role, 'DOCTOR');
      expect(response.clinics, hasLength(1));
      expect(response.clinics.first.id, testClinicAlpha.id);
    });

    // 2. Login response parsing with null clinic
    test('2. parses login response with null clinic and multiple available clinics', () {
      final json = {
        'accessToken': 'jwt-access-token-999',
        'tokenType': 'Bearer',
        'expiresIn': '1h',
        'user': {
          'id': 'user-doc-123',
          'fullName': 'Dr. Ramesh Sharma',
        },
        'clinic': null,
        'clinics': [
          {
            'id': testClinicAlpha.id,
            'name': testClinicAlpha.name,
            'role': 'DOCTOR',
          },
          {
            'id': testClinicBeta.id,
            'name': testClinicBeta.name,
            'role': 'ADMIN',
          },
        ],
      };

      final response = LoginResponse.fromJson(json);

      expect(response.accessToken, 'jwt-access-token-999');
      expect(response.clinic, isNull);
      expect(response.clinics, hasLength(2));
      expect(response.clinics[0].name, testClinicAlpha.name);
      expect(response.clinics[1].name, testClinicBeta.name);
    });

    // 3. Registration response parsing
    test('3. parses registration response with newly created clinic context', () {
      final json = {
        'accessToken': 'jwt-owner-token',
        'tokenType': 'Bearer',
        'expiresIn': '1h',
        'user': {
          'id': 'owner-uuid-1',
          'email': 'owner@newclinic.in',
          'fullName': 'Dr. New Owner',
        },
        'clinic': {
          'id': '33333333-3333-4333-a333-333333333333',
          'name': 'New Care Clinic',
          'role': 'ADMIN',
        },
        'clinics': [
          {
            'id': '33333333-3333-4333-a333-333333333333',
            'name': 'New Care Clinic',
            'role': 'ADMIN',
          },
        ],
      };

      final response = LoginResponse.fromJson(json);

      expect(response.clinic?.id, '33333333-3333-4333-a333-333333333333');
      expect(response.clinic?.name, 'New Care Clinic');
      expect(response.clinic?.role, 'ADMIN');
      expect(response.clinics, hasLength(1));
    });

    // 4. Automatic Clinic ID persistence on login
    test('4. automatically persists Clinic ID in secure storage on successful login', () async {
      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'valid-jwt',
            'tokenType': 'Bearer',
            'expiresIn': '1h',
            'user': {'id': 'doc-1', 'fullName': 'Dr. Test'},
            'clinic': {
              'id': testClinicAlpha.id,
              'name': testClinicAlpha.name,
              'role': 'DOCTOR',
            },
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
            ],
          },
        ),
      );

      when(() => mockStorageService.saveAccessToken(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});

      final success = await authService.login('dr@test.in', 'Password123!');

      expect(success, isTrue);
      expect(authService.activeClinicId, testClinicAlpha.id);
      expect(authService.activeClinic?.name, testClinicAlpha.name);
      verify(() => mockStorageService.saveActiveClinicId(testClinicAlpha.id)).called(1);
    });

    // 5. Fresh installation login
    test('5. fresh installation login resolves clinic without pre-existing storage entry', () async {
      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'fresh-install-jwt',
            'tokenType': 'Bearer',
            'expiresIn': '1h',
            'user': {'id': 'doc-fresh', 'fullName': 'Dr. Fresh'},
            'clinic': {
              'id': testClinicAlpha.id,
              'name': testClinicAlpha.name,
              'role': 'DOCTOR',
            },
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
            ],
          },
        ),
      );

      when(() => mockStorageService.saveAccessToken(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});

      // Verify that prior to login, storage has no active clinic ID
      expect(authService.activeClinicId, isNull);

      final success = await authService.login('fresh@test.in', 'Password123!');

      expect(success, isTrue);
      expect(authService.activeClinicId, equals(testClinicAlpha.id));
      verify(() => mockStorageService.saveActiveClinicId(testClinicAlpha.id)).called(1);
    });

    // 6. Session restoration through /auth/me
    test('6. restores session and validates authoritative clinic context via /auth/me', () async {
      when(() => mockStorageService.getAccessToken()).thenAnswer((_) async => 'stored-jwt');
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testUser);
      when(() => mockStorageService.getActiveClinicId()).thenAnswer((_) async => testClinicAlpha.id);
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});

      when(() => mockApiClient.get(
            '/auth/me',
            options: any(named: 'options'),
          )).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/me'),
          statusCode: 200,
          data: {
            'user': {
              'id': 'user-doc-123',
              'email': 'dr.sharma@opd.local',
              'fullName': 'Dr. Ramesh Sharma',
              'isActive': true,
            },
            'clinic': {
              'id': testClinicAlpha.id,
              'name': testClinicAlpha.name,
              'role': 'DOCTOR',
            },
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
            ],
          },
        ),
      );

      await authService.initialize();

      expect(authService.isInitialized, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.activeClinicId, testClinicAlpha.id);
      expect(authService.activeClinic?.name, testClinicAlpha.name);
      verify(() => mockApiClient.get('/auth/me', options: any(named: 'options'))).called(1);
      verify(() => mockStorageService.saveActiveClinicId(testClinicAlpha.id)).called(1);
    });

    // 7. Logout cleanup
    test('7. logout clears access token, user, and active clinic ID from storage and memory', () async {
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});
      when(() => mockStorageService.clearAuth(clearClinic: true)).thenAnswer((_) async {});

      await authService.setActiveClinic(testClinicAlpha.id);
      expect(authService.activeClinicId, testClinicAlpha.id);

      await authService.logout(clearClinic: true);

      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.availableClinics, isEmpty);
      verify(() => mockStorageService.clearAuth(clearClinic: true)).called(1);
    });

    // 8. Account switching
    test('8. prevents cross-account clinic ID retention when switching users', () async {
      when(() => mockStorageService.clearAuth(clearClinic: true)).thenAnswer((_) async {});
      when(() => mockStorageService.saveAccessToken(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});

      // User A logs in with Clinic Alpha
      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'jwt-user-a',
            'user': {'id': 'user-a', 'fullName': 'Doctor A'},
            'clinic': {
              'id': testClinicAlpha.id,
              'name': testClinicAlpha.name,
              'role': 'DOCTOR',
            },
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
            ],
          },
        ),
      );

      await authService.login('doctorA@test.com', 'PassA123!');
      expect(authService.activeClinicId, testClinicAlpha.id);

      // User A logs out
      await authService.logout(clearClinic: true);
      expect(authService.activeClinicId, isNull);

      // User B logs in with Clinic Beta
      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'jwt-user-b',
            'user': {'id': 'user-b', 'fullName': 'Doctor B'},
            'clinic': {
              'id': testClinicBeta.id,
              'name': testClinicBeta.name,
              'role': 'ADMIN',
            },
            'clinics': [
              {
                'id': testClinicBeta.id,
                'name': testClinicBeta.name,
                'role': 'ADMIN',
              },
            ],
          },
        ),
      );

      await authService.login('doctorB@test.com', 'PassB123!');
      expect(authService.activeClinicId, testClinicBeta.id);
      expect(authService.activeClinicId, isNot(equals(testClinicAlpha.id)));
    });

    // 9. Multiple clinic selection
    test('9. handles multiple memberships and authoritatively activates selected clinic', () async {
      when(() => mockStorageService.saveAccessToken(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});

      // Login returns multiple clinics without default selection
      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'jwt-multi-clinic',
            'user': {'id': 'user-multi', 'fullName': 'Dr. Multi'},
            'clinic': null,
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
              {
                'id': testClinicBeta.id,
                'name': testClinicBeta.name,
                'role': 'ADMIN',
              },
            ],
          },
        ),
      );

      await authService.login('multi@test.com', 'Pass123!');

      expect(authService.activeClinicId, isNull);
      expect(authService.hasMultipleClinicsWithoutSelection, isTrue);
      expect(authService.availableClinics, hasLength(2));

      // User selects Clinic Beta
      when(() => mockApiClient.get('/auth/me', options: any(named: 'options')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/me'),
          statusCode: 200,
          data: {
            'user': {'id': 'user-multi', 'fullName': 'Dr. Multi'},
            'clinic': {
              'id': testClinicBeta.id,
              'name': testClinicBeta.name,
              'role': 'ADMIN',
            },
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
              {
                'id': testClinicBeta.id,
                'name': testClinicBeta.name,
                'role': 'ADMIN',
              },
            ],
          },
        ),
      );

      final selected = await authService.selectClinic(testClinicBeta);

      expect(selected, isTrue);
      expect(authService.activeClinicId, testClinicBeta.id);
      expect(authService.activeClinic?.name, testClinicBeta.name);
      verify(() => mockStorageService.saveActiveClinicId(testClinicBeta.id)).called(1);
    });

    // 10. No clinic membership
    test('10. handles account with zero clinic memberships', () async {
      when(() => mockStorageService.saveAccessToken(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});

      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'jwt-zero-clinic',
            'user': {'id': 'user-orphan', 'fullName': 'Orphan Doctor'},
            'clinic': null,
            'clinics': [],
          },
        ),
      );

      await authService.login('orphan@test.com', 'Pass123!');

      expect(authService.isAuthenticated, isTrue);
      expect(authService.activeClinicId, isNull);
      expect(authService.hasNoClinics, isTrue);
      expect(authService.availableClinics, isEmpty);
    });

    // 11. Backend unavailable on session restore
    test('11. handles unreachable backend gracefully during session initialization', () async {
      when(() => mockStorageService.getAccessToken()).thenAnswer((_) async => 'cached-token');
      when(() => mockStorageService.getUser()).thenAnswer((_) async => testUser);
      when(() => mockStorageService.getActiveClinicId()).thenAnswer((_) async => testClinicAlpha.id);

      when(() => mockApiClient.get('/auth/me', options: any(named: 'options')))
          .thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/me'),
          type: DioExceptionType.connectionError,
          error: 'Connection refused',
        ),
      );

      await authService.initialize();

      // Does not crash; completes initialization with cached state
      expect(authService.isInitialized, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.activeClinicId, testClinicAlpha.id);
    });

    // 12. Secure storage failure
    test('12. fails closed safely when secure storage encounters corruption or exception', () async {
      when(() => mockStorageService.getAccessToken()).thenThrow(
        Exception('Keystore decryption error: hardware key invalid'),
      );
      when(() => mockStorageService.clearAuth(clearClinic: any(named: 'clearClinic')))
          .thenAnswer((_) async {});

      await authService.initialize();

      expect(authService.isInitialized, isTrue);
      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      expect(authService.activeClinicId, isNull);
      verify(() => mockStorageService.clearAuth(clearClinic: any(named: 'clearClinic'))).called(1);
    });

    // 13. Registration automatic clinic persistence
    test('13. registration flow automatically persists clinic context without manual UUID entry', () async {
      const regRequest = RegisterClinicRequest(
        fullName: 'Dr. New Founder',
        email: 'founder@newclinic.org',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        clinicName: 'New Founder Clinic',
      );

      when(() => mockApiClient.post('/auth/register-clinic', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/register-clinic'),
          statusCode: 201,
          data: {
            'accessToken': 'jwt-registered-owner',
            'user': {'id': 'user-founder-1', 'fullName': 'Dr. New Founder'},
            'clinic': {
              'id': '44444444-4444-4444-a444-444444444444',
              'name': 'New Founder Clinic',
              'role': 'ADMIN',
            },
            'clinics': [
              {
                'id': '44444444-4444-4444-a444-444444444444',
                'name': 'New Founder Clinic',
                'role': 'ADMIN',
              },
            ],
          },
        ),
      );

      when(() => mockStorageService.saveAccessToken(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});

      final success = await authService.registerClinic(regRequest);

      expect(success, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.activeClinicId, '44444444-4444-4444-a444-444444444444');
      expect(authService.activeClinic?.name, 'New Founder Clinic');
      expect(authService.activeClinic?.role, 'ADMIN');
      verify(() => mockStorageService.saveActiveClinicId('44444444-4444-4444-a444-444444444444')).called(1);
    });

    // 14. Logout without arguments clears active clinic ID and session by default
    test('14. logout without arguments clears active clinic ID and session by default', () async {
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});
      when(() => mockStorageService.clearAuth(clearClinic: any(named: 'clearClinic'))).thenAnswer((_) async {});

      await authService.setActiveClinic(testClinicAlpha.id);
      expect(authService.activeClinicId, testClinicAlpha.id);

      // Call logout() with no arguments (relies on default clearClinic: true)
      await authService.logout();

      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.availableClinics, isEmpty);
      verify(() => mockStorageService.clearAuth(clearClinic: true)).called(1);
    });

    // 15. Logout cleans up local in-memory state even if storage operation throws
    test('15. logout cleans up local in-memory state even if storage operation throws', () async {
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});
      when(() => mockStorageService.clearAuth(clearClinic: any(named: 'clearClinic')))
          .thenThrow(Exception('Secure storage disk full or corrupted keystore'));

      await authService.setActiveClinic(testClinicAlpha.id);
      expect(authService.activeClinicId, testClinicAlpha.id);

      // Must not throw unhandled exception
      await authService.logout();

      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentUser, isNull);
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.availableClinics, isEmpty);
    });

    // 16. Account switching purges previous clinic ID so second user with multiple clinics does not inherit it
    test('16. account switching purges previous clinic ID so second user with multiple clinics does not inherit it', () async {
      when(() => mockStorageService.clearAuth(clearClinic: any(named: 'clearClinic'))).thenAnswer((_) async {});
      when(() => mockStorageService.saveAccessToken(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.saveActiveClinicId(any())).thenAnswer((_) async {});
      when(() => mockStorageService.clearActiveClinicId()).thenAnswer((_) async {});

      // User A logs in with single clinic (Alpha)
      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'jwt-user-a',
            'user': {'id': 'user-a', 'fullName': 'Doctor A'},
            'clinic': {
              'id': testClinicAlpha.id,
              'name': testClinicAlpha.name,
              'role': 'DOCTOR',
            },
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
            ],
          },
        ),
      );

      await authService.login('doctorA@test.com', 'PassA123!');
      expect(authService.activeClinicId, testClinicAlpha.id);

      // User A logs out with default parameter (clearClinic: true)
      await authService.logout();
      expect(authService.activeClinicId, isNull);
      verify(() => mockStorageService.clearAuth(clearClinic: true)).called(1);

      // User B logs in. User B has multiple clinics and clinic is null in response.
      when(() => mockApiClient.post('/auth/login', data: any(named: 'data')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 200,
          data: {
            'accessToken': 'jwt-user-b',
            'user': {'id': 'user-b', 'fullName': 'Doctor B'},
            'clinic': null,
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
              {
                'id': testClinicBeta.id,
                'name': testClinicBeta.name,
                'role': 'ADMIN',
              },
            ],
          },
        ),
      );

      await authService.login('doctorB@test.com', 'PassB123!');

      // Crucial assertion: User B must NOT inherit User A's activeClinicId
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.hasMultipleClinicsWithoutSelection, isTrue);
      expect(authService.availableClinics, hasLength(2));
      verify(() => mockStorageService.clearActiveClinicId()).called(1);
    });

    // 17. selectClinic rejects when backend returns null clinic context
    test('17. selectClinic rejects when backend returns null clinic context', () async {
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.clearActiveClinicId()).thenAnswer((_) async {});

      // Backend returns 200 with clinic: null
      when(() => mockApiClient.get('/auth/me', options: any(named: 'options')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/me'),
          statusCode: 200,
          data: {
            'user': {'id': 'user-multi', 'fullName': 'Dr. Multi'},
            'clinic': null,
            'clinics': [
              {
                'id': testClinicAlpha.id,
                'name': testClinicAlpha.name,
                'role': 'DOCTOR',
              },
            ],
          },
        ),
      );

      final result = await authService.selectClinic(testClinicAlpha);

      expect(result, isFalse);
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.errorMessage, contains('Unauthorized clinic selection'));
      verify(() => mockStorageService.clearActiveClinicId()).called(1);
    });

    // 18. selectClinic rejects when backend returns mismatched clinic ID
    test('18. selectClinic rejects when backend returns mismatched clinic ID', () async {
      when(() => mockStorageService.saveUser(any())).thenAnswer((_) async {});
      when(() => mockStorageService.clearActiveClinicId()).thenAnswer((_) async {});

      // Backend returns 200 with a different clinic ID
      when(() => mockApiClient.get('/auth/me', options: any(named: 'options')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/me'),
          statusCode: 200,
          data: {
            'user': {'id': 'user-multi', 'fullName': 'Dr. Multi'},
            'clinic': {
              'id': '99999999-9999-4999-a999-999999999999',
              'name': 'Different Clinic',
              'role': 'DOCTOR',
            },
            'clinics': [
              {
                'id': '99999999-9999-4999-a999-999999999999',
                'name': 'Different Clinic',
                'role': 'DOCTOR',
              },
            ],
          },
        ),
      );

      final result = await authService.selectClinic(testClinicAlpha);

      expect(result, isFalse);
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.errorMessage, contains('Unauthorized clinic selection'));
      verify(() => mockStorageService.clearActiveClinicId()).called(1);
    });

    // 19. selectClinic rejects when backend returns HTTP 403 Forbidden
    test('19. selectClinic rejects when backend returns HTTP 403 Forbidden', () async {
      when(() => mockStorageService.clearActiveClinicId()).thenAnswer((_) async {});

      when(() => mockApiClient.get('/auth/me', options: any(named: 'options')))
          .thenThrow(
        ApiException(
          statusCode: 403,
          message: 'Forbidden: You are not an active member of this clinic',
        ),
      );

      final result = await authService.selectClinic(testClinicAlpha);

      expect(result, isFalse);
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.errorMessage, contains('Forbidden'));
      verify(() => mockStorageService.clearActiveClinicId()).called(1);
    });

    // 20. selectClinic rejects when backend returns malformed non-JSON data
    test('20. selectClinic rejects when backend returns malformed non-JSON data', () async {
      when(() => mockStorageService.clearActiveClinicId()).thenAnswer((_) async {});

      when(() => mockApiClient.get('/auth/me', options: any(named: 'options')))
          .thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/auth/me'),
          statusCode: 200,
          data: '<html><body>502 Bad Gateway</body></html>',
        ),
      );

      final result = await authService.selectClinic(testClinicAlpha);

      expect(result, isFalse);
      expect(authService.activeClinicId, isNull);
      expect(authService.activeClinic, isNull);
      expect(authService.errorMessage, contains('Malformed response'));
      verify(() => mockStorageService.clearActiveClinicId()).called(1);
    });
  });
}
