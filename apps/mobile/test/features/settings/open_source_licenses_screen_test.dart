import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/theme/app_theme.dart';
import 'package:doctor_opd_mobile/features/settings/ui/open_source_licenses_screen.dart';
import 'package:doctor_opd_mobile/features/settings/ui/settings_screen.dart';
import 'package:doctor_opd_mobile/core/theme/theme_controller.dart';
import 'package:doctor_opd_mobile/core/theme/theme_preference_repository.dart';

class MockThemeRepo implements ThemePreferenceRepository {
  ThemeMode mode = ThemeMode.light;
  @override
  Future<ThemeMode> getThemeMode() async => mode;
  @override
  Future<void> saveThemeMode(ThemeMode m) async => mode = m;
}

void main() {
  group('OpenSourceLicensesScreen Widget Tests', () {
    Widget buildScreen({ThemeMode mode = ThemeMode.light}) {
      final themeData = mode == ThemeMode.dark ? AppTheme.darkTheme : AppTheme.lightTheme;
      return MaterialApp(
        theme: themeData,
        home: const OpenSourceLicensesScreen(),
      );
    }

    testWidgets('renders all required open-source license cards and disclosures', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle();

      // Screen title
      expect(find.text('Open Source Licenses'), findsOneWidget);

      // Verify Cards
      expect(find.byKey(const Key('licenseCard_scowl')), findsOneWidget);
      expect(find.byKey(const Key('licenseCard_12dicts')), findsOneWidget);
      expect(find.byKey(const Key('licenseCard_mesh')), findsOneWidget);
      expect(find.byKey(const Key('licenseCard_fda')), findsOneWidget);
      expect(find.byKey(const Key('licenseCard_doctor_opd')), findsOneWidget);

      // Verify specific mandatory text fragments
      expect(find.textContaining('Kevin Atkinson'), findsWidgets);
      expect(find.textContaining('Alan Beale'), findsWidgets);
      expect(find.textContaining('National Library of Medicine'), findsWidgets);
      expect(find.textContaining('Food and Drug Administration'), findsWidgets);
      expect(find.textContaining('The spell-checking subsystem performs dictionary lookup'), findsOneWidget);
    });

    testWidgets('expands and displays verbatim legal notices on tap without overflow', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle();

      // Find first "View Full License Notice"
      final expandButtons = find.text('View Full License Notice');
      expect(expandButtons, findsWidgets);

      // Tap SCOWL expand button
      await tester.tap(expandButtons.first);
      await tester.pumpAndSettle();

      // Verbatim notice is displayed
      expect(find.textContaining('Permission to use, copy, modify, distribute, and sell'), findsOneWidget);
      expect(find.text('Hide License Notice'), findsOneWidget);

      // Verify no overflow errors
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders properly in Dark Mode (Obsidian + Golden Ember)', (tester) async {
      await tester.pumpWidget(buildScreen(mode: ThemeMode.dark));
      await tester.pumpAndSettle();

      expect(find.text('Open Source Licenses'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Settings screen contains tile that navigates to OpenSourceLicensesScreen', (tester) async {
      final mockRepo = MockThemeRepo();
      final controller = ThemeController(repository: mockRepo);
      await controller.initialize();

      await tester.pumpWidget(
        ThemeControllerScope(
          controller: controller,
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const SettingsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Find Open Source Licenses tile
      final tile = find.byKey(const Key('settings_openSourceLicensesTile'));
      expect(tile, findsOneWidget);

      // Scroll into view if needed and tap
      await tester.ensureVisible(tile);
      await tester.tap(tile);
      await tester.pumpAndSettle();

      // Navigated to OpenSourceLicensesScreen
      expect(find.text('Open Source Licenses'), findsOneWidget);
      expect(find.byKey(const Key('licenseCard_scowl')), findsOneWidget);
    });
  });
}
