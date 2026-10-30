import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/structured_clinical_extraction.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/widgets/clinical_assessment_section.dart';

void main() {
  const sourceText = 'Chest examination not done today.';

  final sampleAssessments = [
    const ClinicalAssessmentRecord(
      id: 'assess-1',
      assessmentScope: 'SYSTEM_EXAMINATION',
      targetSystemOrExam: 'Chest Examination',
      status: ClinicalAssessmentStatus.notAssessed,
      reason: 'Not performed during this encounter',
      evidence: EvidenceSpan(
        startIndex: 0,
        endIndex: 26,
        text: 'Chest examination not done',
      ),
      provenance: [],
    ),
  ];

  Widget createWidget({
    required Map<String, bool> inclusions,
    required void Function(String, bool) onToggleInclusion,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: ClinicalAssessmentSection(
            assessments: sampleAssessments,
            sourceText: sourceText,
            inclusions: inclusions,
            onToggleInclusion: onToggleInclusion,
          ),
        ),
      ),
    );
  }

  group('ClinicalAssessmentSection Widget Tests', () {
    testWidgets('renders omitted examinations and safety warning notice', (tester) async {
      await tester.pumpWidget(createWidget(
        inclusions: {'assess-1': true},
        onToggleInclusion: (_, __) {},
      ));
      await tester.pumpAndSettle();

      expect(find.text('Unperformed / Deferred Clinical Examinations'), findsOneWidget);
      expect(find.text('(1)'), findsOneWidget);
      expect(find.textContaining('NOT ASSESSED indicates the exam was documented as omitted'), findsOneWidget);
      expect(find.text('Chest Examination'), findsOneWidget);
      expect(find.text('NOT_ASSESSED'), findsOneWidget);
      expect(find.textContaining('Reason: Not performed during this encounter'), findsOneWidget);
      expect(find.textContaining('Evidence: "Chest examination not done"'), findsOneWidget);
    });

    testWidgets('toggling inclusion checkbox triggers onToggleInclusion callback', (tester) async {
      String? toggledId;
      bool? toggledVal;

      await tester.pumpWidget(createWidget(
        inclusions: {'assess-1': true},
        onToggleInclusion: (id, val) {
          toggledId = id;
          toggledVal = val;
        },
      ));
      await tester.pumpAndSettle();

      final checkbox = find.byType(Checkbox);
      expect(checkbox, findsOneWidget);

      await tester.tap(checkbox);
      await tester.pumpAndSettle();

      expect(toggledId, 'assess-1');
      expect(toggledVal, isFalse);
    });

    testWidgets('renders empty widget when assessments list is empty', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: ClinicalAssessmentSection(
            assessments: const [],
            sourceText: sourceText,
            inclusions: const {},
            onToggleInclusion: (_, __) {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Unperformed / Deferred Clinical Examinations'), findsNothing);
    });
  });
}
