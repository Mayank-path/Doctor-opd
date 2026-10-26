import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Clinic Selector & Context Card displaying current multi-tenant context
/// and allowing clinicians/admins to update the active clinic.
class ClinicSelectorCard extends StatefulWidget {
  final String? activeClinicId;
  final bool isLoading;
  final String? validationError;
  final Future<void> Function(String clinicId) onSaveClinicId;

  const ClinicSelectorCard({
    super.key,
    required this.activeClinicId,
    required this.isLoading,
    this.validationError,
    required this.onSaveClinicId,
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
    _isEditing = (widget.activeClinicId == null || widget.activeClinicId!.isEmpty);
  }

  @override
  void didUpdateWidget(covariant ClinicSelectorCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.activeClinicId != oldWidget.activeClinicId && !_isEditing) {
      _controller.text = widget.activeClinicId ?? '';
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
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.accentTeal.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.apartment_rounded,
                    color: AppTheme.accentTeal,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Active Clinic Tenant',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hasActiveClinic
                            ? 'Tenant-isolated PostgreSQL context'
                            : 'Clinic context required',
                        style: const TextStyle(
                          fontSize: 12,
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
                    icon: const Icon(Icons.edit_rounded, size: 16),
                    label: const Text('Change'),
                    onPressed: () => setState(() => _isEditing = true),
                  ),
              ],
            ),
            const SizedBox(height: 14),

            if (!_isEditing && hasActiveClinic) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.borderGray),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CLINIC IDENTIFIER (UUID)',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    SelectableText(
                      widget.activeClinicId!,
                      style: const TextStyle(
                        fontSize: 13,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const Row(
                children: [
                  Icon(Icons.info_outline_rounded, size: 14, color: AppTheme.textSecondary),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Clinic name endpoint not implemented in backend (verified via x-clinic-id membership).',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.textSecondary,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                ],
              ),
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
