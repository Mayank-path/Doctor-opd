import 'dart:math' as math;

/// Vocabulary tiers for deterministic, clinical-safety-oriented candidate ranking.
enum VocabularyTier {
  /// Tier 1: Highest frequency general English vocabulary (e.g. fever, headache, weakness, nausea).
  commonEnglish,

  /// Tier 2: Common clinical terminology & primary OPD pharmacology (e.g. hypertension, diabetes, pneumonia, paracetamol).
  commonClinical,

  /// Tier 3: Specialized medical terminology (MeSH descriptors, specialized anatomy, pathologies).
  specializedMedical,

  /// Tier 4: General extended dictionary entries.
  generalExtended,
}

/// A candidate suggestion paired with its calculated ranking metrics.
class CandidateScore {
  final String word;
  final int score;
  final int distance;
  final VocabularyTier tier;

  const CandidateScore({
    required this.word,
    required this.score,
    required this.distance,
    required this.tier,
  });
}

/// Deterministic, frequency-aware spelling suggestion ranker for clinical and narrative text.
class CandidateRanker {
  /// Ranks candidates for [targetWord] using edit distance, vocabulary tiers,
  /// frequency weighting, initial character matching, and length fidelity.
  static List<String> rankCandidates({
    required String targetWord,
    required Iterable<String> candidates,
    required VocabularyTier Function(String word) getWordTier,
    required bool Function(String word) isClinicalWord,
    int Function(String word)? getFrequencyRank,
    int maxSuggestions = 4,
  }) {
    if (targetWord.isEmpty || candidates.isEmpty) return const [];

    final lowerTarget = targetWord.toLowerCase();
    final targetLen = lowerTarget.length;
    final maxAllowedDistance = targetLen <= 4 ? 1 : 2;
    final firstChar = lowerTarget[0];

    final scored = <CandidateScore>[];

    for (final candidate in candidates) {
      final candLen = candidate.length;
      final lenDelta = (candLen - targetLen).abs();
      if (lenDelta > maxAllowedDistance) continue;

      final dist = damerauLevenshteinDistance(lowerTarget, candidate, maxAllowedDistance);
      if (dist > maxAllowedDistance) continue;

      final tier = getWordTier(candidate);
      final sameFirst = candidate[0] == firstChar;
      final isClinical = isClinicalWord(candidate);

      // Base score: 100 points per edit distance unit
      var score = dist * 100;

      // Penalty if first character does not match
      if (!sameFirst) {
        score += 50;
      }

      // Penalty for length discrepancy
      score += lenDelta * 5;

      // Vocabulary tier bonus (subtracted to favor higher tier)
      switch (tier) {
        case VocabularyTier.commonClinical:
          score -= 50;
          break;
        case VocabularyTier.commonEnglish:
          score -= 40;
          break;
        case VocabularyTier.specializedMedical:
          score -= 25;
          break;
        case VocabularyTier.generalExtended:
          score -= 15;
          break;
      }

      // Clinical terminology bonus
      if (isClinical) {
        score -= 10;
      }

      // Word frequency rank bonus (if available)
      if (getFrequencyRank != null) {
        final rank = getFrequencyRank(candidate);
        if (rank >= 0 && rank < 2000) {
          score -= 15;
        } else if (rank >= 0 && rank < 10000) {
          score -= 10;
        } else if (rank >= 0 && rank < 30000) {
          score -= 5;
        }
      }

      scored.add(
        CandidateScore(
          word: candidate,
          score: score,
          distance: dist,
          tier: tier,
        ),
      );
    }

    if (scored.isEmpty) return const [];

    // Deterministic sort:
    // 1. Score ascending (lower is better)
    // 2. Vocabulary tier index ascending
    // 3. Distance ascending
    // 4. Alphabetical tie-breaking
    scored.sort((a, b) {
      if (a.score != b.score) return a.score.compareTo(b.score);
      if (a.tier.index != b.tier.index) return a.tier.index.compareTo(b.tier.index);
      if (a.distance != b.distance) return a.distance.compareTo(b.distance);
      return a.word.compareTo(b.word);
    });

    final result = <String>[];
    final seen = <String>{};

    for (final cs in scored) {
      if (seen.add(cs.word)) {
        result.add(applyCasing(targetWord, cs.word));
        if (result.length >= maxSuggestions) break;
      }
    }

    return result;
  }

  /// Preserves casing of the original word (UPPERCASE, TitleCase, or lowercase).
  static String applyCasing(String original, String suggestion) {
    if (original.isEmpty || suggestion.isEmpty) return suggestion;

    // 1. ALL CAPS (e.g. FEVR -> FEVER)
    if (original.length >= 2 && original == original.toUpperCase()) {
      return suggestion.toUpperCase();
    }

    // 2. Title Case (e.g. Fevr -> Fever)
    if (original[0] == original[0].toUpperCase()) {
      return suggestion[0].toUpperCase() +
          (suggestion.length > 1 ? suggestion.substring(1) : '');
    }

    // 3. Lowercase
    return suggestion.toLowerCase();
  }

  /// Calculates Damerau-Levenshtein distance (insertions, deletions, substitutions,
  /// adjacent transpositions) with early row termination.
  static int damerauLevenshteinDistance(String s1, String s2, int maxAllowed) {
    final len1 = s1.length;
    final len2 = s2.length;

    if ((len1 - len2).abs() > maxAllowed) return maxAllowed + 1;
    if (s1 == s2) return 0;
    if (len1 == 0) return len2;
    if (len2 == 0) return len1;

    List<int> prevPrev = List.filled(len2 + 1, 0);
    List<int> prev = List.filled(len2 + 1, 0);
    List<int> curr = List.filled(len2 + 1, 0);

    for (var j = 0; j <= len2; j++) {
      prev[j] = j;
    }

    for (var i = 1; i <= len1; i++) {
      curr[0] = i;
      var minInRow = curr[0];

      for (var j = 1; j <= len2; j++) {
        final cost = (s1[i - 1] == s2[j - 1]) ? 0 : 1;
        var d = math.min(
          curr[j - 1] + 1, // insertion
          math.min(
            prev[j] + 1, // deletion
            prev[j - 1] + cost, // substitution
          ),
        );

        // Transposition
        if (i > 1 &&
            j > 1 &&
            s1[i - 1] == s2[j - 2] &&
            s1[i - 2] == s2[j - 1]) {
          d = math.min(d, prevPrev[j - 2] + 1);
        }

        curr[j] = d;
        if (d < minInRow) minInRow = d;
      }

      // Early termination if entire row exceeds maxAllowed
      if (minInRow > maxAllowed) return maxAllowed + 1;

      final temp = prevPrev;
      prevPrev = prev;
      prev = curr;
      curr = temp;
    }

    return prev[len2];
  }
}

