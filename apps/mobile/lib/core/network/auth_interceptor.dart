import 'package:dio/dio.dart';
import '../storage/secure_storage_service.dart';

/// Interceptor attaching JWT authorization and active clinic multi-tenant headers.
class AuthInterceptor extends Interceptor {
  final SecureStorageService _storageService;

  AuthInterceptor(this._storageService);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // 1. Attach JWT Access Token if present
    final token = await _storageService.getAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    // 2. Attach Active Clinic Selector header if not explicitly specified
    final existingClinicId = options.headers['x-clinic-id'];
    if (existingClinicId == null || existingClinicId.toString().isEmpty) {
      final clinicId = await _storageService.getActiveClinicId();
      if (clinicId != null && clinicId.isNotEmpty) {
        options.headers['x-clinic-id'] = clinicId;
      }
    }

    // Always accept and send JSON
    options.headers['Accept'] = 'application/json';
    options.headers['Content-Type'] = 'application/json';

    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Mask sensitive headers in logs / errors
    final headers = Map<String, dynamic>.from(err.requestOptions.headers);
    if (headers.containsKey('Authorization')) {
      headers['Authorization'] = 'Bearer [REDACTED]';
    }
    err.requestOptions.headers = headers;

    return handler.next(err);
  }
}
