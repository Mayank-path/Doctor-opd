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

      if (user == null || user.role != 'DOCTOR') {
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
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingConsultations = false;
        if (e is ApiException && e.statusCode == 403) {
          _isForbidden = true;
        } else {
          _errorMessage = e is ApiException
              ? e.message
              : 'Failed to load consultations. Please check your connection.';
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
    final result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ConsultationDetailsScreen(
          consultationId: item.id,
          initialConsultation: item,
          consultationsService: _consultationsService,
          storageService: _storageService,
        ),
      ),
    );

    if (result != null && mounted) {
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
    if (_isLoadingUser) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_isForbidden) {
      return Scaffold(
        appBar: AppBar(title: const Text('Consultations')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.lock_outline_rounded,
                  size: 64,
                  color: AppTheme.textSecondary,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Access Restricted',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Consultation records contain sensitive clinical narratives and are strictly restricted to attending medical doctors. Administrative staff cannot view clinical consultation data.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.textSecondary,
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
        backgroundColor: AppTheme.primaryNavy,
        foregroundColor: Colors.white,
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.white,
      child: Row(
        children: [
          FilterChip(
            label: const Text('All'),
            selected: _selectedStatusFilter == null,
            onSelected: (_) => _onStatusFilterSelected(null),
            selectedColor: AppTheme.primaryNavy.withAlpha(30),
            checkmarkColor: AppTheme.primaryNavy,
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('Drafts'),
            selected: _selectedStatusFilter == ConsultationStatus.draft,
            onSelected: (_) =>
                _onStatusFilterSelected(ConsultationStatus.draft),
            selectedColor: Colors.amber.shade100,
            checkmarkColor: Colors.amber.shade900,
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('Finalized'),
            selected: _selectedStatusFilter == ConsultationStatus.finalized,
            onSelected: (_) =>
                _onStatusFilterSelected(ConsultationStatus.finalized),
            selectedColor: AppTheme.accentTeal.withAlpha(30),
            checkmarkColor: AppTheme.accentTeal,
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
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
                style: const TextStyle(
                  fontSize: 14,
                  color: AppTheme.textPrimary,
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
                color: Colors.grey.shade400,
              ),
              const SizedBox(height: 16),
              const Text(
                'No Consultations Found',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _selectedStatusFilter == null
                    ? 'Start a new consultation or select a patient from OPD queue.'
                    : 'No consultations match the selected status filter.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade600,
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
    final isDraft = item.isDraft;
    final patientName = item.patient?.fullName ?? 'Patient ID: ${item.patientId.substring(0, 8)}...';
    final patientUhid = item.patient?.uhid;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
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
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        if (patientUhid != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            'UHID: $patientUhid',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
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
                      color: isDraft
                          ? Colors.amber.shade50
                          : AppTheme.accentTeal.withAlpha(20),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isDraft ? Colors.amber.shade700 : AppTheme.accentTeal,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isDraft ? Icons.edit_note : Icons.check_circle_outline,
                          size: 13,
                          color: isDraft
                              ? Colors.amber.shade800
                              : AppTheme.accentTeal,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          isDraft ? 'DRAFT' : 'FINALIZED',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: isDraft
                                ? Colors.amber.shade900
                                : AppTheme.accentTeal,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Divider(height: 20),

              // Chief complaint
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Complaint: ',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      item.chiefComplaint,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.textPrimary,
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
                    const Text(
                      'Diagnosis: ',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        item.diagnosis!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.primaryNavy,
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
                      const Icon(Icons.event_outlined,
                          size: 14, color: AppTheme.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        item.formattedEncounterDate,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Icon(
                        isDraft ? Icons.pending_actions : Icons.verified_user,
                        size: 14,
                        color: isDraft ? Colors.amber.shade800 : AppTheme.accentTeal,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isDraft ? 'Draft In Progress' : 'Final Record',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isDraft
                              ? Colors.amber.shade800
                              : AppTheme.accentTeal,
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
