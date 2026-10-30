import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../patients/models/patient.dart';
import '../models/differential_evaluation_models.dart';
import '../models/doctor_extraction_review.dart';
import '../models/structured_clinical_extraction.dart';
import '../widgets/clinical_assessment_section.dart';
import '../widgets/clinical_finding_card.dart';
import '../widgets/unmapped_expressions_section.dart';
import 'differential_diagnosis_screen.dart';

/// Screen allowing clinicians to review, override, and approve structured clinical
/// extraction findings before inserting them into a consultation note.
///
/// Safety & Architectural Invariants:
/// - Human-in-the-loop review is mandatory before clinical findings can be applied.
/// - Original backend extraction result is strictly immutable.
/// - Doctor decisions (PRESENT, ABSENT, UNCERTAIN, EXCLUDE) are tracked separately.
/// - NOT_ASSESSED examinations are explicitly documented as omitted/deferred and NEVER marked normal.
/// - Quarantined subjective sensations (e.g. chills) are NEVER converted to Fever.
/// - Does not generate diagnoses, prescriptions, or finalize consultations automatically.
class StructuredExtractionReviewScreen extends StatefulWidget {
  final Patient patient;
  final StructuredClinicalExtractionResult extractionResult;
  final String sourceTranscript;

  const StructuredExtractionReviewScreen({
    super.key,
    required this.patient,
    required this.extractionResult,
    required this.sourceTranscript,
  });

  @override
  State<StructuredExtractionReviewScreen> createState() =>
      _StructuredExtractionReviewScreenState();
}

