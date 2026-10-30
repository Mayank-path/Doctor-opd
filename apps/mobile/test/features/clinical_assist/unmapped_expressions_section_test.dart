import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/widgets/unmapped_expressions_section.dart';

void main() {
  const sourceText = 'Mareez ko thand aur sardi lag rahi hai.';

  final sampleExpressions = [
    const UnmappedClinicalExpression(
      expression: 'sardi lag rahi hai',
      category: ExtractedConceptCategory.symptom,
      reason: 'Quarantined sensation: chills/shivering must not map to fever',
      evidence: EvidenceSpan(
        startIndex: 20,
        endIndex: 38,
        text: 'sardi lag rahi hai',
      ),
      provenanceRule: 'RULE-QUARANTINE-01',
    ),
  ];

  Widget createWidget({
    required Map<String, bool> inclusions,
    required void Function(String, bool) onToggleInclusion,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: UnmappedExpressionsSection(
            expressions: sampleExpressions,
            sourceText: sourceText,
            inclusions: inclusions,
            onToggleInclusion: onToggleInclusion,
          ),
        ),
      ),
    );
  }

  group('UnmappedExpressionsSection Widget Tests', () {
    testWidgets('renders quarantined sensations, safety notice, and quarantined badge', (tester) async {
      await tester.pumpWidget(createWidget(
        inclusions: {'sardi lag rahi hai': true},
        onToggleInclusion: (_, __) {},
      ));
      await tester.pumpAndSettle();

      expect(find.text('Unmapped Expressions & Sensations (1)'), findsOneWidget);
      expect(find.textContaining('SAFETY AUDIT NOTICE: Subjective sensations (e.g. chills, shivering)'), findsOneWidget);
      expect(find.text('"sardi lag rahi hai"'), findsOneWidget);
      expect(find.text('QUARANTINED'), findsOneWidget);
      expect(find.textContaining('Reason: Quarantined sensation: chills/shivering must not map to fever'), findsOneWidget);
      expect(find.textContaining('Slice Verified [20, 38)'), findsOneWidget);
    });

    testWidgets('toggling inclusion checkbox triggers onToggleInclusion callback', (tester) async {
      String? toggledExpr;
      bool? toggledVal;

      await tester.pumpWidget(createWidget(
        inclusions: {'sardi lag rahi hai': true},
        onToggleInclusion: (expr, val) {
          toggledExpr = expr;
          toggledVal = val;
        },
      ));
      await tester.pumpAndSettle();

      final checkbox = find.byType(Checkbox);
      expect(checkbox, findsOneWidget);

      await tester.tap(checkbox);
      await tester.pumpAndSettle();

      expect(toggledExpr, 'sardi lag rahi hai');
      expect(toggledVal, isFalse);
    });

    testWidgets('returns shrink widget when expressions list is empty', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: UnmappedExpressionsSection(
            expressions: const [],
            sourceText: sourceText,
            inclusions: const {},
            onToggleInclusion: (_, __) {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Unmapped Expressions & Sensations (0)'), findsNothing);
    });
  });
}
