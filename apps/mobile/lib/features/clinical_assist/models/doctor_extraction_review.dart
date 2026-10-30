import 'package:flutter/foundation.dart';
import 'differential_evaluation_models.dart';
import 'structured_clinical_extraction.dart';

/// Doctor decision type on an extracted clinical finding.
enum DoctorDecisionType {
  approvedAsExtracted,
  statusOverridden,
  excludedByDoctor,
}

/// Clinician's review decision on an individual extracted finding.
/// Note: The original backend extraction result remains immutable; decisions are tracked separately.
@immutable
class FindingReviewDecision {
  final String findingId;
  final ClinicalFindingStatus originalStatus;
  final ClinicalFindingStatus finalStatus;
  final DoctorDecisionType decisionType;
  final String? doctorNote;

  const FindingReviewDecision({
    required this.findingId,
    required this.originalStatus,
    required this.finalStatus,
    required this.decisionType,
    this.doctorNote,
  });

  factory FindingReviewDecision.fromFinding(StructuredClinicalFinding finding) {
    return FindingReviewDecision(
      findingId: finding.id,
      originalStatus: finding.status,
      finalStatus: finding.status,
      decisionType: DoctorDecisionType.approvedAsExtracted,
    );
  }

  bool get isExcluded => decisionType == DoctorDecisionType.excludedByDoctor;

  ClinicalFindingStatus get effectiveStatus => finalStatus;

  FindingReviewDecision copyWith({
    ClinicalFindingStatus? finalStatus,
    DoctorDecisionType? decisionType,
    String? doctorNote,
  }) {
    return FindingReviewDecision(
      findingId: findingId,
      originalStatus: originalStatus,
      finalStatus: finalStatus ?? this.finalStatus,
      decisionType: decisionType ?? this.decisionType,
      doctorNote: doctorNote ?? this.doctorNote,
    );
  }
}

/// Formatted consultation prefill payload ready for clinical draft insertion.
@immutable
class ClinicalExtractionFormattingResult {
  final String formattedSymptoms;
  final String formattedExamination;
  final int includedFindingsCount;
  final int excludedFindingsCount;
  final int includedAssessmentsCount;
  final int includedUnmappedCount;
  final String? formattedDiagnosis;
  final DoctorDifferentialReviewResult? differentialResult;

  const ClinicalExtractionFormattingResult({
    required this.formattedSymptoms,
    required this.formattedExamination,
    required this.includedFindingsCount,
    required this.excludedFindingsCount,
    required this.includedAssessmentsCount,
    required this.includedUnmappedCount,
    this.formattedDiagnosis,
    this.differentialResult,
  });
}

