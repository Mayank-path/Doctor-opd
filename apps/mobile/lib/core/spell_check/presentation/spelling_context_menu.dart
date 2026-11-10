import 'package:flutter/material.dart';
import '../models/spelling_issue.dart';
import 'spelling_text_editing_controller.dart';

/// Builds a context menu with spelling correction suggestions for a [SpellingTextEditingController].
Widget buildSpellingContextMenu(
  BuildContext context,
  EditableTextState editableTextState,
  SpellingTextEditingController controller,
) {
  final List<ContextMenuButtonItem> buttonItems =
      List.from(editableTextState.contextMenuButtonItems);

  // Check if cursor or selection overlaps a misspelled word
  final text = controller.text;
  final selection = controller.selection;
  final offset = selection.isValid ? selection.baseOffset : -1;

  SpellingIssue? activeIssue;
  if (offset >= 0 && offset <= text.length) {
    activeIssue = controller.getIssueAtOffset(offset);
    // If not directly at offset, check offset - 1 in case cursor is at end of word
    if (activeIssue == null && offset > 0) {
      activeIssue = controller.getIssueAtOffset(offset - 1);
    }
  }

  if (activeIssue != null) {
    final issue = activeIssue;
    final List<ContextMenuButtonItem> suggestionItems = [];

    // Add suggestion items
    for (final suggestion in issue.suggestions.take(3)) {
      suggestionItems.add(
        ContextMenuButtonItem(
          label: 'Suggestion: $suggestion',
          onPressed: () {
            controller.replaceWord(issue, suggestion);
            editableTextState.hideToolbar();
          },
        ),
      );
    }

    // Add Ignore item
    suggestionItems.add(
      ContextMenuButtonItem(
        label: 'Ignore "${issue.word}"',
        onPressed: () {
          controller.ignoreWord(issue.word);
          editableTextState.hideToolbar();
        },
      ),
    );

    // Prepend suggestion items before standard clipboard items
    buttonItems.insertAll(0, suggestionItems);
  }

  return AdaptiveTextSelectionToolbar.buttonItems(
    anchors: editableTextState.contextMenuAnchors,
    buttonItems: buttonItems,
  );
}

