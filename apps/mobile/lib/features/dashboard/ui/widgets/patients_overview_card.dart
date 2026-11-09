import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/clinic_dashboard_stats.dart';

/// Overview card showing registered patients in the active clinic
class PatientsOverviewCard extends StatelessWidget {
  final ClinicDashboardStats stats;
  final bool isLoading;
  final VoidCallback? onViewAllTap;
  final void Function(String patientId)? onPatientTap;

  const PatientsOverviewCard({
    super.key,
    required this.stats,
    this.isLoading = false,
    this.onViewAllTap,
    this.onPatientTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Card(
      elevation: 1,
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: colors.primaryAccent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.people_alt_rounded,
                    color: colors.primaryAccent,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Registered Patients',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: colors.primaryAccent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${stats.totalPatients} total',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: colors.primaryAccent,
                        ),
                      ),
                    ),
                    if (onViewAllTap != null) ...[
                      const SizedBox(width: 6),
                      TextButton(
                        onPressed: onViewAllTap,
                        style: TextButton.styleFrom(
                          foregroundColor: colors.primaryAccent,
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text('View All', style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (stats.recentPatients.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: colors.surfaceContainer,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.person_add_disabled_rounded,
                      size: 36,
                      color: colors.textSecondary,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No patients registered in this clinic yet',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Patients created in OPD registration will appear here.',
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              )
            else ...[
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: stats.recentPatients.take(4).length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, index) {
                  final patient = stats.recentPatients[index];

                  return InkWell(
                    onTap: onPatientTap != null ? () => onPatientTap!(patient.id) : null,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: colors.surfaceContainer,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: colors.primaryAccent.withValues(alpha: 0.15),
                            child: Text(
                              patient.fullName.isNotEmpty
                                  ? patient.fullName[0].toUpperCase()
                                  : 'P',
                              style: TextStyle(
                                color: colors.primaryAccent,
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  patient.fullName,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: colors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'UHID: ${patient.uhid} • Phone: ${patient.phone}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: colors.surface,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: colors.border),
                            ),
                            child: Text(
                              patient.gender,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              if (onViewAllTap != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: onViewAllTap,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: colors.textPrimary,
                      side: BorderSide(color: colors.border),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    child: Text('View All ${stats.totalPatients} Patients'),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
