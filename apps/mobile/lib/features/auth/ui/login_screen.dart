import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_controller.dart';
import '../models/register_clinic_request.dart';
import '../services/auth_service.dart';

/// Clean medical SaaS Login and Clinic Owner Registration Screen.
class LoginScreen extends StatefulWidget {
  final AuthService authService;

  const LoginScreen({
    super.key,
    required this.authService,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  // Sign In controllers
  final _loginFormKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  // Registration controllers
  final _registerFormKey = GlobalKey<FormState>();
  final _regFullNameController = TextEditingController();
  final _regEmailController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regClinicNameController = TextEditingController();
  final _regClinicAddressController = TextEditingController();
  final _regPasswordController = TextEditingController();
  final _regConfirmPasswordController = TextEditingController();
  bool _regObscurePassword = true;
  bool _regObscureConfirmPassword = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        widget.authService.clearError();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _regFullNameController.dispose();
    _regEmailController.dispose();
    _regPhoneController.dispose();
    _regClinicNameController.dispose();
    _regClinicAddressController.dispose();
    _regPasswordController.dispose();
    _regConfirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    FocusScope.of(context).unfocus();
    widget.authService.clearError();

    if (!_loginFormKey.currentState!.validate()) {
      return;
    }

    await widget.authService.login(
      _emailController.text,
      _passwordController.text,
    );
  }

  Future<void> _handleRegister() async {
    FocusScope.of(context).unfocus();
    widget.authService.clearError();

    if (!_registerFormKey.currentState!.validate()) {
      return;
    }

    final request = RegisterClinicRequest(
      fullName: _regFullNameController.text,
      email: _regEmailController.text,
      password: _regPasswordController.text,
      confirmPassword: _regConfirmPasswordController.text,
      clinicName: _regClinicNameController.text,
      clinicAddress: _regClinicAddressController.text.trim().isNotEmpty
          ? _regClinicAddressController.text.trim()
          : null,
      phone: _regPhoneController.text.trim().isNotEmpty
          ? _regPhoneController.text.trim()
          : null,
    );

    await widget.authService.registerClinic(request);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              context.isDarkMode ? Icons.light_mode_rounded : Icons.dark_mode_outlined,
              color: context.isDarkMode ? AppTheme.goldenEmber : AppTheme.primaryNavy,
            ),
            tooltip: context.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
            onPressed: () {
              ThemeControllerScope.of(context).toggleTheme();
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: AnimatedBuilder(
                animation: widget.authService,
                builder: (context, _) {
                  final isLoading = widget.authService.isLoading;
                  final errorMessage = widget.authService.errorMessage;

                  return Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Clinic Portal Header & Icon
                      Center(
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: context.isDarkMode ? colors.accentContainer : AppTheme.primaryNavy,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: colors.primaryAccent.withValues(alpha: 0.15),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.local_hospital_rounded,
                            color: colors.primaryAccent,
                            size: 34,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'DOCTOR-OPD',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Outpatient Department Clinic Portal',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: colors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Navigation Tabs: Sign In / Create Clinic Account
                      Container(
                        decoration: BoxDecoration(
                          color: colors.border.withValues(alpha: 0.35),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: TabBar(
                          controller: _tabController,
                          indicator: BoxDecoration(
                            color: colors.surface,
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          indicatorSize: TabBarIndicatorSize.tab,
                          dividerColor: Colors.transparent,
                          labelColor: colors.primaryAccent,
                          unselectedLabelColor: colors.textSecondary,
                          labelStyle: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                          unselectedLabelStyle: const TextStyle(
                            fontWeight: FontWeight.w500,
                            fontSize: 14,
                          ),
                          tabs: const [
                            Tab(text: 'Sign In'),
                            Tab(text: 'Create Clinic Account'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Error Banner if present
                      if (errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.errorRed.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: AppTheme.errorRed.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                color: AppTheme.errorRed,
                                size: 20,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  errorMessage,
                                  style: const TextStyle(
                                    color: AppTheme.errorRed,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Card containing TabBarView
                      Card(
                        elevation: 1.5,
                        color: colors.surface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: colors.border),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: AnimatedBuilder(
                            animation: _tabController,
                            builder: (context, _) {
                              if (_tabController.index == 0) {
                                return _buildSignInForm(isLoading);
                              } else {
                                return _buildRegisterForm(isLoading);
                              }
                            },
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Environment & Host info indicator
                      Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: colors.surfaceContainer,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: colors.primaryAccent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'API: ${AppConfig.apiBaseUrl}',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: colors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignInForm(bool isLoading) {
    final colors = context.colors;
    return Form(
      key: _loginFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Sign In',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 18),

          // Email Input
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Work Email',
              hintText: 'doctor@clinic.com',
              prefixIcon: Icon(
                Icons.alternate_email_rounded,
                size: 20,
                color: colors.textSecondary,
              ),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Email address is required';
              }
              final emailRegex = RegExp(
                r'^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$',
              );
              if (!emailRegex.hasMatch(value.trim())) {
                return 'Enter a valid email address';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Password Input
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: Icon(
                Icons.lock_outline_rounded,
                size: 20,
                color: colors.textSecondary,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: colors.textSecondary,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Password is required';
              }
              return null;
            },
          ),
          const SizedBox(height: 24),

          // Login Button
          ElevatedButton(
            onPressed: isLoading ? null : _handleLogin,
            child: isLoading
                ? SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        context.isDarkMode ? colors.background : Colors.white,
                      ),
                    ),
                  )
                : const Text('Log In to Clinic Portal'),
          ),
        ],
      ),
    );
  }

  Widget _buildRegisterForm(bool isLoading) {
    final colors = context.colors;
    return Form(
      key: _registerFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Clinic Owner Registration',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Create your clinic account and owner administrator credentials.',
            style: TextStyle(
              fontSize: 13,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: 20),

          // Full Name
          TextFormField(
            controller: _regFullNameController,
            textCapitalization: TextCapitalization.words,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Full Name *',
              hintText: 'Dr. Jane Doe',
              prefixIcon: Icon(
                Icons.person_outline_rounded,
                size: 20,
                color: colors.textSecondary,
              ),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Full name is required';
              }
              if (value.trim().length < 2) {
                return 'Full name must be at least 2 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Work Email
          TextFormField(
            controller: _regEmailController,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Work Email *',
              hintText: 'owner@clinic.com',
              prefixIcon: Icon(
                Icons.alternate_email_rounded,
                size: 20,
                color: colors.textSecondary,
              ),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Work email is required';
              }
              final emailRegex = RegExp(
                r'^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$',
              );
              if (!emailRegex.hasMatch(value.trim())) {
                return 'Enter a valid work email address';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Phone Number (Optional)
          TextFormField(
            controller: _regPhoneController,
            keyboardType: TextInputType.phone,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Phone Number (Optional)',
              hintText: '+91 98765 43210',
              prefixIcon: Icon(
                Icons.phone_outlined,
                size: 20,
                color: colors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Clinic Name
          TextFormField(
            controller: _regClinicNameController,
            textCapitalization: TextCapitalization.words,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Clinic Name *',
              hintText: 'City Care Polyclinic',
              prefixIcon: Icon(
                Icons.local_hospital_outlined,
                size: 20,
                color: colors.textSecondary,
              ),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Clinic name is required';
              }
              if (value.trim().length < 2) {
                return 'Clinic name must be at least 2 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Clinic Address (Optional)
          TextFormField(
            controller: _regClinicAddressController,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Clinic Address (Optional)',
              hintText: '123 Health Street, Suite 4',
              prefixIcon: Icon(
                Icons.location_on_outlined,
                size: 20,
                color: colors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Password Input
          TextFormField(
            controller: _regPasswordController,
            obscureText: _regObscurePassword,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Password (min. 8 characters) *',
              prefixIcon: Icon(
                Icons.lock_outline_rounded,
                size: 20,
                color: colors.textSecondary,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _regObscurePassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: colors.textSecondary,
                ),
                onPressed: () {
                  setState(() {
                    _regObscurePassword = !_regObscurePassword;
                  });
                },
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Password is required';
              }
              if (value.length < 8) {
                return 'Password must be at least 8 characters long';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Confirm Password Input
          TextFormField(
            controller: _regConfirmPasswordController,
            obscureText: _regObscureConfirmPassword,
            enabled: !isLoading,
            decoration: InputDecoration(
              labelText: 'Confirm Password *',
              prefixIcon: Icon(
                Icons.lock_reset_rounded,
                size: 20,
                color: colors.textSecondary,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _regObscureConfirmPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: colors.textSecondary,
                ),
                onPressed: () {
                  setState(() {
                    _regObscureConfirmPassword = !_regObscureConfirmPassword;
                  });
                },
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please confirm your password';
              }
              if (value != _regPasswordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          const SizedBox(height: 24),

          // Register Button
          ElevatedButton(
            onPressed: isLoading ? null : _handleRegister,
            style: ElevatedButton.styleFrom(
              backgroundColor: colors.primaryAccent,
              foregroundColor: context.isDarkMode ? colors.background : Colors.white,
            ),
            child: isLoading
                ? SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        context.isDarkMode ? colors.background : Colors.white,
                      ),
                    ),
                  )
                : const Text(
                    'Create Clinic & Register Owner',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
          ),
        ],
      ),
    );
  }
}