/// Pure Dart category-aware and status-aware clinical formatter.
/// Safely formats reviewed structured findings into documentation-ready consultation text.
class ClinicalExtractionConsultationFormatter {
  /// Formats reviewed structured findings and assessments into consultation draft sections.
  static ClinicalExtractionFormattingResult format({
    required StructuredClinicalExtractionResult extractionResult,
    required Map<String, FindingReviewDecision> findingDecisions,
    required Map<String, bool> assessmentInclusions,
    required Map<String, bool> unmappedInclusions,
    DoctorDifferentialReviewResult? differentialResult,
  }) {
    final symptomBuffer = StringBuffer();
    final examBuffer = StringBuffer();

    int includedFindings = 0;
    int excludedFindings = 0;
    int includedAssessments = 0;
    int includedUnmapped = 0;

    // 1. Process Findings (Symptoms)
    final presentLines = <String>[];
    final absentLines = <String>[];
    final uncertainLines = <String>[];
    final unknownLines = <String>[];

    for (final finding in extractionResult.findings) {
      final decision = findingDecisions[finding.id] ??
          FindingReviewDecision(
            findingId: finding.id,
            originalStatus: finding.status,
            finalStatus: finding.status,
            decisionType: DoctorDecisionType.approvedAsExtracted,
          );

      if (decision.isExcluded) {
        excludedFindings++;
        continue;
      }

      includedFindings++;
      final status = decision.finalStatus;
      final buffer = StringBuffer();

      // Display canonical term
      buffer.write('• ${finding.canonicalDisplayName}: ${status.value}');

      // Append severity if assessed or explicitly unclear
      if (finding.severityAssessment.state == SeverityAssessmentState.assessed &&
          finding.severityAssessment.level != null) {
        buffer.write(' (${finding.severityAssessment.level!.value})');
      } else if (finding.severityAssessment.state ==
          SeverityAssessmentState.explicitlyUnclear) {
        buffer.write(' (Severity Unclear in source)');
      }

      // Append duration if present
      final activeStatement = finding.temporalStatements.isNotEmpty
          ? finding.temporalStatements.first
          : null;
      if (activeStatement?.duration != null) {
        final d = activeStatement!.duration!;
        buffer.write(' [Duration: ${d.raw}]');
      }

      // Append evidence text
      final evidenceText = finding.originalExpression.isNotEmpty
          ? finding.originalExpression
          : (activeStatement?.evidence.text ?? '');
      if (evidenceText.isNotEmpty) {
        buffer.write(' [Ref: "$evidenceText"]');
      }

      // Append doctor note if provided during review
      if (decision.doctorNote != null && decision.doctorNote!.trim().isNotEmpty) {
        buffer.write(' (Dr. Note: ${decision.doctorNote!.trim()})');
      }

      // Append chronological progression if multi-statement
      if (finding.chronologicalRelationships.isNotEmpty) {
        final transitions = finding.chronologicalRelationships
            .map((r) => '${r.transitionType.value} (${r.evidence.text})')
            .join(' -> ');
        buffer.write('\n    Timeline: $transitions');
      }

      final formattedLine = buffer.toString();
      switch (status) {
        case ClinicalFindingStatus.present:
          presentLines.add(formattedLine);
          break;
        case ClinicalFindingStatus.absent:
          absentLines.add(formattedLine);
          break;
        case ClinicalFindingStatus.uncertain:
          uncertainLines.add(formattedLine);
          break;
        case ClinicalFindingStatus.unknown:
          unknownLines.add(formattedLine);
          break;
      }
    }

    if (presentLines.isNotEmpty) {
      symptomBuffer.writeln('[Reported Symptoms]');
      for (final line in presentLines) {
        symptomBuffer.writeln(line);
      }
    }

    if (absentLines.isNotEmpty) {
      if (symptomBuffer.isNotEmpty) symptomBuffer.writeln();
      symptomBuffer.writeln('[Denied / Negative Symptoms]');
      for (final line in absentLines) {
        symptomBuffer.writeln(line);
      }
    }

    if (uncertainLines.isNotEmpty) {
      if (symptomBuffer.isNotEmpty) symptomBuffer.writeln();
      symptomBuffer.writeln('[Clinically Uncertain Symptoms]');
      for (final line in uncertainLines) {
        symptomBuffer.writeln(line);
      }
    }

    if (unknownLines.isNotEmpty) {
      if (symptomBuffer.isNotEmpty) symptomBuffer.writeln();
      symptomBuffer.writeln('[Unresolved Fluctuations]');
      for (final line in unknownLines) {
        symptomBuffer.writeln(line);
      }
    }

    // 2. Process Quarantined / Unmapped Expressions (e.g. chills as subjective sensation)
    final unmappedLines = <String>[];
    for (final unmapped in extractionResult.unmappedExpressions) {
      final shouldInclude = unmappedInclusions[unmapped.expression] ?? false;
      if (shouldInclude) {
        includedUnmapped++;
        unmappedLines.add(
          '• Associated subjective sensation: "${unmapped.expression}" (${unmapped.category.value}) [Ref: "${unmapped.evidence.text}"]',
        );
      }
    }

    if (unmappedLines.isNotEmpty) {
      if (symptomBuffer.isNotEmpty) symptomBuffer.writeln();
      symptomBuffer.writeln('[Associated Patient Sensations]');
      for (final line in unmappedLines) {
        symptomBuffer.writeln(line);
      }
    }

    // 3. Process Clinical Assessments (Unperformed / Deferred examinations)
    final examLines = <String>[];
    for (final assessment in extractionResult.clinicalAssessments) {
      final shouldInclude = assessmentInclusions[assessment.id] ?? false;
      if (shouldInclude) {
        includedAssessments++;
        final statusDesc = assessment.status == ClinicalAssessmentStatus.notAssessed
            ? 'NOT PERFORMED'
            : assessment.status == ClinicalAssessmentStatus.deferred
                ? 'DEFERRED'
                : 'PARTIALLY ASSESSED';

        final reasonText = assessment.reason != null && assessment.reason!.isNotEmpty
            ? ' (Reason: ${assessment.reason})'
            : '';

        examLines.add(
          '• ${assessment.targetSystemOrExam}: $statusDesc$reasonText [Evidence: "${assessment.evidence.text}"]',
        );
      }
    }

    if (examLines.isNotEmpty) {
      examBuffer.writeln('[Examinations & Procedures Omitted / Deferred]');
      for (final line in examLines) {
        examBuffer.writeln(line);
      }
    }

    return ClinicalExtractionFormattingResult(
      formattedSymptoms: symptomBuffer.toString().trim(),
      formattedExamination: examBuffer.toString().trim(),
      includedFindingsCount: includedFindings,
      excludedFindingsCount: excludedFindings,
      includedAssessmentsCount: includedAssessments,
      includedUnmappedCount: includedUnmapped,
      formattedDiagnosis: differentialResult?.formatForConsultationDiagnosis(),
      differentialResult: differentialResult,
    );
  }
}
