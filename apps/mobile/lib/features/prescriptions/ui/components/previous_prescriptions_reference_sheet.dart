import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/prescription.dart';
import '../../services/prescriptions_service.dart';

/// Read-only reference sheet displaying previous prescriptions for a patient.
///
/// Safety Invariant:
/// Under NO circumstances are previous medications silently copied or auto-filled
/// into a new prescription. This sheet is strictly reference material to prevent
/// drug interaction or dosage errors. Every medication in a new prescription
/// must be explicitly confirmed and added by the attending physician.
class PreviousPrescriptionsReferenceSheet extends StatefulWidget {
  final String patientId;
  final String patientName;
  final PrescriptionsService? prescriptionsService;

  const PreviousPrescriptionsReferenceSheet({
    super.key,
    required this.patientId,
    required this.patientName,
    this.prescriptionsService,
  });

  static Future<void> show(
    BuildContext context, {
    required String patientId,
    required String patientName,
    PrescriptionsService? prescriptionsService,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PreviousPrescriptionsReferenceSheet(
        patientId: patientId,
        patientName: patientName,
        prescriptionsService: prescriptionsService,
      ),
    );
  }

  @override
  State<PreviousPrescriptionsReferenceSheet> createState() =>
      _PreviousPrescriptionsReferenceSheetState();
}

class _PreviousPrescriptionsReferenceSheetState
    extends State<PreviousPrescriptionsReferenceSheet> {
  late final PrescriptionsService _prescriptionsService;
  bool _isLoading = true;
  String? _errorMessage;
  List<Prescription> _prescriptions = [];

  @override
  void initState() {
    super.initState();
    _prescriptionsService =
        widget.prescriptionsService ?? PrescriptionsService();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _prescriptionsService.getPrescriptions(
        patientId: widget.patientId,
        limit: 15,
      );
      if (mounted) {
        setState(() {
          _prescriptions = res.items;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.of(context).size.height * 0.85;

    return Container(
      height: height,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Header handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Title row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                const Icon(
                  Icons.history_edu_rounded,
                  color: AppTheme.primaryNavy,
                  size: 24,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Prior Prescriptions History',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      Text(
                        'Patient: ${widget.patientName}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          // Mandatory Clinical Reference Safety Warning Banner
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.blue.shade200),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.shield_outlined,
                  size: 20,
                  color: Colors.blue.shade900,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CLINICAL REFERENCE ONLY (NO AUTO-COPY)',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.blue.shade900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Prior prescriptions are displayed for historical reference only. Medications are never automatically copied into new orders. Each medication must be explicitly entered and reviewed by the doctor.',
                        style: TextStyle(
                          fontSize: 11.5,
                          height: 1.35,
                          color: Colors.blue.shade900,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Content body
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  color: AppTheme.dangerRed, size: 36),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.dangerRed),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _loadHistory,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_prescriptions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.inventory_2_outlined,
                  size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              const Text(
                'No previous prescriptions found',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'There are no historical prescription records on file for this patient.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _prescriptions.length,
      itemBuilder: (context, index) {
        final rx = _prescriptions[index];
        return _buildPrescriptionCard(rx);
      },
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

    final doctorName = rx.doctor?.fullName ?? 'Attending Clinician';
    final dateStr = '${rx.createdAt.day}/${rx.createdAt.month}/${rx.createdAt.year}';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderGray),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        childrenPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.receipt_long_rounded, color: statusColor, size: 20),
        ),
        title: Row(
          children: [
            Text(
              dateStr,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: statusColor.withValues(alpha: 0.3)),
              ),
              child: Text(
                rx.status.name.toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: statusColor,
                ),
              ),
            ),
            if (rx.amendmentVersion > 1) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.indigo.shade200),
                ),
                child: Text(
                  'v${rx.amendmentVersion}',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.indigo.shade800,
                  ),
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(
          'Dr. $doctorName • ${rx.items.length} item(s)',
          style: const TextStyle(
            fontSize: 12,
            color: AppTheme.textSecondary,
          ),
        ),
        children: [
          if (rx.notes != null && rx.notes!.trim().isNotEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: AppTheme.backgroundLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.borderGray),
              ),
              child: Text(
                'Notes: ${rx.notes!.trim()}',
                style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: AppTheme.textPrimary,
                ),
              ),
            ),
          ],
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'MEDICATION ITEMS (READ-ONLY)',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
                color: AppTheme.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 6),
          ...rx.items.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.backgroundLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.borderGray),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${idx + 1}.',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${item.medicationName} (${item.strength}) - ${item.dosageForm.displayName}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Route: ${item.route.displayName} • Frequency: ${item.frequency} • ${item.durationValue} ${item.durationUnit.toLowerCase()} • Timing: ${item.timing.displayName}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        if (item.specialInstructions != null &&
                            item.specialInstructions!.trim().isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            'Instructions: ${item.specialInstructions!.trim()}',
                            style: TextStyle(
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                              color: Colors.amber.shade900,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
      ),
    );
  }
}

