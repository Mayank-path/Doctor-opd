import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/models/auth_user.dart';
import '../../auth/services/auth_service.dart';
import '../models/clinic_dashboard_stats.dart';
import '../services/dashboard_service.dart';
import 'widgets/appointments_overview_card.dart';
import 'widgets/clinic_selector_card.dart';
import 'widgets/clinical_privacy_card.dart';
import 'widgets/opd_queue_overview_card.dart';
import 'widgets/patients_overview_card.dart';
import 'widgets/quick_actions_grid.dart';
import 'widgets/system_status_card.dart';
import '../../patients/ui/patient_list_screen.dart';
import '../../patients/ui/patient_details_screen.dart';
import '../../patients/services/patients_service.dart';
import '../../appointments/ui/appointment_list_screen.dart';
import '../../appointments/ui/appointment_details_screen.dart';
import '../../appointments/services/appointments_service.dart';
import '../../queue/services/queue_service.dart';
import '../../queue/ui/queue_screen.dart';
import '../../consultations/services/consultations_service.dart';
import '../../consultations/ui/consultation_list_screen.dart';
import '../../prescriptions/services/prescriptions_service.dart';
import '../../prescriptions/ui/prescription_list_screen.dart';
import '../../clinical_assist/screens/voice_symptom_capture_screen.dart';

/// Production-ready Clinic Dashboard Screen
/// Integrates real backend OPD endpoints, tenant isolation, and role boundaries.
class DashboardScreen extends StatefulWidget {
  final AuthService authService;
  final AuthUser user;
  final DashboardService? dashboardService;
  final PatientsService? patientsService;
  final AppointmentsService? appointmentsService;
  final QueueService? queueService;
  final ConsultationsService? consultationsService;
  final PrescriptionsService? prescriptionsService;

