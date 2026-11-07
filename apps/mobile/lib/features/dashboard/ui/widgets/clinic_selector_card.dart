import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/models/auth_clinic.dart';

/// Clinic Selector & Context Card displaying current multi-tenant context
/// and allowing clinicians/admins to select or update the active clinic.
class ClinicSelectorCard extends StatefulWidget {
  final String? activeClinicId;
  final AuthClinic? activeClinic;
  final List<AuthClinic> availableClinics;
  final bool isLoading;
  final String? validationError;
  final Future<void> Function(String clinicId) onSaveClinicId;
  final Future<void> Function(AuthClinic clinic)? onSelectClinic;
  final VoidCallback? onContinueToDashboard;

  const ClinicSelectorCard({
    super.key,
    required this.activeClinicId,
    this.activeClinic,
    this.availableClinics = const [],
    required this.isLoading,
    this.validationError,
    required this.onSaveClinicId,
    this.onSelectClinic,
    this.onContinueToDashboard,
  });

  @override
  State<ClinicSelectorCard> createState() => _ClinicSelectorCardState();
}

class _ClinicSelectorCardState extends State<ClinicSelectorCard> {
  late TextEditingController _controller;
  bool _isEditing = false;
  bool _isSaving = false;
  String? _selectedClinicIdInFlight;

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
      if ((oldWidget.activeClinicId == null ||
              oldWidget.activeClinicId!.isEmpty) &&
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

  Future<void> _handleSelectClinic(AuthClinic clinic) async {
    if (widget.onSelectClinic != null) {
      setState(() {
        _selectedClinicIdInFlight = clinic.id;
      });
      try {
        await widget.onSelectClinic!(clinic);
        if (mounted) {
          setState(() {
            _isEditing = false;
          });
        }
      } finally {
        if (mounted) {
          setState(() {
            _selectedClinicIdInFlight = null;
          });
        }
      }
    } else {
      await widget.onSaveClinicId(clinic.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasActiveClinic =
        widget.activeClinicId != null && widget.activeClinicId!.isNotEmpty;

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
                          if (hasActiveClinic &&
                              widget.validationError == null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.successGreen
                                    .withValues(alpha: 0.12),
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
                    icon: const Icon(Icons.swap_horiz_rounded, size: 16),
                    label: Text(widget.availableClinics.length > 1
                        ? 'Switch'
                        : 'Change'),
                    onPressed: () => setState(() => _isEditing = true),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            if (!_isEditing && hasActiveClinic) ...[
              // Active Clinic Name & Role Display
              if (widget.activeClinic != null &&
                  widget.activeClinic!.name.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.accentTeal.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppTheme.accentTeal.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.medical_services_outlined,
                        size: 20,
                        color: AppTheme.accentTeal,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          widget.activeClinic!.name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.primaryNavy,
                          ),
                        ),
                      ),
                      if (widget.activeClinic!.role.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryNavy,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            widget.activeClinic!.role,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],

              // Monospace UUID display
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
              // Multiple clinic memberships selection UI (names-based)
              if (widget.availableClinics.length > 1) ...[
                const Text(
                  'Select your clinic workspace from verified memberships:',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 10),
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: widget.availableClinics.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final clinic = widget.availableClinics[index];
                    final isCurrent = clinic.id == widget.activeClinicId;
                    final isInFlight =
                        _selectedClinicIdInFlight == clinic.id;

                    return InkWell(
                      onTap: isInFlight
                          ? null
                          : () => _handleSelectClinic(clinic),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: isCurrent
                              ? AppTheme.accentTeal.withValues(alpha: 0.08)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isCurrent
                                ? AppTheme.accentTeal
                                : AppTheme.borderGray,
                            width: isCurrent ? 1.5 : 1.0,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.apartment_rounded,
                              size: 20,
                              color: isCurrent
                                  ? AppTheme.accentTeal
                                  : AppTheme.textSecondary,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    clinic.name,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: isCurrent
                                          ? AppTheme.accentTeal
                                          : AppTheme.textPrimary,
                                    ),
                                  ),
                                  Text(
                                    clinic.id,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontFamily: 'monospace',
                                      color: AppTheme.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (clinic.role.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryNavy
                                      .withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  clinic.role,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.primaryNavy,
                                  ),
                                ),
                              ),
                            const SizedBox(width: 8),
                            if (isInFlight)
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppTheme.accentTeal,
                                ),
                              )
                            else
                              Icon(
                                isCurrent
                                    ? Icons.check_circle_rounded
                                    : Icons.chevron_right_rounded,
                                color: isCurrent
                                    ? AppTheme.accentTeal
                                    : AppTheme.textSecondary,
                                size: 20,
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                if (hasActiveClinic) ...[
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => setState(() => _isEditing = false),
                      child: const Text('Cancel'),
                    ),
                  ),
                ],
              ] else ...[
                // Single or zero clinics: manual entry / UUID configuration
                const Text(
                  'Enter the Clinic UUID to scope all patient, consultation, and prescription operations to that tenant:',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Clinic UUID',
                          hintText:
                              'e.g. 550e8400-e29b-41d4-a716-446655440000',
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
            ],

            if (widget.validationError != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppTheme.errorRed.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      size: 18,
                      color: AppTheme.errorRed,
                    ),
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
