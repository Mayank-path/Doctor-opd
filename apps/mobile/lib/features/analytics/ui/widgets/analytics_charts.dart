import 'dart:math';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/practice_analytics.dart';

/// A lightweight, responsive, production-quality daily bar chart widget.
/// Renders individual, bounded vertical bars with Y-axis scale, horizontal grid lines,
/// value labels, and formatted X-axis date labels.
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

  static List<double> _calculateYTicks(double maxValue) {
    if (maxValue <= 0) return [2, 1, 0];
    if (maxValue <= 2) return [2, 1, 0];
    if (maxValue <= 4) return [4, 2, 0];
    if (maxValue <= 10) {
      final top = (maxValue / 2).ceil() * 2.0;
      return [top, top / 2, 0];
    }
    double factor = 10;
    while (maxValue / factor > 10) {
      factor *= 10;
    }
    final norm = maxValue / factor;
    double top;
    if (norm <= 2) {
      top = 2 * factor;
    } else if (norm <= 5) {
      top = 5 * factor;
    } else {
      top = 10 * factor;
    }
    return [top, top / 2, 0];
  }

  static String _formatTick(double val, String prefix) {
    if (val >= 100000) {
      return '$prefix${(val / 100000).toStringAsFixed(1)}L';
    } else if (val >= 1000) {
      final kVal = val / 1000;
      return '$prefix${kVal % 1 == 0 ? kVal.toInt() : kVal.toStringAsFixed(1)}k';
    } else if (val % 1 == 0) {
      return '$prefix${val.toInt()}';
    } else {
      return '$prefix${val.toStringAsFixed(1)}';
    }
  }

  static String _formatValue(double val, String prefix) {
    if (prefix.isNotEmpty) {
      if (val >= 100000) {
        return '$prefix${(val / 100000).toStringAsFixed(1)}L';
      } else if (val >= 1000) {
        final k = val / 1000;
        return '$prefix${k % 1 == 0 ? k.toInt() : k.toStringAsFixed(1)}k';
      }
      return '$prefix${val % 1 == 0 ? val.toInt() : val.toStringAsFixed(0)}';
    }
    if (val % 1 == 0) {
      return '${val.toInt()}';
    }
    return val.toStringAsFixed(1);
  }

  static String _formatDateLabel(String label) {
    try {
      final parts = label.split('-');
      if (parts.length == 3) {
        final month = int.tryParse(parts[1]);
        final day = int.tryParse(parts[2]);
        if (month != null && day != null) {
          const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
          ];
          if (month >= 1 && month <= 12) {
            return '$day ${months[month - 1]}';
          }
        }
      }
    } catch (_) {}
    return label.length >= 5 ? label.substring(label.length - 5) : label;
  }

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.colors.border),
        ),
        alignment: Alignment.center,
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: context.colors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 24),
            Icon(Icons.bar_chart_rounded,
                size: 36, color: context.colors.textMuted.withValues(alpha: 0.5)),
            const SizedBox(height: 8),
            Text(
              emptyMessage,
              style: TextStyle(fontSize: 12, color: context.colors.textSecondary),
            ),
            const SizedBox(height: 12),
          ],
        ),
      );
    }

    final maxValue = items.map((e) => e.value).reduce((a, b) => a > b ? a : b);
    final ticks = _calculateYTicks(maxValue);
    final topY = ticks.first;
    const double plotHeight = 100.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: context.colors.textPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: barColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Max: ${_formatValue(maxValue, valuePrefix)}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: barColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 146,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Y-Axis Column
                SizedBox(
                  width: 36,
                  child: Column(
                    children: [
                      const SizedBox(height: 18),
                      SizedBox(
                        height: plotHeight,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: ticks
                              .map(
                                (t) => Text(
                                  _formatTick(t, valuePrefix),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: context.colors.textSecondary,
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
                // Vertical Axis separator line
                Container(
                  width: 1,
                  margin: const EdgeInsets.only(top: 18, bottom: 24, left: 6, right: 8),
                  color: context.colors.divider,
                ),
                // Chart Plot Area
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final availableWidth = constraints.maxWidth;
                      final count = items.length;
                      final slotWidth = count > 0 ? availableWidth / count : availableWidth;
                      final isScrollable = count > 8 || slotWidth < 28;

                      return Stack(
                        children: [
                          // 1. Horizontal grid lines aligned with ticks
                          Positioned(
                            top: 18,
                            left: 0,
                            right: 0,
                            height: plotHeight,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: List.generate(ticks.length, (idx) {
                                return Container(
                                  height: 1,
                                  color: idx == ticks.length - 1
                                      ? context.colors.divider
                                      : context.colors.divider.withValues(alpha: 0.4),
                                );
                              }),
                            ),
                          ),
                          // 2. Bars and date labels
                          Positioned.fill(
                            child: isScrollable
                                ? SingleChildScrollView(
                                    scrollDirection: Axis.horizontal,
                                    physics: const BouncingScrollPhysics(),
                                    child: Row(
                                      children: items.map((item) {
                                        return SizedBox(
                                          width: 36,
                                          child: _buildBarColumn(
                                            context: context,
                                            item: item,
                                            barWidth: 16.0,
                                            topY: topY,
                                            plotHeight: plotHeight,
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  )
                                : count == 1
                                    ? Center(
                                        child: SizedBox(
                                          width: 80,
                                          child: _buildBarColumn(
                                            context: context,
                                            item: items.first,
                                            barWidth: 26.0,
                                            topY: topY,
                                            plotHeight: plotHeight,
                                          ),
                                        ),
                                      )
                                    : Row(
                                        children: items.map((item) {
                                          final barWidth = min(24.0, max(8.0, slotWidth * 0.45));
                                          return Expanded(
                                            child: _buildBarColumn(
                                              context: context,
                                              item: item,
                                              barWidth: barWidth,
                                              topY: topY,
                                              plotHeight: plotHeight,
                                            ),
                                          );
                                        }).toList(),
                                      ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBarColumn({
    required BuildContext context,
    required DailyBarChartItem item,
    required double barWidth,
    required double topY,
    required double plotHeight,
  }) {
    final ratio = topY > 0 ? (item.value / topY).clamp(0.0, 1.0) : 0.0;
    final filledHeight = ratio * plotHeight;
    final isZero = item.value <= 0;

    return Tooltip(
      message: '${item.label}: ${_formatValue(item.value, valuePrefix)}',
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // 1. Value label above bar
          SizedBox(
            height: 18,
            child: Center(
              child: Text(
                isZero ? '0' : _formatValue(item.value, valuePrefix),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isZero ? FontWeight.w500 : FontWeight.w700,
                  color: isZero ? context.colors.textSecondary : barColor,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          // 2. Bar plotting area
          SizedBox(
            height: plotHeight,
            width: barWidth,
            child: Stack(
              alignment: Alignment.bottomCenter,
              children: [
                // Background track
                Container(
                  width: barWidth,
                  height: plotHeight,
                  decoration: BoxDecoration(
                    color: barColor.withValues(alpha: 0.08),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
                  ),
                ),
                // Filled bar
                if (!isZero)
                  Container(
                    width: barWidth,
                    height: max(filledHeight, 4.0),
                    decoration: BoxDecoration(
                      color: barColor,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
                    ),
                  )
                else
                  // Zero baseline indicator
                  Container(
                    width: barWidth,
                    height: 2.0,
                    decoration: BoxDecoration(
                      color: barColor.withValues(alpha: 0.25),
                    ),
                  ),
              ],
            ),
          ),
          // 3. X-axis date label below bar
          SizedBox(
            height: 20,
            child: Center(
              child: Text(
                _formatDateLabel(item.label),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: context.colors.textSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
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
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.colors.border),
        ),
        alignment: Alignment.center,
        child: Text(
          'No payment transactions recorded in this period',
          style: TextStyle(fontSize: 12, color: context.colors.textSecondary),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Methods Breakdown',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: context.colors.textPrimary,
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
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: context.colors.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '₹${item.amount.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: context.colors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '(${item.count} tx • ${item.percentage.toStringAsFixed(1)}%)',
                        style: TextStyle(
                          fontSize: 11,
                          color: context.colors.textSecondary,
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
