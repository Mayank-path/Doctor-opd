import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/approve_prescription_request.dart';

/// Explicit confirmation dialog prior to calling the backend approval endpoint.
/// Enforces positive clinician affirmation that all medication items,
/// dosages, and frequencies have been reviewed.
class PrescriptionApproveDialog extends StatefulWidget {
  final int itemCount;
  final String patientName;

  const PrescriptionApproveDialog({
    super.key,
    required this.itemCount,
    required this.patientName,
  });

  static Future<ApprovePrescriptionRequest?> show(
    BuildContext context, {
    required int itemCount,
    required String patientName,
  }) {
    return showDialog<ApprovePrescriptionRequest>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PrescriptionApproveDialog(
        itemCount: itemCount,
        patientName: patientName,
      ),
    );
  }

  @override
  State<PrescriptionApproveDialog> createState() =>
      _PrescriptionApproveDialogState();
}

class _PrescriptionApproveDialogState extends State<PrescriptionApproveDialog> {
  bool _isConfirmed = false;
  final _doctorNotesController = TextEditingController();

  @override
  void dispose() {
    _doctorNotesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      actionsPadding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      title: const Row(
        children: [
          Icon(Icons.verified_rounded, color: AppTheme.successGreen, size: 26),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Approve Prescription',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'You are approving ${widget.itemCount} medication item(s) for ${widget.patientName}.',
              style: const TextStyle(
                fontSize: 13.5,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            // Immutability Warning Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.dangerRed.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppTheme.dangerRed.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.lock_rounded,
                    size: 18,
                    color: AppTheme.dangerRed,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'IMMUTABILITY NOTICE: Once approved, this prescription becomes an immutable legal medical document. It cannot be edited directly; only versioned clinical amendments will be permitted.',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                        color: Colors.red.shade900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Optional Doctor's Note
            TextFormField(
              key: const Key('approvalNotesField'),
              controller: _doctorNotesController,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'Approval Notes (Optional)',
                hintText: 'e.g. Verified with patient, no known allergies...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
            const SizedBox(height: 12),

            // Affirmation Checkbox
            InkWell(
              key: const Key('approvalConfirmCheckboxTile'),
              onTap: () {
                setState(() {
                  _isConfirmed = !_isConfirmed;
                });
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      key: const Key('approvalConfirmCheckbox'),
                      value: _isConfirmed,
                      activeColor: AppTheme.accentTeal,
                      onChanged: (val) {
                        setState(() {
                          _isConfirmed = val ?? false;
                        });
                      },
                    ),
                    const Expanded(
                      child: Text(
                        'I have reviewed all medication items, strengths, frequencies, and instructions for clinical accuracy.',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          key: const Key('cancelApprovalButton'),
          onPressed: () => Navigator.of(context).pop(null),
          child: const Text('Cancel'),
        ),
        ElevatedButton.icon(
          key: const Key('confirmApprovalButton'),
          onPressed: _isConfirmed
              ? () {
                  final notes = _doctorNotesController.text.trim();
                  Navigator.of(context).pop(
                    ApprovePrescriptionRequest(
                      confirmApproval: true,
                      doctorNotes: notes.isEmpty ? null : notes,
                    ),
                  );
                }
              : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.accentTeal,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          icon: const Icon(Icons.check_circle_rounded, size: 18),
          label: const Text(
            'Confirm & Approve',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }
}

