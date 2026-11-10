// ignore_for_file: avoid_print
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/spelling_engine.dart';

class StatResult {
  final double min;
  final double max;
  final double mean;
  final double median;
  final double p95;

  StatResult({
    required this.min,
    required this.max,
    required this.mean,
    required this.median,
    required this.p95,
  });

  @override
  String toString() {
    return 'min: ${min.toStringAsFixed(3)}ms, max: ${max.toStringAsFixed(3)}ms, '
        'mean: ${mean.toStringAsFixed(3)}ms, median: ${median.toStringAsFixed(3)}ms, '
        'P95: ${p95.toStringAsFixed(3)}ms';
  }
}

StatResult calculateStats(List<double> values) {
  final sorted = List<double>.from(values)..sort();
  final n = sorted.length;
  final min = sorted.first;
  final max = sorted.last;
  final mean = sorted.reduce((a, b) => a + b) / n;
  final median = n % 2 == 0
      ? (sorted[n ~/ 2 - 1] + sorted[n ~/ 2]) / 2.0
      : sorted[n ~/ 2];
  final p95Index = ((n * 0.95).floor()).clamp(0, n - 1);
  final p95 = sorted[p95Index];

  return StatResult(
    min: min,
    max: max,
    mean: mean,
    median: median,
    p95: p95,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 5E — Reconciled Performance Benchmarks (Detection vs Suggestions)', () {
    late MedicalDictionaryRepository repository;
    late SpellingEngine engine;

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

    setUpAll(() {
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
    });

    test('1. Detection-only scanning (keystroke mode, computeSuggestions = false)', () {
      print('--- BENCHMARK: DETECTION-ONLY SCANNING (50 iterations) ---');

      // Warmup
      engine.checkText(paragraph150, computeSuggestions: false);

      // A. 150-word note
      final times150 = <double>[];
      for (var i = 0; i < 50; i++) {
        final sw = Stopwatch()..start();
        final issues = engine.checkText(paragraph150, computeSuggestions: false);
        sw.stop();
        times150.add(sw.elapsedMicroseconds / 1000.0);
        expect(issues, isNotEmpty);
      }
      final stats150 = calculateStats(times150);
      print('150-word Note (Detection only): $stats150');

      // B. 500-word note
      final buffer500 = StringBuffer();
      for (var i = 0; i < 4; i++) {
        buffer500.writeln(paragraph150);
      }
      final text500 = buffer500.toString();

      final times500 = <double>[];
      for (var i = 0; i < 50; i++) {
        final sw = Stopwatch()..start();
        final issues = engine.checkText(text500, computeSuggestions: false);
        sw.stop();
        times500.add(sw.elapsedMicroseconds / 1000.0);
        expect(issues, isNotEmpty);
      }
      final stats500 = calculateStats(times500);
      print('500-word Note (Detection only): $stats500');

      // Thresholds: detection on 150 words must stay well below 16ms frame budget (60 FPS)
      expect(stats150.median, lessThan(5.0), reason: 'Median detection time for 150 words should be < 5ms');
      expect(stats150.p95, lessThan(16.0), reason: 'P95 detection time for 150 words should be < 16ms (60fps)');
    });

    test('2. On-demand suggestion generation for single typos (tap mode)', () {
      print('--- BENCHMARK: SINGLE-TYPO SUGGESTION GENERATION (20 iterations each) ---');

      // Typos to measure
      final typos = ['fevr', 'paracetmol', 'hypertensn'];

      for (final typo in typos) {
        final times = <double>[];
        for (var i = 0; i < 20; i++) {
          final sw = Stopwatch()..start();
          final suggestions = repository.getSuggestions(typo, maxSuggestions: 4);
          sw.stop();
          times.add(sw.elapsedMicroseconds / 1000.0);
          expect(suggestions, isNotEmpty);
        }
        final stats = calculateStats(times);
        print('Suggestion Gen for "$typo": $stats');
        expect(stats.median, lessThan(150.0), reason: 'Median suggestion time should be < 150ms');
        expect(stats.p95, lessThan(250.0), reason: 'P95 suggestion time should be < 250ms');
      }
    });

    test('3. Full paragraph scanning WITH suggestion computation (batch mode)', () {
      print('--- BENCHMARK: BATCH SCAN WITH SUGGESTIONS (20 iterations) ---');

      // Warmup
      engine.checkText(paragraph150, computeSuggestions: true);

      final times = <double>[];
      for (var i = 0; i < 20; i++) {
        engine.clearCache(); // Force recalculation to benchmark worst-case uncached compute
        final sw = Stopwatch()..start();
        final issues = engine.checkText(paragraph150, computeSuggestions: true);
        sw.stop();
        times.add(sw.elapsedMicroseconds / 1000.0);
        expect(issues, isNotEmpty);
      }
      final stats = calculateStats(times);
      print('150-word Note with 5 typos (Uncached Full Suggestions): $stats');

      // Test cached performance
      final cachedTimes = <double>[];
      for (var i = 0; i < 20; i++) {
        final sw = Stopwatch()..start();
        final issues = engine.checkText(paragraph150, computeSuggestions: true);
        sw.stop();
        cachedTimes.add(sw.elapsedMicroseconds / 1000.0);
        expect(issues, isNotEmpty);
      }
      final cachedStats = calculateStats(cachedTimes);
      print('150-word Note with 5 typos (LRU-Cached Suggestions): $cachedStats');
      expect(cachedStats.median, lessThan(2.0), reason: 'Cached lookup should be < 2ms');
    });
  });
}
