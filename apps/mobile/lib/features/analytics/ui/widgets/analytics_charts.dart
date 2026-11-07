import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/practice_analytics.dart';

/// A lightweight, responsive daily bar chart rendered via CustomPainter.
class DailyBarChart extends StatelessWidget {
  final List<DailyBarChartItem> items;
  final String title;
  final String emptyMessage;
  final Color barColor;
  final String valuePrefix;

  const DailyBarChart({
    super.key,
    required this.items,
    required this.title,
    this.emptyMessage = 'No trend data for selected period',
    this.barColor = AppTheme.accentTeal,
    this.valuePrefix = '',
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Container(
        height: 160,
        alignment: Alignment.center,
        child: Text(
          emptyMessage,
          style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
        ),
      );
    }

    final maxValue = items.map((e) => e.value).reduce((a, b) => a > b ? a : b);
    final effectiveMax = maxValue <= 0 ? 1.0 : maxValue;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderGray),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary,
                ),
              ),
              Text(
                'Max: $valuePrefix${maxValue.toStringAsFixed(maxValue is int || maxValue % 1 == 0 ? 0 : 2)}',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: items.map((item) {
                final ratio = (item.value / effectiveMax).clamp(0.04, 1.0);
                final shortLabel = item.label.length >= 5
                    ? item.label.substring(item.label.length - 5) // MM-DD
                    : item.label;

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Tooltip(
                          message: '${item.label}: $valuePrefix${item.value}',
                          child: Container(
                            height: 90 * ratio,
                            decoration: BoxDecoration(
                              color: barColor,
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(4),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          shortLabel,
                          style: const TextStyle(
                            fontSize: 9,
                            color: AppTheme.textMuted,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class DailyBarChartItem {
  final String label;
  final double value;

  const DailyBarChartItem({
    required this.label,
    required this.value,
  });
}

/// Payment method breakdown with amount, count, and progress indicators.
class PaymentMethodDistributionWidget extends StatelessWidget {
  final List<PaymentMethodBreakdown> items;

  const PaymentMethodDistributionWidget({
    super.key,
    required this.items,
  });

  IconData _getMethodIcon(String method) {
    switch (method.toUpperCase()) {
      case 'UPI':
        return Icons.qr_code_rounded;
      case 'CASH':
        return Icons.payments_outlined;
      case 'CARD':
        return Icons.credit_card_rounded;
      default:
        return Icons.account_balance_wallet_outlined;
    }
  }

  Color _getMethodColor(String method) {
    switch (method.toUpperCase()) {
      case 'UPI':
        return AppTheme.accentTeal;
      case 'CASH':
        return AppTheme.successGreen;
      case 'CARD':
        return Colors.indigo;
      default:
        return Colors.deepPurple;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderGray),
        ),
        alignment: Alignment.center,
        child: const Text(
          'No payment transactions recorded in this period',
          style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderGray),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Payment Methods Breakdown',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 14),
          ...items.map((item) {
            final color = _getMethodColor(item.method);
            final icon = _getMethodIcon(item.method);

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(icon, size: 16, color: color),
                      const SizedBox(width: 6),
                      Text(
                        item.method,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '₹${item.amount.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '(${item.count} tx • ${item.percentage.toStringAsFixed(1)}%)',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (item.percentage / 100.0).clamp(0.0, 1.0),
                      backgroundColor: color.withValues(alpha: 0.12),
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                      minHeight: 6,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
