import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';

void main() {
  group('MedicalDictionaryRepository Unit Tests', () {
    late MedicalDictionaryRepository repository;

    setUp(() {
      repository = MedicalDictionaryRepository(
        initialEnglishWords: {
          'patient', 'patients', 'doctor', 'fever', 'headache', 'cough',
          'vomiting', 'pain', 'severe', 'mild', 'since', 'days', 'has', 'and'
        },
        initialMedicalWords: {
          'hypertension', 'diabetes', 'myocardial', 'tachycardia', 'pneumonia',
          'bronchitis', 'paracetamol', 'amoxicillin', 'metformin', 'malaria'
        },
        initialAbbreviations: {
          'BP', 'HR', 'RR', 'SpO2', 'OD', 'BD', 'TDS', 'SOS', 'PRN', 'ECG', 'CBC'
        },
      );
    });

    test('validates common English words accurately', () {
      expect(repository.isWordValid('patient'), isTrue);
      expect(repository.isWordValid('fever'), isTrue);
      expect(repository.isWordValid('headache'), isTrue);
      expect(repository.isWordValid('cough'), isTrue);
      expect(repository.isWordValid('pain'), isTrue);
    });

    test('validates medical terminology accurately', () {
      expect(repository.isWordValid('hypertension'), isTrue);
      expect(repository.isWordValid('diabetes'), isTrue);
      expect(repository.isWordValid('paracetamol'), isTrue);
      expect(repository.isWordValid('amoxicillin'), isTrue);
      expect(repository.isWordValid('metformin'), isTrue);
    });

    test('validates clinical abbreviations case-insensitively', () {
      expect(repository.isWordValid('BP'), isTrue);
      expect(repository.isWordValid('bp'), isTrue);
      expect(repository.isWordValid('SpO2'), isTrue);
      expect(repository.isWordValid('spo2'), isTrue);
      expect(repository.isWordValid('OD'), isTrue);
      expect(repository.isWordValid('bd'), isTrue);
      expect(repository.isWordValid('TDS'), isTrue);
      expect(repository.isWordValid('sos'), isTrue);
    });

    test('strips surrounding punctuation during validation', () {
      expect(repository.isWordValid('fever,'), isTrue);
      expect(repository.isWordValid('"cough"'), isTrue);
      expect(repository.isWordValid('headache.'), isTrue);
      expect(repository.isWordValid('(diabetes)'), isTrue);
    });

    test('protects clinical numbers, vitals, measurements and doses from false errors', () {
      expect(repository.isProtectedToken('120/80'), isTrue);
      expect(repository.isProtectedToken('98.6F'), isTrue);
      expect(repository.isProtectedToken('500mg'), isTrue);
      expect(repository.isProtectedToken('5ml'), isTrue);
      expect(repository.isProtectedToken('10mcg'), isTrue);
      expect(repository.isProtectedToken('1-2'), isTrue);
      expect(repository.isProtectedToken('2026-11-10'), isTrue);
      expect(repository.isProtectedToken('mg'), isTrue);
      expect(repository.isProtectedToken('mmHg'), isTrue);
      expect(repository.isProtectedToken('bpm'), isTrue);
      expect(repository.isWordValid('120/80'), isTrue);
      expect(repository.isWordValid('500mg'), isTrue);
    });

    test('flags misspelled words as invalid', () {
      expect(repository.isWordValid('fevr'), isFalse);
      expect(repository.isWordValid('hedache'), isFalse);
      expect(repository.isWordValid('diabtes'), isFalse);
      expect(repository.isWordValid('paracetaml'), isFalse);
    });

    test('generates accurate correction suggestions with distance ranking', () {
      final feverSuggestions = repository.getSuggestions('fevr');
      expect(feverSuggestions, contains('fever'));

      final headacheSuggestions = repository.getSuggestions('hedache');
      expect(headacheSuggestions, contains('headache'));

      final diabetesSuggestions = repository.getSuggestions('diabtes');
      expect(diabetesSuggestions, contains('diabetes'));
    });

    test('preserves casing in correction suggestions', () {
      // Title Case
      final titleSuggestions = repository.getSuggestions('Fevr');
      expect(titleSuggestions.first, equals('Fever'));

      // ALL CAPS
      final capsSuggestions = repository.getSuggestions('FEVR');
      expect(capsSuggestions.first, equals('FEVER'));

      // Lowercase
      final lowerSuggestions = repository.getSuggestions('fevr');
      expect(lowerSuggestions.first, equals('fever'));
    });

    test('returns empty suggestions for empty or already valid words', () {
      expect(repository.getSuggestions(''), isEmpty);
      expect(repository.getSuggestions('fever'), isEmpty);
      expect(repository.getSuggestions('BP'), isEmpty);
    });

    test('handles fallback initialization when asset loading is unavailable', () async {
      final fallbackRepo = MedicalDictionaryRepository();
      expect(fallbackRepo.isInitialized, isFalse);
      await fallbackRepo.initialize();
      expect(fallbackRepo.isInitialized, isTrue);
      expect(fallbackRepo.englishWordCount, greaterThan(0));
      expect(fallbackRepo.medicalWordCount, greaterThan(0));
      expect(fallbackRepo.abbreviationCount, greaterThan(0));
    });
  });
}