  const DashboardScreen({
    super.key,
    required this.authService,
    required this.user,
    this.dashboardService,
    this.patientsService,
    this.appointmentsService,
    this.queueService,
    this.consultationsService,
    this.prescriptionsService,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late final DashboardService _dashboardService;
  final ScrollController _scrollController = ScrollController();
  final GlobalKey _dashboardContentKey = GlobalKey();

  String? _activeClinicId;
  ClinicDashboardStats? _stats;
  bool _isLoading = false;
  String? _errorMessage;
  String? _clinicValidationError;

  @override
  void initState() {
    super.initState();
    _dashboardService = widget.dashboardService ?? DashboardService();
    try {
      _activeClinicId = widget.authService.activeClinicId;
    } catch (_) {
      _activeClinicId = null;
    }
    if (_activeClinicId != null && _activeClinicId!.isNotEmpty) {
      _isLoading = true;
    }
    _initializeDashboard();
  }

  @override
  void didUpdateWidget(covariant DashboardScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    String? currentClinicId;
    try {
      currentClinicId = widget.authService.activeClinicId;
    } catch (_) {
      currentClinicId = null;
    }
    if (currentClinicId != null &&
        currentClinicId.isNotEmpty &&
        currentClinicId != _activeClinicId) {
      setState(() {
        _activeClinicId = currentClinicId;
      });
      _loadDashboardData(currentClinicId);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initializeDashboard() async {
    String? clinicId = _activeClinicId;
    if (clinicId == null || clinicId.isEmpty) {
      try {
        clinicId = await widget.authService.getActiveClinicId();
      } catch (_) {
        clinicId = null;
      }
    }

    if (mounted) {
      setState(() {
        _activeClinicId = clinicId;
      });
      if (clinicId != null && clinicId.trim().isNotEmpty) {
        await _loadDashboardData(clinicId.trim());
      } else {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _scrollToDashboard() {
    if (_dashboardContentKey.currentContext != null) {
      Scrollable.ensureVisible(
        _dashboardContentKey.currentContext!,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    } else if (_scrollController.hasClients) {
      _scrollController.animateTo(
        260,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _loadDashboardData(String clinicId) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _clinicValidationError = null;
    });

    try {
      final stats = await _dashboardService.fetchDashboardStats(clinicId: clinicId);
      if (mounted) {
        setState(() {
          _stats = stats;
          _isLoading = false;
        });
        if (stats.detectedRole != 'UNKNOWN') {
          try {
            await widget.authService.updateUserRole(stats.detectedRole);
          } catch (_) {}
        }
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _stats = null;
          _clinicValidationError = e.message;
          _errorMessage = (e.statusCode == 403)
              ? 'Access denied for the selected clinic tenant.'
              : e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _stats = null;
          _errorMessage = 'Failed to load clinic dashboard: $e';
        });
      }
    }
  }

  Future<void> _handleSaveClinicId(String newClinicId) async {
    final trimmed = newClinicId.trim();
    if (trimmed.isEmpty) return;

    await widget.authService.setActiveClinic(trimmed);
    setState(() {
      _activeClinicId = trimmed;
    });
    await _loadDashboardData(trimmed);

    if (_stats != null && _clinicValidationError == null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Clinic context verified! Welcome to OPD Dashboard.'),
          backgroundColor: AppTheme.accentTeal,
          duration: Duration(seconds: 2),
        ),
      );
      _scrollToDashboard();
    }
  }

  Future<void> _navigateToPatients() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PatientListScreen(
          authService: widget.authService,
          patientsService: widget.patientsService,
        ),
      ),
    );
    if (_activeClinicId != null && mounted) {
      await _loadDashboardData(_activeClinicId!);
    }
  }

  Future<void> _navigateToPatientDetails(String patientId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PatientDetailsScreen(
          patientId: patientId,
          authService: widget.authService,
          patientsService: widget.patientsService,
        ),
      ),
    );
    if (_activeClinicId != null && mounted) {
      await _loadDashboardData(_activeClinicId!);
    }
  }

  Future<void> _navigateToAppointments() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AppointmentListScreen(
          appointmentsService: widget.appointmentsService,
          patientsService: widget.patientsService,
        ),
      ),
    );
    if (_activeClinicId != null && mounted) {
      await _loadDashboardData(_activeClinicId!);
    }
  }

  Future<void> _navigateToAppointmentDetails(String appointmentId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AppointmentDetailsScreen(
          appointmentId: appointmentId,
          appointmentsService: widget.appointmentsService,
          patientsService: widget.patientsService,
        ),
      ),
    );
    if (_activeClinicId != null && mounted) {
      await _loadDashboardData(_activeClinicId!);
    }
  }

  Future<void> _navigateToQueue() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QueueScreen(
          queueService: widget.queueService,
          appointmentsService: widget.appointmentsService,
          patientsService: widget.patientsService,
        ),
      ),
    );
    if (_activeClinicId != null && mounted) {
      await _loadDashboardData(_activeClinicId!);
    }
  }

  Future<void> _navigateToConsultations() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ConsultationListScreen(
          consultationsService: widget.consultationsService,
        ),
      ),
    );
    if (_activeClinicId != null && mounted) {
      await _loadDashboardData(_activeClinicId!);
    }
  }

  Future<void> _navigateToPrescriptions() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PrescriptionListScreen(
          prescriptionsService: widget.prescriptionsService,
        ),
      ),
    );
    if (_activeClinicId != null && mounted) {
      await _loadDashboardData(_activeClinicId!);
    }
  }

  Future<void> _navigateToVoiceSymptoms() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const VoiceSymptomCaptureScreen(),
      ),
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: AppTheme.errorRed),
            SizedBox(width: 8),
            Text('Log Out'),
          ],
        ),
        content: const Text(
          'Are you sure you want to end this clinical session? Your secure session tokens will be cleared.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              widget.authService.logout();
            },
            child: const Text('Log Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasActiveClinic = _activeClinicId != null && _activeClinicId!.isNotEmpty;
    final String? effectiveRole = (_stats?.detectedRole != null && _stats!.detectedRole != 'UNKNOWN')
        ? _stats!.detectedRole
        : (widget.authService.currentUser?.role != null && widget.authService.currentUser!.role!.isNotEmpty)
            ? widget.authService.currentUser!.role
            : (widget.user.role != null && widget.user.role!.isNotEmpty)
                ? widget.user.role
                : null;
    final bool isDoctor = _stats?.isDoctor ?? (effectiveRole == 'DOCTOR');

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      drawer: _buildAppDrawer(context, effectiveRole, isDoctor),
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.accentTeal.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.local_hospital_rounded,
                color: AppTheme.accentTeal,
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'DOCTOR-OPD',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        actions: [
          if (hasActiveClinic)
            IconButton(
              icon: _isLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppTheme.primaryNavy,
                      ),
                    )
                  : const Icon(Icons.refresh_rounded),
              tooltip: 'Refresh Dashboard',
              onPressed: _isLoading ? null : () => _loadDashboardData(_activeClinicId!),
            ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppTheme.errorRed),
            tooltip: 'Log Out',
            onPressed: _confirmLogout,
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppTheme.accentTeal,
          onRefresh: () async {
            if (hasActiveClinic) {
              await _loadDashboardData(_activeClinicId!);
            }
          },
          child: SingleChildScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Authenticated User Profile Banner
                    _buildUserProfileCard(effectiveRole),
                    const SizedBox(height: 16),

                    // Multi-Tenant Clinic Context Selector
                    ClinicSelectorCard(
                      activeClinicId: _activeClinicId,
                      isLoading: _isLoading,
                      validationError: _clinicValidationError,
                      onSaveClinicId: _handleSaveClinicId,
                      onContinueToDashboard: _scrollToDashboard,
                    ),
                    const SizedBox(height: 16),

                    // Error Banner if dashboard fetch failed
                    if (_errorMessage != null && !_isLoading) ...[
                      _buildErrorBanner(),
                      const SizedBox(height: 16),
                    ],

                    // OPD Dashboard Section Header with Anchor Key
                    Container(
                      key: _dashboardContentKey,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'OPD CLINICAL DASHBOARD',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                          if (hasActiveClinic && _stats != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.successGreen.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: AppTheme.successGreen.withValues(alpha: 0.3),
                                ),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.check_circle_rounded,
                                    size: 11,
                                    color: AppTheme.successGreen,
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    'LIVE SYNC',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.successGreen,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Quick Actions Grid
                    QuickActionsGrid(
                      activeClinicId: _activeClinicId,
                      isDoctor: isDoctor,
                      onPatientsTap: _navigateToPatients,
                      onAppointmentsTap: _navigateToAppointments,
                      onQueueTap: _navigateToQueue,
                      onConsultationsTap: _navigateToConsultations,
                      onPrescriptionsTap: _navigateToPrescriptions,
                    ),
                    const SizedBox(height: 16),

                    // Body prompts based on clinic validation and data loading
                    if (!hasActiveClinic) ...[
                      _buildMissingClinicContextPrompt(),
                      const SizedBox(height: 16),
                    ] else if (_isLoading && _stats == null) ...[
                      _buildLoadingPlaceholder(),
                      const SizedBox(height: 16),
                    ] else if (_stats != null) ...[
                      // Real OPD Queue Overview
                      OpdQueueOverviewCard(
                        stats: _stats!,
                        isLoading: _isLoading,
                        onViewAllTap: _navigateToQueue,
                      ),
                      const SizedBox(height: 16),

                      // Real Appointments Overview
                      AppointmentsOverviewCard(
                        stats: _stats!,
                        isLoading: _isLoading,
                        onViewAllTap: _navigateToAppointments,
                        onAppointmentTap: _navigateToAppointmentDetails,
                      ),
                      const SizedBox(height: 16),

                      // Real Patients Overview
                      PatientsOverviewCard(
                        stats: _stats!,
                        isLoading: _isLoading,
                        onViewAllTap: _navigateToPatients,
                        onPatientTap: _navigateToPatientDetails,
                      ),
                      const SizedBox(height: 16),

                      // Clinical Privacy Protection Banner
                      ClinicalPrivacyCard(stats: _stats!),
                      const SizedBox(height: 16),
                    ],

                    // System Connection & Infrastructure Status
                    SystemStatusCard(
                      healthStatus: _stats?.healthStatus ?? 'online',
                      lastRefreshed: _stats?.lastRefreshed,
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUserProfileCard(String? role) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppTheme.borderGray),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppTheme.primaryNavy,
              child: Text(
                widget.user.fullName.isNotEmpty
                    ? widget.user.fullName[0].toUpperCase()
                    : 'U',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          widget.user.fullName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: role != null
                              ? AppTheme.accentTeal.withValues(alpha: 0.12)
                              : Colors.grey.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          role ?? (_isLoading ? 'VERIFYING...' : 'PENDING'),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: role != null ? AppTheme.accentTeal : Colors.grey.shade700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.user.email ?? 'No email associated',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'User ID: ${widget.user.id.length > 8 ? "${widget.user.id.substring(0, 8)}..." : widget.user.id}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.errorRed.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppTheme.errorRed, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Dashboard Fetch Issue',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.errorRed,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _errorMessage!,
                  style: const TextStyle(fontSize: 12, color: AppTheme.textPrimary),
                ),
              ],
            ),
          ),
          if (_activeClinicId != null)
            TextButton(
              onPressed: () => _loadDashboardData(_activeClinicId!),
              child: const Text('Retry'),
            ),
        ],
      ),
    );
  }

  Widget _buildMissingClinicContextPrompt() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderGray),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.accentTeal.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.apartment_rounded,
              size: 40,
              color: AppTheme.accentTeal,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Select Active Clinic',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'To load real OPD Queue, Appointments, and Patient data, please enter and save your Clinic UUID in the section above.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingPlaceholder() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderGray),
      ),
      child: const Column(
        children: [
          CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppTheme.accentTeal),
          ),
          SizedBox(height: 16),
          Text(
            'Loading clinic metrics & OPD queue...',
            style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildAppDrawer(BuildContext context, String? effectiveRole, bool isDoctor) {
    final hasActiveClinic = _activeClinicId != null && _activeClinicId!.isNotEmpty;

    return Drawer(
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(
              color: AppTheme.primaryNavy,
            ),
            currentAccountPicture: CircleAvatar(
              backgroundColor: AppTheme.accentTeal,
              child: Text(
                widget.user.fullName.isNotEmpty
                    ? widget.user.fullName[0].toUpperCase()
                    : 'U',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            accountName: Text(
              widget.user.fullName,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
            accountEmail: Text(
              effectiveRole != null
                  ? '${widget.user.email ?? "No email"} • $effectiveRole'
                  : (widget.user.email ?? "No email"),
              style: const TextStyle(
                fontSize: 12,
                color: Colors.white70,
              ),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.dashboard_rounded, color: AppTheme.primaryNavy),
            title: const Text('Dashboard', style: TextStyle(fontWeight: FontWeight.w600)),
            onTap: () {
              Navigator.of(context).pop();
              _scrollToDashboard();
            },
          ),
          ListTile(
            leading: const Icon(Icons.confirmation_number_rounded, color: AppTheme.accentTeal),
            title: const Text('OPD Queue'),
            onTap: () {
              Navigator.of(context).pop();
              _navigateToQueue();
            },
          ),
          ListTile(
            leading: const Icon(Icons.edit_calendar_rounded, color: AppTheme.accentTeal),
            title: const Text('Appointments'),
            onTap: () {
              Navigator.of(context).pop();
              _navigateToAppointments();
            },
          ),
          ListTile(
            leading: const Icon(Icons.people_alt_rounded, color: AppTheme.accentTeal),
            title: const Text('Patients'),
            onTap: () {
              Navigator.of(context).pop();
              _navigateToPatients();
            },
          ),
          if (isDoctor || effectiveRole == 'DOCTOR' || (_stats?.isDoctor ?? false))
            ListTile(
              leading: const Icon(Icons.medical_services_rounded, color: Colors.purple),
              title: const Text('Consultations'),
              onTap: () {
                Navigator.of(context).pop();
                _navigateToConsultations();
              },
            ),
          if (isDoctor || effectiveRole == 'DOCTOR' || (_stats?.isDoctor ?? false))
            ListTile(
              leading: const Icon(Icons.receipt_long_rounded, color: Colors.teal),
              title: const Text('Prescriptions'),
              onTap: () {
                Navigator.of(context).pop();
                _navigateToPrescriptions();
              },
            ),
          if (isDoctor || effectiveRole == 'DOCTOR' || (_stats?.isDoctor ?? false))
            ListTile(
              leading: const Icon(Icons.mic_rounded, color: Colors.deepOrange),
              title: const Text('Voice Symptoms'),
              onTap: () {
                Navigator.of(context).pop();
                _navigateToVoiceSymptoms();
              },
            ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.apartment_rounded, color: AppTheme.textSecondary),
            title: const Text('Active Clinic Context'),
            subtitle: Text(
              hasActiveClinic ? _activeClinicId! : 'No clinic configured',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
            ),
            onTap: () {
              Navigator.of(context).pop();
              if (_scrollController.hasClients) {
                _scrollController.animateTo(
                  0,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                );
              }
            },
          ),
          const Spacer(),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: AppTheme.errorRed),
            title: const Text(
              'Log Out',
              style: TextStyle(
                color: AppTheme.errorRed,
                fontWeight: FontWeight.w600,
              ),
            ),
            onTap: () {
              Navigator.of(context).pop();
              _confirmLogout();
            },
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
