import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/prescription.dart';
import '../models/prescription_item.dart';
import '../models/update_prescription_request.dart';
import '../services/prescriptions_service.dart';
import 'components/medication_item_card.dart';
import 'components/medication_item_editor_sheet.dart';
import 'components/prescription_amend_dialog.dart';
import 'components/prescription_approve_dialog.dart';
import 'components/previous_prescriptions_reference_sheet.dart';
import 'prescription_create_screen.dart';

/// Screen displaying and managing a specific prescription record.
///
/// Immutability & Lifecycle Invariants:
/// - If DRAFT: Attending clinician can add/edit/remove medication items, update notes, and explicitly approve.
/// - If APPROVED: Strictly immutable and read-only. Editing is prohibited. Provides authenticated PDF printing/download and versioned amendment workflows.
/// - If SUPERSEDED: Preserved as historical clinical audit record; immutable.
/// - Handles 409 Conflict gracefully when draft modifications are rejected on approved records.
class PrescriptionDetailsScreen extends StatefulWidget {
  final String prescriptionId;
  final Prescription? initialPrescription;
  final PrescriptionsService? prescriptionsService;

  const PrescriptionDetailsScreen({
    super.key,
    required this.prescriptionId,
    this.initialPrescription,
    this.prescriptionsService,
  });

  @override
  State<PrescriptionDetailsScreen> createState() =>
      _PrescriptionDetailsScreenState();
}

class _PrescriptionDetailsScreenState extends State<PrescriptionDetailsScreen> {
  late final PrescriptionsService _prescriptionsService;

  Prescription? _prescription;
  bool _isLoading = true;
  bool _isSavingDraft = false;
  bool _isApproving = false;
  bool _isGeneratingPdf = false;
  String? _errorMessage;
  bool _hasUnsavedChanges = false;

  // Editable draft state
  final _notesController = TextEditingController();
  final List<PrescriptionItem> _draftItems = [];

  @override
  void initState() {
    super.initState();
    _prescriptionsService =
        widget.prescriptionsService ?? PrescriptionsService();

    if (widget.initialPrescription != null) {
      _prescription = widget.initialPrescription;
      _populateDraftState(widget.initialPrescription!);
      _isLoading = false;
    }

    _loadPrescription();
  }

