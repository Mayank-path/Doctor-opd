import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/network/auth_interceptor.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService extends Mock implements SecureStorageService {}
class MockRequestInterceptorHandler extends Mock implements RequestInterceptorHandler {}
class MockErrorInterceptorHandler extends Mock implements ErrorInterceptorHandler {}

class FakeRequestOptions extends Fake implements RequestOptions {}
class FakeDioException extends Fake implements DioException {}

void main() {
  late MockSecureStorageService mockStorageService;
  late AuthInterceptor interceptor;

  setUpAll(() {
    registerFallbackValue(FakeRequestOptions());
    registerFallbackValue(FakeDioException());
  });

  setUp(() {
    mockStorageService = MockSecureStorageService();
    interceptor = AuthInterceptor(mockStorageService);
  });

  group('AuthInterceptor Tests', () {
    test('attaches Bearer token and active clinic selector to headers', () async {
      when(() => mockStorageService.getAccessToken())
          .thenAnswer((_) async => 'mock-jwt-token-123');
      when(() => mockStorageService.getActiveClinicId())
          .thenAnswer((_) async => 'clinic-alpha-456');

      final options = RequestOptions(path: '/consultations');
      final handler = MockRequestInterceptorHandler();
      when(() => handler.next(any())).thenReturn(null);

      await interceptor.onRequest(options, handler);

      expect(options.headers['Authorization'], 'Bearer mock-jwt-token-123');
      expect(options.headers['x-clinic-id'], 'clinic-alpha-456');
      expect(options.headers['Accept'], 'application/json');
      expect(options.headers['Content-Type'], 'application/json');
      verify(() => handler.next(options)).called(1);
    });

    test('preserves explicit Accept header when caller requests non-json (e.g. PDF)', () async {
      when(() => mockStorageService.getAccessToken())
          .thenAnswer((_) async => 'token');
      when(() => mockStorageService.getActiveClinicId())
          .thenAnswer((_) async => 'clinic-1');

      final options = RequestOptions(
        path: '/prescriptions/123/pdf',
        headers: {'Accept': 'application/pdf'},
      );
      final handler = MockRequestInterceptorHandler();
      when(() => handler.next(any())).thenReturn(null);

      await interceptor.onRequest(options, handler);

      expect(options.headers['Accept'], 'application/pdf');
    });

    test('does NOT overwrite Content-Type when data is FormData (preserving boundary)', () async {
      when(() => mockStorageService.getAccessToken())
          .thenAnswer((_) async => 'token');
      when(() => mockStorageService.getActiveClinicId())
          .thenAnswer((_) async => 'clinic-1');

      final formData = FormData.fromMap({'test': 'value'});
      final options = RequestOptions(
        path: '/clinical-assist/transcribe',
        data: formData,
      );
      final handler = MockRequestInterceptorHandler();
      when(() => handler.next(any())).thenReturn(null);

      await interceptor.onRequest(options, handler);

      // Content-Type should NOT be forced to application/json
      expect(options.headers['Content-Type'], isNull);
    });

    test('redacts Authorization header on error to prevent log leakage', () {
      final requestOptions = RequestOptions(
        path: '/consultations',
        headers: {'Authorization': 'Bearer super-secret-jwt-token'},
      );
      final dioException = DioException(
        requestOptions: requestOptions,
        type: DioExceptionType.badResponse,
      );
      final handler = MockErrorInterceptorHandler();
      when(() => handler.next(any())).thenReturn(null);

      interceptor.onError(dioException, handler);

      expect(
        dioException.requestOptions.headers['Authorization'],
        'Bearer [REDACTED]',
      );
      verify(() => handler.next(dioException)).called(1);
    });
  });
}
