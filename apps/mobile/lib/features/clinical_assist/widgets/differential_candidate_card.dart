import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../models/differential_evaluation_models.dart';
import 'differential_match_tier_badge.dart';

/// Interactive card presenting a candidate condition from deterministic AST evaluation.
/// Allows attending physician to review evidence, missing assessments, and assign a clinical decision.
class DifferentialCandidateCard extends StatefulWidget {
  final ConditionCandidateMatch candidate;
  final DoctorCandidateAction? selectedAction;
  final ValueChanged<DoctorCandidateAction?> onActionSelected;

  const DifferentialCandidateCard({
    super.key,
    required this.candidate,
    required this.selectedAction,
    required this.onActionSelected,
  });

  @override
  State<DifferentialCandidateCard> createState() => _DifferentialCandidateCardState();
}

class _DifferentialCandidateCardState extends State<DifferentialCandidateCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.candidate;
    final isContradicted = c.tier == DifferentialMatchTier.contradicted;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: widget.selectedAction != null
              ? _borderColorForAction(widget.selectedAction!)
              : isContradicted
                  ? AppTheme.errorRed.withValues(alpha: 0.3)
                  : AppTheme.borderSubtle,
          width: widget.selectedAction != null ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Header Row
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.conditionDisplayName,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: isContradicted
                                  ? AppTheme.errorRed
                                  : AppTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${c.category} • Rule: ${c.ruleTitle}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    DifferentialMatchTierBadge(tier: c.tier),
                  ],
                ),

                const SizedBox(height: 10),

                // Rationale Snippet
                Text(
                  c.rationale,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textSecondary,
                    height: 1.35,
                  ),
                ),

                // Suggested Investigations Chips if present
                if (c.suggestedInvestigations.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      const Text(
                        'Investigations: ',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      ...c.suggestedInvestigations.map(
                        (inv) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.indigo.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: Colors.indigo.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Text(
                            inv,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Colors.indigo,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // 2. Expandable Criteria / Evidence / Missing Section
          if (_isExpanded) ...[
            const Divider(height: 1),
            Container(
              color: AppTheme.backgroundLight,
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Mandatory Criterion
                  if (c.mandatoryResult != null) ...[
                    _buildCriterionRow(
                      label: 'Mandatory Criterion',
                      detail: c.mandatoryResult!,
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Major Supporting Criteria
                  if (c.majorSupportingResults.isNotEmpty) ...[
                    Text(
                      'Major Supporting Criteria (${c.majorSupportingMatchedCount}/${c.minMajorCount} required matched):',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ...c.majorSupportingResults.map(
                      (d) => _buildDetailItem(d),
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Minor Supporting Criteria
                  if (c.minorSupportingResults.isNotEmpty) ...[
                    const Text(
                      'Minor Supporting Criteria:',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ...c.minorSupportingResults.map(
                      (d) => _buildDetailItem(d),
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Contradiction Criteria
                  if (c.contradictionResults.isNotEmpty) ...[
                    Text(
                      'Contradiction Criteria${c.contradictionTriggered ? ' (TRIGGERED)' : ''}:',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: c.contradictionTriggered
                            ? AppTheme.errorRed
                            : AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ...c.contradictionResults.map(
                      (d) => _buildDetailItem(d, isContradiction: true),
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Missing Information Alerts
                  if (c.missingInformation.isNotEmpty) ...[
                    Text(
                      'Missing Information (${c.missingInformation.length}):',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.warningAmber,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ...c.missingInformation.map((m) => Container(
                          margin: const EdgeInsets.only(bottom: 4),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.amber.shade200),
                          ),
                          child: Text(
                            '• ${m.prompt} (${m.reason})',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.amber.shade900,
                            ),
                          ),
                        )),
                    const SizedBox(height: 8),
                  ],

                  // Unperformed Assessments Alerts
                  if (c.unperformedAssessments.isNotEmpty) ...[
                    Text(
                      'Unperformed Assessments (${c.unperformedAssessments.length}):',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Colors.blueGrey.shade800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ...c.unperformedAssessments.map((u) => Container(
                          margin: const EdgeInsets.only(bottom: 4),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.blueGrey.shade50,
                            borderRadius: BorderRadius.circular(4),
                            border:
                                Border.all(color: Colors.blueGrey.shade200),
                          ),
                          child: Text(
                            '• ${u.examination}: ${u.prompt} (${u.reason})',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.blueGrey.shade900,
                            ),
                          ),
                        )),
                  ],
                ],
              ),
            ),
          ],

          // Expand / Collapse Toggle Button
          InkWell(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 6),
              alignment: Alignment.center,
              color: AppTheme.surfaceMuted.withValues(alpha: 0.5),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _isExpanded ? 'Hide Evidence Details' : 'View Evidence Details',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.accentTeal,
                    ),
                  ),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 16,
                    color: AppTheme.accentTeal,
                  ),
                ],
              ),
            ),
          ),

          const Divider(height: 1),

          // 3. Doctor Action Buttons
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Doctor Clinical Decision:',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _buildActionButton(
                      label: 'Primary',
                      action: DoctorCandidateAction.acceptedAsPrimary,
                      color: AppTheme.accentTeal,
                      icon: Icons.star_rounded,
                    ),
                    _buildActionButton(
                      label: 'Differential',
                      action: DoctorCandidateAction.acceptedAsDifferential,
                      color: const Color(0xFF0284C7),
                      icon: Icons.add_circle_outline_rounded,
                    ),
                    _buildActionButton(
                      label: 'Investigate',
                      action: DoctorCandidateAction.deferredForInvestigation,
                      color: Colors.purple.shade700,
                      icon: Icons.biotech_outlined,
                    ),
                    _buildActionButton(
                      label: 'Reject',
                      action: DoctorCandidateAction.rejected,
                      color: AppTheme.errorRed,
                      icon: Icons.close_rounded,
                    ),
                    if (widget.selectedAction != null)
                      IconButton(
                        tooltip: 'Clear decision',
                        icon: const Icon(Icons.clear, size: 16),
                        onPressed: () => widget.onActionSelected(null),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required String label,
    required DoctorCandidateAction action,
    required Color color,
    required IconData icon,
  }) {
    final isSelected = widget.selectedAction == action;

    return InkWell(
      onTap: () {
        if (isSelected) {
          widget.onActionSelected(null);
        } else {
          widget.onActionSelected(action);
        }
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? color : color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? color : color.withValues(alpha: 0.3),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 13,
              color: isSelected ? Colors.white : color,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: isSelected ? Colors.white : color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCriterionRow({
    required String label,
    required CriterionDetail detail,
  }) {
    final isSatisfied = detail.satisfied;
    final color = isSatisfied ? AppTheme.successGreen : AppTheme.errorRed;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          isSatisfied ? Icons.check_circle_rounded : Icons.cancel_rounded,
          size: 14,
          color: color,
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$label: ${detail.result}',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
              Text(
                detail.explanation,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDetailItem(
    CriterionDetail d, {
    bool isContradiction = false,
  }) {
    final isSatisfied = d.satisfied;
    final color = isContradiction
        ? (isSatisfied ? AppTheme.errorRed : AppTheme.textSecondary)
        : (isSatisfied ? AppTheme.successGreen : AppTheme.textSecondary);

    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isSatisfied ? Icons.check : Icons.circle_outlined,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '${d.result}: ${d.explanation}',
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: isSatisfied ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _borderColorForAction(DoctorCandidateAction action) {
    switch (action) {
      case DoctorCandidateAction.acceptedAsPrimary:
        return AppTheme.accentTeal;
      case DoctorCandidateAction.acceptedAsDifferential:
        return const Color(0xFF0284C7);
      case DoctorCandidateAction.deferredForInvestigation:
        return Colors.purple.shade700;
      case DoctorCandidateAction.rejected:
        return AppTheme.errorRed;
    }
  }
}

