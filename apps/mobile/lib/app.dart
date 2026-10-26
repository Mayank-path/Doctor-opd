import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/services/auth_service.dart';
import 'features/auth/ui/login_screen.dart';
import 'features/dashboard/ui/dashboard_screen.dart';

/// Root Application Widget coordinating reactive navigation based on AuthService.
class DoctorOpdApp extends StatelessWidget {
  final AuthService authService;

  const DoctorOpdApp({
    super.key,
    required this.authService,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DOCTOR-OPD',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: AnimatedBuilder(
        animation: authService,
        builder: (context, _) {
          // 1. Initializing session from secure storage
          if (!authService.isInitialized) {
            return const Scaffold(
              backgroundColor: AppTheme.backgroundLight,
              body: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.local_hospital_rounded,
                      color: AppTheme.primaryNavy,
                      size: 48,
                    ),
                    SizedBox(height: 16),
                    SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppTheme.accentTeal,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          // 2. Authenticated Session -> Protected Dashboard
          if (authService.isAuthenticated) {
            return DashboardScreen(
              authService: authService,
              user: authService.currentUser!,
            );
          }

          // 3. Unauthenticated Session -> Login Screen
          return LoginScreen(authService: authService);
        },
      ),
    );
  }
}
