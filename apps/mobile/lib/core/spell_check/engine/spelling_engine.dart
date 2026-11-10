import '../dictionary/medical_dictionary_repository.dart';
import '../models/spelling_issue.dart';
import 'lru_cache.dart';

/// Local offline spelling engine for clinical narrative text.
/// Uses bounded Least-Recently-Used (LRU) caches to prevent unbounded memory growth.
class SpellingEngine {
  final MedicalDictionaryRepository dictionaryRepository;
  final int cacheCapacity;

  // Memory-bounded LRU caches (default max 500 entries each)
  final LruCache<String, bool> _validityCache;
  final LruCache<String, List<String>> _suggestionCache;

  SpellingEngine({
    required this.dictionaryRepository,
    this.cacheCapacity = 500,
  })  : _validityCache = LruCache<String, bool>(capacity: cacheCapacity),
        _suggestionCache = LruCache<String, List<String>>(capacity: cacheCapacity);

  /// Current number of entries in the validity cache.
  int get validityCacheSize => _validityCache.length;

  /// Current number of entries in the suggestion cache.
  int get suggestionCacheSize => _suggestionCache.length;

  /// Analyzes text and returns a list of detected spelling issues.
  List<SpellingIssue> checkText(
    String text, {
    Set<String>? ignoredWords,
    bool computeSuggestions = true,
  }) {
    if (text.isEmpty) return const [];

    final issues = <SpellingIssue>[];
    final ignoredLower = ignoredWords?.map((w) => w.toLowerCase()).toSet();

    // Regex to match narrative tokens (clinical words, abbreviations, and alphanumeric expressions)
    // Matches "headache", "patient's", "follow-up", "SpO2", "COVID-19", "UHID-12345"
    final tokenRegex = RegExp(r"[A-Za-z0-9]+(?:['’\-_/][A-Za-z0-9]+)*");
    final matches = tokenRegex.allMatches(text);

    for (final match in matches) {
      final rawWord = match.group(0)!;
      final start = match.start;
      final end = match.end;

      // Ignore single character tokens (e.g. 'a', 'I')
      if (rawWord.length <= 1) continue;

      // Skip tokens that are protected clinical data (digits, units, measurements)
      if (dictionaryRepository.isProtectedToken(rawWord)) continue;

      final lowerWord = rawWord.toLowerCase();

      // Check if ignored by doctor for this consultation session
      if (ignoredLower != null && ignoredLower.contains(lowerWord)) {
        continue;
      }

      // Check validity (with bounded LRU cache)
      final isValid = _validityCache.putIfAbsent(
        lowerWord,
        () => dictionaryRepository.isWordValid(rawWord),
      );

      if (!isValid) {
        List<String> suggestions = const [];
        if (computeSuggestions) {
          suggestions = _suggestionCache.putIfAbsent(
            rawWord,
            () => dictionaryRepository.getSuggestions(rawWord),
          );
        }

        issues.add(
          SpellingIssue(
            word: rawWord,
            startIndex: start,
            endIndex: end,
            suggestions: suggestions,
          ),
        );
      }
    }

    return issues;
  }

  /// Clears internal LRU lookup caches (useful after dictionary reloads).
  void clearCache() {
    _validityCache.clear();
    _suggestionCache.clear();
  }
}
