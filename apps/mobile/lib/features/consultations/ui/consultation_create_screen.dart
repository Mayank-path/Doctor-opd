import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/storage/secure_storage_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/create_consultation_request.dart';
import '../services/consultations_service.dart';
import 'components/vitals_input_grid.dart';
import 'consultation_details_screen.dart';

/// Screen for creating a new consultation draft for a patient.
///
/// Role Security:
/// - Restricted to DOCTOR role only.
/// - Unauthorized roles (ADMIN, RECEPTIONIST, STAFF) see an access restriction shield.
/// - Unsaved changes prompt warning before back navigation.
class ConsultationCreateScreen extends StatefulWidget {
  final String? patientId;
  final String? patientName;
  final String? patientUhid;
  final String? patientGender;
  final int? patientAge;
  final String? initialChiefComplaint;
  final String? appointmentId;
  final String? queueEntryId;
  final ConsultationsService? consultationsService;
  final SecureStorageService? storageService;

  const ConsultationCreateScreen({
    super.key,
    this.patientId,
    this.patientName,
    this.patientUhid,
    this.patientGender,
    this.patientAge,
    this.initialChiefComplaint,
    this.appointmentId,
    this.queueEntryId,
    this.consultationsService,
    this.storageService,
  });

  @override
  State<ConsultationCreateScreen> createState() =>
      _ConsultationCreateScreenState();
}

class _ConsultationCreateScreenState extends State<ConsultationCreateScreen> {
  final _formKey = GlobalKey<FormState>();

  late final ConsultationsService _consultationsService;
  late final SecureStorageService _storageService;

  bool _isLoading = true;
  bool _isCreating = false;
  String? _errorMessage;
  bool _hasUnsavedChanges = false;
  bool _isForbidden = false;

  // Controllers
  final _patientIdController = TextEditingController();
  final _chiefComplaintController = TextEditingController();
  final _symptomsController = TextEditingController();
  final _examinationController = TextEditingController();
  final _diagnosisController = TextEditingController();
  final _treatmentPlanController = TextEditingController();
  final _followUpDateController = TextEditingController();

  // Vitals
  final _bpSystolicController = TextEditingController();
  final _bpDiastolicController = TextEditingController();
  final _pulseController = TextEditingController();
  final _temperatureController = TextEditingController();
  final _weightKgController = TextEditingController();
  final _heightCmController = TextEditingController();
  final _spo2Controller = TextEditingController();
  final _respiratoryRateController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _consultationsService =
        widget.consultationsService ?? ConsultationsService();
    _storageService = widget.storageService ?? SecureStorageService();

    if (widget.patientId != null) {
      _patientIdController.text = widget.patientId!;
    }
    if (widget.initialChiefComplaint != null) {
      _chiefComplaintController.text = widget.initialChiefComplaint!;
    }

