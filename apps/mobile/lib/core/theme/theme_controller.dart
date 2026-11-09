import 'package:flutter/material.dart';
import 'theme_preference_repository.dart';

/// Centralized state manager for application-wide theme mode (Light vs Dark).
///
/// Features:
/// - Reactive state updates via [ChangeNotifier].
/// - Persistent local storage via [ThemePreferenceRepository].
/// - Defaulting to [ThemeMode.light] on first launch.
/// - Survives authentication logouts and application restarts.
class ThemeController extends ChangeNotifier {
  final ThemePreferenceRepository _repository;
  ThemeMode _themeMode = ThemeMode.light;
  bool _isInitialized = false;

  ThemeController({
    required ThemePreferenceRepository repository,
    ThemeMode initialMode = ThemeMode.light,
  })  : _repository = repository,
        _themeMode = initialMode;

  /// Current active [ThemeMode].
  ThemeMode get themeMode => _themeMode;

  /// Convenience getter checking if current theme is Dark mode.
  bool get isDarkMode => _themeMode == ThemeMode.dark;

  /// Whether the controller has initialized its state from persistent storage.
  bool get isInitialized => _isInitialized;

  /// Initializes the controller by restoring user theme preference from disk.
  Future<void> initialize() async {
    if (_isInitialized) return;
    try {
      _themeMode = await _repository.getThemeMode();
    } catch (_) {
      _themeMode = ThemeMode.light;
    } finally {
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Explicitly sets the active theme mode and persists it to disk.
  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode == mode) return;
    _themeMode = mode;
    notifyListeners();
    try {
      await _repository.saveThemeMode(mode);
    } catch (_) {
      // Storage error gracefully caught; memory state remains reactive
    }
  }

  /// Toggles between [ThemeMode.light] and [ThemeMode.dark].
  Future<void> toggleTheme() async {
    final nextMode = isDarkMode ? ThemeMode.light : ThemeMode.dark;
    await setThemeMode(nextMode);
  }
}

/// InheritedWidget providing ambient access to [ThemeController] down the widget tree.
class ThemeControllerScope extends InheritedNotifier<ThemeController> {
  const ThemeControllerScope({
    super.key,
    required ThemeController controller,
    required super.child,
  }) : super(notifier: controller);

  /// Looks up the nearest [ThemeController] in the widget tree.
  static ThemeController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ThemeControllerScope>();
    assert(
      scope != null,
      'No ThemeControllerScope found in context. Ensure the app is wrapped in ThemeControllerScope.',
    );
    return scope!.notifier!;
  }

  /// Optional lookup that does not throw if no [ThemeControllerScope] is found.
  static ThemeController? maybeOf(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ThemeControllerScope>();
    return scope?.notifier;
  }
}

