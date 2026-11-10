import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/spelling_engine.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Real Production Dictionary Integration Tests', () {
    late MedicalDictionaryRepository repository;
    late SpellingEngine engine;

    setUpAll(() async {
      // Load actual bundled assets from assets/dictionaries/
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

    test('production dictionary initialization verifies asset word counts', () {
      expect(repository.isInitialized, isTrue);
      // Production English vocabulary from SCOWL 35 & 50
      expect(repository.englishWordCount, greaterThan(70000));
      // Production Medical vocabulary from NLM MeSH and OPD medications
      expect(repository.medicalWordCount, greaterThan(19000));
      // Clinical OPD abbreviations
      expect(repository.abbreviationCount, greaterThanOrEqualTo(200));
    });

    group('Mandatory Suggestion Ranking Test Cases (Within Top 4)', () {
      test('1. fevr -> fever within top 4 suggestions', () {
        final suggestions = repository.getSuggestions('fevr');
        expect(suggestions, isNotEmpty);
        expect(suggestions.length, lessThanOrEqualTo(4));
        expect(suggestions, contains('fever'));
        expect(suggestions.first, equals('fever'));
      });

      test('2. hedache -> headache within top 4 suggestions', () {
        final suggestions = repository.getSuggestions('hedache');
        expect(suggestions, isNotEmpty);
        expect(suggestions.length, lessThanOrEqualTo(4));
        expect(suggestions, contains('headache'));
        expect(suggestions.first, equals('headache'));
      });

      test('3. pneuomnia -> pneumonia within top 4 suggestions', () {
        final suggestions = repository.getSuggestions('pneuomnia');
        expect(suggestions, isNotEmpty);
        expect(suggestions.length, lessThanOrEqualTo(4));
        expect(suggestions, contains('pneumonia'));
        expect(suggestions.first, equals('pneumonia'));
      });

      test('4. paracetmol -> paracetamol within top 4 suggestions', () {
        final suggestions = repository.getSuggestions('paracetmol');
        expect(suggestions, isNotEmpty);
        expect(suggestions.length, lessThanOrEqualTo(4));
        expect(suggestions, contains('paracetamol'));
        expect(suggestions.first, equals('paracetamol'));
      });

      test('5. hypertensn -> hypertension within top 4 suggestions', () {
        final suggestions = repository.getSuggestions('hypertensn');
        expect(suggestions, isNotEmpty);
        expect(suggestions.length, lessThanOrEqualTo(4));
        expect(suggestions, contains('hypertension'));
        expect(suggestions.first, equals('hypertension'));
      });

      test('6. diabtes -> diabetes within top 4 suggestions', () {
        final suggestions = repository.getSuggestions('diabtes');
        expect(suggestions, isNotEmpty);
        expect(suggestions.length, lessThanOrEqualTo(4));
        expect(suggestions, contains('diabetes'));
        expect(suggestions.first, equals('diabetes'));
      });
    });

    test('deterministic suggestion ordering across repeated runs', () {
      final run1 = repository.getSuggestions('fevr');
      final run2 = repository.getSuggestions('fevr');
      final run3 = repository.getSuggestions('fevr');

      expect(run1, equals(run2));
      expect(run2, equals(run3));
      expect(run1.first, equals('fever'));
    });

    test('preserves casing in production suggestions', () {
      // Lowercase
      expect(repository.getSuggestions('fevr').first, equals('fever'));
      // TitleCase
      expect(repository.getSuggestions('Fevr').first, equals('Fever'));
      // ALL CAPS
      expect(repository.getSuggestions('FEVR').first, equals('FEVER'));
      // TitleCase for headache
      expect(repository.getSuggestions('Hedache').first, equals('Headache'));
      // ALL CAPS for diabetes
      expect(repository.getSuggestions('DIABTES').first, equals('DIABETES'));
    });

    test('recognizes standard medical conditions and Indian OPD drugs', () {
      expect(repository.isWordValid('malaria'), isTrue);
      expect(repository.isWordValid('dengue'), isTrue);
      expect(repository.isWordValid('typhoid'), isTrue);
      expect(repository.isWordValid('asthma'), isTrue);
      expect(repository.isWordValid('amoxicillin'), isTrue);
      expect(repository.isWordValid('metformin'), isTrue);
      expect(repository.isWordValid('pantoprazole'), isTrue);
      expect(repository.isWordValid('atorvastatin'), isTrue);
      expect(repository.isWordValid('salbutamol'), isTrue);
      expect(repository.isWordValid('azithromycin'), isTrue);
      expect(repository.isWordValid('ciprofloxacin'), isTrue);
      // Verified clinical terms and findings
      expect(repository.isWordValid('coryza'), isTrue);
      expect(repository.isWordValid('bodyache'), isTrue);
      expect(repository.isWordValid('retrosternal'), isTrue);
      // Unverified proprietary brand names are excluded from bundled assets
      expect(repository.isWordValid('dolo'), isFalse);
      expect(repository.isWordValid('crocin'), isFalse);
      expect(repository.isWordValid('pantocid'), isFalse);
    });

    test('recognizes clinical abbreviations case-insensitively', () {
      expect(repository.isWordValid('OD'), isTrue);
      expect(repository.isWordValid('od'), isTrue);
      expect(repository.isWordValid('BD'), isTrue);
      expect(repository.isWordValid('TDS'), isTrue);
      expect(repository.isWordValid('QID'), isTrue);
      expect(repository.isWordValid('SOS'), isTrue);
      expect(repository.isWordValid('PRN'), isTrue);
      expect(repository.isWordValid('STAT'), isTrue);
      expect(repository.isWordValid('BP'), isTrue);
      expect(repository.isWordValid('HR'), isTrue);
      expect(repository.isWordValid('RR'), isTrue);
      expect(repository.isWordValid('SpO2'), isTrue);
      expect(repository.isWordValid('spo2'), isTrue);
      expect(repository.isWordValid('CBC'), isTrue);
      expect(repository.isWordValid('ECG'), isTrue);
      expect(repository.isWordValid('O/E'), isTrue);
      expect(repository.isWordValid('o/e'), isTrue);
      expect(repository.isWordValid('P/R'), isTrue);
    });

    test('LRU cache maintains strictly bounded capacity under continuous narrative scanning', () {
      expect(engine.validityCacheSize, equals(0));
      expect(engine.suggestionCacheSize, equals(0));

      const clinicalParagraph = '''
Patient attended OPD with complaints of fevr, severe hedache, and persistent cough since 4 days.
Known k/c/o hypertensn and diabtes on regular medications.
Vitals: BP 130/84 mmHg, HR 82 bpm, SpO2 98%, Temp 100.4F.
Advised Tab paracetmol 650mg TDS, Tab amoxicillin 500mg TDS for 5 days.
''';

      final issues = engine.checkText(clinicalParagraph);

      // Verify that all 5 typos in the paragraph were detected
      final wordsFound = issues.map((i) => i.word).toList();
      expect(wordsFound, contains('fevr'));
      expect(wordsFound, contains('hedache'));
      expect(wordsFound, contains('hypertensn'));
      expect(wordsFound, contains('diabtes'));
      expect(wordsFound, contains('paracetmol'));

      // Verify caches are populated but bounded
      expect(engine.validityCacheSize, greaterThan(0));
      expect(engine.validityCacheSize, lessThanOrEqualTo(500));
      expect(engine.suggestionCacheSize, greaterThan(0));
      expect(engine.suggestionCacheSize, lessThanOrEqualTo(500));

      // Clear cache verification
      engine.clearCache();
      expect(engine.validityCacheSize, equals(0));
      expect(engine.suggestionCacheSize, equals(0));
    });
  });
}

