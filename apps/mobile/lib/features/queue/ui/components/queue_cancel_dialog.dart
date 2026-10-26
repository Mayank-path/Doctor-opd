import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/queue_entry.dart';
import '../../models/update_queue_status_request.dart';
import '../../services/queue_service.dart';

/// Confirmation dialog for cancelling an active queue token
class QueueCancelDialog extends StatefulWidget {
  final QueueEntry entry;
  final QueueService queueService;

  const QueueCancelDialog({
    super.key,
    required this.entry,
    required this.queueService,
  });

  @override
  State<QueueCancelDialog> createState() => _QueueCancelDialogState();
}

class _QueueCancelDialogState extends State<QueueCancelDialog> {
  bool _isSubmitting = false;
  String? _errorMessage;

  Future<void> _handleCancel() async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final updated = await widget.queueService.updateStatus(
        widget.entry.id,
        const UpdateQueueStatusRequest(status: QueueStatus.cancelled),
      );
      if (mounted) {
        Navigator.of(context).pop(updated);
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
          _errorMessage = 'An unexpected error occurred: ${e.toString()}';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final patientName = widget.entry.patient?.fullName ?? 'Patient';

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: AppTheme.errorRed, size: 28),
          SizedBox(width: 10),
          Text(
            'Cancel Queue Token',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppTheme.textPrimary,
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
              'Are you sure you want to cancel Token #${widget.entry.tokenNumber} for $patientName?',
              style: const TextStyle(
                fontSize: 14,
                height: 1.4,
                color: AppTheme.textPrimary,
              ),
            ),
            if (widget.entry.appointmentId != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline_rounded,
                        color: Colors.amber.shade900, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Note: This token is linked to an appointment. Cancelling this token will also cancel the linked appointment.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.amber.shade900,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppTheme.errorRed.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: AppTheme.errorRed, size: 18),
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
          child: const Text('Keep in Queue'),
        ),
        ElevatedButton(
          onPressed: _isSubmitting ? null : _handleCancel,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.errorRed,
            foregroundColor: Colors.white,
          ),
          child: _isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : const Text('Confirm Cancel'),
        ),
      ],
    );
  }
}
