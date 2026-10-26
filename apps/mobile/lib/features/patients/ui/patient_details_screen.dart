import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/services/auth_service.dart';
import '../models/patient.dart';
import '../models/patient_consultation_summary.dart';
import '../services/patients_service.dart';
import 'patient_edit_screen.dart';
import '../../consultations/ui/consultation_details_screen.dart';
import '../../consultations/ui/consultation_create_screen.dart';

/// Patient Details Screen showing full demographics and role-aware clinical visit history
class PatientDetailsScreen extends StatefulWidget {
  final String patientId;
  final AuthService? authService;
  final PatientsService? patientsService;

  const PatientDetailsScreen({
    super.key,
    required this.patientId,
    this.authService,
    this.patientsService,
  });

  @override
  State<PatientDetailsScreen> createState() => _PatientDetailsScreenState();
}

class _PatientDetailsScreenState extends State<PatientDetailsScreen> {
  late final PatientsService _patientsService;

  Patient? _patient;
  List<PatientConsultationSummary>? _consultations;
  bool _isLoading = true;
  String? _errorMessage;
  bool _isNotFound = false;
  bool _isDoctor = false;

  @override
  void initState() {
    super.initState();
    _patientsService = widget.patientsService ?? PatientsService();
    _loadPatientDetails();
  }

