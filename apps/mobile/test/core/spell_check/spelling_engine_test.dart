import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/spelling_engine.dart';

void main() {
  group('SpellingEngine Unit Tests', () {
    late MedicalDictionaryRepository repository;
    late SpellingEngine engine;

    setUp(() {
      repository = MedicalDictionaryRepository(
        initialEnglishWords: {
          'patient', 'patients', 'doctor', 'has', 'and', 'since', 'days',
          'fever', 'headache', 'cough', 'vomiting', 'pain', 'is', 'conscious',
          'oriented', 'afebrile', 'clear', 'normal', 'tab', 'for'
        },
        initialMedicalWords: {
          'paracetamol', 'amoxicillin', 'metformin', 'hypertension', 'malaria'
        },
        initialAbbreviations: {
          'BP', 'HR', 'RR', 'SpO2', 'OD', 'BD', 'TDS', 'SOS', 'PRN', 'PO'
        },
      );
      engine = SpellingEngine(dictionaryRepository: repository);
    });

    test('detects misspelled words in narrative sentence', () {
      const text = 'Patient has fevr and hedache since 3 days.';
      final issues = engine.checkText(text);

      expect(issues.length, equals(2));
      expect(issues[0].word, equals('fevr'));
      expect(issues[0].suggestions, contains('fever'));
      expect(issues[1].word, equals('hedache'));
      expect(issues[1].suggestions, contains('headache'));
    });

    test('returns zero issues for fully valid clinical sentences', () {
      const text = 'Patient is conscious, oriented, afebrile. BP 120/80 mmHg, HR 72 bpm, SpO2 99%.';
      final issues = engine.checkText(text);

      expect(issues, isEmpty);
    });

    test('preserves clinical abbreviations, routes, and frequencies', () {
      const text = 'Tab Paracetamol 500mg PO TDS for 3 days.';
      final issues = engine.checkText(text);

      expect(issues, isEmpty);
    });

    test('protects patient identifiers and UHID formats', () {
      const text = 'Patient UHID-100234 has fever and cough.';
      final issues = engine.checkText(text);

      expect(issues, isEmpty);
    });

    test('respects session ignoredWords set', () {
      const text = 'Patient has fevr and hedache.';
      final issues = engine.checkText(text, ignoredWords: {'fevr'});

      expect(issues.length, equals(1));
      expect(issues[0].word, equals('hedache'));
    });

    test('caches lookup results for high performance during repeated scans', () {
      const text = 'Patient has fever and cough.';
      final firstCheck = engine.checkText(text);
      expect(firstCheck, isEmpty);

      // Second check should utilize caches without recomputation
      final secondCheck = engine.checkText(text);
      expect(secondCheck, isEmpty);

      engine.clearCache();
      final thirdCheck = engine.checkText(text);
      expect(thirdCheck, isEmpty);
    });

    test('handles long narrative clinical documentation efficiently', () {
      // Build a 500-word clinical note
      final buffer = StringBuffer();
      for (var i = 0; i < 50; i++) {
        buffer.write('Patient is conscious and oriented. BP 120/80 mmHg. ');
        buffer.write('Tab Paracetamol 500mg PO TDS. ');
      }
      buffer.write('Patient has fevr.');

      final stopwatch = Stopwatch()..start();
      final issues = engine.checkText(buffer.toString());
      stopwatch.stop();

      expect(issues.length, equals(1));
      expect(issues[0].word, equals('fevr'));
      // Analysis must complete well within performance budget (< 100ms)
      expect(stopwatch.elapsedMilliseconds, lessThan(100));
    });
  });
}