  void _populateDraftState(Prescription rx) {
    _notesController.text = rx.notes ?? '';
    _draftItems.clear();
    _draftItems.addAll(rx.items);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadPrescription({bool preserveError = false}) async {
    setState(() {
      _isLoading = true;
      if (!preserveError) _errorMessage = null;
    });

    try {
      final rx =
          await _prescriptionsService.getPrescriptionById(widget.prescriptionId);
      if (mounted) {
        setState(() {
          _prescription = rx;
          _populateDraftState(rx);
          _isLoading = false;
          _hasUnsavedChanges = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          if (!preserveError) {
            _errorMessage = e is ApiException ? e.message : e.toString();
          }
          _isLoading = false;
        });
      }
    }
  }

  void _openMedicationEditor([PrescriptionItem? item, int? index]) {
    if (_prescription?.isApproved == true) return; // Strict read-only check

    MedicationItemEditorSheet.show(
      context,
      item: item,
      onSave: (savedItem) {
        setState(() {
          if (index != null && index >= 0 && index < _draftItems.length) {
            _draftItems[index] = savedItem;
          } else {
            _draftItems.add(savedItem);
          }
          _hasUnsavedChanges = true;
          _errorMessage = null;
        });
      },
    );
  }

  void _removeItem(int index) {
    if (_prescription?.isApproved == true) return; // Strict read-only check

    final removed = _draftItems[index];
    setState(() {
      _draftItems.removeAt(index);
      _hasUnsavedChanges = true;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Removed ${removed.medicationName}'),
        action: SnackBarAction(
          label: 'UNDO',
          onPressed: () {
            setState(() {
              _draftItems.insert(index, removed);
            });
          },
        ),
      ),
    );
  }

  Future<void> _handleSaveDraftChanges() async {
    if (_draftItems.isEmpty) {
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
      final req = UpdatePrescriptionRequest(
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
        items: _draftItems,
      );

      final updated = await _prescriptionsService.updateDraft(
        widget.prescriptionId,
        req,
      );

      if (mounted) {
        setState(() {
          _prescription = updated;
          _populateDraftState(updated);
          _hasUnsavedChanges = false;
          _isSavingDraft = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Prescription draft updated successfully'),
            backgroundColor: AppTheme.successGreen,
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isSavingDraft = false;
          if (e.statusCode == 409) {
            _errorMessage =
                'Conflict: This prescription has already been approved and is now immutable.';
            _loadPrescription(preserveError: true);
          } else {
            _errorMessage = e.message;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSavingDraft = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  Future<void> _handleApprove() async {
    if (_draftItems.isEmpty) {
      setState(() {
        _errorMessage = 'At least one medication item is required to approve';
      });
      return;
    }

    final pName = _prescription?.patient?.fullName ?? 'Patient';

    final approvalResult = await PrescriptionApproveDialog.show(
      context,
      itemCount: _draftItems.length,
      patientName: pName,
    );

    if (approvalResult == null || !approvalResult.confirmApproval) {
      return;
    }

    setState(() {
      _isApproving = true;
      _errorMessage = null;
    });

    try {
      // If there are unsaved draft edits, save them first
      if (_hasUnsavedChanges) {
        final updateReq = UpdatePrescriptionRequest(
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
          items: _draftItems,
        );
        await _prescriptionsService.updateDraft(
          widget.prescriptionId,
          updateReq,
        );
      }

      // Explicitly approve on backend
      final approved = await _prescriptionsService.approve(
        widget.prescriptionId,
        approvalResult,
      );

      if (mounted) {
        setState(() {
          _prescription = approved;
          _populateDraftState(approved);
          _hasUnsavedChanges = false;
          _isApproving = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Prescription approved and locked permanently'),
            backgroundColor: AppTheme.successGreen,
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isApproving = false;
          if (e.statusCode == 409) {
            _errorMessage =
                'Conflict: Prescription has already been approved or superseded.';
            _loadPrescription(preserveError: true);
          } else {
            _errorMessage = e.message;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isApproving = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  Future<void> _handlePrintPdf() async {
    setState(() {
      _isGeneratingPdf = true;
      _errorMessage = null;
    });

    try {
      final Uint8List pdfBytes =
          await _prescriptionsService.downloadPdf(widget.prescriptionId);

      if (mounted) {
        setState(() {
          _isGeneratingPdf = false;
        });
      }

      await Printing.layoutPdf(
        name: 'Prescription_${widget.prescriptionId.substring(0, 8)}.pdf',
        onLayout: (format) async => pdfBytes,
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isGeneratingPdf = false;
          _errorMessage = 'PDF Error: ${e.message}';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isGeneratingPdf = false;
          _errorMessage = 'Failed to load PDF: $e';
        });
      }
    }
  }

  Future<void> _handleInitiateAmendment() async {
    if (_prescription == null) return;

    final details = await PrescriptionAmendDialog.show(
      context,
      currentVersion: _prescription!.amendmentVersion,
    );

    if (details == null || !mounted) return;

    // Navigate to PrescriptionCreateScreen in Amendment mode
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PrescriptionCreateScreen(
          consultationId: _prescription!.consultationId,
          prefilledPatientId: _prescription!.patientId,
          prefilledPatientName: _prescription!.patient?.fullName,
          prefilledPatientDetails: _prescription!.patient != null
              ? '${_prescription!.patient!.gender.toUpperCase()} • ${_prescription!.patient!.phone}'
              : null,
          isAmending: true,
          amendingPrescriptionId: _prescription!.id,
          amendingFromVersion: _prescription!.amendmentVersion,
          initialAmendmentReason: details.reason,
          initialNotes: details.notes ?? _prescription!.notes,
          initialItems: List<PrescriptionItem>.from(_prescription!.items),
          prescriptionsService: _prescriptionsService,
        ),
      ),
    );
  }

  void _openPriorPrescriptionsSheet() {
    if (_prescription?.patientId == null) return;

    PreviousPrescriptionsReferenceSheet.show(
      context,
      patientId: _prescription!.patientId,
      patientName: _prescription!.patient?.fullName ?? 'Patient',
      prescriptionsService: _prescriptionsService,
    );
  }

  @override
  Widget build(BuildContext context) {
    final rx = _prescription;
    final isDraft = rx?.isDraft ?? false;
    final isApproved = rx?.isApproved ?? false;
    final isSuperseded = rx?.isSuperseded ?? false;

    return PopScope(
      canPop: !_hasUnsavedChanges || isApproved || isSuperseded,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldLeave = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Unsaved Draft Changes'),
            content: const Text(
              'You have unsaved changes to this prescription draft. Discard them and leave?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Keep Editing'),
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
        if (shouldLeave == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppTheme.backgroundLight,
        appBar: AppBar(
          title: Text(
            isDraft
                ? 'Prescription Draft'
                : (isApproved
                    ? 'Approved Prescription'
                    : 'Superseded Prescription'),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
          ),
          backgroundColor: Colors.white,
          elevation: 0,
          actions: [
            if (isApproved || isSuperseded)
              IconButton(
                key: const Key('printPdfIconButton'),
                icon: _isGeneratingPdf
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.print_rounded),
                tooltip: 'Preview & Print PDF',
                color: AppTheme.primaryNavy,
                onPressed: _isGeneratingPdf ? null : _handlePrintPdf,
              ),
            if (rx?.patientId != null)
              IconButton(
                key: const Key('priorPrescriptionsAction'),
                icon: const Icon(Icons.history_edu_rounded),
                tooltip: 'Prior Prescriptions History',
                color: AppTheme.primaryNavy,
                onPressed: _openPriorPrescriptionsSheet,
              ),
          ],
        ),
        body: _buildBody(),
        bottomNavigationBar: _buildBottomBar(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _prescription == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null && _prescription == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  color: AppTheme.dangerRed, size: 40),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.dangerRed),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _loadPrescription,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final rx = _prescription!;
    final isDraft = rx.isDraft;

    return RefreshIndicator(
      onRefresh: _loadPrescription,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Error banner
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

                // Status & Immutability Badge Banner
                _buildStatusBanner(rx),
                const SizedBox(height: 14),

                // Patient Details Card
                _buildPatientCard(rx),
                const SizedBox(height: 14),

                // Medication Items Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'PRESCRIBED MEDICATIONS',
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
                            color: AppTheme.accentTeal.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${isDraft ? _draftItems.length : rx.items.length}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.accentTeal,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (isDraft)
                      ElevatedButton.icon(
                        key: const Key('addMedicationDraftButton'),
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
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                // Items Cards
                if (isDraft) ...[
                  if (_draftItems.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.borderGray),
                      ),
                      child: const Text('No medications added.'),
                    )
                  else
                    ..._draftItems.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final item = entry.value;
                      return MedicationItemCard(
                        item: item,
                        index: idx,
                        isReadOnly: false,
                        onEdit: () => _openMedicationEditor(item, idx),
                        onDelete: () => _removeItem(idx),
                      );
                    }),
                ] else ...[
                  // STRICT READ-ONLY MODE
                  ...rx.items.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final item = entry.value;
                    return MedicationItemCard(
                      item: item,
                      index: idx,
                      isReadOnly: true,
                    );
                  }),
                ],

                const SizedBox(height: 14),

                // Prescription Notes
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
                        'PRESCRIPTION NOTES & ADVICE',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (isDraft)
                        TextFormField(
                          key: const Key('draftNotesField'),
                          controller: _notesController,
                          maxLines: 3,
                          maxLength: 2000,
                          onChanged: (_) {
                            if (!_hasUnsavedChanges) {
                              setState(() {
                                _hasUnsavedChanges = true;
                              });
                            }
                          },
                          decoration: InputDecoration(
                            hintText: 'Add clinical advice or instructions...',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            contentPadding: const EdgeInsets.all(12),
                          ),
                        )
                      else
                        Text(
                          rx.notes != null && rx.notes!.trim().isNotEmpty
                              ? rx.notes!.trim()
                              : 'No specific notes recorded.',
                          style: TextStyle(
                            fontSize: 13,
                            color: rx.notes != null && rx.notes!.trim().isNotEmpty
                                ? AppTheme.textPrimary
                                : AppTheme.textSecondary,
                            fontStyle: rx.notes != null &&
                                    rx.notes!.trim().isNotEmpty
                                ? FontStyle.normal
                                : FontStyle.italic,
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
      ),
    );
  }

  Widget _buildStatusBanner(Prescription rx) {
    if (rx.isApproved) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.successGreen.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: AppTheme.successGreen.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.lock_rounded, color: AppTheme.successGreen, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'APPROVED RECORD (IMMUTABLE)',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.successGreen,
                        ),
                      ),
                      if (rx.amendmentVersion > 1) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 1.5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.indigo.shade50,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.indigo.shade200),
                          ),
                          child: Text(
                            'Version ${rx.amendmentVersion}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.indigo.shade800,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Signed by Dr. ${rx.doctor?.fullName ?? "Attending Doctor"} • Legally binding prescription.',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (rx.isSuperseded) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade400),
        ),
        child: const Row(
          children: [
            Icon(Icons.history_rounded, color: Colors.blueGrey, size: 22),
            SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SUPERSEDED PRESCRIPTION',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: Colors.blueGrey,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'This version has been superseded by a clinical amendment and is kept for audit history.',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.edit_note_rounded,
              color: Colors.orange.shade900, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'DRAFT PRESCRIPTION (UNAPPROVED)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.orange.shade900,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'This prescription is currently an editable draft and has not been locked or issued.',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPatientCard(Prescription rx) {
    return Container(
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
              CircleAvatar(
                radius: 18,
                backgroundColor: AppTheme.primaryNavy.withValues(alpha: 0.1),
                child: const Icon(
                  Icons.person_rounded,
                  color: AppTheme.primaryNavy,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rx.patient?.fullName ?? 'Patient ID: ${rx.patientId}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    if (rx.patient != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        '${rx.patient!.gender.toUpperCase()} • Phone: ${rx.patient!.phone}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (rx.consultationId != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.accentTeal.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: AppTheme.accentTeal.withValues(alpha: 0.3),
                    ),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.link_rounded,
                          size: 13, color: AppTheme.accentTeal),
                      SizedBox(width: 4),
                      Text(
                        'OPD Visit',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.accentTeal,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget? _buildBottomBar() {
    final rx = _prescription;
    if (rx == null) return null;

    if (rx.isApproved) {
      // APPROVED ACTIONS: PRINT / DOWNLOAD PDF & AMEND
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Colors.grey.shade200)),
        ),
        child: SafeArea(
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('amendPrescriptionButton'),
                  onPressed: _handleInitiateAmendment,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.edit_note_rounded, size: 20),
                  label: const Text(
                    'Amend',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  key: const Key('printPdfButton'),
                  onPressed: _isGeneratingPdf ? null : _handlePrintPdf,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  icon: _isGeneratingPdf
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.print_rounded, size: 20),
                  label: const Text(
                    'View / Print PDF',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (rx.isDraft) {
      // DRAFT ACTIONS: SAVE EDITS & APPROVE
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Colors.grey.shade200)),
        ),
        child: SafeArea(
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  key: const Key('saveDraftChangesButton'),
                  onPressed:
                      _isSavingDraft || _isApproving ? null : _handleSaveDraftChanges,
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
                          'Save Changes',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  key: const Key('approveDraftPrescriptionButton'),
                  onPressed:
                      _isSavingDraft || _isApproving ? null : _handleApprove,
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
                    'Approve & Lock',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return null;
  }
}

