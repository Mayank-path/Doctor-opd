import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/models/auth_user.dart';
import '../../patients/models/patient.dart';
import '../../patients/services/patients_service.dart';
import '../models/appointment.dart';
import '../models/create_appointment_request.dart';
import '../services/appointments_service.dart';
import 'components/patient_selector_modal.dart';

/// Screen for creating a new scheduled or walk-in appointment
class AppointmentCreateScreen extends StatefulWidget {
  final Patient? initialPatient;
  final String? initialDoctorId;
  final PatientsService? patientsService;
  final AppointmentsService? appointmentsService;
  final SecureStorageService? storageService;

  const AppointmentCreateScreen({
    super.key,
    this.initialPatient,
    this.initialDoctorId,
    this.patientsService,
    this.appointmentsService,
    this.storageService,
  });

  @override
  State<AppointmentCreateScreen> createState() =>
      _AppointmentCreateScreenState();
}

class _AppointmentCreateScreenState extends State<AppointmentCreateScreen> {
  final _formKey = GlobalKey<FormState>();

  late final PatientsService _patientsService;
  late final AppointmentsService _appointmentsService;
  late final SecureStorageService _storageService;

  Patient? _selectedPatient;
  AuthUser? _currentUser;

  final _doctorIdController = TextEditingController();
  final _chiefComplaintController = TextEditingController();
  final _notesController = TextEditingController();

  late DateTime _selectedDate;
  TimeOfDay _startTime = const TimeOfDay(hour: 10, minute: 0);
  TimeOfDay? _endTime = const TimeOfDay(hour: 10, minute: 30);
  AppointmentType _selectedType = AppointmentType.scheduled;

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _patientsService = widget.patientsService ?? PatientsService();
    _appointmentsService = widget.appointmentsService ?? AppointmentsService();
    _storageService = widget.storageService ?? SecureStorageService();

    _selectedPatient = widget.initialPatient;

    // Default serviceDate to today in clinic timezone
    final todayStr = AppointmentsService.getClinicLocalDate();
    try {
      _selectedDate = DateTime.parse('${todayStr}T00:00:00Z');
    } catch (_) {
      _selectedDate = DateTime.now();
    }

    if (widget.initialDoctorId != null) {
      _doctorIdController.text = widget.initialDoctorId!;
    }

