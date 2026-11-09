import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/theme/app_theme.dart';
import 'package:doctor_opd_mobile/core/theme/theme_controller.dart';
import 'package:doctor_opd_mobile/core/theme/theme_preference_repository.dart';
import 'package:doctor_opd_mobile/core/storage/secure_storage_service.dart';

class MockFlutterSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  group('Design System Token Governance & Regression Protection', () {
    test('Official Dark Mode tokens match authoritative Palette A specification', () {
      const dark = AppTheme.darkColors;

      expect(dark.background, const Color(0xFF111315));
      expect(dark.surface, const Color(0xFF191C20));
      expect(dark.surfaceContainer, const Color(0xFF202327));
      expect(dark.elevatedSurface, const Color(0xFF25282B));
      expect(dark.textPrimary, const Color(0xFFF4E8D2));
      expect(dark.textSecondary, const Color(0xFFB9AA96));
      expect(dark.textMuted, const Color(0xFF8D877D));
      expect(dark.primaryAccent, const Color(0xFFE8A947));
      expect(dark.accentHighlight, const Color(0xFFF2C477));
      expect(dark.accentContainer, const Color(0xFF342718));
      expect(dark.accentBorder, const Color(0xFF75532B));
      expect(dark.border, const Color(0xFF34383C));
      expect(dark.divider, const Color(0xFF34383C));
      expect(dark.error, const Color(0xFFEF4444));
      expect(dark.success, const Color(0xFF10B981));
      expect(dark.warning, const Color(0xFFF59E0B));
    });

    test('Official Light Mode tokens match Clean Medical SaaS specification', () {
      const light = AppTheme.lightColors;

      expect(light.background, const Color(0xFFF8FAFC));
      expect(light.surface, const Color(0xFFFFFFFF));
      expect(light.surfaceContainer, const Color(0xFFF1F5F9));
      expect(light.elevatedSurface, const Color(0xFFFFFFFF));
      expect(light.textPrimary, const Color(0xFF0F172A));
      expect(light.textSecondary, const Color(0xFF64748B));
      expect(light.textMuted, const Color(0xFF94A3B8));
      expect(light.primaryAccent, const Color(0xFF0D9488));
      expect(light.accentHighlight, const Color(0xFF14B8A6));
      expect(light.accentContainer, const Color(0xFFE6FFFA));
      expect(light.accentBorder, const Color(0xFF99F6E4));
      expect(light.border, const Color(0xFFE2E8F0));
      expect(light.divider, const Color(0xFFE2E8F0));
      expect(light.error, const Color(0xFFEF4444));
      expect(light.success, const Color(0xFF10B981));
      expect(light.warning, const Color(0xFFF59E0B));
    });

    test('Deprecated Palette B hex values are strictly absent from dark theme tokens', () {
      final darkColorsList = [
        AppTheme.darkColors.background,
        AppTheme.darkColors.surface,
        AppTheme.darkColors.surfaceContainer,
        AppTheme.darkColors.elevatedSurface,
        AppTheme.darkColors.textPrimary,
        AppTheme.darkColors.textSecondary,
        AppTheme.darkColors.textMuted,
        AppTheme.darkColors.primaryAccent,
        AppTheme.darkColors.accentHighlight,
      ];

      const deprecatedPaletteB = [
        Color(0xFF0B0F17), // Deprecated background
        Color(0xFF121824), // Deprecated surface
        Color(0xFF1A2234), // Deprecated elevated
        Color(0xFFE5A93C), // Deprecated accent
        Color(0xFFF5C76D), // Deprecated highlight
        Color(0xFFF1F5F9), // Deprecated dark text primary (valid only as Light surface)
      ];

      for (final deprecatedColor in deprecatedPaletteB) {
        expect(
          darkColorsList.contains(deprecatedColor),
          isFalse,
          reason: 'Active dark token must not contain deprecated Palette B: $deprecatedColor',
        );
      }
    });

    testWidgets('AppColorsExtension resolves dynamically via BuildContext', (tester) async {
      AppColorsExtension? capturedLightColors;
      bool? capturedLightIsDark;

      await tester.pumpWidget(
        Theme(
          data: AppTheme.lightTheme,
          child: Builder(
            builder: (context) {
              capturedLightColors = context.colors;
              capturedLightIsDark = context.isDarkMode;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(capturedLightColors!.background, AppTheme.lightColors.background);
      expect(capturedLightColors!.primaryAccent, AppTheme.lightColors.primaryAccent);
      expect(capturedLightIsDark, isFalse);

      AppColorsExtension? capturedDarkColors;
      bool? capturedDarkIsDark;

      await tester.pumpWidget(
        Theme(
          data: AppTheme.darkTheme,
          child: Builder(
            builder: (context) {
              capturedDarkColors = context.colors;
              capturedDarkIsDark = context.isDarkMode;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(capturedDarkColors!.background, AppTheme.darkColors.background);
      expect(capturedDarkColors!.primaryAccent, AppTheme.darkColors.primaryAccent);
      expect(capturedDarkIsDark, isTrue);
    });

    test('AppColorsExtension copyWith and lerp operate correctly', () {
      const original = AppTheme.darkColors;
      final modified = original.copyWith(
        primaryAccent: const Color(0xFFFFFFFF),
      );

      expect(modified.primaryAccent, const Color(0xFFFFFFFF));
      expect(modified.background, original.background);

      final lerped = original.lerp(modified, 0.5);
      expect(lerped.primaryAccent, isNot(original.primaryAccent));
      expect(lerped.background, original.background);
    });
  });

  group('Theme Persistence Security & Key Integrity', () {
    late MockFlutterSecureStorage mockSecureStorage;
    late SecureStorageService storageService;
    late SecureStorageThemePreferenceRepository repo;

    setUp(() {
      mockSecureStorage = MockFlutterSecureStorage();
      storageService = SecureStorageService(storage: mockSecureStorage);
      repo = SecureStorageThemePreferenceRepository(storageService: storageService);
    });

    test('Theme mode persistence strictly uses the opd_theme_mode key', () async {
      when(() => mockSecureStorage.write(
            key: 'opd_theme_mode',
            value: any(named: 'value'),
          )).thenAnswer((_) async {});

      when(() => mockSecureStorage.read(key: 'opd_theme_mode'))
          .thenAnswer((_) async => 'dark');

      // Test SecureStorageService directly
      await storageService.saveThemeMode('dark');
      verify(() => mockSecureStorage.write(key: 'opd_theme_mode', value: 'dark')).called(1);

      final readValue = await storageService.getThemeMode();
      expect(readValue, 'dark');
      verify(() => mockSecureStorage.read(key: 'opd_theme_mode')).called(1);

      // Verify that the unprefixed 'theme_mode' key was NEVER used
      verifyNever(() => mockSecureStorage.write(
            key: 'theme_mode',
            value: any(named: 'value'),
          ));
      verifyNever(() => mockSecureStorage.read(key: 'theme_mode'));
    });

    test('SecureStorageThemePreferenceRepository correctly reads and writes ThemeMode', () async {
      when(() => mockSecureStorage.write(
            key: 'opd_theme_mode',
            value: any(named: 'value'),
          )).thenAnswer((_) async {});

      // Save dark
      await repo.saveThemeMode(ThemeMode.dark);
      verify(() => mockSecureStorage.write(key: 'opd_theme_mode', value: 'dark')).called(1);

      // Save light
      await repo.saveThemeMode(ThemeMode.light);
      verify(() => mockSecureStorage.write(key: 'opd_theme_mode', value: 'light')).called(1);

      // Save system
      await repo.saveThemeMode(ThemeMode.system);
      verify(() => mockSecureStorage.write(key: 'opd_theme_mode', value: 'system')).called(1);

      // Read dark
      when(() => mockSecureStorage.read(key: 'opd_theme_mode'))
          .thenAnswer((_) async => 'dark');
      expect(await repo.getThemeMode(), ThemeMode.dark);

      // Read system
      when(() => mockSecureStorage.read(key: 'opd_theme_mode'))
          .thenAnswer((_) async => 'system');
      expect(await repo.getThemeMode(), ThemeMode.system);

      // Read fallback
      when(() => mockSecureStorage.read(key: 'opd_theme_mode'))
          .thenAnswer((_) async => null);
      expect(await repo.getThemeMode(), ThemeMode.light);

      // Read invalid
      when(() => mockSecureStorage.read(key: 'opd_theme_mode'))
          .thenAnswer((_) async => 'unknown_mode_string');
      expect(await repo.getThemeMode(), ThemeMode.light);
    });

    test('clearAuth clears auth credentials but strictly preserves opd_theme_mode', () async {
      when(() => mockSecureStorage.delete(key: any(named: 'key')))
          .thenAnswer((_) async {});

      await storageService.clearAuth(clearClinic: true);

      // Verifies auth keys were deleted
      verify(() => mockSecureStorage.delete(key: 'opd_access_token')).called(1);
      verify(() => mockSecureStorage.delete(key: 'opd_refresh_token')).called(1);
      verify(() => mockSecureStorage.delete(key: 'opd_cached_user')).called(1);
      verify(() => mockSecureStorage.delete(key: 'opd_active_clinic_id')).called(1);

      // Verifies theme mode is NEVER deleted on logout
      verifyNever(() => mockSecureStorage.delete(key: 'opd_theme_mode'));
    });
  });

  group('Reactive Application Theme Mode Switching', () {
    testWidgets('AnimatedBuilder updates MaterialApp themeMode instantly on controller state change',
        (tester) async {
      final mockStorage = MockFlutterSecureStorage();
      when(() => mockStorage.write(
            key: any(named: 'key'),
            value: any(named: 'value'),
          )).thenAnswer((_) async {});
      when(() => mockStorage.read(key: 'opd_theme_mode'))
          .thenAnswer((_) async => 'light');

      final storageService = SecureStorageService(storage: mockStorage);
      final repo = SecureStorageThemePreferenceRepository(storageService: storageService);
      final controller = ThemeController(repository: repo);
      await controller.initialize();

      await tester.pumpWidget(
        AnimatedBuilder(
          animation: controller,
          builder: (context, _) {
            return MaterialApp(
              theme: AppTheme.lightTheme,
              darkTheme: AppTheme.darkTheme,
              themeMode: controller.themeMode,
              home: Scaffold(
                body: Builder(
                  builder: (ctx) {
                    final isDark = ctx.isDarkMode;
                    return Text(isDark ? 'DARK_ACTIVE' : 'LIGHT_ACTIVE');
                  },
                ),
              ),
            );
          },
        ),
      );

      expect(find.text('LIGHT_ACTIVE'), findsOneWidget);
      expect(find.text('DARK_ACTIVE'), findsNothing);

      // Toggle to dark
      await controller.toggleTheme();
      await tester.pumpAndSettle();

      expect(find.text('DARK_ACTIVE'), findsOneWidget);
      expect(find.text('LIGHT_ACTIVE'), findsNothing);

      // Toggle back to light
      await controller.toggleTheme();
      await tester.pumpAndSettle();

      expect(find.text('LIGHT_ACTIVE'), findsOneWidget);
      expect(find.text('DARK_ACTIVE'), findsNothing);
    });
  });
}
