# DOCTOR-OPD — Design System & Theme Governance Specification
**Document ID:** `DOC-DS-001`  
**Version:** `1.0.0`  
**Classification:** Official Architecture Specification  
**Status:** LOCKED & AUTHORITATIVE  
**Applicability:** Flutter Mobile Application (`apps/mobile`) & Future Web/Desktop Portals

---

## 1. DESIGN PHILOSOPHY & CLINICAL OBJECTIVES

DOCTOR-OPD is an independent, subscription-based clinical workspace designed primarily for individual doctors operating private Outpatient Department (OPD) practices.

The design system is engineered around the cognitive demands of practicing clinicians:
- **Clinical Readability & High Legibility:** Medical data (dosages, vitals, ICD-10 diagnoses, UHIDs) must be instantly readable under diverse lighting conditions (harsh fluorescent exam-room lights or dimly lit bedside rounds).
- **Zero Ambiguity in Status & Safety:** Clinical states (Draft, Finalized, Voided, Superseded) must be instantly discernible using multi-sensory signifiers (color + typography + iconography), avoiding color-only dependencies.
- **Dual Visual Identity:**
  1. **Light Mode (Clean Medical SaaS):** High-clarity medical aesthetic using deep slate navy (`#0F172A`), healthcare teal accents (`#0D9488`), and surgical white cards on slate-50 background (`#F8FAFC`).
  2. **Dark Mode (Obsidian & Golden Ember):** Premium, ultra-low eye-strain nocturnal clinical theme featuring deep warm obsidian (`#111315`), tiered elevation surfaces (`#191C20`, `#202327`, `#25282B`), warm ivory typography (`#F4E8D2`), and golden ember action accents (`#E8A947`).

---

## 2. OFFICIAL DESIGN TOKENS (PALETTE LOCK)

The tokens listed below represent the **single authoritative source of truth**. All components, screens, and themes must consume these values exclusively via `Theme.of(context)` and `AppColorsExtension` (`context.colors`).

### 2.1 Dark Mode: Obsidian & Golden Ember (Authoritative Palette A)

| Semantic Token | Hex Code | Material / Design Role | WCAG Contrast on `#111315` |
| :--- | :---: | :--- | :---: |
| **`background`** | `#111315` | Root scaffold background, screen foundation | Base (0.012 Lum) |
| **`surface`** | `#191C20` | Primary cards, app bars, list tiles | 1.15:1 (Subtle elevation) |
| **`surfaceContainer`** | `#202327` | Form inputs, search fields, inner containers | 1.25:1 (Interactive base) |
| **`elevatedSurface`** | `#25282B` | Modals, dialogs, bottom sheets, date pickers | 1.45:1 (High elevation) |
| **`textPrimary`** | `#F4E8D2` | Warm Ivory: Headings, clinical values, body copy | **15.36:1 (AAA Pass)** |
| **`textSecondary`** | `#B9AA96` | Warm Sand: Subtitles, field labels, timestamps | **8.20:1 (AAA Pass)** |
| **`textMuted`** | `#8D877D` | Warm Slate: Placeholders, hints, inactive icons | **5.23:1 (AA Pass)** |
| **`primaryAccent`** | `#E8A947` | Golden Ember: Primary buttons, active tabs, CTAs | **9.04:1 (AAA Pass)** |
| **`accentHighlight`**| `#F2C477` | Ember Glow: Focus rings, selected tab highlights | **10.53:1 (AAA Pass)** |
| **`accentContainer`**| `#342718` | Deep Ember: Chip fills, active badge containers | 2.10:1 (Graphical base) |
| **`accentBorder`** | `#75532B` | Medium Ember: Focus outlines, active borders | 3.50:1 (UI Component) |
| **`border`** | `#34383C` | Subtle Obsidian: Card outlines, inactive borders | 3.10:1 (UI Component) |
| **`divider`** | `#34383C` | Subtle Obsidian: Hairline list and card dividers | 3.10:1 (Structural) |
| **`error`** | `#EF4444` | Crimson: Validation errors, voided badges | **4.95:1 (AA Pass)** |
| **`success`** | `#10B981` | Emerald: Finalized consultations, approved Rx | **7.34:1 (AAA Pass)** |
| **`warning`** | `#F59E0B` | Amber: Draft consultation badges, pending alerts | **8.67:1 (AAA Pass)** |

### 2.2 Light Mode: Clean Medical SaaS

