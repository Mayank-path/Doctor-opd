import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Quick-action cards grid with non-destructive placeholder feedback
/// preserving navigation boundary until respective workflow checkpoints.
class QuickActionsGrid extends StatelessWidget {
  final String? activeClinicId;
  final bool isDoctor;
  final VoidCallback? onPatientsTap;
  final VoidCallback? onConsultationsTap;
  final VoidCallback? onPrescriptionsTap;
  final VoidCallback? onAnalyticsTap;
  final VoidCallback? onDiseaseSearchTap;

  const QuickActionsGrid({
    super.key,
    required this.activeClinicId,
    required this.isDoctor,
    this.onPatientsTap,
    this.onConsultationsTap,
    this.onPrescriptionsTap,
    this.onAnalyticsTap,
    this.onDiseaseSearchTap,
  });

  void _showComingSoonSheet(
    BuildContext context, {
    required String title,
    required IconData icon,
    required String description,
  }) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.accentTeal.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, color: AppTheme.accentTeal, size: 28),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Upcoming OPD Module',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                description,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.4,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              if (activeClinicId != null && activeClinicId!.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderGray),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        color: AppTheme.successGreen,
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Clinic Active: ${activeClinicId!.substring(0, activeClinicId!.length.clamp(0, 8))}...',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text('Understood', style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 4),
          child: Text(
            'QUICK ACTIONS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: AppTheme.textSecondary,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _buildActionCard(
                context,
                title: 'Patients',
                subtitle: 'Register & search',
                icon: Icons.person_add_alt_1_rounded,
                color: AppTheme.accentTeal,
                onTap: onPatientsTap ??
                    () => _showComingSoonSheet(
                          context,
                          title: 'Patient Management',
                          icon: Icons.person_add_alt_1_rounded,
                          description:
                              'Patient registration and search forms will be integrated in upcoming checkpoints.',
                        ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildActionCard(
                context,
                title: 'Consultations',
                subtitle: isDoctor ? 'Doctor visits' : 'Protected',
                icon: Icons.medical_services_rounded,
                color: isDoctor ? Colors.purple.shade700 : Colors.blueGrey,
                onTap: (isDoctor && onConsultationsTap != null)
                    ? onConsultationsTap!
                    : () => _showComingSoonSheet(
                          context,
                          title: 'Clinical Consultations',
                          icon: Icons.medical_services_rounded,
                          description: isDoctor
                              ? 'Clinical consultation drafting, diagnosis coding, and finalization workflows.'
                              : 'Clinical records are restricted to DOCTOR memberships under healthcare privacy regulations.',
                        ),
              ),
            ),
          ],
        ),
        if (isDoctor || onPrescriptionsTap != null) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  context,
                  title: 'Prescriptions',
                  subtitle: isDoctor ? 'Builder & History' : 'Protected',
                  icon: Icons.receipt_long_rounded,
                  color: Colors.teal.shade700,
                  onTap: (isDoctor && onPrescriptionsTap != null)
                      ? onPrescriptionsTap!
                      : () => _showComingSoonSheet(
                            context,
                            title: 'Prescription Builder',
                            icon: Icons.receipt_long_rounded,
                            description: isDoctor
                                ? 'Clinician-reviewed prescription builder, digital approvals, and authenticated PDF printing.'
                                : 'Prescription creation is restricted to DOCTOR memberships.',
                          ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  context,
                  title: 'Analytics',
                  subtitle: isDoctor ? 'Performance' : 'Protected',
                  icon: Icons.insights_rounded,
                  color: Colors.indigo.shade700,
                  onTap: (isDoctor && onAnalyticsTap != null)
                      ? onAnalyticsTap!
                      : () => _showComingSoonSheet(
                            context,
                            title: 'Practice Analytics',
                            icon: Icons.insights_rounded,
                            description: isDoctor
                                ? 'Doctor practice performance, patient trends, and collected revenue metrics.'
                                : 'Practice analytics is restricted to DOCTOR memberships.',
                          ),
                ),
              ),
            ],
          ),
        ],
        if (isDoctor || onDiseaseSearchTap != null) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  context,
                  title: 'Disease Search',
                  subtitle: isDoctor ? 'Clinical History' : 'Protected',
                  icon: Icons.manage_search_rounded,
                  color: Colors.deepOrange.shade700,
                  onTap: (isDoctor && onDiseaseSearchTap != null)
                      ? onDiseaseSearchTap!
                      : () => _showComingSoonSheet(
                            context,
                            title: 'Disease Search',
                            icon: Icons.manage_search_rounded,
                            description: isDoctor
                                ? 'Search historical clinical consultation records by confirmed disease name or clinical symptoms.'
                                : 'Clinical record search is restricted to DOCTOR memberships.',
                          ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildActionCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderGray),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
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
}
