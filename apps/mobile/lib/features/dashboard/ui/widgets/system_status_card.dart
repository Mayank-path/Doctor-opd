import 'package:flutter/material.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/theme/app_theme.dart';

/// System Status and API Connection Card
class SystemStatusCard extends StatelessWidget {
  final String healthStatus;
  final DateTime? lastRefreshed;

  const SystemStatusCard({
    super.key,
    required this.healthStatus,
    this.lastRefreshed,
  });

  @override
  Widget build(BuildContext context) {
    final isOnline = healthStatus.toLowerCase() == 'online' || healthStatus.toLowerCase() == 'ok';

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppTheme.borderGray),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.dns_rounded,
                  size: 18,
                  color: AppTheme.textSecondary,
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'SYSTEM INFRASTRUCTURE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isOnline
                        ? AppTheme.successGreen.withValues(alpha: 0.12)
                        : AppTheme.errorRed.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isOnline ? AppTheme.successGreen : AppTheme.errorRed,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isOnline ? 'API ONLINE' : 'OFFLINE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: isOnline ? AppTheme.successGreen : AppTheme.errorRed,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppTheme.backgroundLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                AppConfig.apiBaseUrl,
                style: const TextStyle(
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: AppTheme.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.security_rounded, size: 14, color: AppTheme.accentTeal),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text(
                    'Tokens encrypted with Android Keystore / AES-GCM.',
                    style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                  ),
                ),
                if (lastRefreshed != null) ...[
                  const SizedBox(width: 8),
                  Text(
                    'Refreshed ${_formatTime(lastRefreshed!)}',
                    style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final minute = dt.minute.toString().padLeft(2, '0');
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $ampm';
  }
}