| Semantic Token | Hex Code | Material / Design Role | WCAG Contrast on `#F8FAFC` |
| :--- | :---: | :--- | :---: |
| **`background`** | `#F8FAFC` | Slate-50: Scaffold canvas, root views | Base (0.952 Lum) |
| **`surface`** | `#FFFFFF` | Pure White: Primary cards, app bars, sheets | 1.05:1 |
| **`surfaceContainer`** | `#F1F5F9` | Slate-100: Form field backgrounds, search bars | 1.15:1 |
| **`elevatedSurface`** | `#FFFFFF` | Pure White: Dialogs, popups, pickers | 1.05:1 |
| **`textPrimary`** | `#0F172A` | Slate Navy: Titles, patient names, body text | **17.06:1 (AAA Pass)** |
| **`textSecondary`** | `#64748B` | Slate Grey: Subtitles, field labels, metadata | **4.55:1 (AA Pass)** |
| **`textMuted`** | `#94A3B8` | Light Slate: Input placeholders, inactive hints | 2.45:1 (Placeholder only) |
| **`primaryAccent`** | `#0D9488` | Healthcare Teal: Primary buttons, active tabs | **3.58:1 (AA Large/UI)** |
| **`accentHighlight`**| `#14B8A6` | Bright Teal: Active highlights, selection rings | **2.85:1 (Interactive)** |
| **`accentContainer`**| `#E6FFFA` | Mint Tint: Badge containers, active chip fills | 1.10:1 (Tint base) |
| **`accentBorder`** | `#99F6E4` | Mint Border: Chip outlines, active field borders| 1.25:1 |
| **`border`** | `#E2E8F0` | Slate-200: Card borders, input inactive borders | 1.25:1 |
| **`divider`** | `#E2E8F0` | Slate-200: Hairline list separators | 1.25:1 |
| **`error`** | `#EF4444` | Crimson: Error banners, cancelled badges | **4.54:1 (AA Pass)** |
| **`success`** | `#10B981` | Emerald: Approved badges, completed states | **3.05:1 (AA Large/UI)** |
| **`warning`** | `#F59E0B` | Amber: Draft consultation badges, pending sync | **2.10:1 (Tint)** |

---

## 3. COMPONENT STYLING & USAGE RULES

Every component in `DOCTOR-OPD` must strictly follow these standardized styling rules:

### 3.1 Scaffold Backgrounds & AppBars
- **Scaffold Canvas:** Use `Theme.of(context).scaffoldBackgroundColor` (or `colors.background`). Never hardcode background colors.
- **AppBars:**
  - Background: `Theme.of(context).appBarTheme.backgroundColor` (`#FFFFFF` light, `#191C20` dark).
  - Title & Actions: Always use `colors.textPrimary`.
  - System UI Overlays: Configured automatically in `AppTheme` via `SystemUiOverlayStyle`. Status bar is transparent; icons are dark in Light Mode and light in Dark Mode.

### 3.2 Cards & Elevated Containers
- **Surfaces:** Use `colors.surface` (`#FFFFFF` in Light, `#191C20` in Dark).
- **Outlines:** Cards must render a 1px border using `colors.border` (`#E2E8F0` in Light, `#34383C` in Dark).
- **Elevation:** Do not use heavy drop shadows (`elevation: 0` with explicit `BorderSide` is the mandated standard across the app).

### 3.3 Form Inputs & Search Fields
- **Container Background:** Use `colors.surfaceContainer` (`#F1F5F9` in Light, `#202327` in Dark).
- **Inactive Border:** `colors.border` (`#E2E8F0` / `#34383C`).
- **Focused Border:** `colors.primaryAccent` at 1.5px thickness (`#0D9488` in Light, `#E8A947` in Dark).
- **Text & Placeholder:** Input text is `colors.textPrimary`; placeholder/hint text is `colors.textMuted`.

### 3.4 Buttons (Elevated & Outlined)
- **Primary Elevated Buttons:**
  - Light Mode: `#0F172A` background with white text.
  - Dark Mode: `#E8A947` (Golden Ember) background with `#111315` (Obsidian Deep) text.
  - **Rule:** Dark mode primary button text must ALWAYS be `#111315` to ensure a 9.04:1 AAA contrast on top of Golden Ember.
- **Outlined Buttons:**
  - Foreground: `colors.primaryAccent`.
  - Border: `colors.border` (Light) or `colors.accentBorder` (Dark).

### 3.5 Dialogs & Modal Bottom Sheets
- **Dialog Canvas:** `colors.elevatedSurface` (`#FFFFFF` Light, `#25282B` Dark) with a 16dp border radius and `colors.border` outline.
- **Bottom Sheets:** `colors.elevatedSurface` with 20dp top rounded corners and `colors.border` outline.

### 3.6 Material DatePickers
- Must be styled via centralized `datePickerTheme` in `AppTheme`.
- Header background: `colors.surface` (Light: `#0F172A`, Dark: `#191C20`).
- Selected day circle: `colors.primaryAccent` (`#E8A947` in Dark).
- Day numbers: `colors.textPrimary` (`#F4E8D2` in Dark).

