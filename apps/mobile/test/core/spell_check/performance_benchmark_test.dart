// ignore_for_file: avoid_print
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/spelling_engine.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 3F — Spell Checker Performance Benchmarks', () {
    late MedicalDictionaryRepository repository;
    late SpellingEngine engine;
    late int dictLoadMs;

    setUpAll(() async {
      final sw = Stopwatch()..start();
      final engFile = File('assets/dictionaries/english_words.txt');
      final medFile = File('assets/dictionaries/medical_words.txt');
      final abbrFile = File('assets/dictionaries/clinical_abbreviations.txt');

      final engLines = engFile.readAsLinesSync();
      final medLines = medFile.readAsLinesSync();
      final abbrLines = abbrFile.readAsLinesSync();

      repository = MedicalDictionaryRepository(
        initialEnglishWords: engLines.toSet(),
        initialMedicalWords: medLines.toSet(),
        initialAbbreviations: abbrLines.toSet(),
      );

      engine = SpellingEngine(
        dictionaryRepository: repository,
        cacheCapacity: 500,
      );
      sw.stop();
      dictLoadMs = sw.elapsedMilliseconds;
    });

    test('1. Dictionary initialization latency (< 500 ms)', () {
      print('BENCHMARK: Dictionary initialization: ${dictLoadMs}ms');
      expect(dictLoadMs, lessThan(500));
    });

    test('2. Single word lookup latency (< 1 ms)', () {
      final sw = Stopwatch()..start();
      const iterations = 10000;
      for (var i = 0; i < iterations; i++) {
        repository.isWordValid('hypertension');
        repository.isWordValid('paracetamol');
        repository.isWordValid('patient');
      }
      sw.stop();
      final perLookupMicroseconds = sw.elapsedMicroseconds / (iterations * 3);
      print('BENCHMARK: Average single word lookup: ${perLookupMicroseconds.toStringAsFixed(3)} µs');
      expect(perLookupMicroseconds, lessThan(1000)); // under 1ms (1000 µs)
    });

    test('3. Paragraph scanning latency (< 16 ms for 150 words)', () {
      const paragraph150 = '''
Patient presents with complaints of persistent cough, low-grade fevr, and generalized weakness since 5 days.
History of hypertension and diabetes mellitus on regular treatment.
No history of chest pain, dyspnea, or hemoptysis.
Physical examination reveals conscious and oriented patient.
Vitals: BP 128/82 mmHg, HR 76 bpm, RR 18/min, SpO2 98% on room air, Temp 99.2F.
Chest examination shows bilateral clear breath sounds without wheezing or crackles.
Cardiovascular examination demonstrates normal heart sounds without murmurs.
Abdominal examination reveals soft, non-tender abdomen without organomegaly.
Impression: Acute upper respiratory tract infection in a patient with controlled hypertension and diabetes.
Plan: Advised symptomatic relief with Tab paracetmol 650mg TDS PRN, Tab cetirizine 10mg HS, steam inhalation, and warm saline gargles.
Encouraged adequate oral hydration and rest.
Follow-up review advised if fevr persists beyond 3 days or if new symptoms like shortness of breath develop.
''';

      // Warm up
      engine.checkText(paragraph150, computeSuggestions: false);
      engine.clearCache();

      final sw = Stopwatch()..start();
      final issues = engine.checkText(paragraph150, computeSuggestions: false);
      sw.stop();

      final scanTimeMs = sw.elapsedMicroseconds / 1000;
      print('BENCHMARK: 150-word paragraph scanning (detection only): $scanTimeMs ms (Issues: ${issues.length})');
      expect(sw.elapsedMilliseconds, lessThan(16));
    });

    test('4. Suggestion generation latency (< 250 ms)', () {
      final sw = Stopwatch()..start();
      final suggestions = repository.getSuggestions('fevr');
      sw.stop();

      print('BENCHMARK: Suggestion generation for "fevr": ${sw.elapsedMilliseconds} ms -> $suggestions');
      expect(sw.elapsedMilliseconds, lessThan(250));
      expect(suggestions, contains('fever'));
    });

    test('5. Full 500-word clinical note analysis', () {
      final buffer = StringBuffer();
      for (var i = 0; i < 50; i++) {
        buffer.write('Patient is conscious, oriented. BP 120/80 mmHg, HR 72 bpm. ');
        buffer.write('Complaining of fevr and severe hedache. ');
      }

      engine.clearCache();
      final sw = Stopwatch()..start();
      final issues = engine.checkText(buffer.toString());
      sw.stop();

      print('BENCHMARK: 500-word note analysis: ${sw.elapsedMilliseconds} ms (Issues: ${issues.length})');
      expect(sw.elapsedMilliseconds, lessThan(250));
    });

    test('6. Long 2,000-word clinical note analysis', () {
      final buffer = StringBuffer();
      for (var i = 0; i < 200; i++) {
        buffer.write('Patient attended OPD with complaints of fevr and hedache. ');
        buffer.write('Known k/c/o hypertensn and diabtes on regular therapy. ');
      }

      engine.clearCache();
      final sw = Stopwatch()..start();
      final issues = engine.checkText(buffer.toString());
      sw.stop();

      print('BENCHMARK: 2,000-word note analysis: ${sw.elapsedMilliseconds} ms (Issues: ${issues.length})');
      expect(sw.elapsedMilliseconds, lessThan(350));
    });

    test('7. Cache boundedness verification', () {
      expect(engine.validityCacheSize, lessThanOrEqualTo(500));
      expect(engine.suggestionCacheSize, lessThanOrEqualTo(500));
      print('BENCHMARK: Validity cache: ${engine.validityCacheSize}/500, Suggestion cache: ${engine.suggestionCacheSize}/500');
    });
  });
}
