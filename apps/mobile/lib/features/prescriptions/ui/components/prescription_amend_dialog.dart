import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Class encapsulating the verified amendment reason and optional notes.
class PrescriptionAmendmentDetails {
  final String reason;
  final String? notes;

  const PrescriptionAmendmentDetails({
    required this.reason,
    this.notes,
  });
}

/// Dialog enforcing clinical justification for creating a versioned amendment
/// to an approved immutable prescription.
class PrescriptionAmendDialog extends StatefulWidget {
  final int currentVersion;

  const PrescriptionAmendDialog({
    super.key,
    required this.currentVersion,
  });

  static Future<PrescriptionAmendmentDetails?> show(
    BuildContext context, {
    required int currentVersion,
  }) {
    return showDialog<PrescriptionAmendmentDetails>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PrescriptionAmendDialog(
        currentVersion: currentVersion,
      ),
    );
  }

  @override
  State<PrescriptionAmendDialog> createState() =>
      _PrescriptionAmendDialogState();
}

class _PrescriptionAmendDialogState extends State<PrescriptionAmendDialog> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _reasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    Navigator.of(context).pop(
      PrescriptionAmendmentDetails(
        reason: _reasonController.text.trim(),
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final nextVersion = widget.currentVersion + 1;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      actionsPadding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      title: Row(
        children: [
          Icon(Icons.edit_note_rounded,
              color: Colors.amber.shade800, size: 28),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Create Amendment (v$nextVersion)',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Approved prescription v${widget.currentVersion} will be preserved and superseded. An audited v$nextVersion will be created with your revised medication list.',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSecondary,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 12),

              // Mandatory Amendment Reason
              TextFormField(
                key: const Key('amendmentReasonField'),
                controller: _reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Clinical Justification / Reason *',
                  hintText:
                      'e.g. Patient experienced mild nausea on 500mg, reduced to 250mg...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding: const EdgeInsets.all(12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Amendment reason is required';
                  }
                  if (val.trim().length < 5) {
                    return 'Reason must be at least 5 characters';
                  }
                  if (val.trim().length > 1000) {
                    return 'Exceeds maximum 1000 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Optional New Notes
              TextFormField(
                key: const Key('amendmentNotesField'),
                controller: _notesController,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'Additional Notes (Optional)',
                  hintText: 'e.g. Follow up in 3 days if symptoms persist...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding: const EdgeInsets.all(12),
                ),
                validator: (val) {
                  if (val != null && val.trim().length > 1000) {
                    return 'Exceeds maximum 1000 characters';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          key: const Key('cancelAmendmentButton'),
          onPressed: () => Navigator.of(context).pop(null),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          key: const Key('confirmAmendmentButton'),
          onPressed: _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.accentTeal,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          child: const Text(
            'Continue to Edit',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }
}

