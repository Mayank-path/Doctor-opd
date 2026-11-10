import 'dart:async';
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../engine/spelling_engine.dart';
import '../models/spelling_issue.dart';

/// Specialized [TextEditingController] that provides inline visual error highlighting
/// (red wavy underline) for misspelled clinical words without modifying the raw text.
class SpellingTextEditingController extends TextEditingController {
  final SpellingEngine? spellingEngine;
  final Duration debounceDuration;

  final Set<String> _ignoredWords = <String>{};
  List<SpellingIssue> _currentIssues = const [];
  Timer? _debounceTimer;

  SpellingTextEditingController({
    super.text,
    this.spellingEngine,
    this.debounceDuration = const Duration(milliseconds: 200),
  }) {
    if (spellingEngine != null) {
      _checkSpellingImmediate();
      addListener(_onTextChanged);
    }
  }

  /// The active spelling issues identified in the current text.
  List<SpellingIssue> get currentIssues => _currentIssues;

  /// Set of words ignored by the doctor in the current editing session.
  Set<String> get ignoredWords => Set.unmodifiable(_ignoredWords);

  void _onTextChanged() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(debounceDuration, () {
      _checkSpellingImmediate();
    });
  }

  /// Forces immediate spelling check of the current text.
  void checkSpellingNow() {
    _debounceTimer?.cancel();
    _checkSpellingImmediate();
  }

  void _checkSpellingImmediate() {
    if (spellingEngine == null) return;
    final issues = spellingEngine!.checkText(
      text,
      ignoredWords: _ignoredWords,
    );

    // Only notify if issues changed to minimize unnecessary repaints
    if (!_areIssuesEqual(_currentIssues, issues)) {
      _currentIssues = issues;
      notifyListeners();
    }
  }

  bool _areIssuesEqual(List<SpellingIssue> a, List<SpellingIssue> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  /// Returns the [SpellingIssue] at or surrounding the specified character offset, if any.
  SpellingIssue? getIssueAtOffset(int offset) {
    for (final issue in _currentIssues) {
      if (issue.containsOffset(offset)) {
        return issue;
      }
    }
    return null;
  }

  /// Replaces the word in [issue] with [replacement], preserving cursor position and surrounding text.
  void replaceWord(SpellingIssue issue, String replacement) {
    final currentText = text;
    if (issue.startIndex >= 0 &&
        issue.endIndex <= currentText.length &&
        currentText.substring(issue.startIndex, issue.endIndex) == issue.word) {
      final before = currentText.substring(0, issue.startIndex);
      final after = currentText.substring(issue.endIndex);
      final newText = before + replacement + after;
      final newCursorOffset = (issue.startIndex + replacement.length).clamp(0, newText.length);

      value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: newCursorOffset),
      );

      checkSpellingNow();
    }
  }

  /// Ignores the specified word for the current session, removing its error underline.
  void ignoreWord(String word) {
    final lower = word.toLowerCase().trim();
    if (lower.isNotEmpty && _ignoredWords.add(lower)) {
      _currentIssues = _currentIssues.where((i) => i.word.toLowerCase() != lower).toList();
      notifyListeners();
    }
  }

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    if (_currentIssues.isEmpty || text.isEmpty) {
      return super.buildTextSpan(
        context: context,
        style: style,
        withComposing: withComposing,
      );
    }

    final children = <TextSpan>[];
    var currentIndex = 0;

    // Filter out issues that intersect with active IME composing region
    final activeIssues = _currentIssues.where((issue) {
      if (withComposing && value.isComposingRangeValid) {
        final compStart = value.composing.start;
        final compEnd = value.composing.end;
        if (issue.startIndex < compEnd && issue.endIndex > compStart) {
          return false;
        }
      }
      return true;
    }).toList()
      ..sort((a, b) => a.startIndex.compareTo(b.startIndex));

    final defaultStyle = style ?? const TextStyle();
    final errorStyle = defaultStyle.copyWith(
      decoration: TextDecoration.underline,
      decorationColor: AppTheme.errorRed,
      decorationStyle: TextDecorationStyle.wavy,
      decorationThickness: 1.5,
    );

    for (final issue in activeIssues) {
      if (issue.startIndex < currentIndex) continue;
      if (issue.startIndex > text.length) break;

      // Add normal text before the issue
      if (issue.startIndex > currentIndex) {
        children.add(
          TextSpan(
            text: text.substring(currentIndex, issue.startIndex),
            style: defaultStyle,
          ),
        );
      }

      // Add misspelled word with red underline
      final issueEnd = issue.endIndex.clamp(0, text.length);
      children.add(
        TextSpan(
          text: text.substring(issue.startIndex, issueEnd),
          style: errorStyle,
        ),
      );

      currentIndex = issueEnd;
    }

    // Add remaining trailing text
    if (currentIndex < text.length) {
      children.add(
        TextSpan(
          text: text.substring(currentIndex),
          style: defaultStyle,
        ),
      );
    }

    return TextSpan(style: style, children: children);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}

