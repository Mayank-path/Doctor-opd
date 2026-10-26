import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/consultation.dart';
import '../../services/consultations_service.dart';

/// Confirmation dialog for finalizing an active clinical consultation draft.
///
/// Invariants:
/// - Explicitly warns the clinician that finalized records are immutable and permanent.
/// - Prevents repeated submission while finalization is in flight.
/// - Handles HTTP 409 conflict, HTTP 403 authorization errors, and network failures.
class ConsultationFinalizeDialog extends StatefulWidget {
  final Consultation consultation;
  final ConsultationsService consultationsService;

  const ConsultationFinalizeDialog({
    super.key,
    required this.consultation,
    required this.consultationsService,
  });

  @override
  State<ConsultationFinalizeDialog> createState() =>
      _ConsultationFinalizeDialogState();
}

class _ConsultationFinalizeDialogState
    extends State<ConsultationFinalizeDialog> {
  bool _isSubmitting = false;
  String? _errorMessage;

  Future<void> _handleFinalize() async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final finalized = await widget.consultationsService.finalize(
        widget.consultation.id,
      );

      if (mounted) {
        Navigator.of(context).pop(finalized);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'An unexpected error occurred: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final patientName =
        widget.consultation.patient?.fullName ?? 'Patient';

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Row(
        children: [
          Icon(
            Icons.lock_outline_rounded,
            color: AppTheme.accentTeal,
            size: 26,
          ),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Finalize Consultation',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
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
              'Are you ready to lock and finalize the consultation for $patientName?',
              style: const TextStyle(
                fontSize: 14,
                height: 1.4,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: Colors.amber.shade900,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Once finalized, this consultation record becomes strictly read-only and immutable under OPD compliance policy. It cannot be edited or deleted.',
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: Colors.amber.shade900,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (widget.consultation.diagnosis != null &&
                widget.consultation.diagnosis!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Diagnosis: ${widget.consultation.diagnosis}',
                style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.errorRed.withAlpha(75)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.error_outline,
                      color: AppTheme.errorRed,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.errorRed,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Keep Editing'),
        ),
        ElevatedButton.icon(
          key: const Key('confirmFinalizeButton'),
          onPressed: _isSubmitting ? null : _handleFinalize,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.accentTeal,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          icon: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : const Icon(Icons.check_circle_outline, size: 18),
          label: const Text('Confirm Finalize'),
        ),
      ],
    );
  }
}
