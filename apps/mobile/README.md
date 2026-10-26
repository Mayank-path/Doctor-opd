# DOCTOR-OPD Mobile Application (Flutter Android)

Outpatient Department (OPD) clinic management mobile application foundation built with Flutter and Dart for Android.

---

## 1. Architecture Overview

The application follows a clean, feature-driven, layered structure designed for scalability:

```text
apps/mobile/
├── .gitignore
├── pubspec.yaml
├── README.md
├── lib/
│   ├── main.dart                          # App entrypoint & service bootstrap
│   ├── app.dart                           # Root widget & reactive session routing
│   ├── core/
│   │   ├── config/
│   │   │   └── app_config.dart            # Environment & --dart-define configuration
│   │   ├── errors/
│   │   │   └── api_exception.dart         # Centralized NestJS exception mapper
│   │   ├── network/
│   │   │   ├── api_client.dart            # Dio HTTP client wrapper with timeouts
│   │   │   └── auth_interceptor.dart      # Injects Bearer token and x-clinic-id
│   │   ├── storage/
│   │   │   └── secure_storage_service.dart# Android Keystore / EncryptedSharedPreferences
│   │   └── theme/
│   │       └── app_theme.dart             # Medical SaaS design system & light theme
│   └── features/
│       ├── auth/
│       │   ├── models/
│       │   │   ├── auth_user.dart         # Authenticated user profile entity
│       │   │   ├── login_request.dart     # Login DTO with validation
│       │   │   └── login_response.dart    # AccessToken and user response
│       │   ├── services/
│       │   │   └── auth_service.dart      # ChangeNotifier managing reactive auth state
│       │   └── ui/
│       │       └── login_screen.dart      # Responsive medical SaaS login UI
│       └── dashboard/
│           └── ui/
│               └── dashboard_screen.dart  # Protected dashboard with real user metadata
└── test/
    ├── core/
    │   ├── config_test.dart               # Base URL and timeout tests
    │   └── api_error_test.dart            # NestJS status code parsing tests
    └── features/
        └── auth/
            ├── login_request_test.dart    # Request validation & normalization tests
            └── auth_service_test.dart     # Mocked networking & storage flow tests
```

---

## 2. Environment & Tooling Prerequisites

To run and build this application on Windows:

1. **Flutter SDK (>= 3.24.0, Dart >= 3.5.0):**
   Install via Windows Package Manager:
   ```powershell
   winget install Google.Flutter
   ```
   Or download manually from [Flutter Windows Install Guide](https://docs.flutter.dev/get-started/install/windows/mobile).
2. **Android Studio & Android SDK:**
   - Install Android Studio: `winget install Google.AndroidStudio`
   - Complete Android SDK Command-line Tools and Platform Tools (`adb`) setup via the Android Studio SDK Manager.
   - Accept Android licenses:
     ```powershell
     flutter doctor --android-licenses
     ```
3. **Verify Environment:**
   ```powershell
   flutter doctor
   ```

---

## 3. Running the Application

### A. Android Emulator (Default)
The Android Emulator uses `10.0.2.2` to loop back to the host machine's `localhost`:
```powershell
cd C:\Users\r9158\Doctor-opd\apps\mobile
flutter run
```
*(Uses default `API_BASE_URL=http://10.0.2.2:3000/api/v1`)*

### B. Physical Android Device
Connect your Android phone via USB with USB Debugging enabled, and provide your computer's local Wi-Fi/LAN IP:
```powershell
# 1. Identify your computer's local IP (e.g., 192.168.1.50)
ipconfig

# 2. Run with compile-time environment definition
flutter run --dart-define=API_BASE_URL=http://192.168.1.50:3000/api/v1
```

### C. Staging / Production
```powershell
flutter run --dart-define=API_BASE_URL=https://api.yourclinic.com/api/v1 --dart-define=APP_ENV=production
```

---

## 4. Android Network Security (Cleartext HTTP Policy)

Android 9+ (API Level 28+) disables unencrypted (cleartext HTTP) traffic by default.

### Recommended Development Configuration
When Android platform folders are generated (via `flutter create . --platforms=android`), create:
`android/app/src/debug/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext HTTP ONLY in debug builds for emulator and local LAN development -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```
And reference it in `android/app/src/debug/AndroidManifest.xml`:
```xml
<application android:networkSecurityConfig="@xml/network_security_config" />
```
> [!IMPORTANT]
> Never enable `android:usesCleartextTraffic="true"` globally in the main `AndroidManifest.xml`. Production builds MUST use HTTPS exclusively.

---

## 5. Backend Authentication Contract

The mobile app integrates directly with the existing DOCTOR-OPD NestJS backend:

### Endpoint: `POST /api/v1/auth/login`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "doctor@clinic.com",
    "password": "ValidPassword123!"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresIn": "1h",
    "user": {
      "id": "c39b1a5e-...",
      "email": "doctor@clinic.com",
      "fullName": "Dr. Vikram Sharma"
    }
  }
  ```

### Tenant Isolation:
- Protected clinic resources (`/patients`, `/appointments`, `/queue`, `/consultations`) require two headers:
  - `Authorization: Bearer <accessToken>`
  - `x-clinic-id: <clinicUuid>`
- The `AuthInterceptor` automatically injects both headers from encrypted device storage into every outgoing request.

---

## 6. Running Automated Tests

Once the Flutter SDK is installed:
```powershell
cd C:\Users\r9158\Doctor-opd\apps\mobile

# Install packages
flutter pub get

# Static code analysis
flutter analyze

# Execute test suite
flutter test
```