class _StructuredExtractionReviewScreenState
    extends State<StructuredExtractionReviewScreen> {
  // Map of findingId -> Doctor Review Decision
  late final Map<String, FindingReviewDecision> _decisions;

  // Inclusions for assessments and unmapped expressions
  late final Map<String, bool> _assessmentInclusions;
  late final Map<String, bool> _unmappedInclusions;

  DoctorDifferentialReviewResult? _differentialResult;

  bool _isTranscriptExpanded = false;

  @override
  void initState() {
    super.initState();
    _decisions = <String, FindingReviewDecision>{};
    for (final finding in widget.extractionResult.findings) {
      _decisions[finding.id] = FindingReviewDecision.fromFinding(finding);
    }

    _assessmentInclusions = <String, bool>{
      for (final a in widget.extractionResult.clinicalAssessments) a.id: true,
    };

    _unmappedInclusions = <String, bool>{
      for (final u in widget.extractionResult.unmappedExpressions) u.expression: true,
    };
  }

  void _onFindingDecisionChanged(String findingId, FindingReviewDecision newDecision) {
    setState(() {
      _decisions[findingId] = newDecision;
    });
  }

  void _onAssessmentInclusionChanged(String assessmentId, bool included) {
    setState(() {
      _assessmentInclusions[assessmentId] = included;
    });
  }

  void _onUnmappedInclusionChanged(String expression, bool included) {
    setState(() {
      _unmappedInclusions[expression] = included;
    });
  }

  Future<void> _openDifferentialDiagnosis() async {
    final findings = <DifferentialFindingInput>[];
    for (final f in widget.extractionResult.findings) {
      final dec = _decisions[f.id];
      if (dec != null && !dec.isExcluded) {
        EvaluationFindingStatus status;
        switch (dec.effectiveStatus) {
          case ClinicalFindingStatus.present:
            status = EvaluationFindingStatus.present;
            break;
          case ClinicalFindingStatus.absent:
            status = EvaluationFindingStatus.absent;
            break;
          case ClinicalFindingStatus.uncertain:
            status = EvaluationFindingStatus.uncertain;
            break;
          case ClinicalFindingStatus.unknown:
            status = EvaluationFindingStatus.unknown;
            break;
        }

        int? durationDays;
        if (f.temporalStatements.isNotEmpty) {
          final dur = f.temporalStatements.first.duration;
          if (dur != null && dur.unit != null && dur.value != null) {
            final unit = dur.unit!.toLowerCase();
            final val = dur.value!.toInt();
            if (unit.contains('day')) {
              durationDays = val;
            } else if (unit.contains('week')) {
              durationDays = val * 7;
            } else if (unit.contains('month')) {
              durationDays = val * 30;
            }
          }
        }

        findings.add(
          DifferentialFindingInput(
            canonicalTerm: f.canonicalDisplayName.isNotEmpty
                ? f.canonicalDisplayName
                : f.canonicalTermId,
            conceptId: f.canonicalTermId,
            status: status,
            durationDays: durationDays,
            severity: f.severityAssessment.level?.value,
            bodyLocation: f.bodyLocation.name,
          ),
        );
      }
    }

    final assessments = <DifferentialAssessmentInput>[];
    for (final a in widget.extractionResult.clinicalAssessments) {
      if (_assessmentInclusions[a.id] == true) {
        assessments.add(
          DifferentialAssessmentInput(
            examination: a.targetSystemOrExam,
            status: a.status == ClinicalAssessmentStatus.notAssessed
                ? AssessmentStatus.notAssessed
                : AssessmentStatus.deferred,
            reason: a.reason,
          ),
        );
      }
    }

    final result = await Navigator.of(context).push<DoctorDifferentialReviewResult>(
      MaterialPageRoute(
        builder: (_) => DifferentialDiagnosisScreen(
          patient: widget.patient,
          initialFindings: findings,
          initialInfectionSuspicion: InfectionSuspicionState.unknown,
          initialAssessments: assessments.isNotEmpty ? assessments : null,
        ),
      ),
    );

    if (result != null && mounted) {
      setState(() {
        _differentialResult = result;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.primaryDiagnosis != null
                ? 'Primary Diagnosis: ${result.primaryDiagnosis!.conditionDisplayName}'
                : '${result.differentialDiagnoses.length} differential diagnoses confirmed',
          ),
          backgroundColor: AppTheme.accentTeal,
        ),
      );
    }
  }

  Future<void> _onInsertIntoConsultation() async {
    final formattedResult = ClinicalExtractionConsultationFormatter.format(
      extractionResult: widget.extractionResult,
      findingDecisions: _decisions,
      assessmentInclusions: _assessmentInclusions,
      unmappedInclusions: _unmappedInclusions,
      differentialResult: _differentialResult,
    );

    // Show insertion preview confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Row(
          children: [
            Icon(Icons.rate_review_rounded, color: AppTheme.accentTeal),
            SizedBox(width: 8),
            Text(
              'Confirm Insertion',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'The following formatted clinical text will be inserted into your consultation note:',
                  style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 12),
                const Text(
                  'SYMPTOMS & HISTORY:',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.primaryNavy),
                ),
                const SizedBox(height: 4),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderGray),
                  ),
                  child: Text(
                    formattedResult.formattedSymptoms,
                    style: const TextStyle(fontSize: 12, height: 1.4),
                  ),
                ),
                if (formattedResult.formattedExamination.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'EXAMINATION & ASSESSMENTS:',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.primaryNavy),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.backgroundLight,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.borderGray),
                    ),
                    child: Text(
                      formattedResult.formattedExamination,
                      style: const TextStyle(fontSize: 12, height: 1.4),
                    ),
                  ),
                ],
                if (formattedResult.formattedDiagnosis != null &&
                    formattedResult.formattedDiagnosis!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'CLINICAL DIAGNOSIS:',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.accentTeal),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.accentTeal.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.accentTeal.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      formattedResult.formattedDiagnosis!,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primaryNavy),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, size: 14, color: AppTheme.primaryNavy),
                      SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Draft Note Safeguard: Consultation remains in DRAFT. No prescription or diagnosis will be finalized automatically.',
                          style: TextStyle(fontSize: 11, color: AppTheme.primaryNavy),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Back to Review', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.accentTeal,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm & Insert', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.of(context).pop<ClinicalExtractionFormattingResult>(formattedResult);
    }
  }

  Future<void> _onDiscard() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('Discard Structured Extraction?'),
        content: const Text(
          'Are you sure you want to discard these structured findings? You will return to the transcript editor.',
          style: TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep Reviewing', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Discard', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.of(context).pop<ClinicalExtractionFormattingResult?>(null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final findings = widget.extractionResult.findings;
    int presentCount = 0;
    int absentCount = 0;
    int uncertainCount = 0;
    int excludedCount = 0;

    for (final decision in _decisions.values) {
      if (decision.isExcluded) {
        excludedCount++;
      } else {
        switch (decision.effectiveStatus) {
          case ClinicalFindingStatus.present:
            presentCount++;
            break;
          case ClinicalFindingStatus.absent:
            absentCount++;
            break;
          case ClinicalFindingStatus.uncertain:
            uncertainCount++;
            break;
          case ClinicalFindingStatus.unknown:
            break;
        }
      }
    }

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text(
          'Review Clinical Findings',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: _onDiscard,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.close_rounded, color: AppTheme.errorRed),
            tooltip: 'Discard Extraction',
            onPressed: _onDiscard,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Patient Demographics Banner
              _buildPatientBanner(),
              const SizedBox(height: 12),

              // 2. Source Transcript Card
              _buildTranscriptCard(),
              const SizedBox(height: 12),

              // 3. Extraction Summary Badges
              _buildSummaryRow(
                total: findings.length,
                present: presentCount,
                absent: absentCount,
                uncertain: uncertainCount,
                excluded: excludedCount,
                assessments: widget.extractionResult.clinicalAssessments.length,
                unmapped: widget.extractionResult.unmappedExpressions.length,
              ),
              const SizedBox(height: 16),

              // Section Title: Findings
              Row(
                children: [
                  const Icon(Icons.playlist_add_check_rounded, color: AppTheme.accentTeal, size: 22),
                  const SizedBox(width: 8),
                  Text(
                    'Extracted Findings (${findings.length})',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Review each extracted symptom. Override status or exclude findings as clinically appropriate.',
                style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 12),

              // 4. Clinical Finding Cards
              if (findings.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.borderGray),
                  ),
                  child: const Center(
                    child: Text(
                      'No clinical findings extracted from this transcript.',
                      style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                    ),
                  ),
                )
              else
                ...findings.map((finding) {
                  final decision = _decisions[finding.id]!;
                  return ClinicalFindingCard(
                    finding: finding,
                    sourceText: widget.sourceTranscript,
                    decision: decision,
                    onDecisionChanged: (newDecision) => _onFindingDecisionChanged(finding.id, newDecision),
                  );
                }),

              // 5. Clinical Assessments Section (NOT_ASSESSED / Deferred)
              ClinicalAssessmentSection(
                assessments: widget.extractionResult.clinicalAssessments,
                sourceText: widget.sourceTranscript,
                inclusions: _assessmentInclusions,
                onToggleInclusion: _onAssessmentInclusionChanged,
              ),

              // 6. Unmapped Expressions Section (Quarantined Sensations)
              UnmappedExpressionsSection(
                expressions: widget.extractionResult.unmappedExpressions,
                sourceText: widget.sourceTranscript,
                inclusions: _unmappedInclusions,
                onToggleInclusion: _onUnmappedInclusionChanged,
              ),

              const SizedBox(height: 12),

              // 7. Assistive Differential Diagnosis Action Button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.primaryNavy,
                    side: const BorderSide(color: AppTheme.accentTeal, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                  onPressed: _openDifferentialDiagnosis,
                  icon: const Icon(Icons.biotech_outlined, color: AppTheme.accentTeal),
                  label: Text(
                    _differentialResult != null
                        ? 'Differential: ${_differentialResult!.primaryDiagnosis?.conditionDisplayName ?? "${_differentialResult!.differentialDiagnoses.length} Selected"}'
                        : 'Evaluate Differential Diagnosis',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // 8. Primary Action Button: Insert into Consultation
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.accentTeal,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 2,
                  ),
                  onPressed: _onInsertIntoConsultation,
                  icon: const Icon(Icons.check_circle_rounded),
                  label: const Text(
                    'Insert into Consultation',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Discard Action Button
              Center(
                child: TextButton.icon(
                  style: TextButton.styleFrom(foregroundColor: AppTheme.errorRed),
                  onPressed: _onDiscard,
                  icon: const Icon(Icons.close_rounded, size: 18),
                  label: const Text('Discard Structured Extraction'),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPatientBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderGray),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppTheme.primaryNavy,
            child: Text(
              widget.patient.fullName.isNotEmpty ? widget.patient.fullName[0].toUpperCase() : 'P',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.patient.fullName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'UHID: ${widget.patient.uhid} • ${widget.patient.gender} • Age: ${widget.patient.age ?? "N/A"}',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.verified_rounded, size: 13, color: Colors.green),
                SizedBox(width: 4),
                Text(
                  'CONSENT OK',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Colors.green,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTranscriptCard() {
    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.borderGray),
      ),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () {
                setState(() {
                  _isTranscriptExpanded = !_isTranscriptExpanded;
                });
              },
              child: Row(
                children: [
                  const Icon(Icons.record_voice_over_rounded, size: 18, color: AppTheme.primaryNavy),
                  const SizedBox(width: 8),
                  const Text(
                    'Confirmed Source Transcript',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.backgroundLight,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: AppTheme.borderGray),
                    ),
                    child: Text(
                      '${widget.sourceTranscript.length} chars',
                      style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _isTranscriptExpanded ? Icons.expand_less : Icons.expand_more,
                    size: 20,
                    color: AppTheme.textSecondary,
                  ),
                ],
              ),
            ),
            if (_isTranscriptExpanded) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.sourceTranscript,
                  style: const TextStyle(fontSize: 13, height: 1.4, color: AppTheme.primaryNavy),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow({
    required int total,
    required int present,
    required int absent,
    required int uncertain,
    required int excluded,
    required int assessments,
    required int unmapped,
  }) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        _buildStatBadge('Total', total.toString(), Colors.blueGrey),
        _buildStatBadge('Present', present.toString(), Colors.green),
        _buildStatBadge('Absent', absent.toString(), Colors.red),
        if (uncertain > 0) _buildStatBadge('Uncertain', uncertain.toString(), Colors.orange),
        if (excluded > 0) _buildStatBadge('Excluded', excluded.toString(), Colors.grey),
        if (assessments > 0) _buildStatBadge('Assessments', assessments.toString(), Colors.purple),
        if (unmapped > 0) _buildStatBadge('Unmapped', unmapped.toString(), Colors.amber.shade800),
      ],
    );
  }

  Widget _buildStatBadge(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$label: ',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