    _loadUserSession();
  }

  @override
  void dispose() {
    _patientIdController.dispose();
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
    _weightKgController.dispose();
    _heightCmController.dispose();
    _spo2Controller.dispose();
    _respiratoryRateController.dispose();
    super.dispose();
  }

  Future<void> _loadUserSession() async {
    try {
      final user = await _storageService.getUser();
      if (!mounted) return;

      if (user == null || (user.role != null && user.role != 'DOCTOR')) {
        setState(() {
          _isForbidden = true;
          _isLoading = false;
        });
        return;
      }

      setState(() {
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isForbidden = true;
        _isLoading = false;
      });
    }
  }

  void _onFieldChanged() {
    if (!_hasUnsavedChanges) {
      setState(() {
        _hasUnsavedChanges = true;
      });
    }
  }

  Future<bool> _onWillPop() async {
    if (!_hasUnsavedChanges) return true;

    final shouldDiscard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard Consultation Draft?'),
        content: const Text(
          'You have unsaved clinical entries. If you leave now, this draft will not be created.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Stay & Continue'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
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

  Future<void> _selectFollowUpDate() async {
    final now = DateTime.now();
    final initial = now.add(const Duration(days: 7));
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );

    if (picked != null) {
      final formatted =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      setState(() {
        _followUpDateController.text = formatted;
        _hasUnsavedChanges = true;
      });
    }
  }

  int? _parseInt(TextEditingController controller) {
    final text = controller.text.trim();
    if (text.isEmpty) return null;
    return int.tryParse(text);
  }

  double? _parseDouble(TextEditingController controller) {
    final text = controller.text.trim();
    if (text.isEmpty) return null;
    return double.tryParse(text);
  }

  Future<void> _submitCreateDraft() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final targetPatientId = widget.patientId ?? _patientIdController.text.trim();
    if (targetPatientId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select or provide a valid Patient ID'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    final request = CreateConsultationRequest(
      patientId: targetPatientId,
      chiefComplaint: _chiefComplaintController.text.trim(),
      symptoms: _symptomsController.text.trim().isEmpty
          ? null
          : _symptomsController.text.trim(),
      examination: _examinationController.text.trim().isEmpty
          ? null
          : _examinationController.text.trim(),
      diagnosis: _diagnosisController.text.trim().isEmpty
          ? null
          : _diagnosisController.text.trim(),
      treatmentPlan: _treatmentPlanController.text.trim().isEmpty
          ? null
          : _treatmentPlanController.text.trim(),
      followUpDate: _followUpDateController.text.trim().isEmpty
          ? null
          : _followUpDateController.text.trim(),
      bpSystolic: _parseInt(_bpSystolicController),
      bpDiastolic: _parseInt(_bpDiastolicController),
      pulse: _parseInt(_pulseController),
      temperature: _parseDouble(_temperatureController),
      weightKg: _parseDouble(_weightKgController),
      heightCm: _parseDouble(_heightCmController),
      spo2: _parseInt(_spo2Controller),
      respiratoryRate: _parseInt(_respiratoryRateController),
    );

    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(validationErrors.values.first),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    setState(() {
      _isCreating = true;
      _errorMessage = null;
    });

    try {
      final created = await _consultationsService.createDraft(request);
      if (!mounted) return;

      setState(() {
        _hasUnsavedChanges = false;
        _isCreating = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Consultation draft created successfully'),
          backgroundColor: AppTheme.successGreen,
        ),
      );

      // Replace current create screen with details screen
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ConsultationDetailsScreen(
            consultationId: created.id,
            initialConsultation: created,
            consultationsService: _consultationsService,
            storageService: _storageService,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isCreating = false;
        _errorMessage = e is ApiException
            ? e.message
            : 'Failed to create consultation draft. Please try again.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_errorMessage!),
          backgroundColor: AppTheme.errorRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_isForbidden) {
      return Scaffold(
        appBar: AppBar(title: const Text('Access Restricted')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.lock_outline_rounded,
                  size: 64,
                  color: AppTheme.textSecondary,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Doctor Role Required',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Clinical consultations may only be started and managed by authorized attending doctors. Clinical data is protected under medical privacy protocols.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final navigator = Navigator.of(context);
        final shouldPop = await _onWillPop();
        if (shouldPop && mounted) {
          navigator.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Start Consultation'),
          actions: [
            if (_isCreating)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  ),
                ),
              )
            else
              TextButton.icon(
                onPressed: _submitCreateDraft,
                icon: const Icon(Icons.check, color: Colors.white),
                label: const Text(
                  'Create Draft',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
          ],
        ),
        body: Form(
          key: _formKey,
          onChanged: _onFieldChanged,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Patient Info Card
              _buildPatientHeader(),
              const SizedBox(height: 16),

              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorRed.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.errorRed),
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
                            color: AppTheme.errorRed,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Chief Complaint (Required)
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade300),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.assignment_outlined,
                              size: 18, color: AppTheme.primaryNavy),
                          const SizedBox(width: 8),
                          const Text(
                            'Chief Complaint',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            '*',
                            style: TextStyle(
                              color: AppTheme.errorRed,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _chiefComplaintController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          hintText:
                              'Primary reason for visit (e.g. Acute high fever with cough for 3 days)...',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Chief complaint is required (1-500 characters)';
                          }
                          if (value.trim().length > 500) {
                            return 'Must be 500 characters or fewer';
                          }
                          return null;
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Clinical Notes
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade300),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Clinical Notes',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryNavy,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _symptomsController,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Symptoms / History of Present Illness',
                          hintText: 'e.g. Chills, sore throat, fatigue...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _examinationController,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Physical Examination Findings',
                          hintText: 'e.g. Chest clear, throat hyperemic...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _diagnosisController,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Clinical Diagnosis / Impression',
                          hintText: 'e.g. Upper Respiratory Tract Infection (URTI)...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _treatmentPlanController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Treatment Plan & Prescriptions',
                          hintText:
                              'Rx medications, dosage, rest, hydration, diet instructions...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _followUpDateController,
                        readOnly: true,
                        onTap: _selectFollowUpDate,
                        decoration: InputDecoration(
                          labelText: 'Follow-up Date (Optional)',
                          hintText: 'YYYY-MM-DD',
                          border: const OutlineInputBorder(),
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.calendar_today_outlined),
                            onPressed: _selectFollowUpDate,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Vitals Input Grid
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade300),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: VitalsInputGrid(
                    bpSystolicController: _bpSystolicController,
                    bpDiastolicController: _bpDiastolicController,
                    pulseController: _pulseController,
                    temperatureController: _temperatureController,
                    weightController: _weightKgController,
                    heightController: _heightCmController,
                    spo2Controller: _spo2Controller,
                    respiratoryRateController: _respiratoryRateController,
                    isReadOnly: false,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Bottom Submit Button
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryNavy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: _isCreating ? null : _submitCreateDraft,
                icon: _isCreating
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.post_add_outlined),
                label: Text(
                  _isCreating
                      ? 'Creating Draft...'
                      : 'Create Consultation Draft',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPatientHeader() {
    final hasPatientInfo = widget.patientName != null;

    return Card(
      elevation: 0,
      color: AppTheme.backgroundLight,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.person_outline,
                  color: AppTheme.primaryNavy,
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Patient Information',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                const Spacer(),
                if (widget.patientUhid != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.accentTeal.withAlpha(30),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'UHID: ${widget.patientUhid}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (hasPatientInfo) ...[
              Text(
                widget.patientName!,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${widget.patientGender ?? 'Unknown'} • ${widget.patientAge != null ? '${widget.patientAge} yrs' : 'Age N/A'}',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSecondary,
                ),
              ),
            ] else ...[
              TextFormField(
                controller: _patientIdController,
                decoration: const InputDecoration(
                  labelText: 'Patient UUID *',
                  hintText: 'Enter valid Patient UUID...',
                  border: OutlineInputBorder(),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Patient UUID is required';
                  }
                  return null;
                },
              ),
            ],
            if (widget.queueEntryId != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.how_to_reg_outlined,
                      size: 14, color: AppTheme.accentTeal),
                  const SizedBox(width: 4),
                  Text(
                    'Active OPD Queue Encounter',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.teal.shade800,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
