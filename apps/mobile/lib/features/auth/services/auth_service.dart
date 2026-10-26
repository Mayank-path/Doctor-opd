import 'package:flutter/foundation.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../models/auth_user.dart';
import '../models/login_request.dart';
import '../models/login_response.dart';

/// Authentication Service managing session state and API coordination.
class AuthService extends ChangeNotifier {
  final ApiClient _apiClient;
  final SecureStorageService _storageService;

  AuthUser? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  bool _isInitialized = false;

  AuthService({
    ApiClient? apiClient,
    SecureStorageService? storageService,
  })  : _apiClient = apiClient ?? ApiClient(),
        _storageService = storageService ?? SecureStorageService();

  AuthUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isInitialized => _isInitialized;

  /// Restores session from secure storage upon app launch.
  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _storageService.getAccessToken();
      if (token != null && token.isNotEmpty) {
        _currentUser = await _storageService.getUser();
      }
    } catch (_) {
      // In case of storage reading corruption, fail closed to login screen
      await _storageService.clearAuth();
      _currentUser = null;
    } finally {
      _isLoading = false;
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Executes login against backend POST /api/v1/auth/login.
  Future<bool> login(String email, String password) async {
    final request = LoginRequest(email: email, password: password);
    final validationError = request.validate();
    if (validationError != null) {
      _errorMessage = validationError;
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.post(
        '/auth/login',
        data: request.toJson(),
      );

      final loginResponse = LoginResponse.fromJson(
        response.data as Map<String, dynamic>,
      );

      // Securely persist token and user metadata
      await _storageService.saveAccessToken(loginResponse.accessToken);
      await _storageService.saveUser(loginResponse.user);

      _currentUser = loginResponse.user;
      _errorMessage = null;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during login.';
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Sets or updates the active clinic ID selector in secure storage.
  Future<void> setActiveClinic(String clinicId) async {
    await _storageService.saveActiveClinicId(clinicId);
    notifyListeners();
  }

  /// Retrieves the selected clinic ID from secure storage.
  Future<String?> getActiveClinicId() async {
    return _storageService.getActiveClinicId();
  }

  /// Logs out the user by clearing secure storage and in-memory session.
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await _storageService.clearAuth();
    _currentUser = null;
    _errorMessage = null;

    _isLoading = false;
    notifyListeners();
  }

  /// Clears any transient error message.
  void clearError() {
    if (_errorMessage != null) {
      _errorMessage = null;
      notifyListeners();
    }
  }
}
