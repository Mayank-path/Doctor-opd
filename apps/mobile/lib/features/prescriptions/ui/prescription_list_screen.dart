import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/prescription.dart';
import '../services/prescriptions_service.dart';
import 'prescription_create_screen.dart';
import 'prescription_details_screen.dart';

/// Screen listing clinic prescriptions with status filters, pagination,
/// and fast creation navigation.
class PrescriptionListScreen extends StatefulWidget {
  final PrescriptionsService? prescriptionsService;
  final String? initialPatientId;

  const PrescriptionListScreen({
    super.key,
    this.prescriptionsService,
    this.initialPatientId,
  });

  @override
  State<PrescriptionListScreen> createState() => _PrescriptionListScreenState();
}

class _PrescriptionListScreenState extends State<PrescriptionListScreen> {
  late final PrescriptionsService _prescriptionsService;

  PrescriptionStatus? _selectedStatus;
  int _currentPage = 1;
  static const int _limit = 20;

  bool _isLoading = true;
  String? _errorMessage;
  List<Prescription> _prescriptions = [];
  int _totalCount = 0;
  int _totalPages = 1;

  @override
  void initState() {
    super.initState();
    _prescriptionsService =
        widget.prescriptionsService ?? PrescriptionsService();
    _loadPrescriptions();
  }

  Future<void> _loadPrescriptions({int page = 1}) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _currentPage = page;
    });

    try {
      final res = await _prescriptionsService.getPrescriptions(
        page: page,
        limit: _limit,
        patientId: widget.initialPatientId,
        status: _selectedStatus,
      );

      if (mounted) {
        setState(() {
          _prescriptions = res.data;
          _totalCount = res.total;
          _totalPages = res.totalPages;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e is ApiException ? e.message : e.toString();
          _isLoading = false;
        });
      }
    }
  }

  void _onStatusFilterSelected(PrescriptionStatus? status) {
    if (_selectedStatus == status) return;
    setState(() {
      _selectedStatus = status;
    });
    _loadPrescriptions(page: 1);
  }

  void _openCreatePrescription() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PrescriptionCreateScreen(
          prefilledPatientId: widget.initialPatientId,
          prescriptionsService: _prescriptionsService,
        ),
      ),
    ).then((_) {
      if (mounted) {
        _loadPrescriptions(page: _currentPage);
      }
    });
  }

  void _openPrescriptionDetails(String id) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PrescriptionDetailsScreen(
          prescriptionId: id,
          prescriptionsService: _prescriptionsService,
        ),
      ),
    ).then((_) {
      if (mounted) {
        _loadPrescriptions(page: _currentPage);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text(
          'Prescriptions',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            key: const Key('refreshPrescriptionsButton'),
            icon: const Icon(Icons.refresh_rounded),
            color: AppTheme.primaryNavy,
            onPressed: () => _loadPrescriptions(page: _currentPage),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('newPrescriptionFab'),
        onPressed: _openCreatePrescription,
        backgroundColor: AppTheme.accentTeal,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text(
          'New Prescription',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Filter Chips Row
          _buildFilterBar(),
          const Divider(height: 1),

          // Prescriptions List
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildFilterChip(
              label: 'All',
              isSelected: _selectedStatus == null,
              onTap: () => _onStatusFilterSelected(null),
            ),
            const SizedBox(width: 8),
            _buildFilterChip(
              label: 'Draft',
              isSelected: _selectedStatus == PrescriptionStatus.draft,
              onTap: () => _onStatusFilterSelected(PrescriptionStatus.draft),
            ),
            const SizedBox(width: 8),
            _buildFilterChip(
              label: 'Approved',
              isSelected: _selectedStatus == PrescriptionStatus.approved,
              onTap: () => _onStatusFilterSelected(PrescriptionStatus.approved),
            ),
            const SizedBox(width: 8),
            _buildFilterChip(
              label: 'Superseded',
              isSelected: _selectedStatus == PrescriptionStatus.superseded,
              onTap: () =>
                  _onStatusFilterSelected(PrescriptionStatus.superseded),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryNavy
              : AppTheme.backgroundLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppTheme.primaryNavy : AppTheme.borderGray,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : AppTheme.textPrimary,
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _prescriptions.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null && _prescriptions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  color: AppTheme.dangerRed, size: 40),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.dangerRed),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => _loadPrescriptions(page: 1),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_prescriptions.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _loadPrescriptions(page: 1),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(vertical: 80, horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.receipt_long_outlined,
                    size: 56, color: Colors.grey.shade400),
                const SizedBox(height: 14),
                const Text(
                  'No prescriptions found',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Prescriptions created for this clinic or patient will be displayed here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: _openCreatePrescription,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.accentTeal,
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Create Prescription'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadPrescriptions(page: _currentPage),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _prescriptions.length + (_totalPages > 1 ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _prescriptions.length) {
            return _buildPaginationBar();
          }

          final rx = _prescriptions[index];
          return _buildPrescriptionCard(rx);
        },
      ),
    );
  }

  Widget _buildPrescriptionCard(Prescription rx) {
    Color statusColor;
    switch (rx.status) {
      case PrescriptionStatus.approved:
        statusColor = AppTheme.successGreen;
        break;
      case PrescriptionStatus.draft:
        statusColor = Colors.orange.shade800;
        break;
      case PrescriptionStatus.superseded:
        statusColor = Colors.grey.shade700;
        break;
      case PrescriptionStatus.cancelled:
        statusColor = AppTheme.dangerRed;
        break;
    }

    final dateStr =
        '${rx.createdAt.day.toString().padLeft(2, '0')}/${rx.createdAt.month.toString().padLeft(2, '0')}/${rx.createdAt.year}';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderGray),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        key: Key('prescriptionCard_${rx.id}'),
        onTap: () => _openPrescriptionDetails(rx.id),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: statusColor.withValues(alpha: 0.1),
                    child: Icon(Icons.receipt_long_rounded,
                        color: statusColor, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rx.patient?.fullName ?? 'Patient ID: ${rx.patientId}',
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        Text(
                          'Dr. ${rx.doctor?.fullName ?? "Attending Doctor"} • $dateStr',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                      border:
                          Border.all(color: statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      rx.status.name.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: statusColor,
                      ),
                    ),
                  ),
                  if (rx.amendmentVersion > 1) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.indigo.shade50,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.indigo.shade200),
                      ),
                      child: Text(
                        'v${rx.amendmentVersion}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.indigo.shade800,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              const Divider(height: 1, color: AppTheme.borderGray),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.medication_rounded,
                      size: 14, color: AppTheme.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    '${rx.items.length} medication item(s)',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const Spacer(),
                  const Text(
                    'View Details',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.accentTeal,
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      size: 16, color: AppTheme.accentTeal),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPaginationBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          OutlinedButton(
            onPressed: _currentPage > 1
                ? () => _loadPrescriptions(page: _currentPage - 1)
                : null,
            child: const Text('Previous'),
          ),
          Text(
            'Page $_currentPage of $_totalPages ($_totalCount total)',
            style: const TextStyle(
              fontSize: 12,
              color: AppTheme.textSecondary,
            ),
          ),
          OutlinedButton(
            onPressed: _currentPage < _totalPages
                ? () => _loadPrescriptions(page: _currentPage + 1)
                : null,
            child: const Text('Next'),
          ),
        ],
      ),
    );
  }
}

