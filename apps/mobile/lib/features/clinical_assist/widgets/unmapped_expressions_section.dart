import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../models/structured_clinical_extraction.dart';

/// Section rendering unmapped clinical expressions and quarantined sensations.
///
/// Clinical Safety Safeguards:
/// - Explicitly warns that quarantined sensations (e.g. 'chills' / 'sardi') are NOT mapped to Fever.
/// - Allows the clinician to individually select which unmapped expressions to include
///   as descriptive notes in the consultation.
/// - Validates UTF-16 character slice offsets against the confirmed source transcript.
class UnmappedExpressionsSection extends StatelessWidget {
  final List<UnmappedClinicalExpression> expressions;
  final String sourceText;
  final Map<String, bool> inclusions;
  final void Function(String expression, bool included) onToggleInclusion;

  const UnmappedExpressionsSection({
    super.key,
    required this.expressions,
    required this.sourceText,
    required this.inclusions,
    required this.onToggleInclusion,
  });

  @override
  Widget build(BuildContext context) {
    if (expressions.isEmpty) {
      return const SizedBox.shrink();
    }

    final hasQuarantined = expressions.any((e) =>
        e.reason.toLowerCase().contains('quarantine') ||
        e.reason.toLowerCase().contains('chill'));

    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: hasQuarantined ? Colors.amber.shade400 : AppTheme.borderGray,
          width: hasQuarantined ? 1.5 : 1.0,
        ),
      ),
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              children: [
                Icon(
                  Icons.help_outline_rounded,
                  color: hasQuarantined ? Colors.amber.shade800 : AppTheme.primaryNavy,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  'Unmapped Expressions & Sensations (${expressions.length})',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: hasQuarantined ? Colors.amber.shade900 : AppTheme.primaryNavy,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Clinical Safety Warning Banner
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.security_rounded,
                    color: Colors.amber.shade900,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'SAFETY AUDIT NOTICE: Subjective sensations (e.g. chills, shivering) and unmapped phrasing are quarantined and NOT converted to Fever or medical diagnoses. Review each item before deciding to include it as a descriptive note.',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.amber.shade900,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // List of Unmapped Expressions
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: expressions.length,
              separatorBuilder: (_, __) => const Divider(height: 16),
              itemBuilder: (context, index) {
                final expr = expressions[index];
                final isIncluded = inclusions[expr.expression] ?? false;
                final isSliceValid = expr.evidence.isSliceVerified(sourceText);
                final isQuarantined = expr.reason.toLowerCase().contains('quarantine') ||
                    expr.reason.toLowerCase().contains('chill');

                return Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isIncluded ? AppTheme.backgroundLight : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isIncluded ? AppTheme.borderGray : Colors.grey.shade300,
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Checkbox(
                        value: isIncluded,
                        activeColor: AppTheme.accentTeal,
                        onChanged: (val) {
                          onToggleInclusion(expr.expression, val ?? false);
                        },
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '"${expr.expression}"',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      fontStyle: FontStyle.italic,
                                      color: isIncluded ? AppTheme.primaryNavy : Colors.grey,
                                    ),
                                  ),
                                ),
                                if (isQuarantined)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.amber.shade100,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      'QUARANTINED',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.amber.shade900,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Reason: ${expr.reason}',
                              style: TextStyle(
                                fontSize: 11,
                                color: isIncluded ? AppTheme.textSecondary : Colors.grey,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isSliceValid
                                        ? Colors.green.withValues(alpha: 0.1)
                                        : Colors.red.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: isSliceValid ? Colors.green : Colors.red,
                                      width: 0.5,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        isSliceValid ? Icons.check_circle_outline : Icons.error_outline,
                                        size: 10,
                                        color: isSliceValid ? Colors.green : Colors.red,
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        isSliceValid
                                            ? 'Slice Verified [${expr.evidence.startIndex}, ${expr.evidence.endIndex})'
                                            : 'Slice Mismatch',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w600,
                                          color: isSliceValid ? Colors.green.shade800 : Colors.red.shade800,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  isIncluded ? 'Will include in notes' : 'Excluded from notes',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontStyle: FontStyle.italic,
                                    color: isIncluded ? AppTheme.accentTeal : Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
