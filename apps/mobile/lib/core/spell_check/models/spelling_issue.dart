/// Represents a detected spelling issue in narrative clinical text.
class SpellingIssue {
  /// The original raw word as it appears in the text.
  final String word;

  /// Start character index in the source text (inclusive).
  final int startIndex;

  /// End character index in the source text (exclusive).
  final int endIndex;

  /// List of ranked spelling suggestions for manual doctor correction.
  final List<String> suggestions;

  const SpellingIssue({
    required this.word,
    required this.startIndex,
    required this.endIndex,
    this.suggestions = const [],
  });

  /// Returns true if the given character offset is within this word.
  bool containsOffset(int offset) {
    return offset >= startIndex && offset <= endIndex;
  }

  SpellingIssue copyWith({
    String? word,
    int? startIndex,
    int? endIndex,
    List<String>? suggestions,
  }) {
    return SpellingIssue(
      word: word ?? this.word,
      startIndex: startIndex ?? this.startIndex,
      endIndex: endIndex ?? this.endIndex,
      suggestions: suggestions ?? this.suggestions,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SpellingIssue &&
          runtimeType == other.runtimeType &&
          word == other.word &&
          startIndex == other.startIndex &&
          endIndex == other.endIndex;

  @override
  int get hashCode => Object.hash(word, startIndex, endIndex);

  @override
  String toString() =>
      'SpellingIssue($word, [$startIndex, $endIndex], suggestions: $suggestions)';
}

