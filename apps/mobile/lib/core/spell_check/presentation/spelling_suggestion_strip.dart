import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../models/spelling_issue.dart';
import 'spelling_text_editing_controller.dart';

/// A compact, theme-compliant suggestion strip displayed above or near a clinical text field
/// when the cursor is positioned on a misspelled word, offering one-tap doctor correction.
class SpellingSuggestionStrip extends StatelessWidget {
  final SpellingTextEditingController controller;
  final FocusNode? focusNode;

  const SpellingSuggestionStrip({
    super.key,
    required this.controller,
    this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        // Only show if the field has focus (or if no focusNode provided, when text has issues)
        if (focusNode != null && !focusNode!.hasFocus) {
          return const SizedBox.shrink();
        }

        final selection = controller.selection;
        if (!selection.isValid) return const SizedBox.shrink();

        final offset = selection.baseOffset;
        SpellingIssue? activeIssue = controller.getIssueAtOffset(offset);
        if (activeIssue == null && offset > 0) {
          activeIssue = controller.getIssueAtOffset(offset - 1);
        }

        if (activeIssue == null || activeIssue.suggestions.isEmpty) {
          return const SizedBox.shrink();
        }

        final issue = activeIssue;
        final colors = context.colors;

        return Container(
          margin: const EdgeInsets.only(top: 6, bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: colors.surfaceContainer,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: colors.border),
          ),
          child: Row(
            children: [
              Icon(
                Icons.spellcheck_rounded,
                size: 16,
                color: AppTheme.errorRed,
              ),
              const SizedBox(width: 6),
              Text(
                '${issue.word}:',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ...issue.suggestions.take(3).map((suggestion) {
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ActionChip(
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            backgroundColor: colors.surface,
                            side: BorderSide(color: colors.primaryAccent.withAlpha(120)),
                            label: Text(
                              suggestion,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: colors.primaryAccent,
                              ),
                            ),
                            onPressed: () {
                              controller.replaceWord(issue, suggestion);
                            },
                          ),
                        );
                      }),
                      Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: TextButton(
                          style: TextButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          ),
                          onPressed: () {
                            controller.ignoreWord(issue.word);
                          },
                          child: Text(
                            'Ignore',
                            style: TextStyle(
                              fontSize: 12,
                              color: colors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

