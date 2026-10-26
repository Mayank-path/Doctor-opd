import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../models/create_patient_request.dart';
import '../services/patients_service.dart';

/// Patient Registration Screen validating against backend CreatePatientDto
class PatientRegistrationScreen extends StatefulWidget {
  final PatientsService? patientsService;

  const PatientRegistrationScreen({
    super.key,
    this.patientsService,
  });

  @override
  State<PatientRegistrationScreen> createState() => _PatientRegistrationScreenState();
}

class _PatientRegistrationScreenState extends State<PatientRegistrationScreen> {
  late final PatientsService _patientsService;
  final _formKey = GlobalKey<FormState>();

  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _alternatePhoneController = TextEditingController();
  final _dobController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _pincodeController = TextEditingController();

  String _gender = 'MALE';
  bool _isSubmitting = false;
  String? _serverErrorMessage;
  Map<String, String> _fieldErrors = {};

  @override
  void initState() {
    super.initState();
    _patientsService = widget.patientsService ?? PatientsService();
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
    final initialDate = DateTime(now.year - 30, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Select Patient Date of Birth',
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

  Future<void> _submitRegistration() async {
    if (_isSubmitting) return;

    final request = CreatePatientRequest(
      fullName: _fullNameController.text,
      gender: _gender,
      phone: _phoneController.text,
      dateOfBirth: _dobController.text.isNotEmpty ? _dobController.text : null,
      alternatePhone: _alternatePhoneController.text.isNotEmpty ? _alternatePhoneController.text : null,
      email: _emailController.text.isNotEmpty ? _emailController.text : null,
      address: _addressController.text.isNotEmpty ? _addressController.text : null,
      city: _cityController.text.isNotEmpty ? _cityController.text : null,
      pincode: _pincodeController.text.isNotEmpty ? _pincodeController.text : null,
    );

    final validationErrors = request.validate();
    setState(() {
      _fieldErrors = validationErrors;
      _serverErrorMessage = null;
    });

    if (validationErrors.isNotEmpty) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final createdPatient = await _patientsService.createPatient(request);
      if (mounted) {
        Navigator.of(context).pop(createdPatient);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          if (e.statusCode == 403) {
            _serverErrorMessage =
                'Access Denied: You do not have permissions to register patients in this clinic.';
          } else if (e.statusCode == 409) {
            _serverErrorMessage =
                'Conflict: A patient with this identifier or UHID sequence already exists.';
          } else {
            _serverErrorMessage = e.message;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _serverErrorMessage = 'Unexpected error occurred: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('New Patient Registration'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Information Notice
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.accentTeal.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.accentTeal.withValues(alpha: 0.2)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.badge_outlined, color: AppTheme.accentTeal, size: 22),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'The Unique Health Identifier (UHID) will be atomically generated by the clinic backend upon submission.',
                              style: TextStyle(fontSize: 12, color: AppTheme.textPrimary, height: 1.3),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    if (_serverErrorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.errorRed.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: AppTheme.errorRed, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _serverErrorMessage!,
                                style: const TextStyle(fontSize: 12, color: AppTheme.errorRed),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Full Name (Required)
                    TextFormField(
                      controller: _fullNameController,
                      textCapitalization: TextCapitalization.words,
                      decoration: InputDecoration(
                        labelText: 'Full Name *',
                        hintText: 'e.g. Ramesh Kumar',
                        prefixIcon: const Icon(Icons.person_outline_rounded),
                        errorText: _fieldErrors['fullName'],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Gender (Required)
                    DropdownButtonFormField<String>(
                      initialValue: _gender,
                      decoration: InputDecoration(
                        labelText: 'Gender *',
                        prefixIcon: const Icon(Icons.transgender_rounded),
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

                    // Phone Number (Required)
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Primary Phone Number *',
                        hintText: '+919876543210',
                        prefixIcon: const Icon(Icons.phone_outlined),
                        errorText: _fieldErrors['phone'],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Date of Birth (Optional)
                    TextFormField(
                      controller: _dobController,
                      readOnly: true,
                      onTap: _pickDateOfBirth,
                      decoration: InputDecoration(
                        labelText: 'Date of Birth (Optional)',
                        hintText: 'YYYY-MM-DD',
                        prefixIcon: const Icon(Icons.cake_outlined),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.calendar_month_rounded),
                          onPressed: _pickDateOfBirth,
                        ),
                        errorText: _fieldErrors['dateOfBirth'],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Alternate Phone (Optional)
                    TextFormField(
                      controller: _alternatePhoneController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Alternate Phone (Optional)',
                        hintText: '+919876543211',
                        prefixIcon: const Icon(Icons.phone_forwarded_outlined),
                        errorText: _fieldErrors['alternatePhone'],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Email (Optional)
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: 'Email Address (Optional)',
                        hintText: 'patient@email.com',
                        prefixIcon: const Icon(Icons.email_outlined),
                        errorText: _fieldErrors['email'],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Address (Optional)
                    TextFormField(
                      controller: _addressController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'Residential Address (Optional)',
                        hintText: 'Flat / House No, Street, Locality',
                        prefixIcon: const Icon(Icons.home_outlined),
                        errorText: _fieldErrors['address'],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // City & Pincode (Row)
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            controller: _cityController,
                            decoration: InputDecoration(
                              labelText: 'City (Optional)',
                              hintText: 'e.g. Mumbai',
                              prefixIcon: const Icon(Icons.location_city_outlined),
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
                              labelText: 'Pincode (Optional)',
                              hintText: '400001',
                              errorText: _fieldErrors['pincode'],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),

                    // Submit Button
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryNavy,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      onPressed: _isSubmitting ? null : _submitRegistration,
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Text(
                              'Register & Generate UHID',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
