import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Keyboard-safe multiline editor for reviewing and refining speech-to-text transcripts.
class TranscriptEditor extends StatelessWidget {
  final TextEditingController controller;
  final String originalTranscript;
  final VoidCallback onResetToOriginal;

  const TranscriptEditor({
    super.key,
    required this.controller,
    required this.originalTranscript,
    required this.onResetToOriginal,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(
              children: [
                Icon(Icons.edit_note_rounded, size: 20, color: AppTheme.primaryNavy),
                SizedBox(width: 8),
                Text(
                  'Editable Transcript',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryNavy,
                  ),
                ),
              ],
            ),
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, value, _) {
                if (value.text.trim() != originalTranscript.trim() &&
                    originalTranscript.trim().isNotEmpty) {
                  return TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      visualDensity: VisualDensity.compact,
                    ),
                    onPressed: onResetToOriginal,
                    icon: const Icon(Icons.undo_rounded, size: 16),
                    label: const Text(
                      'Reset to Raw',
                      style: TextStyle(fontSize: 12),
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Text Field
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.borderGray),
          ),
          child: TextField(
            controller: controller,
            maxLines: 8,
            minLines: 5,
            keyboardType: TextInputType.multiline,
            textCapitalization: TextCapitalization.sentences,
            style: const TextStyle(
              fontSize: 15,
              height: 1.5,
              color: AppTheme.textPrimary,
            ),
            decoration: const InputDecoration(
              hintText: 'Spoken transcript will appear here. Tap to edit or add symptoms...',
              hintStyle: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
              contentPadding: EdgeInsets.all(14),
              border: InputBorder.none,
            ),
          ),
        ),
        const SizedBox(height: 8),

        // Character / Word count footer
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: controller,
          builder: (context, value, _) {
            final text = value.text.trim();
            final words = text.isEmpty ? 0 : text.split(RegExp(r'\s+')).length;
            final chars = text.length;

            return Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.shield_outlined, size: 14, color: AppTheme.accentTeal),
                    SizedBox(width: 4),
                    Text(
                      'Doctor-reviewed clinical transcription',
                      style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                Text(
                  '$words words • $chars characters',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textSecondary,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
