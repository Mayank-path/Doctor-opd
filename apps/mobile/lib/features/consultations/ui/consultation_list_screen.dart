import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/storage/secure_storage_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/consultation.dart';
import '../services/consultations_service.dart';
import 'consultation_create_screen.dart';
import 'consultation_details_screen.dart';

/// Screen listing clinic consultations with status filtering and role-based privacy shield.
///
/// Privacy & Security Invariants:
/// - Restricted to DOCTOR role only.
/// - Non-doctors (ADMIN, RECEPTIONIST, STAFF) see an access-restricted shield with zero clinical data leakage.
/// - Doctors see consultations for their active clinic.
class ConsultationListScreen extends StatefulWidget {
  final ConsultationsService? consultationsService;
  final SecureStorageService? storageService;

  const ConsultationListScreen({
    super.key,
    this.consultationsService,
    this.storageService,
  });

  @override
  State<ConsultationListScreen> createState() => _ConsultationListScreenState();
}

class _ConsultationListScreenState extends State<ConsultationListScreen> {
  late final ConsultationsService _consultationsService;
  late final SecureStorageService _storageService;

  bool _isLoadingUser = true;
  bool _isForbidden = false;

  bool _isLoadingConsultations = true;
  String? _errorMessage;
  List<Consultation> _consultations = [];

  // Filter state
  ConsultationStatus? _selectedStatusFilter; // null = all
  int _page = 1;
  final int _limit = 20;

  @override
  void initState() {
    super.initState();
    _consultationsService =
        widget.consultationsService ?? ConsultationsService();
    _storageService = widget.storageService ?? SecureStorageService();
    _checkRoleAndLoad();
  }

