import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/theme/app_theme.dart';
import 'package:doctor_opd_mobile/features/consultations/models/consultation.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/prescription.dart';

/// Calculates the contrast ratio between two colors per W3C WCAG 2.1 using
/// Flutter's standard `Color.computeLuminance()`.
/// Ratio is between 1:1 and 21:1.
double contrastRatio(Color c1, Color c2) {
  final l1 = c1.computeLuminance();
  final l2 = c2.computeLuminance();
  final lighter = math.max(l1, l2);
  final darker = math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  group('WCAG 2.1 AA Mathematical Color Contrast Verification', () {
    test('Dark Mode (Obsidian & Golden Ember) Text Contrast meets WCAG AA / AAA', () {
      const dark = AppTheme.darkColors;

      // Primary text on dark surfaces
      final primaryOnBg = contrastRatio(dark.textPrimary, dark.background);
      final primaryOnSurface = contrastRatio(dark.textPrimary, dark.surface);
      final primaryOnContainer = contrastRatio(dark.textPrimary, dark.surfaceContainer);

      expect(primaryOnBg, greaterThanOrEqualTo(7.0),
          reason: 'Dark textPrimary on background must achieve WCAG AAA (>= 7:1). Actual: $primaryOnBg');
      expect(primaryOnSurface, greaterThanOrEqualTo(7.0),
          reason: 'Dark textPrimary on surface must achieve WCAG AAA (>= 7:1). Actual: $primaryOnSurface');
      expect(primaryOnContainer, greaterThanOrEqualTo(7.0),
          reason: 'Dark textPrimary on container must achieve WCAG AAA (>= 7:1). Actual: $primaryOnContainer');

      // Secondary text on dark surfaces (all must exceed 4.5:1 AA)
      final secondaryOnBg = contrastRatio(dark.textSecondary, dark.background);
      final secondaryOnSurface = contrastRatio(dark.textSecondary, dark.surface);
      final secondaryOnContainer = contrastRatio(dark.textSecondary, dark.surfaceContainer);

      expect(secondaryOnBg, greaterThanOrEqualTo(4.5),
          reason: 'Dark textSecondary on background must achieve WCAG AA (>= 4.5:1). Actual: $secondaryOnBg');
      expect(secondaryOnSurface, greaterThanOrEqualTo(4.5),
          reason: 'Dark textSecondary on surface must achieve WCAG AA (>= 4.5:1). Actual: $secondaryOnSurface');
      expect(secondaryOnContainer, greaterThanOrEqualTo(4.5),
          reason: 'Dark textSecondary on container must achieve WCAG AA (>= 4.5:1). Actual: $secondaryOnContainer');

      // Golden Ember Primary Accent button and active elements
      final buttonTextOnAccent = contrastRatio(const Color(0xFF111315), dark.primaryAccent);
      expect(buttonTextOnAccent, greaterThanOrEqualTo(7.0),
          reason: 'Dark button text on Golden Ember must achieve WCAG AAA (>= 7:1). Actual: $buttonTextOnAccent');

      // Status indicator tokens on dark background
      final successOnBg = contrastRatio(dark.success, dark.background);
      final errorOnBg = contrastRatio(dark.error, dark.background);
      expect(successOnBg, greaterThanOrEqualTo(4.5),
          reason: 'Dark success token on background must achieve WCAG AA. Actual: $successOnBg');
      expect(errorOnBg, greaterThanOrEqualTo(4.5),
          reason: 'Dark error token on background must achieve WCAG AA. Actual: $errorOnBg');
    });

    test('Light Mode (Clean Medical SaaS) Text Contrast meets WCAG AA / AAA', () {
      const light = AppTheme.lightColors;

      // Primary text on white and light background
      final primaryOnSurface = contrastRatio(light.textPrimary, light.surface);
      final primaryOnBg = contrastRatio(light.textPrimary, light.background);
      final primaryOnContainer = contrastRatio(light.textPrimary, light.surfaceContainer);

      expect(primaryOnSurface, greaterThanOrEqualTo(7.0),
          reason: 'Light textPrimary on surface must achieve WCAG AAA (>= 7:1). Actual: $primaryOnSurface');
      expect(primaryOnBg, greaterThanOrEqualTo(7.0),
          reason: 'Light textPrimary on background must achieve WCAG AAA (>= 7:1). Actual: $primaryOnBg');
      expect(primaryOnContainer, greaterThanOrEqualTo(7.0),
          reason: 'Light textPrimary on container must achieve WCAG AAA (>= 7:1). Actual: $primaryOnContainer');

      // Secondary text on light surfaces (must achieve >= 4.5:1 AA for readable body/labels on surface & background)
      final secondaryOnSurface = contrastRatio(light.textSecondary, light.surface);
      final secondaryOnBg = contrastRatio(light.textSecondary, light.background);
      final secondaryOnContainer = contrastRatio(light.textSecondary, light.surfaceContainer);

      expect(secondaryOnSurface, greaterThanOrEqualTo(4.5),
          reason: 'Light textSecondary on surface must achieve WCAG AA (>= 4.5:1). Actual: $secondaryOnSurface');
      expect(secondaryOnBg, greaterThanOrEqualTo(4.5),
          reason: 'Light textSecondary on background must achieve WCAG AA (>= 4.5:1). Actual: $secondaryOnBg');
      expect(secondaryOnContainer, greaterThanOrEqualTo(3.0),
          reason: 'Light textSecondary on container satisfies WCAG large text/control requirement (>= 3:1). Actual: $secondaryOnContainer');
    });

    test('Interactive Control Boundaries and Graphical UI Meet WCAG Non-Text Contrast (>= 3:1)', () {
      const dark = AppTheme.darkColors;
      const light = AppTheme.lightColors;

      // Dark mode active interactive accent on background
      final darkAccentOnBg = contrastRatio(dark.primaryAccent, dark.background);
      expect(darkAccentOnBg, greaterThanOrEqualTo(3.0),
          reason: 'Dark primaryAccent against background must satisfy >= 3:1 for graphical UI. Actual: $darkAccentOnBg');

      // Light mode active interactive accent on surface
      final lightAccentOnSurface = contrastRatio(light.primaryAccent, light.surface);
      expect(lightAccentOnSurface, greaterThanOrEqualTo(3.0),
          reason: 'Light primaryAccent against surface must satisfy >= 3:1 for graphical UI. Actual: $lightAccentOnSurface');

      // Form icon colors (textSecondary) satisfy non-text contrast >= 3:1
      final lightIconContrast = contrastRatio(light.textSecondary, light.surface);
      final darkIconContrast = contrastRatio(dark.textSecondary, dark.surface);
      expect(lightIconContrast, greaterThanOrEqualTo(3.0),
          reason: 'Light mode icons must exceed 3:1 contrast. Actual: $lightIconContrast');
      expect(darkIconContrast, greaterThanOrEqualTo(3.0),
          reason: 'Dark mode icons must exceed 3:1 contrast. Actual: $darkIconContrast');
    });

    test('Finding A — Prescription Medication Counter Contrast across All 4 States (>= 4.5:1)', () {
      const light = AppTheme.lightColors;
      const dark = AppTheme.darkColors;

      // State 1: Empty (0 items), Light Mode
      // Container: surfaceContainer (#F1F5F9), Text: textPrimary (#0F172A)
      final emptyLightContrast = contrastRatio(light.textPrimary, light.surfaceContainer);
      expect(emptyLightContrast, greaterThanOrEqualTo(7.0),
          reason: 'Medication counter empty state in Light Mode must achieve AAA (>= 7:1). Actual: $emptyLightContrast');

      // State 2: Empty (0 items), Dark Mode
      // Container: surfaceContainer (#202327), Text: textSecondary (#B9AA96)
      final emptyDarkContrast = contrastRatio(dark.textSecondary, dark.surfaceContainer);
      expect(emptyDarkContrast, greaterThanOrEqualTo(4.5),
          reason: 'Medication counter empty state in Dark Mode must achieve AA (>= 4.5:1). Actual: $emptyDarkContrast');

      // State 3: Active (>0 items), Light Mode
      // Container: accentContainer (#E6FFFA), Text: statusFinalizedLight (#0F766E)
      final activeLightContrast = contrastRatio(AppTheme.statusFinalizedLight, light.accentContainer);
      expect(activeLightContrast, greaterThanOrEqualTo(4.5),
          reason: 'Medication counter active state in Light Mode must achieve AA (>= 4.5:1). Actual: $activeLightContrast');

      // State 4: Active (>0 items), Dark Mode
      // Container: accentContainer (#342718), Text: primaryAccent (#E8A947)
      final activeDarkContrast = contrastRatio(dark.primaryAccent, dark.accentContainer);
      expect(activeDarkContrast, greaterThanOrEqualTo(7.0),
          reason: 'Medication counter active state in Dark Mode must achieve AAA (>= 7:1). Actual: $activeDarkContrast');
    });

    test('Finding B & C — Clinical Status Badge Contrast across Actual Rendered Backgrounds', () {
      const lightSurface = Color(0xFFFFFFFF);
      const darkBg = AppTheme.obsidianBackground;
      const darkSurface = AppTheme.obsidianSurface;

      // Status 1: Approved / Finalized (Light & Dark)
      final approvedLightOnWhite = contrastRatio(AppTheme.statusApprovedLight, lightSurface);
      final approvedLightOnTint = contrastRatio(AppTheme.statusApprovedLight, const Color(0xFFECFDF5));
      final approvedDarkOnBg = contrastRatio(AppTheme.statusApprovedDark, darkBg);
      final approvedDarkOnSurface = contrastRatio(AppTheme.statusApprovedDark, darkSurface);

      expect(approvedLightOnWhite, greaterThanOrEqualTo(4.5),
          reason: 'Approved status in Light Mode on white must be >= 4.5:1. Actual: $approvedLightOnWhite');
      expect(approvedLightOnTint, greaterThanOrEqualTo(4.5),
          reason: 'Approved status in Light Mode on green tint must be >= 4.5:1. Actual: $approvedLightOnTint');
      expect(approvedDarkOnBg, greaterThanOrEqualTo(4.5),
          reason: 'Approved status in Dark Mode on background must be >= 4.5:1. Actual: $approvedDarkOnBg');
      expect(approvedDarkOnSurface, greaterThanOrEqualTo(4.5),
          reason: 'Approved status in Dark Mode on surface must be >= 4.5:1. Actual: $approvedDarkOnSurface');

      // Status 2: Finalized (Light & Dark)
      final finalizedLightOnWhite = contrastRatio(AppTheme.statusFinalizedLight, lightSurface);
      final finalizedLightOnTint = contrastRatio(AppTheme.statusFinalizedLight, const Color(0xFFF0FDFA));
      final finalizedDarkOnBg = contrastRatio(AppTheme.statusFinalizedDark, darkBg);
      final finalizedDarkOnSurface = contrastRatio(AppTheme.statusFinalizedDark, darkSurface);

      expect(finalizedLightOnWhite, greaterThanOrEqualTo(4.5),
          reason: 'Finalized status in Light Mode on white must be >= 4.5:1. Actual: $finalizedLightOnWhite');
      expect(finalizedLightOnTint, greaterThanOrEqualTo(4.5),
          reason: 'Finalized status in Light Mode on teal tint must be >= 4.5:1. Actual: $finalizedLightOnTint');
      expect(finalizedDarkOnBg, greaterThanOrEqualTo(7.0),
          reason: 'Finalized status in Dark Mode must be >= 7:1 AAA. Actual: $finalizedDarkOnBg');
      expect(finalizedDarkOnSurface, greaterThanOrEqualTo(7.0),
          reason: 'Finalized status in Dark Mode on surface must be >= 7:1 AAA. Actual: $finalizedDarkOnSurface');

      // Status 3: Draft (Light & Dark)
      final draftLightOnWhite = contrastRatio(AppTheme.statusDraftLight, lightSurface);
      final draftLightOnTint = contrastRatio(AppTheme.statusDraftLight, const Color(0xFFFFF3E0));
      final draftDarkOnBg = contrastRatio(AppTheme.statusDraftDark, darkBg);
      final draftDarkOnSurface = contrastRatio(AppTheme.statusDraftDark, darkSurface);

      expect(draftLightOnWhite, greaterThanOrEqualTo(4.5),
          reason: 'Draft status in Light Mode on white must be >= 4.5:1. Actual: $draftLightOnWhite');
      expect(draftLightOnTint, greaterThanOrEqualTo(4.5),
          reason: 'Draft status in Light Mode on orange tint must be >= 4.5:1. Actual: $draftLightOnTint');
      expect(draftDarkOnBg, greaterThanOrEqualTo(7.0),
          reason: 'Draft status in Dark Mode must be >= 7:1 AAA. Actual: $draftDarkOnBg');
      expect(draftDarkOnSurface, greaterThanOrEqualTo(7.0),
          reason: 'Draft status in Dark Mode on surface must be >= 7:1 AAA. Actual: $draftDarkOnSurface');

      // Status 4: Superseded (Light & Dark)
      final supersededLightOnWhite = contrastRatio(AppTheme.statusSupersededLight, lightSurface);
      final supersededLightOnGrey = contrastRatio(AppTheme.statusSupersededLight, const Color(0xFFF5F5F5));
      final supersededDarkOnBg = contrastRatio(AppTheme.statusSupersededDark, darkBg);
      final supersededDarkOnSurface = contrastRatio(AppTheme.statusSupersededDark, darkSurface);

      expect(supersededLightOnWhite, greaterThanOrEqualTo(7.0),
          reason: 'Superseded status in Light Mode on white must be >= 7:1 AAA. Actual: $supersededLightOnWhite');
      expect(supersededLightOnGrey, greaterThanOrEqualTo(7.0),
          reason: 'Superseded status in Light Mode on grey container must be >= 7:1 AAA. Actual: $supersededLightOnGrey');
      expect(supersededDarkOnBg, greaterThanOrEqualTo(4.5),
          reason: 'Superseded status in Dark Mode must be >= 4.5:1 AA. Actual: $supersededDarkOnBg');
      expect(supersededDarkOnSurface, greaterThanOrEqualTo(4.5),
          reason: 'Superseded status in Dark Mode on surface must be >= 4.5:1 AA. Actual: $supersededDarkOnSurface');

      // Status 5: Voided / Cancelled (Light & Dark)
      final voidedLightOnWhite = contrastRatio(AppTheme.statusVoidedLight, lightSurface);
      final voidedLightOnTint = contrastRatio(AppTheme.statusVoidedLight, const Color(0xFFFEF2F2));
      final voidedDarkOnBg = contrastRatio(AppTheme.statusVoidedDark, darkBg);
      final voidedDarkOnSurface = contrastRatio(AppTheme.statusVoidedDark, darkSurface);

      expect(voidedLightOnWhite, greaterThanOrEqualTo(4.5),
          reason: 'Voided status in Light Mode on white must be >= 4.5:1. Actual: $voidedLightOnWhite');
      expect(voidedLightOnTint, greaterThanOrEqualTo(4.5),
          reason: 'Voided status in Light Mode on red tint must be >= 4.5:1. Actual: $voidedLightOnTint');
      expect(voidedDarkOnBg, greaterThanOrEqualTo(4.5),
          reason: 'Voided status in Dark Mode on background must be >= 4.5:1. Actual: $voidedDarkOnBg');
      expect(voidedDarkOnSurface, greaterThanOrEqualTo(4.5),
          reason: 'Voided status in Dark Mode on surface must be >= 4.5:1. Actual: $voidedDarkOnSurface');
    });

    test('ConsultationStatus and PrescriptionStatus Model colorFor() Enums match Centralized Tokens', () {
      // Light Mode checks
      expect(ConsultationStatus.finalized.colorFor(isDark: false), AppTheme.statusFinalizedLight);
      expect(ConsultationStatus.draft.colorFor(isDark: false), AppTheme.statusDraftLight);
      expect(ConsultationStatus.voided.colorFor(isDark: false), AppTheme.statusVoidedLight);

      expect(PrescriptionStatus.approved.colorFor(isDark: false), AppTheme.statusApprovedLight);
      expect(PrescriptionStatus.draft.colorFor(isDark: false), AppTheme.statusDraftLight);
      expect(PrescriptionStatus.superseded.colorFor(isDark: false), AppTheme.statusSupersededLight);
      expect(PrescriptionStatus.cancelled.colorFor(isDark: false), AppTheme.statusVoidedLight);

      // Dark Mode checks
      expect(ConsultationStatus.finalized.colorFor(isDark: true), AppTheme.statusFinalizedDark);
      expect(ConsultationStatus.draft.colorFor(isDark: true), AppTheme.statusDraftDark);
      expect(ConsultationStatus.voided.colorFor(isDark: true), AppTheme.statusVoidedDark);

      expect(PrescriptionStatus.approved.colorFor(isDark: true), AppTheme.statusApprovedDark);
      expect(PrescriptionStatus.draft.colorFor(isDark: true), AppTheme.statusDraftDark);
      expect(PrescriptionStatus.superseded.colorFor(isDark: true), AppTheme.statusSupersededDark);
      expect(PrescriptionStatus.cancelled.colorFor(isDark: true), AppTheme.statusVoidedDark);
    });
  });
}
