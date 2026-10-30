import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../models/differential_evaluation_models.dart';

/// Reusable badge displaying the deterministic AST match tier for a candidate diagnosis.
class DifferentialMatchTierBadge extends StatelessWidget {
  final DifferentialMatchTier? tier;
  final bool compact;

  const DifferentialMatchTierBadge({
    super.key,
    required this.tier,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, border, fg, icon) = _styleForTier(tier);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: compact ? 12 : 14, color: fg),
          const SizedBox(width: 4),
          Text(
            tier?.displayName ?? 'Unranked',
            style: TextStyle(
              fontSize: compact ? 11 : 12,
              fontWeight: FontWeight.w700,
              color: fg,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }

  (Color, Color, Color, IconData) _styleForTier(DifferentialMatchTier? tier) {
    switch (tier) {
      case DifferentialMatchTier.strongMatch:
        return (
          const Color(0xFF065F46).withValues(alpha: 0.12),
          const Color(0xFF059669),
          const Color(0xFF065F46),
          Icons.verified_rounded,
        );
      case DifferentialMatchTier.moderateMatch:
        return (
          const Color(0xFF0284C7).withValues(alpha: 0.12),
          const Color(0xFF0284C7),
          const Color(0xFF0369A1),
          Icons.check_circle_outline_rounded,
        );
      case DifferentialMatchTier.possibleMatch:
        return (
          const Color(0xFFD97706).withValues(alpha: 0.12),
          const Color(0xFFD97706),
          const Color(0xFFB45309),
          Icons.help_outline_rounded,
        );
      case DifferentialMatchTier.contradicted:
        return (
          AppTheme.errorRed.withValues(alpha: 0.12),
          AppTheme.errorRed,
          AppTheme.errorRed,
          Icons.cancel_outlined,
        );
      case DifferentialMatchTier.unmatched:
      case null:
        return (
          AppTheme.surfaceMuted,
          AppTheme.borderSubtle,
          AppTheme.textMuted,
          Icons.remove_circle_outline_rounded,
        );
    }
  }
}

