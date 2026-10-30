import 'package:flutter/foundation.dart';

/// Strict 4-state clinical finding ontology matching backend ClinicalFindingStatus.
enum ClinicalFindingStatus {
  present('PRESENT'),
  absent('ABSENT'),
  uncertain('UNCERTAIN'),
  unknown('UNKNOWN');

  final String value;
  const ClinicalFindingStatus(this.value);

  static ClinicalFindingStatus fromString(String? val) {
    if (val == null) return ClinicalFindingStatus.unknown;
    final normalized = val.trim().toUpperCase();
    for (final status in ClinicalFindingStatus.values) {
      if (status.value == normalized) return status;
    }
    return ClinicalFindingStatus.unknown;
  }
}

/// Clinically defensible concept categorization.
enum ExtractedConceptCategory {
  symptom('SYMPTOM'),
  subjectiveSensation('SUBJECTIVE_SENSATION'),
  clinicalSign('CLINICAL_SIGN'),
  diagnosisOrCondition('DIAGNOSIS_OR_CONDITION'),
  temporalDescriptor('TEMPORAL_DESCRIPTOR'),
  unclassifiedExpression('UNCLASSIFIED_EXPRESSION');

  final String value;
  const ExtractedConceptCategory(this.value);

  static ExtractedConceptCategory fromString(String? val) {
    if (val == null) return ExtractedConceptCategory.unclassifiedExpression;
    final normalized = val.trim().toUpperCase();
    for (final cat in ExtractedConceptCategory.values) {
      if (cat.value == normalized) return cat;
    }
    return ExtractedConceptCategory.unclassifiedExpression;
  }
}

/// Three-state severity assessment modeling.
enum SeverityAssessmentState {
  notMentioned('NOT_MENTIONED'),
  explicitlyUnclear('EXPLICITLY_UNCLEAR'),
  assessed('ASSESSED');

  final String value;
  const SeverityAssessmentState(this.value);

  static SeverityAssessmentState fromString(String? val) {
    if (val == null) return SeverityAssessmentState.notMentioned;
    final normalized = val.trim().toUpperCase();
    for (final state in SeverityAssessmentState.values) {
      if (state.value == normalized) return state;
    }
    return SeverityAssessmentState.notMentioned;
  }
}

/// Standardized severity levels.
enum SymptomSeverityLevel {
  mild('MILD'),
  moderate('MODERATE'),
  severe('SEVERE');

  final String value;
  const SymptomSeverityLevel(this.value);

  static SymptomSeverityLevel? fromString(String? val) {
    if (val == null) return null;
    final normalized = val.trim().toUpperCase();
    for (final lvl in SymptomSeverityLevel.values) {
      if (lvl.value == normalized) return lvl;
    }
    return null;
  }
}

/// Chronological transition type between clinical episodes.
enum ChronologicalTransitionType {
  improved('IMPROVED'),
  resolved('RESOLVED'),
  recurred('RECURRED'),
  worsened('WORSENED'),
  newOnset('NEW_ONSET'),
  ambiguous('AMBIGUOUS');

  final String value;
  const ChronologicalTransitionType(this.value);

  static ChronologicalTransitionType fromString(String? val) {
    if (val == null) return ChronologicalTransitionType.ambiguous;
    final normalized = val.trim().toUpperCase();
    for (final t in ChronologicalTransitionType.values) {
      if (t.value == normalized) return t;
    }
    return ChronologicalTransitionType.ambiguous;
  }
}

/// Clinical assessment status.
enum ClinicalAssessmentStatus {
  notAssessed('NOT_ASSESSED'),
  partiallyAssessed('PARTIALLY_ASSESSED'),
  deferred('DEFERRED');

  final String value;
  const ClinicalAssessmentStatus(this.value);

