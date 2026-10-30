import 'package:flutter/foundation.dart';

/// Top-level status of the Differential Diagnosis API response.
enum DifferentialEvaluationStatus {
  evaluated('EVALUATED'),
  unavailable('UNAVAILABLE');

  final String value;
  const DifferentialEvaluationStatus(this.value);

  static DifferentialEvaluationStatus fromString(String? val) {
    if (val == null) return DifferentialEvaluationStatus.unavailable;
    final normalized = val.trim().toUpperCase();
    for (final s in DifferentialEvaluationStatus.values) {
      if (s.value == normalized) return s;
    }
    return DifferentialEvaluationStatus.unavailable;
  }
}

/// Evaluated match tier for candidate differential conditions.
enum DifferentialMatchTier {
  strongMatch('STRONG_MATCH'),
  moderateMatch('MODERATE_MATCH'),
  possibleMatch('POSSIBLE_MATCH'),
  contradicted('CONTRADICTED'),
  unmatched('UNMATCHED');

  final String value;
  const DifferentialMatchTier(this.value);

  static DifferentialMatchTier? fromString(String? val) {
    if (val == null) return null;
    final normalized = val.trim().toUpperCase();
    for (final t in DifferentialMatchTier.values) {
      if (t.value == normalized) return t;
    }
    return null;
  }

  String get displayName {
    switch (this) {
      case DifferentialMatchTier.strongMatch:
        return 'Strong Match';
      case DifferentialMatchTier.moderateMatch:
        return 'Moderate Match';
      case DifferentialMatchTier.possibleMatch:
        return 'Possible Match';
      case DifferentialMatchTier.contradicted:
        return 'Contradicted';
      case DifferentialMatchTier.unmatched:
        return 'Unmatched';
    }
  }
}

/// Clinician-documented suspected infection state.
enum InfectionSuspicionState {
  suspected('SUSPECTED'),
  notSuspected('NOT_SUSPECTED'),
  unknown('UNKNOWN'),
  notAssessed('NOT_ASSESSED');

  final String value;
  const InfectionSuspicionState(this.value);

  static InfectionSuspicionState fromString(String? val) {
    if (val == null) return InfectionSuspicionState.unknown;
    final normalized = val.trim().toUpperCase();
    for (final s in InfectionSuspicionState.values) {
      if (s.value == normalized) return s;
    }
    return InfectionSuspicionState.unknown;
  }

  String get displayName {
    switch (this) {
      case InfectionSuspicionState.suspected:
        return 'Infection Suspected';
      case InfectionSuspicionState.notSuspected:
        return 'Infection Not Suspected';
      case InfectionSuspicionState.unknown:
        return 'Infection Status Unknown';
      case InfectionSuspicionState.notAssessed:
        return 'Infection Not Assessed';
    }
  }
}

/// Red-flag alert urgency level.
enum RedFlagUrgency {
  immediate('IMMEDIATE'),
  high('HIGH');

  final String value;
  const RedFlagUrgency(this.value);

  static RedFlagUrgency fromString(String? val) {
    if (val == null) return RedFlagUrgency.high;
    final normalized = val.trim().toUpperCase();
    for (final u in RedFlagUrgency.values) {
      if (u.value == normalized) return u;
    }
    return RedFlagUrgency.high;
  }
}

/// Evaluation finding status conforming to Phase 5B.5 6-state ontology.
enum EvaluationFindingStatus {
  present('PRESENT'),
  absent('ABSENT'),
  uncertain('UNCERTAIN'),
  unknown('UNKNOWN'),
  notMentioned('NOT_MENTIONED'),
  notAssessed('NOT_ASSESSED');

  final String value;
  const EvaluationFindingStatus(this.value);

  static EvaluationFindingStatus fromString(String? val) {
    if (val == null) return EvaluationFindingStatus.unknown;
    final normalized = val.trim().toUpperCase();
    for (final s in EvaluationFindingStatus.values) {
      if (s.value == normalized) return s;
    }
    return EvaluationFindingStatus.unknown;
  }
}

