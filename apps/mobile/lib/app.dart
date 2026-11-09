import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'core/theme/theme_preference_repository.dart';
import 'features/auth/services/auth_service.dart';
import 'features/auth/ui/login_screen.dart';
import 'features/dashboard/ui/dashboard_screen.dart';

/// Root Application Widget coordinating reactive navigation and theme switching.
class DoctorOpdApp extends StatefulWidget {
  final AuthService authService;
  final ThemeController? themeController;

  const DoctorOpdApp({
    super.key,
    required this.authService,
    this.themeController,
  });

  @override
  State<DoctorOpdApp> createState() => _DoctorOpdAppState();
}

class _DoctorOpdAppState extends State<DoctorOpdApp> {
  late final ThemeController _themeController;

  @override
  void initState() {
    super.initState();
    _themeController = widget.themeController ??
        ThemeController(
          repository: const _DefaultThemePreferenceRepository(),
        );
  }

  @override
  Widget build(BuildContext context) {
    return ThemeControllerScope(
      controller: _themeController,
      child: AnimatedBuilder(
        animation: _themeController,
        builder: (context, _) {
          return MaterialApp(
            title: 'DOCTOR-OPD',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: _themeController.themeMode,
            home: AnimatedBuilder(
              animation: widget.authService,
              builder: (context, _) {
                // 1. Initializing session from secure storage
                if (!widget.authService.isInitialized) {
                  return Scaffold(
                    backgroundColor: context.colors.background,
                    body: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.local_hospital_rounded,
                            color: context.colors.primaryAccent,
                            size: 48,
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                context.colors.primaryAccent,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                // 2. Authenticated Session -> Protected Dashboard
                if (widget.authService.isAuthenticated) {
                  return DashboardScreen(
                    authService: widget.authService,
                    user: widget.authService.currentUser!,
                  );
                }

                // 3. Unauthenticated Session -> Login Screen
                return LoginScreen(authService: widget.authService);
              },
            ),
          );
        },
      ),
    );
  }
}

class _DefaultThemePreferenceRepository implements ThemePreferenceRepository {
  const _DefaultThemePreferenceRepository();

  @override
  Future<ThemeMode> getThemeMode() async => ThemeMode.light;

  @override
  Future<void> saveThemeMode(ThemeMode mode) async {}
}
