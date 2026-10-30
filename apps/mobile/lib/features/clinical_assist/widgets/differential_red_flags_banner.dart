import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../models/differential_evaluation_models.dart';

/// Urgent Red-Flag alerts banner.
class DifferentialRedFlagsBanner extends StatelessWidget {
  final List<RedFlagAlert> redFlags;

  const DifferentialRedFlagsBanner({
    super.key,
    required this.redFlags,
  });

  @override
  Widget build(BuildContext context) {
    final triggeredFlags = redFlags.where((f) => f.triggered).toList();
    if (triggeredFlags.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: triggeredFlags.map((flag) => _buildAlertCard(context, flag)).toList(),
    );
  }

  Widget _buildAlertCard(BuildContext context, RedFlagAlert flag) {
    final isImmediate = flag.urgencyLevel == RedFlagUrgency.immediate;
    final cardBg = isImmediate
        ? const Color(0xFFFEF2F2) // crimson light
        : const Color(0xFFFFFBEB); // amber light
    final borderColor = isImmediate
        ? const Color(0xFFFCA5A5)
        : const Color(0xFFFCD34D);
    final headerColor = isImmediate
        ? const Color(0xFF991B1B)
        : const Color(0xFF92400E);
    final actionColor = isImmediate
        ? const Color(0xFF7F1D1D)
        : const Color(0xFF78350F);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: headerColor,
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isImmediate ? AppTheme.errorRed : AppTheme.warningAmber,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isImmediate ? 'IMMEDIATE RED FLAG' : 'HIGH RISK ALERT',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        if (flag.isProvisional == true) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.blueGrey.shade700,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'PROVISIONAL',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      flag.title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: headerColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Clinical Action Notice
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: borderColor.withValues(alpha: 0.8)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.medical_services_outlined,
                  size: 16,
                  color: actionColor,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'RECOMMENDED CLINICAL ACTION',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: actionColor,
                          letterSpacing: 0.4,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        flag.clinicalAction,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: actionColor,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Quarantined predicates notice
          if (flag.quarantinedPredicates.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.orange.shade200),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 14, color: Colors.deepOrange),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Quarantined: ${flag.quarantinedPredicates.join(', ')} (excluded from score calculation)',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.deepOrange,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Missing assessment notice
          if (flag.missingAssessmentNotice != null &&
              flag.missingAssessmentNotice!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.blueGrey.shade50,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.blueGrey.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.rule_folder_outlined, size: 14, color: Colors.blueGrey.shade700),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      flag.missingAssessmentNotice!,
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.blueGrey.shade800,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Gating / Clinical Context explanation
          if (flag.gatingExplanation != null &&
              flag.gatingExplanation!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Gating: ${flag.gatingExplanation}',
              style: TextStyle(
                fontSize: 11,
                color: headerColor.withValues(alpha: 0.8),
                fontStyle: FontStyle.italic,
              ),
            ),
          ],

          // Disclaimer
          const SizedBox(height: 8),
          Text(
            flag.disclaimer,
            style: TextStyle(
              fontSize: 10,
              color: Colors.blueGrey.shade600,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

