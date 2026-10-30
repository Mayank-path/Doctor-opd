import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/doctor_extraction_review.dart';
import '../models/structured_clinical_extraction.dart';

/// Card widget rendering an individual extracted clinical finding with doctor review controls.
class ClinicalFindingCard extends StatelessWidget {
  final StructuredClinicalFinding finding;
  final String sourceText;
  final FindingReviewDecision decision;
  final ValueChanged<FindingReviewDecision> onDecisionChanged;

  const ClinicalFindingCard({
    super.key,
    required this.finding,
    required this.sourceText,
    required this.decision,
    required this.onDecisionChanged,
  });

  Color _getStatusColor(ClinicalFindingStatus status) {
    switch (status) {
      case ClinicalFindingStatus.present:
        return const Color(0xFF059669); // Emerald Green
      case ClinicalFindingStatus.absent:
        return const Color(0xFFDC2626); // Rose Red
      case ClinicalFindingStatus.uncertain:
        return const Color(0xFFD97706); // Amber
      case ClinicalFindingStatus.unknown:
        return const Color(0xFF6B7280); // Slate Grey
    }
  }

  @override
  Widget build(BuildContext context) {
    final isExcluded = decision.isExcluded;
    final activeStatus = decision.finalStatus;
    final isOverridden = !isExcluded && activeStatus != finding.status;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      elevation: isExcluded ? 0 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isExcluded
              ? Colors.grey.shade300
              : isOverridden
                  ? AppTheme.accentTeal.withValues(alpha: 0.7)
                  : Colors.grey.shade200,
          width: isOverridden ? 1.5 : 1,
        ),
      ),
      color: isExcluded ? const Color(0xFFF9FAFB) : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Header: Canonical Name & Badges
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        finding.canonicalDisplayName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isExcluded ? AppTheme.textSecondary : AppTheme.textPrimary,
                          decoration: isExcluded ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'ID: ${finding.canonicalTermId} • Expression: "${finding.originalExpression}"',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                // Status Badge
                if (isExcluded)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'EXCLUDED',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Colors.grey,
                      ),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(activeStatus).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: _getStatusColor(activeStatus).withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _getStatusColor(activeStatus),
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          activeStatus.value,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: _getStatusColor(activeStatus),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),

            if (isOverridden) ...[
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.accentTeal.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Overridden by Doctor (Extracted: ${finding.status.value} -> Final: ${activeStatus.value})',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.accentTeal,
                  ),
                ),
              ),
            ],

            const Divider(height: 18),

            // 2. Clinical Attributes (Severity, Duration, Location)
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                // Severity Chip
                if (finding.severityAssessment.state == SeverityAssessmentState.assessed &&
                    finding.severityAssessment.level != null)
                  _buildAttributeChip(
                    icon: Icons.speed_rounded,
                    label: 'Severity: ${finding.severityAssessment.level!.value}',
                    color: Colors.deepOrange,
                  )
                else if (finding.severityAssessment.state ==
                    SeverityAssessmentState.explicitlyUnclear)
                  _buildAttributeChip(
                    icon: Icons.help_outline_rounded,
                    label: 'Severity: Unclear in source',
                    color: Colors.amber.shade800,
                  )
                else
                  _buildAttributeChip(
                    icon: Icons.remove_circle_outline_rounded,
                    label: 'Severity: Not mentioned',
                    color: Colors.grey.shade600,
                  ),

                // Duration Chip
                if (finding.temporalStatements.isNotEmpty &&
                    finding.temporalStatements.first.duration != null)
                  _buildAttributeChip(
                    icon: Icons.timer_outlined,
                    label: 'Duration: ${finding.temporalStatements.first.duration!.raw}',
                    color: Colors.blue.shade700,
                  ),

                // Body Location Chip
                if (finding.bodyLocation.name != null &&
                    finding.bodyLocation.name!.isNotEmpty)
                  _buildAttributeChip(
                    icon: Icons.accessibility_new_rounded,
                    label: 'Location: ${finding.bodyLocation.name}',
                    color: Colors.indigo.shade600,
                  ),

                // Certainty Chip
                _buildAttributeChip(
                  icon: Icons.verified_outlined,
                  label: 'Certainty: ${finding.certainty}',
                  color: Colors.teal.shade700,
                ),
              ],
            ),

            // 3. Temporal History & Chronological Transitions
            if (finding.chronologicalRelationships.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.timeline_rounded, size: 14, color: AppTheme.primaryNavy),
                        SizedBox(width: 4),
                        Text(
                          'Temporal Progression / Transitions:',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    for (final rel in finding.chronologicalRelationships)
                      Padding(
                        padding: const EdgeInsets.only(left: 6, top: 2),
                        child: Text(
                          '• ${rel.transitionType.value}: "${rel.evidence.text}" (Confidence: ${rel.confidence})',
                          style: TextStyle(
                            fontSize: 12,
                            color: rel.transitionType == ChronologicalTransitionType.ambiguous
                                ? Colors.amber.shade900
                                : Colors.black87,
                            fontWeight: rel.transitionType == ChronologicalTransitionType.ambiguous
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],

            // 4. Evidence Span Validation
            const SizedBox(height: 10),
            _buildEvidenceDisplay(context),

            // 5. Validation Warnings
            if (finding.validationWarnings.isNotEmpty) ...[
              const SizedBox(height: 8),
              for (final warning in finding.validationWarnings)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 14, color: Colors.amber),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          warning,
                          style: TextStyle(fontSize: 11, color: Colors.amber.shade900),
                        ),
                      ),
                    ],
                  ),
                ),
            ],

            const SizedBox(height: 12),

            // 6. Doctor Decision Controls
            Row(
              children: [
                const Text(
                  'Doctor Decision:',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                if (finding.status == ClinicalFindingStatus.unknown && !isExcluded)
                  const Text(
                    'Requires resolution',
                    style: TextStyle(fontSize: 11, color: Colors.red, fontWeight: FontWeight.w600),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _buildDecisionChoiceChip(
                  label: 'Present',
                  status: ClinicalFindingStatus.present,
                  isSelected: !isExcluded && activeStatus == ClinicalFindingStatus.present,
                  activeColor: const Color(0xFF059669),
                  onSelected: () => onDecisionChanged(
                    decision.copyWith(
                      finalStatus: ClinicalFindingStatus.present,
                      decisionType: finding.status == ClinicalFindingStatus.present
                          ? DoctorDecisionType.approvedAsExtracted
                          : DoctorDecisionType.statusOverridden,
                    ),
                  ),
                ),
                _buildDecisionChoiceChip(
                  label: 'Absent',
                  status: ClinicalFindingStatus.absent,
                  isSelected: !isExcluded && activeStatus == ClinicalFindingStatus.absent,
                  activeColor: const Color(0xFFDC2626),
                  onSelected: () => onDecisionChanged(
                    decision.copyWith(
                      finalStatus: ClinicalFindingStatus.absent,
                      decisionType: finding.status == ClinicalFindingStatus.absent
                          ? DoctorDecisionType.approvedAsExtracted
                          : DoctorDecisionType.statusOverridden,
                    ),
                  ),
                ),
                _buildDecisionChoiceChip(
                  label: 'Uncertain',
                  status: ClinicalFindingStatus.uncertain,
                  isSelected: !isExcluded && activeStatus == ClinicalFindingStatus.uncertain,
                  activeColor: const Color(0xFFD97706),
                  onSelected: () => onDecisionChanged(
                    decision.copyWith(
                      finalStatus: ClinicalFindingStatus.uncertain,
                      decisionType: finding.status == ClinicalFindingStatus.uncertain
                          ? DoctorDecisionType.approvedAsExtracted
                          : DoctorDecisionType.statusOverridden,
                    ),
                  ),
                ),
                _buildDecisionChoiceChip(
                  label: 'Exclude',
                  status: activeStatus,
                  isSelected: isExcluded,
                  activeColor: Colors.grey.shade700,
                  onSelected: () => onDecisionChanged(
                    decision.copyWith(
                      decisionType: isExcluded
                          ? DoctorDecisionType.approvedAsExtracted
                          : DoctorDecisionType.excludedByDoctor,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttributeChip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEvidenceDisplay(BuildContext context) {
    EvidenceSpan? primarySpan;
    if (finding.temporalStatements.isNotEmpty) {
      primarySpan = finding.temporalStatements.first.evidence;
    } else if (finding.provenance.isNotEmpty) {
      primarySpan = finding.provenance.first.evidence;
    }

    if (primarySpan == null) return const SizedBox.shrink();

    final isVerified = primarySpan.isSliceVerified(sourceText);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Row(
        children: [
          Icon(
            isVerified ? Icons.check_circle_outline_rounded : Icons.warning_amber_rounded,
            size: 13,
            color: isVerified ? Colors.teal : Colors.amber.shade800,
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              'Evidence: "${primarySpan.text}" [Offsets: ${primarySpan.startIndex ?? '?'}-${primarySpan.endIndex ?? '?'}]',
              style: TextStyle(
                fontSize: 11,
                fontFamily: 'monospace',
                color: Colors.grey.shade800,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDecisionChoiceChip({
    required String label,
    required ClinicalFindingStatus status,
    required bool isSelected,
    required Color activeColor,
    required VoidCallback onSelected,
  }) {
    return InkWell(
      onTap: onSelected,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : Colors.white,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? activeColor : Colors.grey.shade300,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : Colors.grey.shade800,
          ),
        ),
      ),
    );
  }
}
