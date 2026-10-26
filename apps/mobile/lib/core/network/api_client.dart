import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../errors/api_exception.dart';
import '../storage/secure_storage_service.dart';
import 'auth_interceptor.dart';

/// Centralized API Client managing HTTP requests and error transformations.
class ApiClient {
  late final Dio _dio;
  final SecureStorageService _storageService;

  ApiClient({
    String? baseUrl,
    SecureStorageService? storageService,
    Dio? customDio,
  }) : _storageService = storageService ?? SecureStorageService() {
    if (customDio != null) {
      _dio = customDio;
    } else {
      final options = BaseOptions(
        baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
        connectTimeout: const Duration(milliseconds: AppConfig.connectTimeoutMs),
        receiveTimeout: const Duration(milliseconds: AppConfig.receiveTimeoutMs),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      );
      _dio = Dio(options);
      _dio.interceptors.add(AuthInterceptor(_storageService));
    }
  }

  /// Base URL getter
  String get baseUrl => _dio.options.baseUrl;

  /// Exposes underlying Dio instance for testing
  Dio get dio => _dio;

  /// Performs a GET request
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw ApiException(message: e.toString());
    }
  }

  /// Performs a POST request
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw ApiException(message: e.toString());
    }
  }

  /// Performs a PATCH request
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.patch<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw ApiException(message: e.toString());
    }
  }

  /// Performs a DELETE request
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      throw ApiException(message: e.toString());
    }
  }

  /// Transforms Dio errors into domain-specific ApiException types.
  ApiException _handleDioError(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return ApiException.timeout();
    }

    if (error.type == DioExceptionType.connectionError) {
      return ApiException.networkError(
        'Could not reach server at ${_dio.options.baseUrl}. '
        'Verify backend is running and address is reachable.',
      );
    }

    final response = error.response;
    if (response != null) {
      return ApiException.fromResponse(
        response.statusCode,
        response.data,
      );
    }

    return ApiException(
      message: error.message ?? 'An unexpected network error occurred.',
    );
  }
}
