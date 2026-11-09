import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/theme/app_theme.dart';
import 'package:doctor_opd_mobile/core/theme/theme_controller.dart';
import 'package:doctor_opd_mobile/core/theme/theme_preference_repository.dart';
import 'package:doctor_opd_mobile/features/settings/ui/settings_screen.dart';

class MockThemePreferenceRepository implements ThemePreferenceRepository {
  ThemeMode storedMode = ThemeMode.light;

  @override
  Future<ThemeMode> getThemeMode() async => storedMode;

  @override
  Future<void> saveThemeMode(ThemeMode mode) async {
    storedMode = mode;
  }
}

void main() {
  group('SettingsScreen', () {
    late MockThemePreferenceRepository mockRepo;
    late ThemeController themeController;

    setUp(() async {
      mockRepo = MockThemePreferenceRepository();
      themeController = ThemeController(repository: mockRepo);
      await themeController.initialize();
    });

    Widget createTestWidget() {
      return AnimatedBuilder(
        animation: themeController,
        builder: (context, _) {
          return ThemeControllerScope(
            controller: themeController,
            child: MaterialApp(
              theme: AppTheme.lightTheme,
              darkTheme: AppTheme.darkTheme,
              themeMode: themeController.themeMode,
              home: const SettingsScreen(),
            ),
          );
        },
      );
    }

    testWidgets('renders Appearance section and theme options', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('APPEARANCE'), findsOneWidget);
      expect(find.text('Light Mode'), findsOneWidget);
      expect(find.text('Dark Mode'), findsOneWidget);
      expect(find.byKey(const Key('themeOption_light')), findsOneWidget);
      expect(find.byKey(const Key('themeOption_dark')), findsOneWidget);
    });

    testWidgets('switching to dark mode updates ThemeController and UI',
        (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      expect(themeController.themeMode, ThemeMode.light);

      // Tap dark mode option
      await tester.tap(find.byKey(const Key('themeOption_dark')));
      await tester.pumpAndSettle();

      expect(themeController.themeMode, ThemeMode.dark);
      expect(mockRepo.storedMode, ThemeMode.dark);

      // Tap light mode option
      await tester.tap(find.byKey(const Key('themeOption_light')));
      await tester.pumpAndSettle();

      expect(themeController.themeMode, ThemeMode.light);
      expect(mockRepo.storedMode, ThemeMode.light);
    });
  });
}

