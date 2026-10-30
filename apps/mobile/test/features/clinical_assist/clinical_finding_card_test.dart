import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/doctor_extraction_review.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/widgets/clinical_finding_card.dart';

void main() {
  const sourceText = 'Mareez ko do din se tez bukhar hai.';

  final sampleFinding = StructuredClinicalFinding(
    id: 'finding-1',
    canonicalTermId: 'fever',
    canonicalDisplayName: 'Fever',
    originalExpression: 'tez bukhar',
    conceptCategory: ExtractedConceptCategory.symptom,
    status: ClinicalFindingStatus.present,
    certainty: 'EXPLICIT',
    bodyLocation: const ClinicalBodyLocation(name: 'Systemic', isDefault: false),
    severityAssessment: const ClinicalSeverityAssessment(
      state: SeverityAssessmentState.assessed,
      level: SymptomSeverityLevel.severe,
      evidence: EvidenceSpan(startIndex: 20, endIndex: 23, text: 'tez'),
    ),
    temporalStatements: const [
      ClinicalTemporalStatement(
        statementId: 'stmt-1',
        temporalAnchor: 'CURRENT',
        status: ClinicalFindingStatus.present,
        evidence: EvidenceSpan(startIndex: 20, endIndex: 30, text: 'tez bukhar'),
      ),
    ],
    chronologicalRelationships: const [
      ChronologicalRelationship(
        relationshipId: 'rel-1',
        priorStatementId: 'stmt-0',
        subsequentStatementId: 'stmt-1',
        transitionType: ChronologicalTransitionType.worsened,
        evidence: EvidenceSpan(startIndex: 10, endIndex: 19, text: 'do din se'),
        confidence: 'EXPLICIT_IN_TEXT',
      ),
    ],
    provenance: const [
      ClinicalProvenance(
        ruleId: 'RULE-01',
        ruleDescription: 'Primary Expression Mapping',
        engineVersion: '5B.1',
        evidence: EvidenceSpan(startIndex: 20, endIndex: 30, text: 'tez bukhar'),
      ),
    ],
    validationWarnings: const ['severity_state_conflict_resolved'],
  );

  Widget createWidget({
    required FindingReviewDecision decision,
    required ValueChanged<FindingReviewDecision> onDecisionChanged,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: ClinicalFindingCard(
            finding: sampleFinding,
            sourceText: sourceText,
            decision: decision,
            onDecisionChanged: onDecisionChanged,
          ),
        ),
      ),
    );
  }

  group('ClinicalFindingCard Widget Tests', () {
    testWidgets('renders canonical name, expression, status, severity, and certainty score', (tester) async {
      final initialDecision = FindingReviewDecision.fromFinding(sampleFinding);

      await tester.pumpWidget(createWidget(
        decision: initialDecision,
        onDecisionChanged: (_) {},
      ));
      await tester.pumpAndSettle();

      expect(find.text('Fever'), findsOneWidget);
      expect(find.textContaining('Expression: "tez bukhar"'), findsOneWidget);
      expect(find.text('PRESENT'), findsOneWidget);
      expect(find.text('Severity: SEVERE'), findsOneWidget);
      expect(find.text('Certainty: EXPLICIT'), findsOneWidget);
      expect(find.textContaining('Evidence: "tez bukhar" [Offsets: 20-30]'), findsOneWidget);
      expect(find.text('severity_state_conflict_resolved'), findsOneWidget);
    });

    testWidgets('renders progression transitions when chronological relationships exist', (tester) async {
      final initialDecision = FindingReviewDecision.fromFinding(sampleFinding);

      await tester.pumpWidget(createWidget(
        decision: initialDecision,
        onDecisionChanged: (_) {},
      ));
      await tester.pumpAndSettle();

      expect(find.text('Temporal Progression / Transitions:'), findsOneWidget);
      expect(find.textContaining('WORSENED'), findsOneWidget);
    });

    testWidgets('tapping status chip triggers onDecisionChanged with statusOverridden', (tester) async {
      FindingReviewDecision? updatedDecision;
      final initialDecision = FindingReviewDecision.fromFinding(sampleFinding);

      await tester.pumpWidget(createWidget(
        decision: initialDecision,
        onDecisionChanged: (d) => updatedDecision = d,
      ));
      await tester.pumpAndSettle();

      // Tap 'Absent' status chip to override
      await tester.tap(find.text('Absent'));
      await tester.pumpAndSettle();

      expect(updatedDecision, isNotNull);
      expect(updatedDecision!.finalStatus, ClinicalFindingStatus.absent);
      expect(updatedDecision!.decisionType, DoctorDecisionType.statusOverridden);
    });

    testWidgets('tapping Exclude button toggles exclusion', (tester) async {
      FindingReviewDecision? updatedDecision;
      final initialDecision = FindingReviewDecision.fromFinding(sampleFinding);

      await tester.pumpWidget(createWidget(
        decision: initialDecision,
        onDecisionChanged: (d) => updatedDecision = d,
      ));
      await tester.pumpAndSettle();

      // Tap Exclude chip
      await tester.tap(find.text('Exclude'));
      await tester.pumpAndSettle();

      expect(updatedDecision, isNotNull);
      expect(updatedDecision!.isExcluded, isTrue);
      expect(updatedDecision!.decisionType, DoctorDecisionType.excludedByDoctor);
    });

    testWidgets('tapping Uncertain chip triggers onDecisionChanged with uncertain status', (tester) async {
      FindingReviewDecision? updatedDecision;
      final initialDecision = FindingReviewDecision.fromFinding(sampleFinding);

      await tester.pumpWidget(createWidget(
        decision: initialDecision,
        onDecisionChanged: (d) => updatedDecision = d,
      ));
      await tester.pumpAndSettle();

      // Tap 'Uncertain' chip
      await tester.tap(find.text('Uncertain'));
      await tester.pumpAndSettle();

      expect(updatedDecision, isNotNull);
      expect(updatedDecision!.finalStatus, ClinicalFindingStatus.uncertain);
      expect(updatedDecision!.decisionType, DoctorDecisionType.statusOverridden);
    });
  });
}
