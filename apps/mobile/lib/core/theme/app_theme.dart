import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Typed ThemeExtension containing semantic design tokens for DOCTOR-OPD.
/// Adapts dynamically between Light Mode and Obsidian + Golden Ember Dark Mode.
class AppColorsExtension extends ThemeExtension<AppColorsExtension> {
  final Color background;
  final Color surface;
  final Color surfaceContainer;
  final Color elevatedSurface;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color primaryAccent;
  final Color accentHighlight;
  final Color accentContainer;
  final Color accentBorder;
  final Color border;
  final Color divider;
  final Color error;
  final Color success;
  final Color warning;

  const AppColorsExtension({
    required this.background,
    required this.surface,
    required this.surfaceContainer,
    required this.elevatedSurface,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.primaryAccent,
    required this.accentHighlight,
    required this.accentContainer,
    required this.accentBorder,
    required this.border,
    required this.divider,
    required this.error,
    required this.success,
    required this.warning,
  });

  @override
  AppColorsExtension copyWith({
    Color? background,
    Color? surface,
    Color? surfaceContainer,
    Color? elevatedSurface,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? primaryAccent,
    Color? accentHighlight,
    Color? accentContainer,
    Color? accentBorder,
    Color? border,
    Color? divider,
    Color? error,
    Color? success,
    Color? warning,
  }) {
    return AppColorsExtension(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceContainer: surfaceContainer ?? this.surfaceContainer,
      elevatedSurface: elevatedSurface ?? this.elevatedSurface,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      primaryAccent: primaryAccent ?? this.primaryAccent,
      accentHighlight: accentHighlight ?? this.accentHighlight,
      accentContainer: accentContainer ?? this.accentContainer,
      accentBorder: accentBorder ?? this.accentBorder,
      border: border ?? this.border,
      divider: divider ?? this.divider,
      error: error ?? this.error,
      success: success ?? this.success,
      warning: warning ?? this.warning,
    );
  }

