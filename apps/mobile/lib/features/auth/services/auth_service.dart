import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../models/auth_clinic.dart';
import '../models/auth_user.dart';
import '../models/login_request.dart';
import '../models/login_response.dart';
import '../models/register_clinic_request.dart';
import '../models/user_profile_response.dart';

/// Authentication Service managing session state, authoritative clinic context,
/// and API coordination.
class AuthService extends ChangeNotifier {
  final ApiClient _apiClient;
  final SecureStorageService _storageService;

  AuthUser? _currentUser;
  AuthClinic? _activeClinic;
  List<AuthClinic> _availableClinics = const [];
  String? _activeClinicId;
  bool _isLoading = false;
  String? _errorMessage;
  bool _isInitialized = false;

  AuthService({
    ApiClient? apiClient,
    SecureStorageService? storageService,
  })  : _apiClient = apiClient ?? ApiClient(),
        _storageService = storageService ?? SecureStorageService();

  AuthUser? get currentUser => _currentUser;
  AuthClinic? get activeClinic => _activeClinic;
  List<AuthClinic> get availableClinics => List.unmodifiable(_availableClinics);
  String? get activeClinicId => _activeClinic?.id ?? _activeClinicId;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isInitialized => _isInitialized;

  /// True when authenticated user has multiple clinics and none is yet selected.
  bool get hasMultipleClinicsWithoutSelection =>
      isAuthenticated && _activeClinic == null && _availableClinics.length > 1;

  /// True when authenticated user has zero active clinic memberships.
  bool get hasNoClinics =>
      isAuthenticated && _activeClinic == null && _availableClinics.isEmpty;

