import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/clinic_dashboard_stats.dart';
import '../../models/queue_summary.dart';

/// Overview card showing real-time OPD Queue tokens and statuses for today
class OpdQueueOverviewCard extends StatelessWidget {
  final ClinicDashboardStats stats;
  final bool isLoading;
  final VoidCallback? onViewAllTap;

  const OpdQueueOverviewCard({
    super.key,
    required this.stats,
    this.isLoading = false,
    this.onViewAllTap,
  });

  Color _getStatusColor(String status) {
    switch (status) {
      case 'WAITING':
        return Colors.amber.shade800;
      case 'CALLED':
        return Colors.blue.shade700;
      case 'IN_CONSULTATION':
        return Colors.purple.shade700;
      case 'COMPLETED':
        return AppTheme.successGreen;
      case 'SKIPPED':
      case 'CANCELLED':
        return AppTheme.errorRed;
      default:
        return AppTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.borderGray),
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
                    color: AppTheme.accentTeal.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.confirmation_number_rounded,
                    color: AppTheme.accentTeal,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    "Today's OPD Queue",
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppTheme.borderGray),
                  ),
                  child: Text(
                    stats.serviceDate.isNotEmpty ? stats.serviceDate : 'Today',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace',
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ),
                if (onViewAllTap != null) ...[
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: onViewAllTap,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('View All', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),

            // Queue Metrics Counters Grid
            Row(
              children: [
                _buildMetricBox('Total', stats.totalQueueToday.toString(), AppTheme.primaryNavy),
                const SizedBox(width: 8),
                _buildMetricBox('Waiting', stats.queueWaitingCount.toString(), Colors.amber.shade800),
                const SizedBox(width: 8),
                _buildMetricBox('Called', stats.queueCalledCount.toString(), Colors.blue.shade700),
                const SizedBox(width: 8),
                _buildMetricBox('In Exam', stats.queueInConsultationCount.toString(), Colors.purple.shade700),
                const SizedBox(width: 8),
                _buildMetricBox('Done', stats.queueCompletedCount.toString(), AppTheme.successGreen),
              ],
            ),
            const SizedBox(height: 16),

            // Queue Entries List or Empty State
            if (stats.queueEntriesToday.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.borderGray),
                ),
                child: const Column(
                  children: [
                    Icon(
                      Icons.people_outline_rounded,
                      size: 36,
                      color: AppTheme.textSecondary,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'No patients currently in OPD queue today',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Tokens allocated via check-in will appear here.',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ACTIVE QUEUE TOKENS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: stats.queueEntriesToday.take(5).length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (ctx, index) {
                      final item = stats.queueEntriesToday[index];
                      return _buildQueueItemRow(item);
                    },
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricBox(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQueueItemRow(QueueSummary item) {
    final statusColor = _getStatusColor(item.status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.backgroundLight,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderGray),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppTheme.primaryNavy,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '#${item.tokenNumber}',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.patientName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'UHID: ${item.patientUhid} • Doctor: ${item.doctorName ?? "Assigned"}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              item.status.replaceAll('_', ' '),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