    _loadUserContext();
  }

  Future<void> _loadUserContext() async {
    final user = await _storageService.getUser();
    if (mounted && user != null) {
      setState(() {
        _currentUser = user;
        if (_doctorIdController.text.isEmpty) {
          // If the logged-in user is a DOCTOR, pre-fill doctorId with user ID
          if (user.role?.toUpperCase() == 'DOCTOR') {
            _doctorIdController.text = user.id;
          }
        }
      });
    }
  }

  @override
  void dispose() {
    _doctorIdController.dispose();
    _chiefComplaintController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _openPatientSelector() async {
    final picked = await showModalBottomSheet<Patient>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => PatientSelectorModal(
        patientsService: _patientsService,
      ),
    );

    if (picked != null && mounted) {
      setState(() {
        _selectedPatient = picked;
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _pickStartTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _startTime,
    );
    if (picked != null) {
      setState(() {
        _startTime = picked;
        // Adjust end time to 30 mins after start if end time was set or earlier
        if (_endTime != null) {
          final startMinutes = _startTime.hour * 60 + _startTime.minute;
          final endMinutes = _endTime!.hour * 60 + _endTime!.minute;
          if (endMinutes <= startMinutes) {
            final newEndMin = (startMinutes + 30) % 1440;
            _endTime = TimeOfDay(hour: newEndMin ~/ 60, minute: newEndMin % 60);
          }
        }
      });
    }
  }

  Future<void> _pickEndTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _endTime ??
          TimeOfDay(
            hour: (_startTime.hour + (_startTime.minute >= 30 ? 1 : 0)) % 24,
            minute: (_startTime.minute + 30) % 60,
          ),
    );
    if (picked != null) {
      setState(() {
        _endTime = picked;
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (_selectedPatient == null) {
      setState(() {
        _errorMessage = 'Please select a patient';
      });
      return;
    }

    if (!_formKey.currentState!.validate()) return;
    if (_isSubmitting) return;

    final startMinutes = _startTime.hour * 60 + _startTime.minute;
    if (_endTime != null) {
      final endMinutes = _endTime!.hour * 60 + _endTime!.minute;
      if (endMinutes <= startMinutes) {
        setState(() {
          _errorMessage = 'End time must be after start time';
        });
        return;
      }
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final dateStr =
          '${_selectedDate.year.toString().padLeft(4, '0')}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
      final startIso = AppointmentsService.toKolkataIsoString(
        _selectedDate,
        _startTime.hour,
        _startTime.minute,
      );
      final endIso = _endTime != null
          ? AppointmentsService.toKolkataIsoString(
              _selectedDate,
              _endTime!.hour,
              _endTime!.minute,
            )
          : null;

      final req = CreateAppointmentRequest(
        patientId: _selectedPatient!.id,
        doctorId: _doctorIdController.text.trim(),
        serviceDate: dateStr,
        startTime: startIso,
        endTime: endIso,
        type: _selectedType,
        chiefComplaint: _chiefComplaintController.text.trim().isEmpty
            ? null
            : _chiefComplaintController.text.trim(),
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      );

      final created = await _appointmentsService.createAppointment(req);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Appointment successfully booked for ${_selectedPatient!.fullName}',
            ),
            backgroundColor: AppTheme.successGreen,
          ),
        );
        Navigator.of(context).pop(created);
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
    final dateFormatted =
        '${_selectedDate.day.toString().padLeft(2, '0')}/${_selectedDate.month.toString().padLeft(2, '0')}/${_selectedDate.year}';

    final isDoctorUser = _currentUser?.role?.toUpperCase() == 'DOCTOR';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Book Appointment'),
        backgroundColor: AppTheme.primaryNavy,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorRed.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppTheme.errorRed.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          color: AppTheme.errorRed, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.errorRed,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Patient Selection Card
              const Text(
                'PATIENT *',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              if (_selectedPatient == null)
                InkWell(
                  onTap: _openPatientSelector,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        vertical: 18, horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.backgroundLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppTheme.accentTeal,
                        style: BorderStyle.solid,
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.person_add_rounded,
                            color: AppTheme.accentTeal, size: 22),
                        SizedBox(width: 10),
                        Text(
                          'Select or Register Patient',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.accentTeal,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.borderGray),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor:
                            AppTheme.accentTeal.withValues(alpha: 0.15),
                        child: Text(
                          _selectedPatient!.fullName.isNotEmpty
                              ? _selectedPatient!.fullName[0].toUpperCase()
                              : 'P',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppTheme.accentTeal,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selectedPatient!.fullName,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'UHID: ${_selectedPatient!.uhid} • ${_selectedPatient!.phone}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: _openPatientSelector,
                        child: const Text('Change'),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),

              // Doctor ID Selection
              const Text(
                'ASSIGNED DOCTOR *',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              if (isDoctorUser)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.borderGray),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.medical_services_rounded,
                          color: AppTheme.primaryNavy, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Dr. ${_currentUser?.fullName ?? "You"} (Active Clinician)',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            Text(
                              'UUID: ${_doctorIdController.text}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              else
                TextFormField(
                  controller: _doctorIdController,
                  decoration: const InputDecoration(
                    labelText: 'Doctor UUID *',
                    hintText: 'Enter active Doctor membership UUID',
                    prefixIcon: Icon(Icons.medical_services_rounded, size: 20),
                    helperText:
                        'Must be an active DOCTOR member in the active clinic',
                    border: OutlineInputBorder(),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Doctor UUID is required';
                    }
                    final uuidRegex = RegExp(
                      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                    );
                    if (!uuidRegex.hasMatch(val.trim())) {
                      return 'Enter a valid UUID format (8-4-4-4-12)';
                    }
                    return null;
                  },
                ),
              const SizedBox(height: 20),

              // Date & Time
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SERVICE DATE *',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: _pickDate,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 13),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppTheme.borderGray),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  dateFormatted,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const Icon(Icons.calendar_today_rounded,
                                    size: 18, color: AppTheme.primaryNavy),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'APPOINTMENT TYPE',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<AppointmentType>(
                          initialValue: _selectedType,
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 12),
                          ),
                          items: AppointmentType.values.map((type) {
                            return DropdownMenuItem(
                              value: type,
                              child: Text(
                                type.label,
                                style: const TextStyle(fontSize: 14),
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _selectedType = val;
                              });
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Time Pickers
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'START TIME *',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: _pickStartTime,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 13),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppTheme.borderGray),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  _startTime.format(context),
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const Icon(Icons.access_time_rounded,
                                    size: 18, color: AppTheme.primaryNavy),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'END TIME (OPTIONAL)',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: _pickEndTime,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 13),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppTheme.borderGray),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  _endTime?.format(context) ?? 'None',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: _endTime == null
                                        ? AppTheme.textSecondary
                                        : AppTheme.textPrimary,
                                  ),
                                ),
                                const Icon(Icons.access_time_rounded,
                                    size: 18, color: AppTheme.primaryNavy),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Chief Complaint
              const Text(
                'CHIEF COMPLAINT (OPTIONAL)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _chiefComplaintController,
                maxLines: 2,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: 'e.g., Persistent cough for 3 days, fever',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),

              // Notes
              const Text(
                'NOTES (OPTIONAL)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _notesController,
                maxLines: 3,
                maxLength: 2000,
                decoration: const InputDecoration(
                  hintText: 'Any internal visit instructions or references...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Confirm & Book Appointment',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