  /// Restores session from secure storage and authoritatively verifies against
  /// backend GET /api/v1/auth/me upon app launch.
  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _storageService.getAccessToken();
      if (token != null && token.isNotEmpty) {
        _currentUser = await _storageService.getUser();
        String? cachedClinicId;
        try {
          cachedClinicId = await _storageService.getActiveClinicId();
        } catch (_) {
          cachedClinicId = null;
        }

        // Authoritatively validate existing session via GET /auth/me
        try {
          final response = await _apiClient.get(
            '/auth/me',
            options: (cachedClinicId != null && cachedClinicId.isNotEmpty)
                ? Options(headers: {'x-clinic-id': cachedClinicId})
                : null,
          );

          if (response.data != null &&
              response.data is Map<String, dynamic>) {
            final profile = UserProfileResponse.fromJson(
              response.data as Map<String, dynamic>,
            );

            _currentUser = profile.user;
            try {
              await _storageService.saveUser(profile.user);
            } catch (_) {}
            _availableClinics = profile.clinics;

            if (profile.clinic != null) {
              final clinic = profile.clinic!;
              _activeClinic = clinic;
              _activeClinicId = clinic.id;
              try {
                await _storageService.saveActiveClinicId(clinic.id);
              } catch (_) {}
              if (clinic.role.isNotEmpty &&
                  _currentUser!.role != clinic.role) {
                _currentUser =
                    _currentUser!.copyWith(role: clinic.role);
                try {
                  await _storageService.saveUser(_currentUser!);
                } catch (_) {}
              }
            } else if (_availableClinics.length == 1) {
              final single = _availableClinics.first;
              _activeClinic = single;
              _activeClinicId = single.id;
              try {
                await _storageService.saveActiveClinicId(single.id);
              } catch (_) {}
              if (single.role.isNotEmpty &&
                  _currentUser!.role != single.role) {
                _currentUser =
                    _currentUser!.copyWith(role: single.role);
                try {
                  await _storageService.saveUser(_currentUser!);
                } catch (_) {}
              }
            } else {
              _activeClinic = null;
              _activeClinicId = null;
              try {
                await _storageService.clearActiveClinicId();
              } catch (_) {}
            }
          } else {
            _activeClinicId = cachedClinicId;
          }
        } on UnauthorizedException {
          // Token is invalid/expired according to backend: fail closed
          await _storageService.clearAuth();
          _currentUser = null;
          _activeClinic = null;
          _activeClinicId = null;
          _availableClinics = const [];
        } on ApiException catch (e) {
          if (e.statusCode == 401) {
            await _storageService.clearAuth();
            _currentUser = null;
            _activeClinic = null;
            _activeClinicId = null;
            _availableClinics = const [];
          } else {
            // Non-auth API error: retain cached session for resilience
            _activeClinicId = cachedClinicId;
          }
        } catch (_) {
          // Transient network failure / offline mode / unit test mock: retain cached session
          _activeClinicId = cachedClinicId;
        }
      } else {
        _currentUser = null;
        _activeClinic = null;
        _activeClinicId = null;
        _availableClinics = const [];
      }
    } catch (_) {
      // Secure storage read failure / corruption: fail closed
      await _storageService.clearAuth();
      _currentUser = null;
      _activeClinic = null;
      _activeClinicId = null;
      _availableClinics = const [];
    } finally {
      _isLoading = false;
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Executes login against backend POST /api/v1/auth/login.
  Future<bool> login(
    String email,
    String password, {
    String? clinicId,
  }) async {
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

    // Prevent prior account's in-memory clinic state leakage
    _activeClinic = null;
    _activeClinicId = null;
    _availableClinics = const [];

    try {
      final payload = request.toJson();
      if (clinicId != null && clinicId.trim().isNotEmpty) {
        payload['clinicId'] = clinicId.trim();
      }

      final response = await _apiClient.post(
        '/auth/login',
        data: payload,
      );

      final loginResponse = LoginResponse.fromJson(
        response.data as Map<String, dynamic>,
      );

      // Securely persist token and user metadata
      await _storageService.saveAccessToken(loginResponse.accessToken);
      if (loginResponse.refreshToken != null &&
          loginResponse.refreshToken!.isNotEmpty) {
        try {
          await _storageService.saveRefreshToken(loginResponse.refreshToken!);
        } catch (_) {}
      }
      await _storageService.saveUser(loginResponse.user);

      _currentUser = loginResponse.user;
      _availableClinics = loginResponse.clinics;

      // Deterministic clinic context handling
      if (loginResponse.clinic != null) {
        final clinic = loginResponse.clinic!;
        _activeClinic = clinic;
        _activeClinicId = clinic.id;
        try {
          await _storageService.saveActiveClinicId(clinic.id);
        } catch (_) {}
        if (clinic.role.isNotEmpty && _currentUser!.role != clinic.role) {
          _currentUser = _currentUser!.copyWith(role: clinic.role);
          try {
            await _storageService.saveUser(_currentUser!);
          } catch (_) {}
        }
      } else if (_availableClinics.length == 1) {
        final single = _availableClinics.first;
        _activeClinic = single;
        _activeClinicId = single.id;
        try {
          await _storageService.saveActiveClinicId(single.id);
        } catch (_) {}
        if (single.role.isNotEmpty && _currentUser!.role != single.role) {
          _currentUser = _currentUser!.copyWith(role: single.role);
          try {
            await _storageService.saveUser(_currentUser!);
          } catch (_) {}
        }
      } else {
        // Multi-clinic without default selection or zero clinics:
        // Clear cached clinic context so previous account's context is never revived.
        _activeClinic = null;
        _activeClinicId = null;
        try {
          await _storageService.clearActiveClinicId();
        } catch (_) {}
      }

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

  /// Executes clinic owner registration against backend POST /api/v1/auth/register-clinic.
  Future<bool> registerClinic(RegisterClinicRequest request) async {
    final validationError = request.validate();
    if (validationError != null) {
      _errorMessage = validationError;
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    // Prevent prior account's in-memory clinic state leakage
    _activeClinic = null;
    _activeClinicId = null;
    _availableClinics = const [];

    try {
      final response = await _apiClient.post(
        '/auth/register-clinic',
        data: request.toJson(),
      );

      final loginResponse = LoginResponse.fromJson(
        response.data as Map<String, dynamic>,
      );

      // Securely persist token and user metadata
      await _storageService.saveAccessToken(loginResponse.accessToken);
      if (loginResponse.refreshToken != null &&
          loginResponse.refreshToken!.isNotEmpty) {
        try {
          await _storageService.saveRefreshToken(loginResponse.refreshToken!);
        } catch (_) {}
      }
      await _storageService.saveUser(loginResponse.user);

      _currentUser = loginResponse.user;

      if (loginResponse.clinic != null) {
        final clinic = loginResponse.clinic!;
        _activeClinic = clinic;
        _activeClinicId = clinic.id;
        _availableClinics = loginResponse.clinics.isNotEmpty
            ? loginResponse.clinics
            : [clinic];
        try {
          await _storageService.saveActiveClinicId(clinic.id);
        } catch (_) {}
        if (clinic.role.isNotEmpty && _currentUser!.role != clinic.role) {
          _currentUser = _currentUser!.copyWith(role: clinic.role);
          try {
            await _storageService.saveUser(_currentUser!);
          } catch (_) {}
        }
      } else {
        _activeClinic = null;
        _activeClinicId = null;
        _availableClinics = loginResponse.clinics;
      }

      _errorMessage = null;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage =
          'An unexpected error occurred during clinic registration.';
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Selects and authoritatively activates a clinic from available memberships.
  /// Strictly verifies that the backend confirms the selection via /api/v1/auth/me.
  Future<bool> selectClinic(AuthClinic clinic) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.get(
        '/auth/me',
        options: Options(headers: {'x-clinic-id': clinic.id}),
      );

      if (response.data == null || response.data is! Map<String, dynamic>) {
        _errorMessage =
            'Malformed response from server during clinic selection.';
        _activeClinic = null;
        _activeClinicId = null;
        try {
          await _storageService.clearActiveClinicId();
        } catch (_) {}
        notifyListeners();
        return false;
      }

      final profile = UserProfileResponse.fromJson(
        response.data as Map<String, dynamic>,
      );

      _currentUser = profile.user;
      try {
        await _storageService.saveUser(profile.user);
      } catch (_) {}
      _availableClinics = profile.clinics;

      // Authoritative validation: backend must return non-null clinic matching requested ID
      if (profile.clinic != null && profile.clinic!.id == clinic.id) {
        final confirmedClinic = profile.clinic!;
        _activeClinic = confirmedClinic;
        _activeClinicId = confirmedClinic.id;
        try {
          await _storageService.saveActiveClinicId(confirmedClinic.id);
        } catch (_) {}
        if (confirmedClinic.role.isNotEmpty &&
            _currentUser!.role != confirmedClinic.role) {
          _currentUser =
              _currentUser!.copyWith(role: confirmedClinic.role);
          try {
            await _storageService.saveUser(_currentUser!);
          } catch (_) {}
        }

        _errorMessage = null;
        notifyListeners();
        return true;
      } else {
        // Backend rejected requested clinic (unauthorized/inactive/mismatched)
        _activeClinic = null;
        _activeClinicId = null;
        try {
          await _storageService.clearActiveClinicId();
        } catch (_) {}
        _errorMessage =
            'Unauthorized clinic selection or inactive membership.';
        notifyListeners();
        return false;
      }
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _activeClinic = null;
      _activeClinicId = null;
      try {
        await _storageService.clearActiveClinicId();
      } catch (_) {}
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Failed to select clinic: $e';
      _activeClinic = null;
      _activeClinicId = null;
      try {
        await _storageService.clearActiveClinicId();
      } catch (_) {}
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Sets or updates the active clinic ID selector in secure storage and in-memory state.
  Future<void> setActiveClinic(String clinicId) async {
    final trimmed = clinicId.trim();
    if (trimmed.isEmpty) return;

    await _storageService.saveActiveClinicId(trimmed);
    _activeClinicId = trimmed;

    final matches = _availableClinics.where((c) => c.id == trimmed);
    if (matches.isNotEmpty) {
      _activeClinic = matches.first;
      if (_activeClinic!.role.isNotEmpty &&
          _currentUser != null &&
          _currentUser!.role != _activeClinic!.role) {
        _currentUser = _currentUser!.copyWith(role: _activeClinic!.role);
        await _storageService.saveUser(_currentUser!);
      }
    } else {
      _activeClinic = AuthClinic(
        id: trimmed,
        name: 'Active Clinic',
        role: _currentUser?.role ?? '',
      );
    }
    notifyListeners();
  }

  /// Safely updates the user's clinic-specific verified role in memory and secure storage.
  Future<void> updateUserRole(String role) async {
    if (_currentUser != null && _currentUser!.role != role) {
      _currentUser = _currentUser!.copyWith(role: role);
      await _storageService.saveUser(_currentUser!);
      notifyListeners();
    }
  }

  /// Retrieves the selected clinic ID from in-memory state or secure storage.
  Future<String?> getActiveClinicId() async {
    if (_activeClinic?.id != null && _activeClinic!.id.isNotEmpty) {
      return _activeClinic!.id;
    }
    if (_activeClinicId != null && _activeClinicId!.isNotEmpty) {
      return _activeClinicId;
    }
    final stored = await _storageService.getActiveClinicId();
    _activeClinicId = stored;
    return stored;
  }

  /// Logs out the user by clearing secure storage and in-memory session.
  /// Clears active clinic context by default to prevent cross-account tenant contamination.
  Future<void> logout({bool clearClinic = true}) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _storageService.clearAuth(clearClinic: clearClinic);
    } catch (_) {}

    _currentUser = null;
    if (clearClinic) {
      _activeClinic = null;
      _activeClinicId = null;
      _availableClinics = const [];
    }
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
