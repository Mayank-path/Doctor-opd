import 'package:flutter/material.dart';
import 'app.dart';
import 'core/network/api_client.dart';
import 'core/spell_check/spell_check_service.dart';
import 'core/storage/secure_storage_service.dart';
import 'core/theme/theme_controller.dart';
import 'core/theme/theme_preference_repository.dart';
import 'features/auth/services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storageService = SecureStorageService();
  final apiClient = ApiClient(storageService: storageService);
  final authService = AuthService(
    apiClient: apiClient,
    storageService: storageService,
  );

  final themeRepository = SecureStorageThemePreferenceRepository(
    storageService: storageService,
  );
  final themeController = ThemeController(repository: themeRepository);

  // Restore existing session, theme preference, and initialize offline spell check
  await Future.wait([
    authService.initialize(),
    themeController.initialize(),
    SpellCheckService.instance.initialize(),
  ]);

  runApp(DoctorOpdApp(
    authService: authService,
    themeController: themeController,
  ));
}
