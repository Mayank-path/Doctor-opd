import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/storage/secure_storage_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../auth/models/auth_user.dart';
import '../models/consultation.dart';
import '../models/update_consultation_request.dart';
import '../services/consultations_service.dart';
import 'components/consultation_finalize_dialog.dart';
import 'components/vitals_input_grid.dart';
import '../../prescriptions/ui/prescription_create_screen.dart';

/// Screen displaying and managing a clinical consultation record.
///
/// Lifecycle & Security Invariants:
/// - If DRAFT and current user is the attending doctor: allows editing and finalization.
/// - If FINALIZED: strictly read-only and immutable. No edit or delete options exist.
/// - If current user is non-doctor or unauthorized: displays access-restricted view without leaking clinical narratives.
/// - Protects unsaved edits via PopScope before exiting.
class ConsultationDetailsScreen extends StatefulWidget {
  final String consultationId;
  final Consultation? initialConsultation;
  final ConsultationsService? consultationsService;
  final SecureStorageService? storageService;

  const ConsultationDetailsScreen({
    super.key,
    required this.consultationId,
    this.initialConsultation,
    this.consultationsService,
    this.storageService,
  });

  @override
  State<ConsultationDetailsScreen> createState() =>
      _ConsultationDetailsScreenState();
}

class _ConsultationDetailsScreenState extends State<ConsultationDetailsScreen> {
  final _formKey = GlobalKey<FormState>();

  late final ConsultationsService _consultationsService;
  late final SecureStorageService _storageService;

  Consultation? _consultation;
  AuthUser? _currentUser;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isFinalizing = false;
  String? _errorMessage;
  bool _hasUnsavedChanges = false;
  bool _isForbidden = false;

  // Form controllers
  final _chiefComplaintController = TextEditingController();
  final _symptomsController = TextEditingController();
  final _examinationController = TextEditingController();
  final _diagnosisController = TextEditingController();
  final _treatmentPlanController = TextEditingController();
  final _followUpDateController = TextEditingController();

  // Vitals controllers
  final _bpSystolicController = TextEditingController();
  final _bpDiastolicController = TextEditingController();
  final _pulseController = TextEditingController();
  final _temperatureController = TextEditingController();
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _spo2Controller = TextEditingController();
  final _respiratoryRateController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _consultationsService =
        widget.consultationsService ?? ConsultationsService();
    _storageService = widget.storageService ?? SecureStorageService();

    if (widget.initialConsultation != null) {
      _consultation = widget.initialConsultation;
      _populateControllers(widget.initialConsultation!);
      _isLoading = false;
    }