  @override
  AppColorsExtension lerp(ThemeExtension<AppColorsExtension>? other, double t) {
    if (other is! AppColorsExtension) return this;
    return AppColorsExtension(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceContainer: Color.lerp(surfaceContainer, other.surfaceContainer, t)!,
      elevatedSurface: Color.lerp(elevatedSurface, other.elevatedSurface, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      primaryAccent: Color.lerp(primaryAccent, other.primaryAccent, t)!,
      accentHighlight: Color.lerp(accentHighlight, other.accentHighlight, t)!,
      accentContainer: Color.lerp(accentContainer, other.accentContainer, t)!,
      accentBorder: Color.lerp(accentBorder, other.accentBorder, t)!,
      border: Color.lerp(border, other.border, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      error: Color.lerp(error, other.error, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
    );
  }
}

/// Convenience extension providing instant access to [AppColorsExtension] and dark mode state.
extension AppThemeContext on BuildContext {
  AppColorsExtension get colors =>
      Theme.of(this).extension<AppColorsExtension>() ?? AppTheme.lightColors;

  bool get isDarkMode => Theme.of(this).brightness == Brightness.dark;
}

/// Design system tokens and theme definitions for DOCTOR-OPD.
///
/// Features:
/// 1. Light Mode: Clean Medical SaaS Interface (Slate Navy #0F172A, Healthcare Teal #0D9488, Crisp White).
/// 2. Dark Mode: Premium Obsidian & Golden Ember (#111315 Background, #191C20 Surface, #E8A947 Ember Accent).
class AppTheme {
  AppTheme._();

  // Legacy Light Mode Palette constants (preserved for backward compatibility)
  static const Color primaryNavy = Color(0xFF0F172A);
  static const Color navyLight = Color(0xFF1E293B);
  static const Color darkSlate = navyLight;
  static const Color accentTeal = Color(0xFF0D9488);
  static const Color primaryTeal = accentTeal;
  static const Color accentTealLight = Color(0xFF14B8A6);
  static const Color backgroundLight = Color(0xFFF8FAFC);
  static const Color surfaceWhite = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF1F5F9);
  static const Color borderSubtle = Color(0xFFE2E8F0);
  static const Color borderGray = borderSubtle;
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color errorRed = Color(0xFFEF4444);
  static const Color dangerRed = errorRed;
  static const Color successGreen = Color(0xFF10B981);
  static const Color warningAmber = Color(0xFFF59E0B);

  // Centralized High-Contrast Semantic Clinical Status Tokens
  // Light Mode (WCAG AA >= 4.5:1 on light backgrounds #FFFFFF / #F8FAFC)
  static const Color statusApprovedLight = Color(0xFF047857);  // Emerald-700 (5.48:1 on white, 5.21:1 on tint)
  static const Color statusFinalizedLight = Color(0xFF0F766E); // Teal-700 (5.47:1 on white, 5.25:1 on tint)
  static const Color statusDraftLight = Color(0xFF9A3412);     // Orange-800 (7.31:1 on white, 6.66:1 on tint)
  static const Color statusSupersededLight = Color(0xFF37474F);// BlueGrey-800 (9.65:1 on white, 8.85:1 on grey)
  static const Color statusVoidedLight = Color(0xFFB91C1C);    // Red-700 (6.47:1 on white, 5.91:1 on tint)

  // Dark Mode (WCAG AA/AAA on Obsidian #111315 / #191C20)
  static const Color statusApprovedDark = Color(0xFF10B981);   // Green-500 (7.34:1 on obsidian)
  static const Color statusFinalizedDark = Color(0xFFE8A947);  // Golden Ember (9.04:1 on obsidian)
  static const Color statusDraftDark = Color(0xFFF2C477);      // Ember Highlight (11.47:1 on obsidian)
  static const Color statusSupersededDark = Color(0xFFB9AA96); // Dark Text Secondary (8.20:1 on obsidian)
  static const Color statusVoidedDark = Color(0xFFEF4444);     // Red-500 (4.95:1 on obsidian)

  // Official Obsidian + Golden Ember Dark Mode Tokens
  static const Color obsidianBackground = Color(0xFF111315);
  static const Color obsidianSurface = Color(0xFF191C20);
  static const Color obsidianContainer = Color(0xFF202327);
  static const Color obsidianElevated = Color(0xFF25282B);
  static const Color darkBorder = Color(0xFF34383C);
  static const Color darkDivider = Color(0xFF34383C);
  static const Color warmIvoryTextPrimary = Color(0xFFF4E8D2);
  static const Color darkTextSecondary = Color(0xFFB9AA96);
  static const Color darkTextMuted = Color(0xFF8D877D);
  static const Color goldenEmber = Color(0xFFE8A947);
  static const Color goldenEmberHighlight = Color(0xFFF2C477);
  static const Color goldenEmberContainer = Color(0xFF342718);
  static const Color goldenEmberBorder = Color(0xFF75532B);

  /// Semantic colors for Light Mode
  static const AppColorsExtension lightColors = AppColorsExtension(
    background: Color(0xFFF8FAFC),
    surface: Color(0xFFFFFFFF),
    surfaceContainer: Color(0xFFF1F5F9),
    elevatedSurface: Color(0xFFFFFFFF),
    textPrimary: Color(0xFF0F172A),
    textSecondary: Color(0xFF64748B),
    textMuted: Color(0xFF94A3B8),
    primaryAccent: Color(0xFF0D9488),
    accentHighlight: Color(0xFF14B8A6),
    accentContainer: Color(0xFFE6FFFA),
    accentBorder: Color(0xFF99F6E4),
    border: Color(0xFFE2E8F0),
    divider: Color(0xFFE2E8F0),
    error: Color(0xFFEF4444),
    success: Color(0xFF10B981),
    warning: Color(0xFFF59E0B),
  );

  /// Semantic colors for Dark Mode (Obsidian & Golden Ember)
  static const AppColorsExtension darkColors = AppColorsExtension(
    background: obsidianBackground,
    surface: obsidianSurface,
    surfaceContainer: obsidianContainer,
    elevatedSurface: obsidianElevated,
    textPrimary: warmIvoryTextPrimary,
    textSecondary: darkTextSecondary,
    textMuted: darkTextMuted,
    primaryAccent: goldenEmber,
    accentHighlight: goldenEmberHighlight,
    accentContainer: goldenEmberContainer,
    accentBorder: goldenEmberBorder,
    border: darkBorder,
    divider: darkDivider,
    error: Color(0xFFEF4444),
    success: Color(0xFF10B981),
    warning: Color(0xFFF59E0B),
  );

  /// Light Theme definition
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: primaryNavy,
      scaffoldBackgroundColor: backgroundLight,
      colorScheme: const ColorScheme.light(
        primary: primaryNavy,
        onPrimary: Colors.white,
        secondary: accentTeal,
        onSecondary: Colors.white,
        surface: surfaceWhite,
        onSurface: textPrimary,
        error: errorRed,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceWhite,
        foregroundColor: textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: textPrimary),
        actionsIconTheme: IconThemeData(color: textPrimary),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
          systemNavigationBarColor: surfaceWhite,
          systemNavigationBarIconBrightness: Brightness.dark,
        ),
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceWhite,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: borderSubtle),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceWhite,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: const TextStyle(color: textMuted, fontSize: 14),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: accentTeal, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: errorRed),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: errorRed, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryNavy,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(50),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryNavy,
          minimumSize: const Size.fromHeight(48),
          side: const BorderSide(color: borderSubtle),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surfaceWhite,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surfaceWhite,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: borderSubtle,
        thickness: 1,
        space: 1,
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: surfaceWhite,
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: surfaceWhite,
        headerBackgroundColor: primaryNavy,
        headerForegroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: borderSubtle),
        ),
        dividerColor: borderSubtle,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: primaryNavy,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        behavior: SnackBarBehavior.floating,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: surfaceWhite,
        surfaceTintColor: Colors.transparent,
        textStyle: const TextStyle(color: textPrimary, fontSize: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: borderSubtle),
        ),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: primaryNavy,
          borderRadius: BorderRadius.circular(6),
        ),
        textStyle: const TextStyle(color: Colors.white, fontSize: 12),
      ),
      extensions: const <ThemeExtension<dynamic>>[
        lightColors,
      ],
    );
  }

  /// Dark Theme definition (Obsidian & Golden Ember)
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      primaryColor: goldenEmber,
      scaffoldBackgroundColor: obsidianBackground,
      colorScheme: const ColorScheme.dark(
        primary: goldenEmber,
        onPrimary: obsidianBackground,
        secondary: goldenEmberHighlight,
        onSecondary: obsidianBackground,
        surface: obsidianSurface,
        onSurface: warmIvoryTextPrimary,
        error: errorRed,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: obsidianSurface,
        foregroundColor: warmIvoryTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: warmIvoryTextPrimary),
        actionsIconTheme: IconThemeData(color: warmIvoryTextPrimary),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
          systemNavigationBarColor: obsidianSurface,
          systemNavigationBarIconBrightness: Brightness.light,
        ),
        titleTextStyle: TextStyle(
          color: warmIvoryTextPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: obsidianSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: darkBorder),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: obsidianContainer,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: const TextStyle(color: darkTextMuted, fontSize: 14),
        labelStyle: const TextStyle(color: darkTextSecondary, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: goldenEmber, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: errorRed),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: errorRed, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: goldenEmber,
          foregroundColor: obsidianBackground,
          minimumSize: const Size.fromHeight(50),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.1,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: goldenEmber,
          minimumSize: const Size.fromHeight(48),
          side: const BorderSide(color: goldenEmberBorder),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: obsidianElevated,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: darkBorder),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: obsidianElevated,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          side: BorderSide(color: darkBorder),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: darkDivider,
        thickness: 1,
        space: 1,
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: obsidianSurface,
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: obsidianElevated,
        headerBackgroundColor: obsidianSurface,
        headerForegroundColor: warmIvoryTextPrimary,
        surfaceTintColor: Colors.transparent,
        dayForegroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return obsidianBackground;
          if (states.contains(WidgetState.disabled)) return darkTextMuted;
          return warmIvoryTextPrimary;
        }),
        dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return goldenEmber;
          return null;
        }),
        todayForegroundColor: WidgetStateProperty.all(goldenEmber),
        todayBorder: const BorderSide(color: goldenEmber),
        yearForegroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return obsidianBackground;
          return warmIvoryTextPrimary;
        }),
        yearBackgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return goldenEmber;
          return null;
        }),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: darkBorder),
        ),
        dividerColor: darkDivider,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: obsidianElevated,
        contentTextStyle: const TextStyle(color: warmIvoryTextPrimary, fontSize: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: darkBorder),
        ),
        behavior: SnackBarBehavior.floating,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: obsidianElevated,
        surfaceTintColor: Colors.transparent,
        textStyle: const TextStyle(color: warmIvoryTextPrimary, fontSize: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: darkBorder),
        ),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: obsidianElevated,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: darkBorder),
        ),
        textStyle: const TextStyle(color: warmIvoryTextPrimary, fontSize: 12),
      ),
      extensions: const <ThemeExtension<dynamic>>[
        darkColors,
      ],
    );
  }
}
