import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/storage/secure_storage_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../appointments/ui/components/patient_selector_modal.dart';
import '../../../auth/models/auth_user.dart';
import '../../../patients/models/patient.dart';
import '../../../patients/services/patients_service.dart';
import '../../models/check_in_request.dart';
import '../../services/queue_service.dart';

/// Modal bottom sheet allowing registration of a walk-in patient into the OPD queue
/// for a specified doctor and priority level on the selected service date.
class WalkInCheckInSheet extends StatefulWidget {
  final String serviceDate;
  final PatientsService patientsService;
  final QueueService queueService;
  final SecureStorageService? storageService;

  const WalkInCheckInSheet({
    super.key,
    required this.serviceDate,
    required this.patientsService,
    required this.queueService,
    this.storageService,
  });

  @override
  State<WalkInCheckInSheet> createState() => _WalkInCheckInSheetState();
}

class _WalkInCheckInSheetState extends State<WalkInCheckInSheet> {
  final _formKey = GlobalKey<FormState>();
  final _doctorIdController = TextEditingController();
  late final SecureStorageService _storageService;

  Patient? _selectedPatient;
  AuthUser? _currentUser;
  int _selectedPriority = 0; // 0 = Normal, 5 = High, 10 = Urgent

  bool _isCheckingIn = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _storageService = widget.storageService ?? SecureStorageService();
    _loadUserContext();
  }

  Future<void> _loadUserContext() async {
    final user = await _storageService.getUser();
    if (mounted && user != null) {
      setState(() {
        _currentUser = user;
        if (user.role?.toUpperCase() == 'DOCTOR' &&
            _doctorIdController.text.isEmpty) {
          _doctorIdController.text = user.id;
        }
      });
    }
  }

  @override
  void dispose() {
    _doctorIdController.dispose();
    super.dispose();
  }

  Future<void> _pickPatient() async {
    final picked = await showModalBottomSheet<Patient>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PatientSelectorModal(
        patientsService: widget.patientsService,
      ),
    );

    if (picked != null && mounted) {
      setState(() {
        _selectedPatient = picked;
      });
    }
  }

  Future<void> _handleCheckIn() async {
    if (_selectedPatient == null) {
      setState(() {
        _errorMessage = 'Please select a patient for walk-in check-in.';
      });
      return;
    }

    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_isCheckingIn) return;

    setState(() {
      _isCheckingIn = true;
      _errorMessage = null;
    });

    try {
      final request = CheckInRequest.forWalkIn(
        patientId: _selectedPatient!.id,
        doctorId: _doctorIdController.text.trim(),
        priority: _selectedPriority,
        serviceDate: widget.serviceDate,
      );

      final entry = await widget.queueService.checkIn(request);

      if (mounted) {
        Navigator.of(context).pop(entry);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isCheckingIn = false;
          _errorMessage = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isCheckingIn = false;
          _errorMessage = 'Walk-in check-in failed: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Title & Date
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withAlpha(25),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.directions_walk_rounded,
                    color: Colors.blue,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Walk-In Check-In',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      Text(
                        'Date: ${widget.serviceDate}',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Error banner
          if (_errorMessage != null)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          // Form fields
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                children: [
                  // Patient Selector Card
                  const Text(
                    'Patient *',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  InkWell(
                    key: const Key('walkInSelectPatientCard'),
                    onTap: _pickPatient,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: _selectedPatient != null
                            ? AppTheme.accentTeal.withAlpha(15)
                            : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _selectedPatient != null
                              ? AppTheme.accentTeal
                              : Colors.grey.shade300,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.person_search_rounded,
                            color: _selectedPatient != null
                                ? AppTheme.accentTeal
                                : Colors.grey.shade600,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _selectedPatient != null
                                ? Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _selectedPatient!.fullName,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.textPrimary,
                                        ),
                                      ),
                                      Text(
                                        'UHID: ${_selectedPatient!.uhid} • ${_selectedPatient!.gender} • ${_selectedPatient!.age ?? "--"} yrs',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade600,
                                        ),
                                      ),
                                    ],
                                  )
                                : Text(
                                    'Select or Register Patient',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                          ),
                          Icon(
                            Icons.chevron_right,
                            color: Colors.grey.shade400,
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Doctor ID
                  const Text(
                    'Assigned Doctor ID *',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    key: const Key('walkInDoctorIdField'),
                    controller: _doctorIdController,
                    decoration: InputDecoration(
                      hintText: 'Doctor UUID',
                      prefixIcon: const Icon(Icons.medical_services_outlined),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      helperText: _currentUser?.role?.toUpperCase() == 'DOCTOR'
                          ? 'Pre-filled with your Doctor ID'
                          : 'Enter the attending doctor UUID',
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Doctor ID is required';
                      }
                      final uuidRegex = RegExp(
                        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                      );
                      if (!uuidRegex.hasMatch(val.trim())) {
                        return 'Doctor ID must be a valid UUID';
                      }
                      return null;
                    },
                  ),

                  const SizedBox(height: 20),

                  // Priority Selector
                  const Text(
                    'Queue Priority',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildPriorityOption(
                        title: 'Normal',
                        priority: 0,
                        color: Colors.grey.shade700,
                        bgColor: Colors.grey.shade100,
                      ),
                      const SizedBox(width: 8),
                      _buildPriorityOption(
                        title: 'Priority',
                        priority: 5,
                        color: Colors.amber.shade800,
                        bgColor: Colors.amber.shade50,
                      ),
                      const SizedBox(width: 8),
                      _buildPriorityOption(
                        title: 'Emergency',
                        priority: 10,
                        color: Colors.red.shade700,
                        bgColor: Colors.red.shade50,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Bottom Action
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: SizedBox(
              height: 48,
              child: ElevatedButton(
                key: const Key('walkInSubmitButton'),
                onPressed: _isCheckingIn ? null : _handleCheckIn,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentTeal,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: _isCheckingIn
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add_task_rounded, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Allocate Token',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityOption({
    required String title,
    required int priority,
    required Color color,
    required Color bgColor,
  }) {
    final isSelected = _selectedPriority == priority;
    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            _selectedPriority = priority;
          });
        },
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? bgColor : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? color : Colors.grey.shade300,
              width: isSelected ? 1.8 : 1,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            title,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              color: isSelected ? color : Colors.grey.shade700,
            ),
          ),
        ),
      ),
    );
  }
}