/// Clinical physical examination status.
enum AssessmentStatus {
  performed('PERFORMED'),
  notAssessed('NOT_ASSESSED'),
  deferred('DEFERRED');

  final String value;
  const AssessmentStatus(this.value);

  static AssessmentStatus fromString(String? val) {
    if (val == null) return AssessmentStatus.notAssessed;
    final normalized = val.trim().toUpperCase();
    for (final s in AssessmentStatus.values) {
      if (s.value == normalized) return s;
    }
    return AssessmentStatus.notAssessed;
  }
}

/// Doctor candidate selection action.
enum DoctorCandidateAction {
  acceptedAsPrimary('ACCEPTED_AS_PRIMARY'),
  acceptedAsDifferential('ACCEPTED_AS_DIFFERENTIAL'),
  deferredForInvestigation('DEFERRED_FOR_INVESTIGATION'),
  rejected('REJECTED');

  final String value;
  const DoctorCandidateAction(this.value);

  String get displayName {
    switch (this) {
      case DoctorCandidateAction.acceptedAsPrimary:
        return 'Primary Diagnosis';
      case DoctorCandidateAction.acceptedAsDifferential:
        return 'Differential';
      case DoctorCandidateAction.deferredForInvestigation:
        return 'Defer / Investigate';
      case DoctorCandidateAction.rejected:
        return 'Reject';
    }
  }
}

// ---------------------------------------------------------------------------
// REQUEST MODELS
// ---------------------------------------------------------------------------

/// Structured clinical finding input DTO.
@immutable
class DifferentialFindingInput {
  final String canonicalTerm;
  final String? conceptId;
  final EvaluationFindingStatus status;
  final int? durationDays;
  final String? severity;
  final String? bodyLocation;

  const DifferentialFindingInput({
    required this.canonicalTerm,
    this.conceptId,
    required this.status,
    this.durationDays,
    this.severity,
    this.bodyLocation,
  });

  Map<String, dynamic> toJson() {
    return {
      'canonicalTerm': canonicalTerm,
      if (conceptId != null && conceptId!.isNotEmpty) 'conceptId': conceptId,
      'status': status.value,
      if (durationDays != null) 'durationDays': durationDays,
      if (severity != null && severity!.isNotEmpty) 'severity': severity,
      if (bodyLocation != null && bodyLocation!.isNotEmpty)
        'bodyLocation': bodyLocation,
    };
  }

  factory DifferentialFindingInput.fromJson(Map<String, dynamic> json) {
    return DifferentialFindingInput(
      canonicalTerm: json['canonicalTerm'] as String? ?? '',
      conceptId: json['conceptId'] as String?,
      status: EvaluationFindingStatus.fromString(json['status'] as String?),
      durationDays: json['durationDays'] as int?,
      severity: json['severity'] as String?,
      bodyLocation: json['bodyLocation'] as String?,
    );
  }
}

/// Vital signs input DTO.
@immutable
class DifferentialVitalsInput {
  final double? temperatureC;
  final int? systolicBp;
  final int? diastolicBp;
  final int? pulse;
  final int? spO2;
  final int? respiratoryRate;

  const DifferentialVitalsInput({
    this.temperatureC,
    this.systolicBp,
    this.diastolicBp,
    this.pulse,
    this.spO2,
    this.respiratoryRate,
  });

