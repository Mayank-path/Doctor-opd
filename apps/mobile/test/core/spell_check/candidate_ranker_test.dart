import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/candidate_ranker.dart';

void main() {
  group('CandidateRanker Unit Tests', () {
    test('ranks Tier 1 and Tier 2 terms ahead of obscure candidates', () {
      final candidates = ['fear', 'feer', 'fer', 'ferv', 'fev', 'fever'];

      final results = CandidateRanker.rankCandidates(
        targetWord: 'fevr',
        candidates: candidates,
        getWordTier: (w) {
          if (w == 'fever') return VocabularyTier.commonClinical;
          if (w == 'fear') return VocabularyTier.commonEnglish;
          return VocabularyTier.generalExtended;
        },
        isClinicalWord: (w) => w == 'fever',
        maxSuggestions: 4,
      );

      expect(results, contains('fever'));
      expect(results.first, equals('fever'));
      expect(results.length, lessThanOrEqualTo(4));
    });

    test('preserves Title Case, ALL CAPS, and lowercase transformations', () {
      expect(CandidateRanker.applyCasing('fevr', 'fever'), equals('fever'));
      expect(CandidateRanker.applyCasing('Fevr', 'fever'), equals('Fever'));
      expect(CandidateRanker.applyCasing('FEVR', 'fever'), equals('FEVER'));
      expect(CandidateRanker.applyCasing('Hedache', 'headache'), equals('Headache'));
      expect(CandidateRanker.applyCasing('DIABTES', 'diabetes'), equals('DIABETES'));
    });

    test('calculates Damerau-Levenshtein distance correctly including transpositions', () {
      // Identity
      expect(CandidateRanker.damerauLevenshteinDistance('fever', 'fever', 2), equals(0));
      // Substitution
      expect(CandidateRanker.damerauLevenshteinDistance('fever', 'feder', 2), equals(1));
      // Insertion
      expect(CandidateRanker.damerauLevenshteinDistance('fevr', 'fever', 2), equals(1));
      // Deletion
      expect(CandidateRanker.damerauLevenshteinDistance('fevers', 'fever', 2), equals(1));
      // Transposition (e.g. pneuomnia -> pneumonia)
      expect(CandidateRanker.damerauLevenshteinDistance('pneuomnia', 'pneumonia', 2), equals(1));
      // Exceeds maxAllowed
      expect(CandidateRanker.damerauLevenshteinDistance('abc', 'xyz', 1), greaterThan(1));
    });

    test('penalizes words with non-matching first characters', () {
      final candidates = ['lever', 'never', 'fever'];

      final results = CandidateRanker.rankCandidates(
        targetWord: 'fevr',
        candidates: candidates,
        getWordTier: (w) => VocabularyTier.commonEnglish,
        isClinicalWord: (w) => w == 'fever',
        maxSuggestions: 3,
      );

      // 'fever' starts with 'f' matching 'fevr', so it must be ranked first
      expect(results.first, equals('fever'));
    });
  });
}

