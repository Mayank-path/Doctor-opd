import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/theme/theme_controller.dart';
import 'package:doctor_opd_mobile/core/theme/theme_preference_repository.dart';

class MockThemePreferenceRepository implements ThemePreferenceRepository {
  ThemeMode storedMode = ThemeMode.light;

  @override
  Future<ThemeMode> getThemeMode() async {
    return storedMode;
  }

  @override
  Future<void> saveThemeMode(ThemeMode mode) async {
    storedMode = mode;
  }
}

void main() {
  group('ThemeController', () {
    late MockThemePreferenceRepository mockRepo;
    late ThemeController controller;

    setUp(() {
      mockRepo = MockThemePreferenceRepository();
      controller = ThemeController(repository: mockRepo);
    });

    test('defaults to ThemeMode.light when no preference is saved', () async {
      expect(controller.themeMode, ThemeMode.light);
      expect(controller.isInitialized, false);

      await controller.initialize();

      expect(controller.isInitialized, true);
      expect(controller.themeMode, ThemeMode.light);
      expect(controller.isDarkMode, false);
    });

    test('initializes with saved ThemeMode.dark', () async {
      mockRepo.storedMode = ThemeMode.dark;

      await controller.initialize();

      expect(controller.isInitialized, true);
      expect(controller.themeMode, ThemeMode.dark);
      expect(controller.isDarkMode, true);
    });

    test('setThemeMode updates state, notifies listeners, and persists', () async {
      await controller.initialize();

      var notified = false;
      controller.addListener(() {
        notified = true;
      });

      await controller.setThemeMode(ThemeMode.dark);

      expect(controller.themeMode, ThemeMode.dark);
      expect(controller.isDarkMode, true);
      expect(mockRepo.storedMode, ThemeMode.dark);
      expect(notified, true);
    });

    test('setThemeMode with same mode is no-op and does not notify', () async {
      await controller.initialize();

      var notified = false;
      controller.addListener(() {
        notified = true;
      });

      await controller.setThemeMode(ThemeMode.light);

      expect(notified, false);
    });

    test('toggleTheme alternates between light and dark', () async {
      await controller.initialize();
      expect(controller.themeMode, ThemeMode.light);

      await controller.toggleTheme();
      expect(controller.themeMode, ThemeMode.dark);
      expect(mockRepo.storedMode, ThemeMode.dark);

      await controller.toggleTheme();
      expect(controller.themeMode, ThemeMode.light);
      expect(mockRepo.storedMode, ThemeMode.light);
    });

    testWidgets('ThemeControllerScope provides controller down the widget tree',
        (tester) async {
      await controller.initialize();

      ThemeController? foundController;

      await tester.pumpWidget(
        ThemeControllerScope(
          controller: controller,
          child: Builder(
            builder: (context) {
              foundController = ThemeControllerScope.of(context);
              return const SizedBox();
            },
          ),
        ),
      );

      expect(foundController, same(controller));
    });
  });
}

