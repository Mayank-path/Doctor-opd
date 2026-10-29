import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Clinic Selector & Context Card displaying current multi-tenant context
/// and allowing clinicians/admins to update the active clinic.
class ClinicSelectorCard extends StatefulWidget {
  final String? activeClinicId;
  final bool isLoading;
  final String? validationError;
  final Future<void> Function(String clinicId) onSaveClinicId;
  final VoidCallback? onContinueToDashboard;

  const ClinicSelectorCard({
    super.key,
    required this.activeClinicId,
    required this.isLoading,
    this.validationError,
    required this.onSaveClinicId,
    this.onContinueToDashboard,
  });

  @override
  State<ClinicSelectorCard> createState() => _ClinicSelectorCardState();
}

class _ClinicSelectorCardState extends State<ClinicSelectorCard> {
  late TextEditingController _controller;
  bool _isEditing = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.activeClinicId ?? '');
    _isEditing = (widget.activeClinicId == null ||
        widget.activeClinicId!.isEmpty ||
        widget.validationError != null);
  }

  @override
  void didUpdateWidget(covariant ClinicSelectorCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.validationError != null && oldWidget.validationError == null) {
      _isEditing = true;
    }
    if (widget.activeClinicId != oldWidget.activeClinicId) {
      _controller.text = widget.activeClinicId ?? '';
      if ((oldWidget.activeClinicId == null || oldWidget.activeClinicId!.isEmpty) &&
          widget.activeClinicId != null &&
          widget.activeClinicId!.isNotEmpty &&
          widget.validationError == null) {
        _isEditing = false;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final newId = _controller.text.trim();
    if (newId.isEmpty) return;

    setState(() => _isSaving = true);
    try {
      await widget.onSaveClinicId(newId);
      if (mounted) {
        setState(() {
          _isEditing = false;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasActiveClinic = widget.activeClinicId != null && widget.activeClinicId!.isNotEmpty;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: widget.validationError != null
              ? AppTheme.errorRed.withValues(alpha: 0.5)
              : hasActiveClinic
                  ? AppTheme.accentTeal.withValues(alpha: 0.3)
                  : Colors.amber.withValues(alpha: 0.5),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.accentTeal.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.apartment_rounded,
                    color: AppTheme.accentTeal,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        children: [
                          const Text(
                            'Active Clinic Tenant',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          if (hasActiveClinic && widget.validationError == null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.successGreen.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.check_circle_rounded,
                                    size: 11,
                                    color: AppTheme.successGreen,
                                  ),
                                  SizedBox(width: 3),
                                  Text(
                                    'ACTIVE',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.successGreen,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hasActiveClinic
                            ? 'Tenant-isolated PostgreSQL context'
                            : 'Clinic context required',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                if (hasActiveClinic && !_isEditing)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      foregroundColor: AppTheme.accentTeal,
                      visualDensity: VisualDensity.compact,
                    ),
                    icon: const Icon(Icons.edit_rounded, size: 14),
                    label: const Text('Change'),
                    onPressed: () => setState(() => _isEditing = true),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            if (!_isEditing && hasActiveClinic) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.borderGray),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CLINIC IDENTIFIER (UUID)',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    SelectableText(
                      widget.activeClinicId!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.validationError == null) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    key: const Key('continue_to_dashboard_button'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accentTeal,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      elevation: 1,
                    ),
                    icon: const Icon(Icons.dashboard_rounded, size: 18),
                    label: const Text(
                      'Continue to Dashboard',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                    onPressed: widget.onContinueToDashboard,
                  ),
                ),
              ],
            ] else ...[
              const Text(
                'Enter the Clinic UUID to scope all patient, appointment, and queue operations to that tenant:',
                style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: 'Clinic UUID',
                        hintText: 'e.g. 550e8400-e29b-41d4-a716-446655440000',
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accentTeal,
                      minimumSize: const Size(80, 48),
                    ),
                    onPressed: _isSaving ? null : _handleSave,
                    child: _isSaving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Save'),
                  ),
                ],
              ),
            ],

            if (widget.validationError != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 18, color: AppTheme.errorRed),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        widget.validationError!,
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
    );
  }
}
