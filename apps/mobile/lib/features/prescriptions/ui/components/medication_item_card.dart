import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/prescription_item.dart';

/// Card displaying a single medication item within a prescription.
/// Supports both editable mode (with edit & delete callbacks) and
/// immutable read-only mode for approved/finalized prescriptions.
class MedicationItemCard extends StatelessWidget {
  final PrescriptionItem item;
  final int index;
  final bool isReadOnly;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const MedicationItemCard({
    super.key,
    required this.item,
    required this.index,
    this.isReadOnly = false,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.colors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Item Index Badge, Medication Name, Strength, Form, and Actions
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: context.isDarkMode
                        ? context.colors.accentContainer
                        : AppTheme.primaryNavy.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: context.isDarkMode
                          ? context.colors.primaryAccent
                          : AppTheme.primaryNavy,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              item.medicationName,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: context.colors.textPrimary,
                              ),
                            ),
                          ),
                          if (item.brandName != null &&
                              item.brandName!.trim().isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              '(${item.brandName!.trim()})',
                              style: TextStyle(
                                fontSize: 13,
                                fontStyle: FontStyle.italic,
                                color: context.colors.textSecondary,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          _buildBadge(
                            text: item.strength,
                            color: context.colors.primaryAccent,
                          ),
                          _buildBadge(
                            text: item.dosageForm.displayName,
                            color: context.isDarkMode
                                ? const Color(0xFFC084FC)
                                : Colors.purple.shade700,
                          ),
                          _buildBadge(
                            text: item.route.displayName,
                            color: context.isDarkMode
                                ? const Color(0xFF818CF8)
                                : Colors.indigo.shade700,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (!isReadOnly) ...[
                  IconButton(
                    key: Key('editMedication_${item.medicationName}'),
                    icon: const Icon(Icons.edit_outlined, size: 20),
                    color: context.colors.primaryAccent,
                    tooltip: 'Edit item',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: onEdit,
                  ),
                  const SizedBox(width: 10),
                  IconButton(
                    key: Key('deleteMedication_${item.medicationName}'),
                    icon: const Icon(Icons.delete_outline_rounded, size: 20),
                    color: AppTheme.dangerRed,
                    tooltip: 'Remove item',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: onDelete,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            Divider(height: 1, color: context.colors.divider),
            const SizedBox(height: 10),

            // Regimen details: Frequency, Duration, Timing
            Row(
              children: [
                Expanded(
                  child: _buildDetailCell(
                    context: context,
                    label: 'Frequency',
                    value: item.frequency,
                    icon: Icons.repeat_rounded,
                  ),
                ),
                Expanded(
                  child: _buildDetailCell(
                    context: context,
                    label: 'Duration',
                    value: '${item.durationValue} ${item.durationUnit.toLowerCase()}',
                    icon: Icons.timelapse_rounded,
                  ),
                ),
                Expanded(
                  child: _buildDetailCell(
                    context: context,
                    label: 'Timing',
                    value: item.timing.displayName,
                    icon: Icons.schedule_rounded,
                  ),
                ),
              ],
            ),

            // Special instructions (if any)
            if (item.specialInstructions != null &&
                item.specialInstructions!.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: context.isDarkMode
                      ? context.colors.accentContainer
                      : Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: context.isDarkMode
                        ? context.colors.accentBorder
                        : Colors.amber.shade200,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 14,
                      color: context.isDarkMode
                          ? context.colors.primaryAccent
                          : Colors.amber.shade900,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        item.specialInstructions!.trim(),
                        style: TextStyle(
                          fontSize: 12,
                          color: context.isDarkMode
                              ? context.colors.textSecondary
                              : Colors.amber.shade900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBadge({required String text, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }

  Widget _buildDetailCell({
    required BuildContext context,
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 12, color: context.colors.textSecondary),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: context.colors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: context.colors.textPrimary,
          ),
        ),
      ],
    );
  }
}

