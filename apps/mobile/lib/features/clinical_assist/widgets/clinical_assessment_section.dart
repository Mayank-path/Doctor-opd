import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/structured_clinical_extraction.dart';

/// Widget rendering unperformed or deferred clinical examinations with inclusion checkboxes.
class ClinicalAssessmentSection extends StatelessWidget {
  final List<ClinicalAssessmentRecord> assessments;
  final String sourceText;
  final Map<String, bool> inclusions;
  final void Function(String assessmentId, bool isIncluded) onToggleInclusion;

  const ClinicalAssessmentSection({
    super.key,
    required this.assessments,
    required this.sourceText,
    required this.inclusions,
    required this.onToggleInclusion,
  });

  @override
  Widget build(BuildContext context) {
    if (assessments.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        Row(
          children: [
            const Icon(Icons.do_not_disturb_on_outlined, size: 18, color: Colors.blueGrey),
            const SizedBox(width: 6),
            const Text(
              'Unperformed / Deferred Clinical Examinations',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const Spacer(),
            Text(
              '(${assessments.length})',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF3C7), // Light Amber
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFFFDE68A)),
          ),
          child: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFB45309)),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'NOT ASSESSED indicates the exam was documented as omitted. It must never be recorded as normal or negative.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF92400E), height: 1.3),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        for (final assessment in assessments) _buildAssessmentCard(context, assessment),
      ],
    );
  }

  Widget _buildAssessmentCard(BuildContext context, ClinicalAssessmentRecord assessment) {
    final isIncluded = inclusions[assessment.id] ?? false;
    final isVerified = assessment.evidence.isSliceVerified(sourceText);

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(
          color: isIncluded ? AppTheme.accentTeal.withValues(alpha: 0.5) : Colors.grey.shade300,
          width: isIncluded ? 1.5 : 1,
        ),
      ),
      color: isIncluded ? const Color(0xFFF0FDFA) : Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: isIncluded,
              activeColor: AppTheme.accentTeal,
              onChanged: (val) => onToggleInclusion(assessment.id, val ?? false),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          assessment.targetSystemOrExam,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.blueGrey.shade100,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          assessment.status.value,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.blueGrey.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Scope: ${assessment.assessmentScope}${assessment.reason != null ? ' • Reason: ${assessment.reason}' : ''}',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        isVerified ? Icons.check_circle_outline : Icons.info_outline,
                        size: 12,
                        color: isVerified ? Colors.teal : Colors.amber.shade800,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Evidence: "${assessment.evidence.text}"',
                          style: TextStyle(
                            fontSize: 11,
                            fontStyle: FontStyle.italic,
                            color: Colors.grey.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

