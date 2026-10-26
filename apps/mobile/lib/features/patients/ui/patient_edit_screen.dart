import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../models/patient.dart';
import '../models/update_patient_request.dart';
import '../services/patients_service.dart';

/// Patient Demographic Editing Screen validating against backend UpdatePatientDto
class PatientEditScreen extends StatefulWidget {
  final Patient patient;
  final PatientsService? patientsService;

  const PatientEditScreen({
    super.key,
    required this.patient,
    this.patientsService,
  });

  @override
  State<PatientEditScreen> createState() => _PatientEditScreenState();
}

class _PatientEditScreenState extends State<PatientEditScreen> {
  late final PatientsService _patientsService;

  late final TextEditingController _fullNameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _alternatePhoneController;
  late final TextEditingController _dobController;
  late final TextEditingController _emailController;
  late final TextEditingController _addressController;
  late final TextEditingController _cityController;
  late final TextEditingController _pincodeController;

  late String _gender;
  bool _isSaving = false;
  String? _errorMessage;
  Map<String, String> _fieldErrors = {};

  @override
  void initState() {
    super.initState();
    _patientsService = widget.patientsService ?? PatientsService();

    final p = widget.patient;
    _fullNameController = TextEditingController(text: p.fullName);
    _phoneController = TextEditingController(text: p.phone);
    _alternatePhoneController = TextEditingController(text: p.alternatePhone ?? '');
    _dobController = TextEditingController(text: p.formattedDob ?? '');
    _emailController = TextEditingController(text: p.email ?? '');
    _addressController = TextEditingController(text: p.address ?? '');
    _cityController = TextEditingController(text: p.city ?? '');
    _pincodeController = TextEditingController(text: p.pincode ?? '');
    _gender = p.gender;
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    _alternatePhoneController.dispose();
    _dobController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _pincodeController.dispose();
    super.dispose();
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    DateTime initialDate = DateTime(now.year - 30, now.month, now.day);
    if (_dobController.text.isNotEmpty) {
      try {
        initialDate = DateTime.parse(_dobController.text);
      } catch (_) {}
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Update Patient Date of Birth',
    );

    if (picked != null) {
      final y = picked.year.toString().padLeft(4, '0');
      final m = picked.month.toString().padLeft(2, '0');
      final d = picked.day.toString().padLeft(2, '0');
      setState(() {
        _dobController.text = '$y-$m-$d';
      });
    }
  }

  Future<void> _saveChanges() async {
    if (_isSaving) return;

    final p = widget.patient;

    // Detect modified fields
    final String? newName = _fullNameController.text.trim() != p.fullName
        ? _fullNameController.text.trim()
        : null;
    final String? newGender = _gender != p.gender ? _gender : null;
    final String? newPhone = _phoneController.text.trim() != p.phone
        ? _phoneController.text.trim()
        : null;
    final String? newDob = _dobController.text.trim() != (p.formattedDob ?? '')
        ? _dobController.text.trim()
        : null;
    final String? newAlt =
        _alternatePhoneController.text.trim() != (p.alternatePhone ?? '')
            ? _alternatePhoneController.text.trim()
            : null;
    final String? newEmail =
        _emailController.text.trim() != (p.email ?? '')
            ? _emailController.text.trim()
            : null;
    final String? newAddress =
        _addressController.text.trim() != (p.address ?? '')
            ? _addressController.text.trim()
            : null;
    final String? newCity = _cityController.text.trim() != (p.city ?? '')
        ? _cityController.text.trim()
        : null;
    final String? newPincode =
        _pincodeController.text.trim() != (p.pincode ?? '')
            ? _pincodeController.text.trim()
            : null;

    final request = UpdatePatientRequest(
      fullName: newName,
      gender: newGender,
      phone: newPhone,
      dateOfBirth: newDob,
      alternatePhone: newAlt,
      email: newEmail,
      address: newAddress,
      city: newCity,
      pincode: newPincode,
    );

    if (!request.hasUpdates) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No changes were made to save.')),
      );
      return;
    }

    final validationErrors = request.validate();
    setState(() {
      _fieldErrors = validationErrors;
      _errorMessage = null;
    });

    if (validationErrors.isNotEmpty) return;

    setState(() => _isSaving = true);

    try {
      final updated = await _patientsService.updatePatient(widget.patient.id, request);
      if (mounted) {
        Navigator.of(context).pop(updated);
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
          _errorMessage = 'Failed to update patient: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: Text('Edit ${widget.patient.fullName}'),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _saveChanges,
            child: _isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text(
                    'Save',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.accentTeal,
                    ),
                  ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // UHID Identity Banner (Read-only)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryNavy.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.lock_outline_rounded, size: 18, color: AppTheme.textSecondary),
                        const SizedBox(width: 8),
                        Text(
                          'UHID: ${widget.patient.uhid} (Permanent Identifier)',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: AppTheme.primaryNavy,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.errorRed.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(fontSize: 12, color: AppTheme.errorRed),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Full Name
                  TextFormField(
                    controller: _fullNameController,
                    decoration: InputDecoration(
                      labelText: 'Full Name *',
                      errorText: _fieldErrors['fullName'],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Gender
                  DropdownButtonFormField<String>(
                    initialValue: _gender,
                    decoration: InputDecoration(
                      labelText: 'Gender *',
                      errorText: _fieldErrors['gender'],
                    ),
                    items: const [
                      DropdownMenuItem(value: 'MALE', child: Text('Male')),
                      DropdownMenuItem(value: 'FEMALE', child: Text('Female')),
                      DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _gender = val);
                    },
                  ),
                  const SizedBox(height: 16),

                  // Phone
                  TextFormField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'Phone Number *',
                      errorText: _fieldErrors['phone'],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Date of Birth
                  TextFormField(
                    controller: _dobController,
                    readOnly: true,
                    onTap: _pickDateOfBirth,
                    decoration: InputDecoration(
                      labelText: 'Date of Birth (YYYY-MM-DD)',
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.calendar_month_rounded),
                        onPressed: _pickDateOfBirth,
                      ),
                      errorText: _fieldErrors['dateOfBirth'],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Alternate Phone
                  TextFormField(
                    controller: _alternatePhoneController,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'Alternate Phone',
                      errorText: _fieldErrors['alternatePhone'],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Email
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email Address',
                      errorText: _fieldErrors['email'],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Address
                  TextFormField(
                    controller: _addressController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Residential Address',
                      errorText: _fieldErrors['address'],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // City & Pincode
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextFormField(
                          controller: _cityController,
                          decoration: InputDecoration(
                            labelText: 'City',
                            errorText: _fieldErrors['city'],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: TextFormField(
                          controller: _pincodeController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Pincode',
                            errorText: _fieldErrors['pincode'],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryNavy,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _isSaving ? null : _saveChanges,
                    child: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text('Save Demographic Changes'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