  static ClinicalAssessmentStatus fromString(String? val) {
    if (val == null) return ClinicalAssessmentStatus.notAssessed;
    final normalized = val.trim().toUpperCase();
    for (final s in ClinicalAssessmentStatus.values) {
      if (s.value == normalized) return s;
    }
    return ClinicalAssessmentStatus.notAssessed;
  }
}

/// Exact substring offsets in source text using UTF-16 code units.
@immutable
class EvidenceSpan {
  final String text;
  final int? startIndex;
  final int? endIndex;
  final String sourceField;

  const EvidenceSpan({
    required this.text,
    this.startIndex,
    this.endIndex,
    this.sourceField = 'originalDoctorConfirmedText',
  });

  factory EvidenceSpan.fromJson(Map<String, dynamic> json) {
    return EvidenceSpan(
      text: json['text'] as String? ?? '',
      startIndex: json['startIndex'] as int?,
      endIndex: json['endIndex'] as int?,
      sourceField: json['sourceField'] as String? ?? 'originalDoctorConfirmedText',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'text': text,
      'startIndex': startIndex,
      'endIndex': endIndex,
      'sourceField': sourceField,
    };
  }

  /// Verifies the UTF-16 slice invariant: sourceText.substring(start, end) == text
  bool isSliceVerified(String sourceText) {
    if (startIndex == null || endIndex == null) return false;
    if (startIndex! < 0 || endIndex! > sourceText.length || startIndex! > endIndex!) {
      return false;
    }
    return sourceText.substring(startIndex!, endIndex!) == text;
  }
}

/// Structured duration.
@immutable
class ClinicalDuration {
  final String raw;
  final num? value;
  final String? unit;

  const ClinicalDuration({
    required this.raw,
    this.value,
    this.unit,
  });

  factory ClinicalDuration.fromJson(Map<String, dynamic> json) {
    return ClinicalDuration(
      raw: json['raw'] as String? ?? '',
      value: json['value'] as num?,
      unit: json['unit'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'raw': raw,
      'value': value,
      'unit': unit,
    };
  }
}

/// Body location specification.
@immutable
class ClinicalBodyLocation {
  final String? name;
  final bool isDefault;
  final EvidenceSpan? evidenceSpan;

  const ClinicalBodyLocation({
    this.name,
    this.isDefault = false,
    this.evidenceSpan,
  });