### 3.7 Clinical Status Badges
Status badges pair explicit color coding with uppercase text labels:
- **Finalized / Approved:** Container `colors.success.withValues(alpha: 0.15)`, text `colors.success`, icon `Icons.check_circle_outline`.
- **Draft / In-Progress:** Container `colors.warning.withValues(alpha: 0.15)`, text `colors.warning`, icon `Icons.edit_note`.
- **Voided / Cancelled:** Container `colors.error.withValues(alpha: 0.15)`, text `colors.error`, icon `Icons.block`.
- **Superseded:** Container neutral slate tint, text `colors.textMuted`, icon `Icons.history`.

### 3.8 Charts & Analytics Visualizations
- Charts retain their **semantic series colors** across both modes:
  - Daily Consultations: Indigo / Purple (`#6366F1` / `#A855F7`).
  - Daily Registrations: Teal / Cyan (`#0D9488` / `#06B6D4`).
  - Revenue: Emerald / Amber (`#10B981` / `#F59E0B`).
- Chart card backgrounds adapt dynamically to `colors.surface` (`#191C20` in Dark Mode).
- Chart grid lines, axis labels, and tooltip backgrounds use `colors.border` and `colors.textSecondary`.

---

## 4. COLOR GOVERNANCE & ARCHITECTURAL RULES

To protect against design regression and palette drift, all contributors and coding agents must abide by the following seven governance rules:

1. **Zero Unapproved Palettes:** No developer or agent may introduce an alternative primary palette (such as the deprecated Palette B) without formal product management and clinical design sign-off.
2. **Zero Arbitrary Hex Literals:** Never write hardcoded `Color(0xFF...)` for primary backgrounds, cards, typography, or borders inside screen files. Always use `context.colors.<token>`.
3. **Strict Preference for Semantic Tokens:** Use tokens according to their semantic intent (`textPrimary` for titles, `textSecondary` for metadata, `primaryAccent` for primary CTAs).
4. **Preservation of Clinical Semantic Colors:** Do not replace clinical status colors (Emerald for Approved, Crimson for Voided/Error) with general branding accents.
5. **Mandatory WCAG Contrast Verification:** Any proposed text color change must verify minimum contrast ratios against its intended surface before inclusion:
   - Body & data text: $\ge 4.5:1$ (AA).
   - Headings & large text: $\ge 3.0:1$ (AA Large).
   - Non-text UI controls & borders: $\ge 3.0:1$.
6. **Bidirectional Theme Parity:** Every newly developed screen, dialog, sheet, or widget must be tested in both Light Mode and Dark Mode.
7. **No Competing Theme Singletons:** `ThemeController` listening to `ThemePreferenceRepository` is the sole state authority. Never instantiate secondary theme notifiers or third-party theme packages.

---

## 5. DEPRECATION OF HISTORICAL PALETTE B

During the Phase I.1 audit, an alternative dark palette (referred to as **Palette B**) was erroneously documented in report narrative text:
- Deprecated Background: `#0B0F17` (Deep Blue Slate)
- Deprecated Surface: `#121824`
- Deprecated Elevated: `#1A2234`
- Deprecated Accent: `#E5A93C`
- Deprecated Highlight: `#F5C76D`
- Deprecated Dark Primary Text: `#F1F5F9`

### Deprecation Status:
- **Verdict:** **DEPRECATED & NON-AUTHORITATIVE.**
- **Investigation Finding:** Palette B was a phantom reporting artifact. It was **never implemented in the codebase**. The actual codebase has exclusively used **Palette A** (`#111315`, `#191C20`, `#E8A947`, `#F4E8D2`).
- **Preserved Light Mode Token:** Note that `#F1F5F9` remains an active and valid token in **Light Mode** as `surfaceContainer` (Slate-100). It is deprecated only when presented as Dark Mode primary typography.

---

## 6. THEME PERSISTENCE ARCHITECTURE

Theme mode preference is persisted locally using Android EncryptedSharedPreferences / iOS Keychain via `FlutterSecureStorage`.

### Storage Key Specification
- **Official Storage Key:** `'opd_theme_mode'`
- **Defining Constant:** `SecureStorageService._keyThemeMode` in `apps/mobile/lib/core/storage/secure_storage_service.dart`.
- **Supported String Values:**
  - `'light'` $\rightarrow$ `ThemeMode.light`
  - `'dark'` $\rightarrow$ `ThemeMode.dark`
  - `'system'` $\rightarrow$ `ThemeMode.system`
- **Fallback Behavior:** If uninitialized, empty, or unreadable, defaults safely to `ThemeMode.light`.
- **Session Survival:** Theme preference is isolated from authentication tokens and is **never deleted** on user logout (`clearAuth`).
- **Governance Mandate:** The key `'opd_theme_mode'` must **never be renamed or altered**, ensuring zero data loss and persistent preference across application upgrades.