  bool get isEmpty =>
      temperatureC == null &&
      systolicBp == null &&
      diastolicBp == null &&
      pulse == null &&
      spO2 == null &&
      respiratoryRate == null;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (temperatureC != null) map['temperatureC'] = temperatureC;
    if (systolicBp != null) map['systolicBp'] = systolicBp;
    if (diastolicBp != null) map['diastolicBp'] = diastolicBp;
    if (pulse != null) map['pulse'] = pulse;
    if (spO2 != null) map['spO2'] = spO2;
    if (respiratoryRate != null) map['respiratoryRate'] = respiratoryRate;
    return map;
  }

  factory DifferentialVitalsInput.fromJson(Map<String, dynamic> json) {
    return DifferentialVitalsInput(
      temperatureC: (json['temperatureC'] as num?)?.toDouble(),
      systolicBp: (json['systolicBp'] as num?)?.toInt(),
      diastolicBp: (json['diastolicBp'] as num?)?.toInt(),
      pulse: (json['pulse'] as num?)?.toInt(),
      spO2: (json['spO2'] as num?)?.toInt(),
      respiratoryRate: (json['respiratoryRate'] as num?)?.toInt(),
    );
  }
}

/// Demographic override DTO.
@immutable
class DifferentialDemographicsInput {
  final int? ageYears;
  final String? gender;
  final bool? isPregnant;

  const DifferentialDemographicsInput({
    this.ageYears,
    this.gender,
    this.isPregnant,
  });

  bool get isEmpty =>
      ageYears == null && gender == null && isPregnant == null;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (ageYears != null) map['ageYears'] = ageYears;
    if (gender != null && gender!.isNotEmpty) map['gender'] = gender;
    if (isPregnant != null) map['isPregnant'] = isPregnant;
    return map;
  }

  factory DifferentialDemographicsInput.fromJson(Map<String, dynamic> json) {
    return DifferentialDemographicsInput(
      ageYears: (json['ageYears'] as num?)?.toInt(),
      gender: json['gender'] as String?,
      isPregnant: json['isPregnant'] as bool?,
    );
  }
}

/// Physical examination / clinical assessment DTO.
@immutable
class DifferentialAssessmentInput {
  final String examination;
  final AssessmentStatus status;
  final String? reason;

  const DifferentialAssessmentInput({
    required this.examination,
    required this.status,
    this.reason,
  });

  Map<String, dynamic> toJson() {
    return {
      'examination': examination,
      'status': status.value,
      if (reason != null && reason!.isNotEmpty) 'reason': reason,
    };
  }

  factory DifferentialAssessmentInput.fromJson(Map<String, dynamic> json) {
    return DifferentialAssessmentInput(
      examination: json['examination'] as String? ?? '',
      status: AssessmentStatus.fromString(json['status'] as String?),
      reason: json['reason'] as String?,
    );
  }
}

/// Top-level request DTO for Differential Diagnosis evaluation.
@immutable
class EvaluateDifferentialRequest {
  final String patientId;
  final String? consultationId;
  final String domain;
  final List<DifferentialFindingInput> findings;
  final DifferentialVitalsInput? vitals;
  final DifferentialDemographicsInput? demographics;
  final InfectionSuspicionState? infectionSuspicion;
  final List<DifferentialAssessmentInput>? assessments;

  const EvaluateDifferentialRequest({
    required this.patientId,
    this.consultationId,
    this.domain = 'GENERAL_MEDICINE',
    required this.findings,
    this.vitals,
    this.demographics,
    this.infectionSuspicion,
    this.assessments,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'patientId': patientId,
      'domain': domain,
      'findings': findings.map((f) => f.toJson()).toList(),
    };
    if (consultationId != null && consultationId!.isNotEmpty) {
      map['consultationId'] = consultationId;
    }
    if (vitals != null && !vitals!.isEmpty) {
      map['vitals'] = vitals!.toJson();
    }
    if (demographics != null && !demographics!.isEmpty) {
      map['demographics'] = demographics!.toJson();
    }
    if (infectionSuspicion != null) {
      map['infectionSuspicion'] = infectionSuspicion!.value;
    }
    if (assessments != null && assessments!.isNotEmpty) {
      map['assessments'] = assessments!.map((a) => a.toJson()).toList();
    }
    return map;
  }
}

// ---------------------------------------------------------------------------
// RESPONSE MODELS
// ---------------------------------------------------------------------------

