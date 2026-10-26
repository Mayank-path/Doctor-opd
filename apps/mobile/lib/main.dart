import 'package:flutter/material.dart';
import 'app.dart';
import 'core/network/api_client.dart';
import 'core/storage/secure_storage_service.dart';
import 'features/auth/services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storageService = SecureStorageService();
  final apiClient = ApiClient(storageService: storageService);
  final authService = AuthService(
    apiClient: apiClient,
    storageService: storageService,
  );

  // Restore existing session from encrypted device storage
  await authService.initialize();

  runApp(DoctorOpdApp(authService: authService));
}
