import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/spelling_engine.dart';
import 'package:doctor_opd_mobile/core/spell_check/presentation/spelling_suggestion_strip.dart';
import 'package:doctor_opd_mobile/core/spell_check/presentation/spelling_text_editing_controller.dart';
import 'package:doctor_opd_mobile/core/theme/app_theme.dart';

void main() {
  group('SpellingTextEditingController & Widget Tests', () {
    late MedicalDictionaryRepository repository;
    late SpellingEngine engine;

    setUp(() {
      repository = MedicalDictionaryRepository(
        initialEnglishWords: {'patient', 'has', 'and', 'fever', 'headache'},
        initialMedicalWords: {'malaria', 'paracetamol'},
        initialAbbreviations: {'BP', 'HR', 'OD'},
      );
      engine = SpellingEngine(dictionaryRepository: repository);
    });

    testWidgets('decorates misspelled words with red underline while leaving raw text untouched',
        (tester) async {
      final controller = SpellingTextEditingController(
        text: 'Patient has fevr.',
        spellingEngine: engine,
      );

      // Force immediate check
      controller.checkSpellingNow();
      expect(controller.currentIssues.length, equals(1));
      expect(controller.currentIssues.first.word, equals('fevr'));

      late BuildContext capturedContext;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) {
                capturedContext = context;
                return TextField(controller: controller);
              },
            ),
          ),
        ),
      );

      final span = controller.buildTextSpan(
        context: capturedContext,
        style: const TextStyle(color: Colors.black, fontSize: 14),
        withComposing: false,
      );

      // Raw text must remain strictly untouched
      expect(controller.text, equals('Patient has fevr.'));

      // TextSpan children should highlight 'fevr' with error underline
      final children = span.children!;
      expect(children.length, greaterThanOrEqualTo(2));

      // Locate the span containing 'fevr'
      final errorSpan = children.firstWhere(
        (s) => (s as TextSpan).text == 'fevr',
      ) as TextSpan;

      expect(errorSpan.style?.decoration, equals(TextDecoration.underline));
      expect(errorSpan.style?.decorationColor, equals(AppTheme.errorRed));

      controller.dispose();
    });

    test('replaceWord replaces only targeted word and preserves surrounding punctuation', () {
      final controller = SpellingTextEditingController(
        text: 'Patient has fevr and hedache.',
        spellingEngine: engine,
      );
      controller.checkSpellingNow();

      final issue = controller.currentIssues.firstWhere((i) => i.word == 'fevr');
      controller.replaceWord(issue, 'fever');

      expect(controller.text, equals('Patient has fever and hedache.'));
      // Cursor should be placed immediately after the replaced word
      expect(controller.selection.baseOffset, equals(17));

      controller.dispose();
    });

    test('ignoreWord removes error underline without altering text', () {
      final controller = SpellingTextEditingController(
        text: 'Patient has fevr.',
        spellingEngine: engine,
      );
      controller.checkSpellingNow();
      expect(controller.currentIssues.length, equals(1));

      controller.ignoreWord('fevr');

      expect(controller.currentIssues, isEmpty);
      expect(controller.ignoredWords, contains('fevr'));
      expect(controller.text, equals('Patient has fevr.')); // Unaltered

      controller.dispose();
    });

    testWidgets('SpellingSuggestionStrip displays candidate chips and replaces word on tap',
        (tester) async {
      final controller = SpellingTextEditingController(
        text: 'Patient has fevr.',
        spellingEngine: engine,
      );
      controller.checkSpellingNow();

      // Position cursor inside 'fevr' (index 14)
      controller.selection = const TextSelection.collapsed(offset: 14);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: Column(
              children: [
                TextField(controller: controller),
                SpellingSuggestionStrip(controller: controller),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Strip should display the misspelled word indicator and suggestions
      expect(find.text('fevr:'), findsOneWidget);
      expect(find.text('fever'), findsOneWidget);
      expect(find.text('Ignore'), findsOneWidget);

      // Tap on the 'fever' suggestion chip
      await tester.tap(find.text('fever'));
      await tester.pumpAndSettle();

      // Text should now be corrected
      expect(controller.text, equals('Patient has fever.'));

      controller.dispose();
    });

    testWidgets('SpellingSuggestionStrip displays correctly in Dark Mode (Obsidian + Golden Ember)',
        (tester) async {
      final controller = SpellingTextEditingController(
        text: 'Patient has fevr.',
        spellingEngine: engine,
      );
      controller.checkSpellingNow();
      controller.selection = const TextSelection.collapsed(offset: 14);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            backgroundColor: AppTheme.obsidianBackground,
            body: Column(
              children: [
                TextField(controller: controller),
                SpellingSuggestionStrip(controller: controller),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('fevr:'), findsOneWidget);
      expect(find.text('fever'), findsOneWidget);

      // Tap 'Ignore' in dark mode
      await tester.tap(find.text('Ignore'));
      await tester.pumpAndSettle();

      // Strip should dismiss once ignored
      expect(controller.ignoredWords, contains('fevr'));
      expect(find.text('fevr:'), findsNothing);

      controller.dispose();
    });
  });
}