  Future<void> _checkRoleAndLoad() async {
    setState(() {
      _isLoadingUser = true;
      _errorMessage = null;
    });

    try {
      final user = await _storageService.getUser();
      if (!mounted) return;

      if (user != null && user.role != null && user.role != 'DOCTOR') {
        setState(() {
          _isForbidden = true;
          _isLoadingUser = false;
        });
        return;
      }

      setState(() {
        _isForbidden = false;
        _isLoadingUser = false;
      });

      await _loadConsultations();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isForbidden = true;
        _isLoadingUser = false;
      });
    }
  }

  Future<void> _loadConsultations({bool refresh = false}) async {
    if (refresh) {
      _page = 1;
    }

    setState(() {
      _isLoadingConsultations = true;
      _errorMessage = null;
    });

    try {
      final response = await _consultationsService.getConsultations(
        status: _selectedStatusFilter,
        page: _page,
        limit: _limit,
      );

      if (!mounted) return;

      setState(() {
        _consultations = response.data;
        _isLoadingConsultations = false;
      });
    } catch (e, stack) {
      debugPrint('CONSULTATIONS_LOAD_ERROR: $e\n$stack');
      if (!mounted) return;
      setState(() {
        _isLoadingConsultations = false;
        if (e is ApiException && e.statusCode == 403) {
          _isForbidden = true;
        } else {
          _errorMessage = e is ApiException
              ? e.message
              : 'Failed to load consultations: $e';
        }
      });
    }
  }

  void _onStatusFilterSelected(ConsultationStatus? status) {
    if (_selectedStatusFilter == status) return;
    setState(() {
      _selectedStatusFilter = status;
    });
    _loadConsultations(refresh: true);
  }

  Future<void> _navigateToDetails(Consultation item) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ConsultationDetailsScreen(
          consultationId: item.id,
          initialConsultation: item,
          consultationsService: _consultationsService,
          storageService: _storageService,
        ),
      ),
    );

    if (mounted) {
      _loadConsultations(refresh: true);
    }
  }

  Future<void> _navigateToCreate() async {
    final result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ConsultationCreateScreen(
          consultationsService: _consultationsService,
          storageService: _storageService,
        ),
      ),
    );

    if (result != null && mounted) {
      _loadConsultations(refresh: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    if (_isLoadingUser) {
      return Scaffold(
        backgroundColor: colors.background,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_isForbidden) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(title: const Text('Consultations')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.lock_outline_rounded,
                  size: 64,
                  color: colors.textSecondary,
                ),
                const SizedBox(height: 16),
                Text(
                  'Access Restricted',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Consultation records contain sensitive clinical narratives and are strictly restricted to attending medical doctors. Administrative staff cannot view clinical consultation data.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: colors.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Return to Dashboard'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: const Text('Consultations'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _loadConsultations(refresh: true),
            tooltip: 'Refresh list',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: colors.primaryAccent,
        foregroundColor: context.isDarkMode ? colors.background : Colors.white,
        onPressed: _navigateToCreate,
        icon: const Icon(Icons.add),
        label: const Text('Start Consultation'),
      ),
      body: Column(
        children: [
          _buildFilterChips(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: colors.surface,
      child: Row(
        children: [
          FilterChip(
            label: const Text('All'),
            selected: _selectedStatusFilter == null,
            onSelected: (_) => _onStatusFilterSelected(null),
            selectedColor: colors.primaryAccent.withValues(alpha: 0.15),
            checkmarkColor: colors.primaryAccent,
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('Drafts'),
            selected: _selectedStatusFilter == ConsultationStatus.draft,
            onSelected: (_) =>
                _onStatusFilterSelected(ConsultationStatus.draft),
            selectedColor: context.isDarkMode
                ? colors.accentContainer
                : Colors.amber.shade100,
            checkmarkColor: context.isDarkMode
                ? colors.primaryAccent
                : Colors.amber.shade900,
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('Finalized'),
            selected: _selectedStatusFilter == ConsultationStatus.finalized,
            onSelected: (_) =>
                _onStatusFilterSelected(ConsultationStatus.finalized),
            selectedColor: colors.primaryAccent.withValues(alpha: 0.15),
            checkmarkColor: colors.primaryAccent,
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('Voided'),
            selected: _selectedStatusFilter == ConsultationStatus.voided,
            onSelected: (_) =>
                _onStatusFilterSelected(ConsultationStatus.voided),
            selectedColor: AppTheme.errorRed.withAlpha(30),
            checkmarkColor: AppTheme.errorRed,
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    final colors = context.colors;
    if (_isLoadingConsultations) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  size: 48, color: AppTheme.errorRed),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => _loadConsultations(refresh: true),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_consultations.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.medical_information_outlined,
                size: 64,
                color: colors.textMuted,
              ),
              const SizedBox(height: 16),
              Text(
                'No Consultations Found',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _selectedStatusFilter == null
                    ? 'Start a new consultation.'
                    : 'No consultations match the selected status filter.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadConsultations(refresh: true),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        itemCount: _consultations.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = _consultations[index];
          return _buildConsultationCard(item);
        },
      ),
    );
  }

  Widget _buildConsultationCard(Consultation item) {
    final colors = context.colors;
    final isDraft = item.isDraft;
    final patientName = item.patient?.fullName ?? 'Patient ID: ${item.patientId.substring(0, 8)}...';
    final patientUhid = item.patient?.uhid;

    return Card(
      elevation: 0,
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: colors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _navigateToDetails(item),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Patient & Status Badge
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          patientName,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: colors.textPrimary,
                          ),
                        ),
                        if (patientUhid != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            'UHID: $patientUhid',
                            style: TextStyle(
                              fontSize: 12,
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: item.isVoided
                          ? AppTheme.errorRed.withAlpha(20)
                          : (isDraft
                              ? (context.isDarkMode ? colors.accentContainer : Colors.amber.shade50)
                              : colors.primaryAccent.withAlpha(20)),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: item.isVoided
                            ? AppTheme.errorRed
                            : (isDraft
                                ? (context.isDarkMode ? colors.primaryAccent : Colors.amber.shade700)
                                : colors.primaryAccent),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          item.isVoided
                              ? Icons.block_rounded
                              : (isDraft
                                  ? Icons.edit_note
                                  : Icons.check_circle_outline),
                          size: 13,
                          color: item.status.colorFor(isDark: context.isDarkMode),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          item.isVoided
                              ? 'VOIDED'
                              : (isDraft ? 'DRAFT' : 'FINALIZED'),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: item.status.colorFor(isDark: context.isDarkMode),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Divider(height: 20, color: colors.divider),

              // Chief complaint
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Complaint: ',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.textSecondary,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      item.chiefComplaint,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),

              if (item.diagnosis != null && item.diagnosis!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Diagnosis: ',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: colors.textSecondary,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        item.diagnosis!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              if (item.isVoided &&
                  item.voidReason != null &&
                  item.voidReason!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Void Reason: ',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.errorRed,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        item.voidReason!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.errorRed,
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 10),
              // Footer: Date and Clinician
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.event_outlined,
                          size: 14, color: colors.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        item.formattedEncounterDate,
                        style: TextStyle(
                          fontSize: 12,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Icon(
                        isDraft ? Icons.pending_actions : Icons.verified_user,
                        size: 14,
                        color: isDraft
                            ? (context.isDarkMode ? colors.primaryAccent : Colors.amber.shade800)
                            : (context.isDarkMode ? colors.primaryAccent : AppTheme.accentTeal),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isDraft ? 'Draft In Progress' : 'Final Record',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isDraft
                              ? (context.isDarkMode ? colors.primaryAccent : Colors.amber.shade800)
                              : (context.isDarkMode ? colors.primaryAccent : AppTheme.accentTeal),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