  Future<void> _loadPatientDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _isNotFound = false;
    });

    try {
      final patient = await _patientsService.getPatientById(widget.patientId);

      // Attempt to load clinical history if user is a DOCTOR
      List<PatientConsultationSummary>? consultations;
      bool isDoctorRole = false;
      try {
        consultations = await _patientsService.getPatientConsultationHistory(widget.patientId);
        isDoctorRole = true;
      } on ApiException catch (e) {
        if (e.statusCode == 403) {
          isDoctorRole = false; // Not a doctor, consultations restricted
        }
      } catch (_) {
        isDoctorRole = false;
      }

      if (mounted) {
        setState(() {
          _patient = patient;
          _consultations = consultations;
          _isDoctor = isDoctorRole;
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          if (e.statusCode == 404) {
            _isNotFound = true;
            _errorMessage = 'Patient record not found in active clinic or has been archived.';
          } else if (e.statusCode == 403) {
            _errorMessage = 'Access denied: You do not have permissions to view this patient.';
          } else {
            _errorMessage = e.message;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load patient: $e';
        });
      }
    }
  }

  Future<void> _navigateToEdit() async {
    if (_patient == null) return;

    final updated = await Navigator.of(context).push<Patient>(
      MaterialPageRoute(
        builder: (_) => PatientEditScreen(
          patient: _patient!,
          patientsService: _patientsService,
        ),
      ),
    );

    if (updated != null && mounted) {
      setState(() {
        _patient = updated;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Patient demographics updated successfully'),
          backgroundColor: AppTheme.accentTeal,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: Text(_patient != null ? _patient!.fullName : 'Patient Details'),
        actions: [
          if (_patient != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit Patient',
              onPressed: _navigateToEdit,
            ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppTheme.accentTeal,
          onRefresh: _loadPatientDetails,
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppTheme.accentTeal),
        ),
      );
    }

    if (_isNotFound || _errorMessage != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 80),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.errorRed.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isNotFound ? Icons.person_off_rounded : Icons.error_outline_rounded,
                      size: 48,
                      color: AppTheme.errorRed,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _isNotFound ? 'Patient Not Found' : 'Error Loading Patient',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _errorMessage ?? 'An error occurred while loading this patient.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _loadPatientDetails,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    final p = _patient!;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Card
              _buildHeaderCard(p),
              const SizedBox(height: 16),

              // Contact Information Card
              _buildContactCard(p),
              const SizedBox(height: 16),

              // Demographics Details Card
              _buildDemographicsCard(p),
              const SizedBox(height: 16),

              // Role-Aware Clinical Consultations Section
              _buildConsultationSection(),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderCard(Patient p) {
    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: AppTheme.accentTeal.withValues(alpha: 0.15),
              child: Text(
                p.fullName.isNotEmpty ? p.fullName[0].toUpperCase() : 'P',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.accentTeal,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p.fullName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryNavy,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          p.uhid,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.successGreen.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'ACTIVE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.successGreen,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactCard(Patient p) {
    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.contact_phone_outlined, size: 20, color: AppTheme.accentTeal),
                SizedBox(width: 8),
                Text(
                  'Contact Information',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _buildDetailRow('Primary Phone', p.phone, isMonospace: true),
            if (p.alternatePhone != null && p.alternatePhone!.isNotEmpty)
              _buildDetailRow('Alternate Phone', p.alternatePhone!, isMonospace: true),
            if (p.email != null && p.email!.isNotEmpty)
              _buildDetailRow('Email', p.email!),
            if (p.address != null && p.address!.isNotEmpty)
              _buildDetailRow('Address', p.address!),
            if (p.city != null && p.city!.isNotEmpty)
              _buildDetailRow('City', p.city!),
            if (p.pincode != null && p.pincode!.isNotEmpty)
              _buildDetailRow('Pincode', p.pincode!, isMonospace: true),
          ],
        ),
      ),
    );
  }

  Widget _buildDemographicsCard(Patient p) {
    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.badge_outlined, size: 20, color: AppTheme.primaryNavy),
                SizedBox(width: 8),
                Text(
                  'Demographics & Record Info',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _buildDetailRow('Gender', p.gender),
            if (p.formattedDob != null)
              _buildDetailRow(
                'Date of Birth',
                '${p.formattedDob}${p.age != null ? " (${p.age} years)" : ""}',
              ),
            _buildDetailRow(
              'Registered Date',
              '${p.createdAt.year}-${p.createdAt.month.toString().padLeft(2, "0")}-${p.createdAt.day.toString().padLeft(2, "0")}',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isMonospace = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppTheme.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontFamily: isMonospace ? 'monospace' : null,
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConsultationSection() {
    if (!_isDoctor) {
      return Card(
        elevation: 0.5,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.blueGrey.withValues(alpha: 0.2)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blueGrey.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.shield_outlined, color: Colors.blueGrey, size: 22),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Clinical Consultations Protected',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Clinical narratives, diagnoses, and prescriptions are strictly restricted to DOCTOR memberships under OPD medical privacy regulations. Demographic data is accessible to Administrators and Receptionists.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.textSecondary,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    // If Doctor role: render consultation visits
    final consultations = _consultations ?? [];

    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.medical_services_outlined, size: 20, color: Colors.purple),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Clinical Visit History (Doctor View)',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.purple.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${consultations.length} visit${consultations.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.purple,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline, color: Colors.purple, size: 22),
                  tooltip: 'Start Consultation',
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ConsultationCreateScreen(
                          patientId: widget.patientId,
                          patientName: _patient?.fullName,
                          patientUhid: _patient?.uhid,
                          patientGender: _patient?.gender,
                          patientAge: _patient?.age,
                        ),
                      ),
                    );
                    _loadPatientDetails();
                  },
                ),
              ],
            ),
            const SizedBox(height: 14),

            if (consultations.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Text(
                    'No recorded consultation visits for this patient.',
                    style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: consultations.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, index) {
                  final c = consultations[index];
                  final isFinal = c.status == 'FINALIZED';

                  return InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ConsultationDetailsScreen(
                            consultationId: c.id,
                          ),
                        ),
                      );
                      _loadPatientDetails();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.backgroundLight,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppTheme.borderSubtle),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                c.encounterDate.length >= 10
                                    ? c.encounterDate.substring(0, 10)
                                    : c.encounterDate,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isFinal
                                      ? AppTheme.successGreen.withValues(alpha: 0.12)
                                      : Colors.amber.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  c.status,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: isFinal ? AppTheme.successGreen : Colors.amber.shade900,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.chevron_right, size: 16, color: AppTheme.textSecondary),
                            ],
                          ),
                          if (c.chiefComplaint != null && c.chiefComplaint!.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Chief Complaint: ${c.chiefComplaint}',
                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                          if (c.diagnosis != null && c.diagnosis!.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              'Diagnosis: ${c.diagnosis}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