/// Knowledge pack release metadata returned with evaluation.
@immutable
class KnowledgePackMetadata {
  final String domain;
  final String version;
  final String releaseStatus;
  final String releaseScope;
  final String checksumSha256;

  const KnowledgePackMetadata({
    required this.domain,
    required this.version,
    required this.releaseStatus,
    required this.releaseScope,
    required this.checksumSha256,
  });

  factory KnowledgePackMetadata.fromJson(Map<String, dynamic> json) {
    return KnowledgePackMetadata(
      domain: json['domain'] as String? ?? '',
      version: json['version'] as String? ?? '',
      releaseStatus: json['releaseStatus'] as String? ?? '',
      releaseScope: json['releaseScope'] as String? ?? '',
      checksumSha256: json['checksumSha256'] as String? ?? '',
    );
  }
}

/// Resolved patient demographic context from server.
@immutable
class ResolvedPatientDemographicContext {
  final String patientId;
  final int? resolvedAgeYears;
  final String ageSource;
  final String? gender;

  const ResolvedPatientDemographicContext({
    required this.patientId,
    this.resolvedAgeYears,
    required this.ageSource,
    this.gender,
  });

  factory ResolvedPatientDemographicContext.fromJson(Map<String, dynamic> json) {
    return ResolvedPatientDemographicContext(
      patientId: json['patientId'] as String? ?? '',
      resolvedAgeYears: (json['resolvedAgeYears'] as num?)?.toInt(),
      ageSource: json['ageSource'] as String? ?? 'UNRECORDED',
      gender: json['gender'] as String?,
    );
  }
}

/// Evaluation detail for a single criterion group or AST node.
@immutable
class CriterionDetail {
  final bool satisfied;
  final String result;
  final String explanation;

  const CriterionDetail({
    required this.satisfied,
    required this.result,
    required this.explanation,
  });

  factory CriterionDetail.fromJson(Map<String, dynamic> json) {
    return CriterionDetail(
      satisfied: json['satisfied'] as bool? ?? false,
      result: json['result'] as String? ?? 'UNKNOWN',
      explanation: json['explanation'] as String? ?? '',
    );
  }
}

/// Missing information alert generated from missingDataRules.
@immutable
class MissingInfoAlert {
  final String? parameter;
  final String? examination;
  final String prompt;
  final String reason;

  const MissingInfoAlert({
    this.parameter,
    this.examination,
    required this.prompt,
    required this.reason,
  });

  factory MissingInfoAlert.fromJson(Map<String, dynamic> json) {
    return MissingInfoAlert(
      parameter: json['parameter'] as String?,
      examination: json['examination'] as String?,
      prompt: json['prompt'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
    );
  }
}

/// Explicit alert for documented unperformed physical examinations.
@immutable
class UnperformedAssessmentAlert {
  final String examination;
  final String prompt;
  final String status;
  final String reason;

  const UnperformedAssessmentAlert({
    required this.examination,
    required this.prompt,
    this.status = 'NOT_ASSESSED',
    required this.reason,
  });

  factory UnperformedAssessmentAlert.fromJson(Map<String, dynamic> json) {
    return UnperformedAssessmentAlert(
      examination: json['examination'] as String? ?? '',
      prompt: json['prompt'] as String? ?? '',
      status: json['status'] as String? ?? 'NOT_ASSESSED',
      reason: json['reason'] as String? ?? '',
    );
  }
}

/// Condition candidate match outcome.
@immutable
class ConditionCandidateMatch {
  final String conditionCode;
  final String conditionDisplayName;
  final String category;
  final String ruleCode;
  final String ruleTitle;
  final DifferentialMatchTier? tier;
  final int minMajorCount;
  final int majorSupportingMatchedCount;
  final CriterionDetail? mandatoryResult;
  final List<CriterionDetail> majorSupportingResults;
  final List<CriterionDetail> minorSupportingResults;
  final List<CriterionDetail> contradictionResults;
  final bool contradictionTriggered;
  final List<MissingInfoAlert> missingInformation;
  final List<UnperformedAssessmentAlert> unperformedAssessments;
  final List<String> suggestedInvestigations;
  final bool isComplete;
  final String rationale;