  factory ClinicalBodyLocation.fromJson(Map<String, dynamic> json) {
    return ClinicalBodyLocation(
      name: json['name'] as String?,
      isDefault: json['isDefault'] as bool? ?? false,
      evidenceSpan: json['evidenceSpan'] != null
          ? EvidenceSpan.fromJson(json['evidenceSpan'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'isDefault': isDefault,
      'evidenceSpan': evidenceSpan?.toJson(),
    };
  }
}

/// Audit provenance entry.
@immutable
class ClinicalProvenance {
  final String ruleId;
  final String ruleDescription;
  final String? matchedAlias;
  final String? canonicalTermId;
  final EvidenceSpan evidence;
  final String engineVersion;

  const ClinicalProvenance({
    required this.ruleId,
    required this.ruleDescription,
    this.matchedAlias,
    this.canonicalTermId,
    required this.evidence,
    required this.engineVersion,
  });

  factory ClinicalProvenance.fromJson(Map<String, dynamic> json) {
    return ClinicalProvenance(
      ruleId: json['ruleId'] as String? ?? '',
      ruleDescription: json['ruleDescription'] as String? ?? '',
      matchedAlias: json['matchedAlias'] as String?,
      canonicalTermId: json['canonicalTermId'] as String?,
      evidence: EvidenceSpan.fromJson(json['evidence'] as Map<String, dynamic>? ?? {}),
      engineVersion: json['engineVersion'] as String? ?? '1.0.0',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ruleId': ruleId,
      'ruleDescription': ruleDescription,
      'matchedAlias': matchedAlias,
      'canonicalTermId': canonicalTermId,
      'evidence': evidence.toJson(),
      'engineVersion': engineVersion,
    };
  }
}

/// Discrete temporal clinical statement.
@immutable
class ClinicalTemporalStatement {
  final String statementId;
  final String temporalAnchor; // CURRENT | HISTORICAL | UNKNOWN_TIMING
  final ClinicalFindingStatus status;
  final EvidenceSpan evidence;
  final ClinicalDuration? duration;
  final String? onset;

  const ClinicalTemporalStatement({
    required this.statementId,
    required this.temporalAnchor,
    required this.status,
    required this.evidence,
    this.duration,
    this.onset,
  });

  factory ClinicalTemporalStatement.fromJson(Map<String, dynamic> json) {
    return ClinicalTemporalStatement(
      statementId: json['statementId'] as String? ?? '',
      temporalAnchor: json['temporalAnchor'] as String? ?? 'CURRENT',
      status: ClinicalFindingStatus.fromString(json['status'] as String?),
      evidence: EvidenceSpan.fromJson(json['evidence'] as Map<String, dynamic>? ?? {}),
      duration: json['duration'] != null
          ? ClinicalDuration.fromJson(json['duration'] as Map<String, dynamic>)
          : null,
      onset: json['onset'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'statementId': statementId,
      'temporalAnchor': temporalAnchor,
      'status': status.value,
      'evidence': evidence.toJson(),
      'duration': duration?.toJson(),
      'onset': onset,
    };
  }
}

/// Chronological relationship connecting two temporal statements.
@immutable
class ChronologicalRelationship {
  final String relationshipId;
  final String priorStatementId;
  final String subsequentStatementId;
  final ChronologicalTransitionType transitionType;
  final EvidenceSpan evidence;
  final String confidence; // EXPLICIT_IN_TEXT | AMBIGUOUS

  const ChronologicalRelationship({
    required this.relationshipId,
    required this.priorStatementId,
    required this.subsequentStatementId,
    required this.transitionType,
    required this.evidence,
    required this.confidence,
  });

  factory ChronologicalRelationship.fromJson(Map<String, dynamic> json) {
    return ChronologicalRelationship(
      relationshipId: json['relationshipId'] as String? ?? '',
      priorStatementId: json['priorStatementId'] as String? ?? '',
      subsequentStatementId: json['subsequentStatementId'] as String? ?? '',
      transitionType: ChronologicalTransitionType.fromString(json['transitionType'] as String?),
      evidence: EvidenceSpan.fromJson(json['evidence'] as Map<String, dynamic>? ?? {}),
      confidence: json['confidence'] as String? ?? 'AMBIGUOUS',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'relationshipId': relationshipId,
      'priorStatementId': priorStatementId,
      'subsequentStatementId': subsequentStatementId,
      'transitionType': transitionType.value,
      'evidence': evidence.toJson(),
      'confidence': confidence,
    };
  }
}

/// Structured severity assessment.
@immutable
class ClinicalSeverityAssessment {
  final SeverityAssessmentState state;
  final SymptomSeverityLevel? level;
  final EvidenceSpan? evidence;

  const ClinicalSeverityAssessment({
    required this.state,
    this.level,
    this.evidence,
  });

  factory ClinicalSeverityAssessment.fromJson(Map<String, dynamic> json) {
    return ClinicalSeverityAssessment(
      state: SeverityAssessmentState.fromString(json['state'] as String?),
      level: SymptomSeverityLevel.fromString(json['level'] as String?),
      evidence: json['evidence'] != null
          ? EvidenceSpan.fromJson(json['evidence'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'state': state.value,
      'level': level?.value,
      'evidence': evidence?.toJson(),
    };
  }
}

/// Individual structured clinical finding (symptom).
@immutable
class StructuredClinicalFinding {
  final String id;
  final String canonicalTermId;
  final String canonicalDisplayName;
  final String originalExpression;
  final ExtractedConceptCategory conceptCategory;
  final ClinicalFindingStatus status;
  final String certainty;
  final List<ClinicalTemporalStatement> temporalStatements;
  final List<ChronologicalRelationship> chronologicalRelationships;
  final ClinicalSeverityAssessment severityAssessment;
  final ClinicalBodyLocation bodyLocation;
  final List<ClinicalProvenance> provenance;
  final List<String> validationWarnings;

  const StructuredClinicalFinding({
    required this.id,
    required this.canonicalTermId,
    required this.canonicalDisplayName,
    required this.originalExpression,
    required this.conceptCategory,
    required this.status,
    required this.certainty,
    required this.temporalStatements,
    required this.chronologicalRelationships,
    required this.severityAssessment,
    required this.bodyLocation,
    required this.provenance,
    required this.validationWarnings,
  });

  factory StructuredClinicalFinding.fromJson(Map<String, dynamic> json) {
    final temporalList = (json['temporalStatements'] as List<dynamic>?)
            ?.map((e) => ClinicalTemporalStatement.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final chronoList = (json['chronologicalRelationships'] as List<dynamic>?)
            ?.map((e) => ChronologicalRelationship.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final provList = (json['provenance'] as List<dynamic>?)
            ?.map((e) => ClinicalProvenance.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final warnings = (json['validationWarnings'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];

    return StructuredClinicalFinding(
      id: json['id'] as String? ?? '',
      canonicalTermId: json['canonicalTermId'] as String? ?? '',
      canonicalDisplayName: json['canonicalDisplayName'] as String? ?? '',
      originalExpression: json['originalExpression'] as String? ?? '',
      conceptCategory: ExtractedConceptCategory.fromString(json['conceptCategory'] as String?),
      status: ClinicalFindingStatus.fromString(json['status'] as String?),
      certainty: json['certainty'] as String? ?? 'CONFIRMED',
      temporalStatements: temporalList,
      chronologicalRelationships: chronoList,
      severityAssessment: json['severityAssessment'] != null
          ? ClinicalSeverityAssessment.fromJson(json['severityAssessment'] as Map<String, dynamic>)
          : const ClinicalSeverityAssessment(state: SeverityAssessmentState.notMentioned),
      bodyLocation: json['bodyLocation'] != null
          ? ClinicalBodyLocation.fromJson(json['bodyLocation'] as Map<String, dynamic>)
          : const ClinicalBodyLocation(),
      provenance: provList,
      validationWarnings: warnings,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'canonicalTermId': canonicalTermId,
      'canonicalDisplayName': canonicalDisplayName,
      'originalExpression': originalExpression,
      'conceptCategory': conceptCategory.value,
      'status': status.value,
      'certainty': certainty,
      'temporalStatements': temporalStatements.map((e) => e.toJson()).toList(),
      'chronologicalRelationships': chronologicalRelationships.map((e) => e.toJson()).toList(),
      'severityAssessment': severityAssessment.toJson(),
      'bodyLocation': bodyLocation.toJson(),
      'provenance': provenance.map((e) => e.toJson()).toList(),
      'validationWarnings': validationWarnings,
    };
  }
}

/// Clinical examination or procedure record (unperformed/deferred).
@immutable
class ClinicalAssessmentRecord {
  final String id;
  final String assessmentScope;
  final String targetSystemOrExam;
  final ClinicalAssessmentStatus status;
  final String? reason;
  final EvidenceSpan evidence;
  final List<ClinicalProvenance> provenance;

  const ClinicalAssessmentRecord({
    required this.id,
    required this.assessmentScope,
    required this.targetSystemOrExam,
    required this.status,
    this.reason,
    required this.evidence,
    required this.provenance,
  });

  factory ClinicalAssessmentRecord.fromJson(Map<String, dynamic> json) {
    final provList = (json['provenance'] as List<dynamic>?)
            ?.map((e) => ClinicalProvenance.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return ClinicalAssessmentRecord(
      id: json['id'] as String? ?? '',
      assessmentScope: json['assessmentScope'] as String? ?? 'SYSTEM_EXAMINATION',
      targetSystemOrExam: json['targetSystemOrExam'] as String? ?? '',
      status: ClinicalAssessmentStatus.fromString(json['status'] as String?),
      reason: json['reason'] as String?,
      evidence: EvidenceSpan.fromJson(json['evidence'] as Map<String, dynamic>? ?? {}),
      provenance: provList,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'assessmentScope': assessmentScope,
      'targetSystemOrExam': targetSystemOrExam,
      'status': status.value,
      'reason': reason,
      'evidence': evidence.toJson(),
      'provenance': provenance.map((e) => e.toJson()).toList(),
    };
  }
}

/// Unmapped clinical expression (quarantined sensations like chills).
@immutable
class UnmappedClinicalExpression {
  final String expression;
  final ExtractedConceptCategory category;
  final String reason;
  final EvidenceSpan evidence;
  final String provenanceRule;

  const UnmappedClinicalExpression({
    required this.expression,
    required this.category,
    required this.reason,
    required this.evidence,
    required this.provenanceRule,
  });

  factory UnmappedClinicalExpression.fromJson(Map<String, dynamic> json) {
    return UnmappedClinicalExpression(
      expression: json['expression'] as String? ?? '',
      category: ExtractedConceptCategory.fromString(json['category'] as String?),
      reason: json['reason'] as String? ?? '',
      evidence: EvidenceSpan.fromJson(json['evidence'] as Map<String, dynamic>? ?? {}),
      provenanceRule: json['provenanceRule'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'expression': expression,
      'category': category.value,
      'reason': reason,
      'evidence': evidence.toJson(),
      'provenanceRule': provenanceRule,
    };
  }
}

/// Summary counts of extracted elements.
@immutable
class StructuredExtractionSummaryCounts {
  final int totalFindings;
  final int presentCount;
  final int absentCount;
  final int uncertainCount;
  final int unknownCount;
  final int unmappedCount;
  final int clinicalAssessmentsCount;

  const StructuredExtractionSummaryCounts({
    required this.totalFindings,
    required this.presentCount,
    required this.absentCount,
    required this.uncertainCount,
    required this.unknownCount,
    required this.unmappedCount,
    required this.clinicalAssessmentsCount,
  });

  factory StructuredExtractionSummaryCounts.fromJson(Map<String, dynamic> json) {
    return StructuredExtractionSummaryCounts(
      totalFindings: json['totalFindings'] as int? ?? 0,
      presentCount: json['presentCount'] as int? ?? 0,
      absentCount: json['absentCount'] as int? ?? 0,
      uncertainCount: json['uncertainCount'] as int? ?? 0,
      unknownCount: json['unknownCount'] as int? ?? 0,
      unmappedCount: json['unmappedCount'] as int? ?? 0,
      clinicalAssessmentsCount: json['clinicalAssessmentsCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'totalFindings': totalFindings,
      'presentCount': presentCount,
      'absentCount': absentCount,
      'uncertainCount': uncertainCount,
      'unknownCount': unknownCount,
      'unmappedCount': unmappedCount,
      'clinicalAssessmentsCount': clinicalAssessmentsCount,
    };
  }
}

/// Source metadata for extraction.
@immutable
class ExtractionSource {
  final String originalDoctorConfirmedText;
  final String detectedLanguage;
  final int characterCount;

  const ExtractionSource({
    required this.originalDoctorConfirmedText,
    required this.detectedLanguage,
    required this.characterCount,
  });

  factory ExtractionSource.fromJson(Map<String, dynamic> json) {
    return ExtractionSource(
      originalDoctorConfirmedText: json['originalDoctorConfirmedText'] as String? ?? '',
      detectedLanguage: json['detectedLanguage'] as String? ?? 'HINGLISH',
      characterCount: json['characterCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'originalDoctorConfirmedText': originalDoctorConfirmedText,
      'detectedLanguage': detectedLanguage,
      'characterCount': characterCount,
    };
  }
}

/// Clinical review metadata ensuring doctor-in-the-loop governance.
@immutable
class ClinicalReviewMetadata {
  final bool requiresDoctorReview;
  final String reviewStatus;
  final String systemSafetyNotice;

  const ClinicalReviewMetadata({
    required this.requiresDoctorReview,
    required this.reviewStatus,
    required this.systemSafetyNotice,
  });

  factory ClinicalReviewMetadata.fromJson(Map<String, dynamic> json) {
    return ClinicalReviewMetadata(
      requiresDoctorReview: json['requiresDoctorReview'] as bool? ?? true,
      reviewStatus: json['reviewStatus'] as String? ?? 'PENDING_REVIEW',
      systemSafetyNotice: json['systemSafetyNotice'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'requiresDoctorReview': requiresDoctorReview,
      'reviewStatus': reviewStatus,
      'systemSafetyNotice': systemSafetyNotice,
    };
  }
}

/// Top-level immutable response payload for Phase 5B structured extraction.
@immutable
class StructuredClinicalExtractionResult {
  final String schemaVersion;
  final String extractionEngineVersion;
  final String normalizationEngineVersion;
  final ExtractionSource source;
  final List<StructuredClinicalFinding> findings;
  final List<ClinicalAssessmentRecord> clinicalAssessments;
  final List<UnmappedClinicalExpression> unmappedExpressions;
  final StructuredExtractionSummaryCounts summaryCounts;
  final ClinicalReviewMetadata review;

  const StructuredClinicalExtractionResult({
    required this.schemaVersion,
    required this.extractionEngineVersion,
    required this.normalizationEngineVersion,
    required this.source,
    required this.findings,
    required this.clinicalAssessments,
    required this.unmappedExpressions,
    required this.summaryCounts,
    required this.review,
  });

  factory StructuredClinicalExtractionResult.fromJson(Map<String, dynamic> json) {
    final findingsList = (json['findings'] as List<dynamic>?)
            ?.map((e) => StructuredClinicalFinding.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final assessmentsList = (json['clinicalAssessments'] as List<dynamic>?)
            ?.map((e) => ClinicalAssessmentRecord.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final unmappedList = (json['unmappedExpressions'] as List<dynamic>?)
            ?.map((e) => UnmappedClinicalExpression.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return StructuredClinicalExtractionResult(
      schemaVersion: json['schemaVersion'] as String? ?? '1.0.0',
      extractionEngineVersion: json['extractionEngineVersion'] as String? ?? '1.0.0',
      normalizationEngineVersion: json['normalizationEngineVersion'] as String? ?? '1.0.0',
      source: ExtractionSource.fromJson(json['source'] as Map<String, dynamic>? ?? {}),
      findings: findingsList,
      clinicalAssessments: assessmentsList,
      unmappedExpressions: unmappedList,
      summaryCounts: StructuredExtractionSummaryCounts.fromJson(
        json['summaryCounts'] as Map<String, dynamic>? ?? {},
      ),
      review: ClinicalReviewMetadata.fromJson(json['review'] as Map<String, dynamic>? ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'schemaVersion': schemaVersion,
      'extractionEngineVersion': extractionEngineVersion,
      'normalizationEngineVersion': normalizationEngineVersion,
      'source': source.toJson(),
      'findings': findings.map((e) => e.toJson()).toList(),
      'clinicalAssessments': clinicalAssessments.map((e) => e.toJson()).toList(),
      'unmappedExpressions': unmappedExpressions.map((e) => e.toJson()).toList(),
      'summaryCounts': summaryCounts.toJson(),
      'review': review.toJson(),
    };
  }
}

