import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../consultations/services/consultations_service.dart';
import '../../consultations/ui/components/patient_search_selector.dart';
import '../../patients/models/patient.dart';
import '../../patients/services/patients_service.dart';
import '../models/amend_prescription_request.dart';
import '../models/create_prescription_request.dart';
import '../models/prescription.dart';
import '../models/prescription_item.dart';
import '../services/prescriptions_service.dart';
import 'components/medication_item_card.dart';
import 'components/medication_item_editor_sheet.dart';
import 'components/prescription_approve_dialog.dart';
import 'components/previous_prescriptions_reference_sheet.dart';
import 'prescription_details_screen.dart';

/// Screen for creating, composing, or amending prescriptions.
///
/// Dual Entry Workflows:
/// 1. Linked Consultation: Prefills verified patient demographics and consultation context.
/// 2. Standalone: Doctor searches and selects a registered patient via PatientSearchSelector.
///
/// Immutability & Clinical Safety Invariants:
/// - Prefilled data is visually distinct from newly composed prescription items.
/// - Prior prescriptions are reference-only; no silent copying of medications is ever permitted.
/// - Every medication item is explicitly confirmed or added by the doctor.
/// - Protected against accidental navigation loss via PopScope.
class PrescriptionCreateScreen extends StatefulWidget {
  final String? consultationId;
  final String? prefilledPatientId;
  final String? prefilledPatientName;
  final String? prefilledPatientDetails;
  final String? prefilledConsultationContext;

  // Amendment Flow parameters
  final bool isAmending;
  final String? amendingPrescriptionId;
  final int? amendingFromVersion;
  final String? initialAmendmentReason;
  final List<PrescriptionItem>? initialItems;
  final String? initialNotes;

  // Services
  final PrescriptionsService? prescriptionsService;
  final PatientsService? patientsService;
  final ConsultationsService? consultationsService;

  const PrescriptionCreateScreen({
    super.key,
    this.consultationId,
    this.prefilledPatientId,
    this.prefilledPatientName,
    this.prefilledPatientDetails,
    this.prefilledConsultationContext,
    this.isAmending = false,
    this.amendingPrescriptionId,
    this.amendingFromVersion,
    this.initialAmendmentReason,
    this.initialItems,
    this.initialNotes,
    this.prescriptionsService,
    this.patientsService,
    this.consultationsService,
  });

  @override
  State<PrescriptionCreateScreen> createState() =>
      _PrescriptionCreateScreenState();
}

class _PrescriptionCreateScreenState extends State<PrescriptionCreateScreen> {
  late final PrescriptionsService _prescriptionsService;
  late final PatientsService _patientsService;

  final _notesController = TextEditingController();
  final List<PrescriptionItem> _items = [];

  Patient? _selectedPatient;
  String? _patientId;
  String? _patientName;
  String? _patientDetails;

  bool _isSavingDraft = false;
  bool _isApproving = false;
  bool _hasUnsavedChanges = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _prescriptionsService =
        widget.prescriptionsService ?? PrescriptionsService();
    _patientsService = widget.patientsService ?? PatientsService();

    // Setup initial state from props
    _patientId = widget.prefilledPatientId;
    _patientName = widget.prefilledPatientName;
    _patientDetails = widget.prefilledPatientDetails;

    if (widget.initialNotes != null) {
      _notesController.text = widget.initialNotes!;
    }

    if (widget.initialItems != null) {
      _items.addAll(widget.initialItems!);
    }

    // Listen for notes changes
    _notesController.addListener(() {
      if (!_hasUnsavedChanges && mounted) {
        setState(() {
          _hasUnsavedChanges = true;
        });
      }
    });