  const ConditionCandidateMatch({
    required this.conditionCode,
    required this.conditionDisplayName,
    required this.category,
    required this.ruleCode,
    required this.ruleTitle,
    this.tier,
    this.minMajorCount = 0,
    this.majorSupportingMatchedCount = 0,
    this.mandatoryResult,
    this.majorSupportingResults = const [],
    this.minorSupportingResults = const [],
    this.contradictionResults = const [],
    this.contradictionTriggered = false,
    this.missingInformation = const [],
    this.unperformedAssessments = const [],
    this.suggestedInvestigations = const [],
    this.isComplete = false,
    required this.rationale,
  });

  factory ConditionCandidateMatch.fromJson(Map<String, dynamic> json) {
    return ConditionCandidateMatch(
      conditionCode: json['conditionCode'] as String? ?? '',
      conditionDisplayName: json['conditionDisplayName'] as String? ?? '',
      category: json['category'] as String? ?? '',
      ruleCode: json['ruleCode'] as String? ?? '',
      ruleTitle: json['ruleTitle'] as String? ?? '',
      tier: DifferentialMatchTier.fromString(json['tier'] as String?),
      minMajorCount: (json['minMajorCount'] as num?)?.toInt() ?? 0,
      majorSupportingMatchedCount:
          (json['majorSupportingMatchedCount'] as num?)?.toInt() ?? 0,
      mandatoryResult: json['mandatoryResult'] != null
          ? CriterionDetail.fromJson(
              json['mandatoryResult'] as Map<String, dynamic>)
          : null,
      majorSupportingResults: (json['majorSupportingResults'] as List<dynamic>?)
              ?.map((e) => CriterionDetail.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      minorSupportingResults: (json['minorSupportingResults'] as List<dynamic>?)
              ?.map((e) => CriterionDetail.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      contradictionResults: (json['contradictionResults'] as List<dynamic>?)
              ?.map((e) => CriterionDetail.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      contradictionTriggered: json['contradictionTriggered'] as bool? ?? false,
      missingInformation: (json['missingInformation'] as List<dynamic>?)
              ?.map((e) => MissingInfoAlert.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      unperformedAssessments: (json['unperformedAssessments'] as List<dynamic>?)
              ?.map((e) =>
                  UnperformedAssessmentAlert.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      suggestedInvestigations: (json['suggestedInvestigations'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      isComplete: json['isComplete'] as bool? ?? false,
      rationale: json['rationale'] as String? ?? '',
    );
  }
}

/// Red-flag alert outcome.
@immutable
class RedFlagAlert {
  final String flagCode;
  final String title;
  final RedFlagUrgency urgencyLevel;
  final bool triggered;
  final String clinicalAction;
  final String disclaimer;
  final bool? isProvisional;
  final String? provisionalWarning;
  final List<String> quarantinedPredicates;
  final String? missingAssessmentNotice;
  final String? clinicalContextNotice;
  final InfectionSuspicionState? infectionSuspicionState;
  final String? gatingExplanation;
  final List<String> supportingInfectionEvidence;

  const RedFlagAlert({
    required this.flagCode,
    required this.title,
    required this.urgencyLevel,
    required this.triggered,
    required this.clinicalAction,
    required this.disclaimer,
    this.isProvisional,
    this.provisionalWarning,
    this.quarantinedPredicates = const [],
    this.missingAssessmentNotice,
    this.clinicalContextNotice,
    this.infectionSuspicionState,
    this.gatingExplanation,
    this.supportingInfectionEvidence = const [],
  });

  factory RedFlagAlert.fromJson(Map<String, dynamic> json) {
    return RedFlagAlert(
      flagCode: json['flagCode'] as String? ?? '',
      title: json['title'] as String? ?? '',
      urgencyLevel: RedFlagUrgency.fromString(json['urgencyLevel'] as String?),
      triggered: json['triggered'] as bool? ?? false,
      clinicalAction: json['clinicalAction'] as String? ?? '',
      disclaimer: json['disclaimer'] as String? ?? '',
      isProvisional: json['isProvisional'] as bool?,
      provisionalWarning: json['provisionalWarning'] as String?,
      quarantinedPredicates: (json['quarantinedPredicates'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      missingAssessmentNotice: json['missingAssessmentNotice'] as String?,
      clinicalContextNotice: json['clinicalContextNotice'] as String?,
      infectionSuspicionState: json['infectionSuspicionState'] != null
          ? InfectionSuspicionState.fromString(
              json['infectionSuspicionState'] as String?)
          : null,
      gatingExplanation: json['gatingExplanation'] as String?,
      supportingInfectionEvidence:
          (json['supportingInfectionEvidence'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
    );
  }
}

/// Differential tier summary.
@immutable
class DifferentialTierSummary {
  final int strongMatchCount;
  final int moderateMatchCount;
  final int possibleMatchCount;
  final int contradictedMatchCount;
  final int unmatchedCount;

  const DifferentialTierSummary({
    required this.strongMatchCount,
    required this.moderateMatchCount,
    required this.possibleMatchCount,
    required this.contradictedMatchCount,
    required this.unmatchedCount,
  });

  factory DifferentialTierSummary.fromJson(Map<String, dynamic> json) {
    return DifferentialTierSummary(
      strongMatchCount: (json['strongMatchCount'] as num?)?.toInt() ?? 0,
      moderateMatchCount: (json['moderateMatchCount'] as num?)?.toInt() ?? 0,
      possibleMatchCount: (json['possibleMatchCount'] as num?)?.toInt() ?? 0,
      contradictedMatchCount:
          (json['contradictedMatchCount'] as num?)?.toInt() ?? 0,
      unmatchedCount: (json['unmatchedCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Top-level response of the Differential Diagnosis API.
@immutable
class DifferentialEvaluationResponse {
  final DifferentialEvaluationStatus status;
  final String evaluatedAt;
  final String engineVersion;
  final KnowledgePackMetadata? knowledgePack;
  final ResolvedPatientDemographicContext? patientContext;
  final InfectionSuspicionState infectionSuspicion;
  final bool hasUrgentRedFlags;
  final List<RedFlagAlert> redFlags;
  final List<ConditionCandidateMatch> candidateMatches;
  final DifferentialTierSummary? tierSummary;
  final List<String> warnings;
  final bool requiresDoctorReview;
  final String disclaimer;
  final String? message;

  const DifferentialEvaluationResponse({
    required this.status,
    required this.evaluatedAt,
    this.engineVersion = '1.0.0',
    this.knowledgePack,
    this.patientContext,
    this.infectionSuspicion = InfectionSuspicionState.unknown,
    this.hasUrgentRedFlags = false,
    this.redFlags = const [],
    this.candidateMatches = const [],
    this.tierSummary,
    this.warnings = const [],
    this.requiresDoctorReview = true,
    required this.disclaimer,
    this.message,
  });

  bool get isEvaluated => status == DifferentialEvaluationStatus.evaluated;
  bool get isUnavailable => status == DifferentialEvaluationStatus.unavailable;

  factory DifferentialEvaluationResponse.fromJson(Map<String, dynamic> json) {
    return DifferentialEvaluationResponse(
      status: DifferentialEvaluationStatus.fromString(json['status'] as String?),
      evaluatedAt: json['evaluatedAt'] as String? ?? DateTime.now().toIso8601String(),
      engineVersion: json['engineVersion'] as String? ?? '1.0.0',
      knowledgePack: json['knowledgePack'] != null
          ? KnowledgePackMetadata.fromJson(
              json['knowledgePack'] as Map<String, dynamic>)
          : null,
      patientContext: json['patientContext'] != null
          ? ResolvedPatientDemographicContext.fromJson(
              json['patientContext'] as Map<String, dynamic>)
          : null,
      infectionSuspicion: InfectionSuspicionState.fromString(
          json['infectionSuspicion'] as String?),
      hasUrgentRedFlags: json['hasUrgentRedFlags'] as bool? ?? false,
      redFlags: (json['redFlags'] as List<dynamic>?)
              ?.map((e) => RedFlagAlert.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      candidateMatches: (json['candidateMatches'] as List<dynamic>?)
              ?.map((e) =>
                  ConditionCandidateMatch.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      tierSummary: json['tierSummary'] != null
          ? DifferentialTierSummary.fromJson(
              json['tierSummary'] as Map<String, dynamic>)
          : null,
      warnings: (json['warnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      requiresDoctorReview: json['requiresDoctorReview'] as bool? ?? true,
      disclaimer: json['disclaimer'] as String? ?? '',
      message: json['message'] as String?,
    );
  }
}

// ---------------------------------------------------------------------------
// DOCTOR DECISION MODELS
// ---------------------------------------------------------------------------

/// Doctor decision on an individual candidate condition.
@immutable
class DoctorCandidateDecision {
  final String conditionCode;
  final String conditionDisplayName;
  final DifferentialMatchTier? tier;
  final DoctorCandidateAction action;
  final String? notes;

  const DoctorCandidateDecision({
    required this.conditionCode,
    required this.conditionDisplayName,
    this.tier,
    required this.action,
    this.notes,
  });

  DoctorCandidateDecision copyWith({
    DoctorCandidateAction? action,
    String? notes,
  }) {
    return DoctorCandidateDecision(
      conditionCode: conditionCode,
      conditionDisplayName: conditionDisplayName,
      tier: tier,
      action: action ?? this.action,
      notes: notes ?? this.notes,
    );
  }
}

/// Clinician's complete review outcome of differential diagnosis candidates.
@immutable
class DoctorDifferentialReviewResult {
  final Map<String, DoctorCandidateDecision> decisions;
  final String? clinicalNotes;

  const DoctorDifferentialReviewResult({
    required this.decisions,
    this.clinicalNotes,
  });

  DoctorCandidateDecision? get primaryDiagnosis {
    for (final d in decisions.values) {
      if (d.action == DoctorCandidateAction.acceptedAsPrimary) return d;
    }
    return null;
  }

  List<DoctorCandidateDecision> get differentialDiagnoses {
    return decisions.values
        .where((d) => d.action == DoctorCandidateAction.acceptedAsDifferential)
        .toList();
  }

  List<DoctorCandidateDecision> get deferredInvestigations {
    return decisions.values
        .where((d) => d.action == DoctorCandidateAction.deferredForInvestigation)
        .toList();
  }

  List<DoctorCandidateDecision> get rejectedDiagnoses {
    return decisions.values
        .where((d) => d.action == DoctorCandidateAction.rejected)
        .toList();
  }

  bool get hasSelections => decisions.values.any((d) =>
      d.action == DoctorCandidateAction.acceptedAsPrimary ||
      d.action == DoctorCandidateAction.acceptedAsDifferential);

  /// Formats the accepted primary and secondary diagnoses for consultation draft insertion.
  String formatForConsultationDiagnosis() {
    final buffer = StringBuffer();

    final primary = primaryDiagnosis;
    if (primary != null) {
      buffer.write(primary.conditionDisplayName);
    }

    final diffs = differentialDiagnoses;
    if (diffs.isNotEmpty) {
      if (primary != null) {
        buffer.write(' (Differential: ');
        buffer.write(diffs.map((d) => d.conditionDisplayName).join(', '));
        buffer.write(')');
      } else {
        buffer.write('Differential: ');
        buffer.write(diffs.map((d) => d.conditionDisplayName).join(', '));
      }
    }

    return buffer.toString().trim();
  }
}