    _loadUserAndConsultation();
  }

  Future<void> _loadUserAndConsultation() async {
    final user = await _storageService.getUser();
    if (mounted) {
      setState(() {
        _currentUser = user;
      });
    }

    if (_consultation == null) {
      await _fetchConsultation();
    } else if (_consultation!.patient == null) {
      try {
        final record = await _consultationsService.getConsultationById(widget.consultationId);
        if (mounted && record.patient != null) {
          setState(() {
            _consultation = _consultation!.copyWith(patient: record.patient);
          });
        }
      } catch (_) {}
    }
  }

  Future<void> _fetchConsultation() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _isForbidden = false;
    });

    try {
      final record =
          await _consultationsService.getConsultationById(widget.consultationId);
      if (mounted) {
        setState(() {
          _consultation = record;
          _populateControllers(record);
          _hasUnsavedChanges = false;
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          if (e.statusCode == 403) {
            _isForbidden = true;
            _errorMessage =
                'Access restricted: You are not authorized to view this clinical consultation record.';
          } else {
            _errorMessage = e.message;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load consultation: $e';
        });
      }
    }
  }

  void _populateControllers(Consultation c) {
    _chiefComplaintController.text = c.chiefComplaint;
    _symptomsController.text = c.symptoms ?? '';
    _examinationController.text = c.examination ?? '';
    _diagnosisController.text = c.diagnosis ?? '';
    _treatmentPlanController.text = c.treatmentPlan ?? '';
    _followUpDateController.text = c.followUpDate != null && c.followUpDate!.length >= 10
        ? c.followUpDate!.substring(0, 10)
        : (c.followUpDate ?? '');

    _bpSystolicController.text = c.bpSystolic?.toString() ?? '';
    _bpDiastolicController.text = c.bpDiastolic?.toString() ?? '';
    _pulseController.text = c.pulse?.toString() ?? '';
    _temperatureController.text = c.temperature?.toString() ?? '';
    _weightController.text = c.weightKg?.toString() ?? '';
    _heightController.text = c.heightCm?.toString() ?? '';
    _spo2Controller.text = c.spo2?.toString() ?? '';
    _respiratoryRateController.text = c.respiratoryRate?.toString() ?? '';

    _attachDirtyListeners();
  }

  void _attachDirtyListeners() {
    void onFieldChange() {
      if (!_hasUnsavedChanges && mounted && (_consultation?.isDraft ?? false)) {
        setState(() {
          _hasUnsavedChanges = true;
        });
      }
    }

    _chiefComplaintController.addListener(onFieldChange);
    _symptomsController.addListener(onFieldChange);
    _examinationController.addListener(onFieldChange);
    _diagnosisController.addListener(onFieldChange);
    _treatmentPlanController.addListener(onFieldChange);
    _followUpDateController.addListener(onFieldChange);
    _bpSystolicController.addListener(onFieldChange);
    _bpDiastolicController.addListener(onFieldChange);
    _pulseController.addListener(onFieldChange);
    _temperatureController.addListener(onFieldChange);
    _weightController.addListener(onFieldChange);
    _heightController.addListener(onFieldChange);
    _spo2Controller.addListener(onFieldChange);
    _respiratoryRateController.addListener(onFieldChange);
  }

  @override
  void dispose() {
    _chiefComplaintController.dispose();
    _symptomsController.dispose();
    _examinationController.dispose();
    _diagnosisController.dispose();
    _treatmentPlanController.dispose();
    _followUpDateController.dispose();

    _bpSystolicController.dispose();
    _bpDiastolicController.dispose();
    _pulseController.dispose();
    _temperatureController.dispose();
    _weightController.dispose();
    _heightController.dispose();
    _spo2Controller.dispose();
    _respiratoryRateController.dispose();
    super.dispose();
  }

  UpdateConsultationRequest _buildUpdateRequest() {
    int? parseInt(String text) {
      final trimmed = text.trim();
      return trimmed.isNotEmpty ? int.tryParse(trimmed) : null;
    }

    double? parseDouble(String text) {
      final trimmed = text.trim();
      return trimmed.isNotEmpty ? double.tryParse(trimmed) : null;
    }

    return UpdateConsultationRequest(
      chiefComplaint: _chiefComplaintController.text.trim().isNotEmpty
          ? _chiefComplaintController.text.trim()
          : null,
      symptoms: _symptomsController.text.trim(),
      examination: _examinationController.text.trim(),
      diagnosis: _diagnosisController.text.trim(),
      treatmentPlan: _treatmentPlanController.text.trim(),
      followUpDate: _followUpDateController.text.trim().isNotEmpty
          ? _followUpDateController.text.trim()
          : null,
      bpSystolic: parseInt(_bpSystolicController.text),
      bpDiastolic: parseInt(_bpDiastolicController.text),
      pulse: parseInt(_pulseController.text),
      temperature: parseDouble(_temperatureController.text),
      weightKg: parseDouble(_weightController.text),
      heightCm: parseDouble(_heightController.text),
      spo2: parseInt(_spo2Controller.text),
      respiratoryRate: parseInt(_respiratoryRateController.text),
    );
  }

  Future<void> _handleSaveDraft() async {
    if (_consultation == null || _isSaving || _isFinalizing) return;

    if (!_formKey.currentState!.validate()) return;

    final request = _buildUpdateRequest();
    if (!request.hasUpdates) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No changes to save')),
      );
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      final updated = await _consultationsService.updateDraft(
        _consultation!.id,
        request,
      );

      if (mounted) {
        setState(() {
          _consultation = updated.patient != null
              ? updated
              : updated.copyWith(patient: _consultation?.patient);
          _hasUnsavedChanges = false;
          _isSaving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Consultation draft saved successfully'),
            backgroundColor: AppTheme.accentTeal,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isSaving = false;
          _errorMessage = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaving = false;
          _errorMessage = 'Failed to save draft: $e';
        });
      }
    }
  }

  Future<void> _handleFinalize() async {
    if (_consultation == null || _isSaving || _isFinalizing) return;

    // Validate form before opening finalization
    if (!_formKey.currentState!.validate()) return;

    // Save any pending changes first
    if (_hasUnsavedChanges) {
      final request = _buildUpdateRequest();
      if (request.hasUpdates) {
        try {
          final saved = await _consultationsService.updateDraft(
            _consultation!.id,
            request,
          );
          if (mounted) {
            setState(() {
              _consultation = saved;
              _hasUnsavedChanges = false;
            });
          }
        } catch (_) {
          // If update fails, still allow dialog or report
        }
      }
    }

    if (!mounted) return;

    setState(() {
      _isFinalizing = true;
    });

    try {
      final result = await showDialog<Consultation>(
        context: context,
        barrierDismissible: false,
        builder: (_) => ConsultationFinalizeDialog(
          consultation: _consultation!,
          consultationsService: _consultationsService,
        ),
      );

      if (result != null && mounted) {
        setState(() {
          _consultation = result.patient != null
              ? result
              : result.copyWith(patient: _consultation?.patient);
          _hasUnsavedChanges = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Consultation finalized and locked permanently'),
            backgroundColor: AppTheme.successGreen,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isFinalizing = false;
        });
      }
    }
  }

  Future<bool> _onWillPop() async {
    if (!_hasUnsavedChanges || (_consultation?.isFinalized ?? true)) {
      return true;
    }

    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unsaved Changes'),
        content: const Text(
          'You have unsaved changes in this consultation draft. Do you want to discard them and exit?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep Editing'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Discard Changes'),
          ),
        ],
      ),
    );

    return discard ?? false;
  }

  Future<void> _pickFollowUpDate() async {
    DateTime initial = DateTime.now().add(const Duration(days: 7));
    if (_followUpDateController.text.isNotEmpty) {
      try {
        initial = DateTime.parse('${_followUpDateController.text}T00:00:00Z');
      } catch (_) {}
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );

    if (picked != null) {
      final year = picked.year.toString().padLeft(4, '0');
      final month = picked.month.toString().padLeft(2, '0');
      final day = picked.day.toString().padLeft(2, '0');
      setState(() {
        _followUpDateController.text = '$year-$month-$day';
        _hasUnsavedChanges = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_hasUnsavedChanges || (_consultation?.isFinalized ?? true),
      onPopInvokedWithResult: (didPop, result) async {
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
            _consultation?.isFinalized == true
                ? 'Finalized Consultation'
                : 'Consultation Note',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
          ),
          backgroundColor: Colors.white,
          elevation: 0,
          actions: [
            if (_consultation != null) ...[
              IconButton(
                key: const Key('consultationPrescriptionAppBarButton'),
                icon: const Icon(Icons.receipt_long_rounded),
                tooltip: 'Prescription Builder',
                color: AppTheme.primaryNavy,
                onPressed: () {
                  final c = _consultation!;
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => PrescriptionCreateScreen(
                        consultationId: c.id,
                        prefilledPatientId: c.patientId,
                        prefilledPatientName: c.patientName,
                        prefilledConsultationContext:
                            'Diagnosis: ${c.diagnosis ?? "N/A"} | Complaint: ${c.chiefComplaint}',
                      ),
                    ),
                  );
                },
              ),
            ],
            if (_consultation != null &&
                !_consultation!.isFinalized &&
                _canCurrentUserEdit()) ...[
              TextButton.icon(
                key: const Key('saveDraftButton'),
                onPressed: _isSaving || _isFinalizing ? null : _handleSaveDraft,
                icon: _isSaving
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined, size: 18),
                label: const Text('Save'),
              ),
              const SizedBox(width: 4),
            ],
          ],
        ),
        body: _buildBody(),
        bottomNavigationBar: _buildBottomBar(),
      ),
    );
  }

  bool _canCurrentUserEdit() {
    if (_consultation == null) return false;
    final userId = _currentUser?.id;
    final role = _currentUser?.role;
    return _consultation!.canEdit(userId, role);
  }

  bool _canCurrentUserFinalize() {
    if (_consultation == null) return false;
    final userId = _currentUser?.id;
    final role = _currentUser?.role;
    return _consultation!.canFinalize(userId, role);
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(strokeWidth: 2.5),
      );
    }

    if (_isForbidden) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blueGrey.withAlpha(25),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.shield_outlined,
                  size: 48,
                  color: Colors.blueGrey,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Access Restricted',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Clinical consultation records are restricted to authorized Doctor memberships under healthcare privacy regulations.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    if (_errorMessage != null && _consultation == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: AppTheme.errorRed),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchConsultation,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final c = _consultation!;
    final isEditable = c.isDraft && _canCurrentUserEdit();

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
        children: [
          // Patient & Encounter Header
          _buildPatientHeader(c),

          const SizedBox(height: 12),

          // Error banner if any
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.errorRed.withAlpha(25),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.errorRed.withAlpha(75)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: AppTheme.errorRed, size: 20),
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
            const SizedBox(height: 12),
          ],

          // Status & Immutability Notice
          if (c.isFinalized)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.successGreen.withAlpha(20),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.successGreen.withAlpha(80)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_rounded,
                      color: AppTheme.successGreen, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'FINALIZED RECORD (IMMUTABLE)',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.successGreen,
                          ),
                        ),
                        if (c.formattedFinalizedAt != null)
                          Text(
                            'Finalized: ${c.formattedFinalizedAt}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else if (_hasUnsavedChanges)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                children: [
                  Icon(Icons.edit, size: 16, color: Colors.amber.shade900),
                  const SizedBox(width: 8),
                  Text(
                    'Unsaved draft changes',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade900,
                    ),
                  ),
                ],
              ),
            ),

          // Chief Complaint Card
          _buildCard(
            title: 'Chief Complaint *',
            icon: Icons.chat_bubble_outline_rounded,
            child: isEditable
                ? TextFormField(
                    key: const Key('chiefComplaintField'),
                    controller: _chiefComplaintController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Enter patient chief complaint (e.g. Fever, persistent cough for 3 days)...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Chief complaint is required';
                      }
                      if (val.trim().length > 500) {
                        return 'Exceeds maximum 500 characters';
                      }
                      return null;
                    },
                  )
                : Text(
                    c.chiefComplaint,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppTheme.textPrimary,
                    ),
                  ),
          ),

          const SizedBox(height: 12),

          // Clinical Narrative Card
          _buildCard(
            title: 'Clinical Evaluation',
            icon: Icons.medical_services_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildClinicalTextField(
                  label: 'Symptoms / History of Present Illness',
                  controller: _symptomsController,
                  text: c.symptoms,
                  isEditable: isEditable,
                  hintText: 'History of present illness, symptom timeline...',
                ),
                const SizedBox(height: 12),
                _buildClinicalTextField(
                  label: 'Physical Examination Findings',
                  controller: _examinationController,
                  text: c.examination,
                  isEditable: isEditable,
                  hintText: 'General appearance, systemic examination findings...',
                ),
                const SizedBox(height: 12),
                _buildClinicalTextField(
                  label: 'Clinical Diagnosis',
                  controller: _diagnosisController,
                  text: c.diagnosis,
                  isEditable: isEditable,
                  hintText: 'Working / definitive diagnosis...',
                ),
                const SizedBox(height: 12),
                _buildClinicalTextField(
                  label: 'Treatment Plan & Prescriptions',
                  controller: _treatmentPlanController,
                  text: c.treatmentPlan,
                  isEditable: isEditable,
                  hintText: 'Medication regimen, dosage, diet, and clinical advice...',
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Vital Signs Card
          _buildCard(
            title: 'Vital Signs',
            icon: Icons.monitor_heart_outlined,
            child: isEditable
                ? VitalsInputGrid(
                    bpSystolicController: _bpSystolicController,
                    bpDiastolicController: _bpDiastolicController,
                    pulseController: _pulseController,
                    temperatureController: _temperatureController,
                    weightController: _weightController,
                    heightController: _heightController,
                    spo2Controller: _spo2Controller,
                    respiratoryRateController: _respiratoryRateController,
                    isReadOnly: false,
                  )
                : VitalsInputGrid(
                    bpSystolic: c.bpSystolic,
                    bpDiastolic: c.bpDiastolic,
                    pulse: c.pulse,
                    temperature: c.temperature,
                    weightKg: c.weightKg,
                    heightCm: c.heightCm,
                    spo2: c.spo2,
                    respiratoryRate: c.respiratoryRate,
                    isReadOnly: true,
                  ),
          ),

          const SizedBox(height: 12),

          // Prescriptions Card
          _buildCard(
            title: 'Prescriptions',
            icon: Icons.receipt_long_rounded,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _consultation?.isFinalized == true
                        ? 'Prescription orders linked to this consultation.'
                        : 'Draft or review prescription orders for this visit.',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  key: const Key('composePrescriptionButton'),
                  onPressed: () {
                    final c = _consultation!;
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => PrescriptionCreateScreen(
                          consultationId: c.id,
                          prefilledPatientId: c.patientId,
                          prefilledPatientName: c.patientName,
                          prefilledConsultationContext:
                              'Diagnosis: ${c.diagnosis ?? "N/A"} | Complaint: ${c.chiefComplaint}',
                        ),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.accentTeal,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.add_rounded, size: 16),
                  label: const Text(
                    'Prescription',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Follow-up Date Card
          _buildCard(
            title: 'Follow-Up Instructions',
            icon: Icons.calendar_today_rounded,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _followUpDateController.text.isNotEmpty
                        ? 'Follow-up Date: ${_followUpDateController.text}'
                        : 'No follow-up scheduled',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: _followUpDateController.text.isNotEmpty
                          ? FontWeight.w600
                          : FontWeight.normal,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                if (isEditable)
                  OutlinedButton.icon(
                    key: const Key('pickFollowUpDateButton'),
                    onPressed: _pickFollowUpDate,
                    icon: const Icon(Icons.date_range, size: 16),
                    label: Text(
                      _followUpDateController.text.isNotEmpty
                          ? 'Change Date'
                          : 'Set Date',
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPatientHeader(Consultation c) {
    final p = c.patient;

    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p?.fullName ?? 'Patient',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'UHID: ${p?.uhid ?? "N/A"} • ${p?.gender ?? ""} • ${p?.age != null ? "${p!.age} yrs" : ""}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: c.status.color.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(c.status.icon, size: 14, color: c.status.color),
                      const SizedBox(width: 4),
                      Text(
                        c.status.label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: c.status.color,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(
                  Icons.event_note,
                  size: 14,
                  color: Colors.grey.shade600,
                ),
                const SizedBox(width: 4),
                Text(
                  'Encounter: ${c.formattedEncounterDate}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: AppTheme.accentTeal),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }

  Widget _buildClinicalTextField({
    required String label,
    required TextEditingController controller,
    required String? text,
    required bool isEditable,
    required String hintText,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        if (isEditable)
          TextFormField(
            controller: controller,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: hintText,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            validator: (val) {
              if (val != null && val.length > 5000) {
                return 'Maximum length is 5000 characters';
              }
              return null;
            },
          )
        else
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.backgroundLight,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppTheme.borderSubtle),
            ),
            child: Text(
              text != null && text.isNotEmpty ? text : 'None recorded',
              style: TextStyle(
                fontSize: 13,
                color: text != null && text.isNotEmpty
                    ? AppTheme.textPrimary
                    : Colors.grey.shade500,
              ),
            ),
          ),
      ],
    );
  }

  Widget? _buildBottomBar() {
    if (_consultation == null || _consultation!.isFinalized) {
      return null;
    }

    if (!_canCurrentUserFinalize()) {
      return null;
    }

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
                key: const Key('saveDraftBottomButton'),
                onPressed: _isSaving || _isFinalizing ? null : _handleSaveDraft,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSaving
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
                key: const Key('finalizeConsultationButton'),
                onPressed: _isSaving || _isFinalizing ? null : _handleFinalize,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentTeal,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                icon: const Icon(Icons.check_circle_outline, size: 20),
                label: const Text(
                  'Finalize Record',
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