    // If prefilled patient ID exists but no name, load patient details
    if (_patientId != null && _patientName == null) {
      _loadPrefilledPatient(_patientId!);
    }
  }

  Future<void> _loadPrefilledPatient(String patientId) async {
    try {
      final p = await _patientsService.getPatientById(patientId);
      if (mounted) {
        setState(() {
          _selectedPatient = p;
          _patientName = p.fullName;
          _patientDetails =
              '${p.gender.toUpperCase()}, ${p.ageYears ?? "N/A"} yrs • ${p.phone}';
        });
      }
    } catch (_) {
      // Non-blocking fallback
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _onPatientSelected(Patient? patient) {
    setState(() {
      _selectedPatient = patient;
      _patientId = patient?.id;
      _patientName = patient?.fullName;
      _patientDetails = patient != null
          ? '${patient.gender.toUpperCase()}, ${patient.ageYears ?? "N/A"} yrs • ${patient.phone}'
          : null;
      _hasUnsavedChanges = true;
      _errorMessage = null;
    });
  }

  void _openMedicationEditor([PrescriptionItem? item, int? index]) {
    MedicationItemEditorSheet.show(
      context,
      item: item,
      onSave: (savedItem) {
        setState(() {
          if (index != null && index >= 0 && index < _items.length) {
            _items[index] = savedItem;
          } else {
            _items.add(savedItem);
          }
          _hasUnsavedChanges = true;
          _errorMessage = null;
        });
      },
    );
  }

  void _removeItem(int index) {
    final removed = _items[index];
    setState(() {
      _items.removeAt(index);
      _hasUnsavedChanges = true;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Removed ${removed.medicationName}'),
        action: SnackBarAction(
          label: 'UNDO',
          onPressed: () {
            setState(() {
              _items.insert(index, removed);
            });
          },
        ),
      ),
    );
  }

  void _openPriorPrescriptionsSheet() {
    final pId = _patientId;
    final pName = _patientName ?? 'Patient';

    if (pId == null || pId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a patient first to view prior prescriptions.'),
        ),
      );
      return;
    }

    PreviousPrescriptionsReferenceSheet.show(
      context,
      patientId: pId,
      patientName: pName,
      prescriptionsService: _prescriptionsService,
    );
  }

  Future<bool> _onWillPop() async {
    if (!_hasUnsavedChanges) return true;

    final shouldDiscard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Discard Prescription Draft?'),
        content: const Text(
          'You have unsaved changes in this prescription. If you leave now, these changes will be lost.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Stay'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.dangerRed,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );

    return shouldDiscard ?? false;
  }

  Future<void> _handleSaveDraft() async {
    final pid = _patientId;
    if (pid == null || pid.trim().isEmpty) {
      setState(() {
        _errorMessage = 'Please select a patient before saving';
      });
      return;
    }

    if (_items.isEmpty) {
      setState(() {
        _errorMessage = 'At least one medication item is required';
      });
      return;
    }

    setState(() {
      _isSavingDraft = true;
      _errorMessage = null;
    });

    try {
      Prescription savedRx;

      if (widget.isAmending && widget.amendingPrescriptionId != null) {
        // Submit amendment
        final req = AmendPrescriptionRequest(
          amendmentReason: widget.initialAmendmentReason ?? 'Clinical revision',
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
          items: _items,
        );
        savedRx = await _prescriptionsService.amend(
          widget.amendingPrescriptionId!,
          req,
        );
      } else {
        // Standard create draft
        final req = CreatePrescriptionRequest(
          patientId: pid,
          consultationId: widget.consultationId,
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
          items: _items,
        );
        savedRx = await _prescriptionsService.createDraft(req);
      }

      _hasUnsavedChanges = false;

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Prescription draft saved successfully'),
          backgroundColor: AppTheme.successGreen,
        ),
      );

      // Navigate to Prescription Details
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => PrescriptionDetailsScreen(
            prescriptionId: savedRx.id,
            prescriptionsService: _prescriptionsService,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e is ApiException ? e.message : e.toString();
          _isSavingDraft = false;
        });
      }
    }
  }

  Future<void> _handleReviewAndApprove() async {
    final pid = _patientId;
    if (pid == null || pid.trim().isEmpty) {
      setState(() {
        _errorMessage = 'Please select a patient before approving';
      });
      return;
    }

    if (_items.isEmpty) {
      setState(() {
        _errorMessage = 'At least one medication item is required to approve';
      });
      return;
    }

    // 1. Show review & approval dialog
    final approvalResult = await PrescriptionApproveDialog.show(
      context,
      itemCount: _items.length,
      patientName: _patientName ?? 'Patient',
    );

    if (approvalResult == null || !approvalResult.confirmApproval) {
      return; // Cancelled
    }

    setState(() {
      _isApproving = true;
      _errorMessage = null;
    });

    try {
      Prescription draftRx;

      // First ensure draft is created / amended
      if (widget.isAmending && widget.amendingPrescriptionId != null) {
        final amendReq = AmendPrescriptionRequest(
          amendmentReason: widget.initialAmendmentReason ?? 'Clinical revision',
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
          items: _items,
        );
        draftRx = await _prescriptionsService.amend(
          widget.amendingPrescriptionId!,
          amendReq,
        );
      } else {
        final createReq = CreatePrescriptionRequest(
          patientId: pid,
          consultationId: widget.consultationId,
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
          items: _items,
        );
        draftRx = await _prescriptionsService.createDraft(createReq);
      }

      // Then explicitly approve
      final approvedRx = await _prescriptionsService.approve(
        draftRx.id,
        approvalResult,
      );

      _hasUnsavedChanges = false;

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Prescription approved and locked successfully'),
          backgroundColor: AppTheme.successGreen,
        ),
      );

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => PrescriptionDetailsScreen(
            prescriptionId: approvedRx.id,
            prescriptionsService: _prescriptionsService,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e is ApiException ? e.message : e.toString();
          _isApproving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLinkedConsultation =
        widget.consultationId != null && widget.consultationId!.isNotEmpty;

    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppTheme.backgroundLight,
        appBar: AppBar(
          title: Text(
            widget.isAmending
                ? 'Amend Prescription (v${(widget.amendingFromVersion ?? 1) + 1})'
                : (isLinkedConsultation
                    ? 'Consultation Prescription'
                    : 'New Prescription'),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
          ),
          backgroundColor: Colors.white,
          elevation: 0,
          actions: [
            if (_patientId != null)
              IconButton(
                key: const Key('priorPrescriptionsButton'),
                icon: const Icon(Icons.history_edu_rounded),
                tooltip: 'Prior Prescriptions Reference',
                color: AppTheme.primaryNavy,
                onPressed: _openPriorPrescriptionsSheet,
              ),
          ],
        ),
        body: _buildBody(isLinkedConsultation),
        bottomNavigationBar: _buildBottomBar(),
      ),
    );
  }

  Widget _buildBody(bool isLinkedConsultation) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Error banner if any
              if (_errorMessage != null) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.dangerRed.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppTheme.dangerRed.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: AppTheme.dangerRed, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.dangerRed,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Amendment Notice Banner if in Amendment mode
              if (widget.isAmending) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.shade300),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.history_toggle_off_rounded,
                              color: Colors.amber.shade900, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'AMENDMENT IN PROGRESS (v${(widget.amendingFromVersion ?? 1) + 1})',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.amber.shade900,
                            ),
                          ),
                        ],
                      ),
                      if (widget.initialAmendmentReason != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Clinical Justification: "${widget.initialAmendmentReason!}"',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontStyle: FontStyle.italic,
                            color: Colors.amber.shade900,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],

              // Patient Selection / Prefilled Demographics
              if (isLinkedConsultation || widget.prefilledPatientId != null) ...[
                // VISIBLY DISTINGUISHABLE PREFILLED DEMOGRAPHICS CARD
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppTheme.accentTeal.withValues(alpha: 0.5),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.accentTeal.withValues(alpha: 0.05),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.accentTeal.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.link_rounded,
                                    size: 14,
                                    color: AppTheme.accentTeal,
                                  ),
                                  SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      'PREFILLED CONSULTATION CONTEXT',
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.5,
                                        color: AppTheme.accentTeal,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          TextButton.icon(
                            key: const Key('viewPriorPrescriptionsButton'),
                            onPressed: _openPriorPrescriptionsSheet,
                            icon: const Icon(Icons.history_edu_rounded, size: 16),
                            label: const Text(
                              'Prior Prescriptions',
                              style: TextStyle(fontSize: 12),
                            ),
                            style: TextButton.styleFrom(
                              foregroundColor: AppTheme.primaryNavy,
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _patientName ?? 'Verified Patient',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      if (_patientDetails != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          _patientDetails!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                      if (widget.prefilledConsultationContext != null &&
                          widget.prefilledConsultationContext!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppTheme.backgroundLight,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.borderGray),
                          ),
                          child: Text(
                            widget.prefilledConsultationContext!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ] else ...[
                // STANDALONE MODE: PATIENT SEARCH SELECTOR
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.borderGray),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'SELECT PATIENT *',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const Spacer(),
                          if (_patientId != null)
                            TextButton.icon(
                              onPressed: _openPriorPrescriptionsSheet,
                              icon: const Icon(Icons.history_edu_rounded, size: 16),
                              label: const Text(
                                'Prior Prescriptions',
                                style: TextStyle(fontSize: 12),
                              ),
                              style: TextButton.styleFrom(
                                foregroundColor: AppTheme.primaryNavy,
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      PatientSearchSelector(
                        patientsService: _patientsService,
                        selectedPatient: _selectedPatient,
                        onPatientSelected: _onPatientSelected,
                      ),
                    ],
                  ),
                ),
              ],

              // Medication Items Section Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Text(
                        'MEDICATION ITEMS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: _items.isNotEmpty
                              ? AppTheme.accentTeal.withValues(alpha: 0.15)
                              : Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${_items.length}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _items.isNotEmpty
                                ? AppTheme.accentTeal
                                : Colors.grey.shade700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  ElevatedButton.icon(
                    key: const Key('addMedicationButton'),
                    onPressed: () => _openMedicationEditor(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryNavy,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 38),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text(
                      'Add Medication',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Items List or Empty State
              if (_items.isEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppTheme.borderGray,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.medication_liquid_outlined,
                        size: 40,
                        color: Colors.grey.shade400,
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'No medications prescribed yet',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Tap "Add Medication" above to prescribe medicines, strength, frequency, and instructions.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                ..._items.asMap().entries.map((entry) {
                  final index = entry.key;
                  final item = entry.value;
                  return MedicationItemCard(
                    item: item,
                    index: index,
                    isReadOnly: false,
                    onEdit: () => _openMedicationEditor(item, index),
                    onDelete: () => _removeItem(index),
                  );
                }),
              ],

              const SizedBox(height: 16),

              // Doctor's General Prescription Notes
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.borderGray),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PRESCRIPTION NOTES & ADVICE (OPTIONAL)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      key: const Key('prescriptionNotesField'),
                      controller: _notesController,
                      maxLines: 3,
                      maxLength: 2000,
                      decoration: InputDecoration(
                        hintText:
                            'Dietary advice, warning signs to watch for, follow-up recommendations...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        contentPadding: const EdgeInsets.all(12),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget? _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                key: const Key('saveDraftPrescriptionButton'),
                onPressed:
                    _isSavingDraft || _isApproving ? null : _handleSaveDraft,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSavingDraft
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text(
                        'Save Draft',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton.icon(
                key: const Key('reviewAndApproveButton'),
                onPressed:
                    _isSavingDraft || _isApproving ? null : _handleReviewAndApprove,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentTeal,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                icon: _isApproving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.verified_rounded, size: 20),
                label: const Text(
                  'Review & Approve',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

