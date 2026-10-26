import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../patients/models/patient.dart';
import '../../../patients/services/patients_service.dart';
import '../../../patients/ui/patient_registration_screen.dart';

/// Modal bottom sheet allowing search and selection of an active patient for appointment booking,
/// or navigating to register a new patient seamlessly.
class PatientSelectorModal extends StatefulWidget {
  final PatientsService patientsService;

  const PatientSelectorModal({
    super.key,
    required this.patientsService,
  });

  @override
  State<PatientSelectorModal> createState() => _PatientSelectorModalState();
}

class _PatientSelectorModalState extends State<PatientSelectorModal> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  bool _isLoading = false;
  String? _errorMessage;
  List<Patient> _patients = [];

  @override
  void initState() {
    super.initState();
    _loadPatients();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _loadPatients(query: query.trim());
    });
  }

  Future<void> _loadPatients({String? query}) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await widget.patientsService.getPatients(
        page: 1,
        limit: 20,
        query: (query != null && query.length >= 2) ? query : null,
      );
      if (mounted) {
        setState(() {
          _patients = res.data;
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to load patients: ${e.toString()}';
        });
      }
    }
  }

  Future<void> _openRegistration() async {
    final newPatient = await Navigator.of(context).push<Patient>(
      MaterialPageRoute(
        builder: (_) => PatientRegistrationScreen(
          patientsService: widget.patientsService,
        ),
      ),
    );

    if (newPatient != null && mounted) {
      Navigator.of(context).pop(newPatient);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.person_search_rounded,
                        color: AppTheme.accentTeal, size: 24),
                    SizedBox(width: 8),
                    Text(
                      'Select Patient',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search by name, phone, or UHID...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          _loadPatients();
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: InkWell(
              onTap: _openRegistration,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.accentTeal.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppTheme.accentTeal.withValues(alpha: 0.3),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.person_add_rounded,
                        color: AppTheme.accentTeal, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Register New Patient',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.accentTeal,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          Expanded(
            child: _buildPatientList(),
          ),
        ],
      ),
    );
  }

  Widget _buildPatientList() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: AppTheme.errorRed, size: 36),
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppTheme.errorRed),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => _loadPatients(query: _searchController.text),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_patients.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.person_off_rounded,
                  color: AppTheme.textSecondary, size: 36),
              const SizedBox(height: 8),
              const Text(
                'No patients found',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Try searching or register a new patient above.',
                style: TextStyle(
                  fontSize: 12,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _patients.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, index) {
        final p = _patients[index];
        return ListTile(
          onTap: () => Navigator.of(context).pop(p),
          leading: CircleAvatar(
            backgroundColor: AppTheme.primaryNavy.withValues(alpha: 0.1),
            child: Text(
              p.fullName.isNotEmpty ? p.fullName[0].toUpperCase() : 'P',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppTheme.primaryNavy,
              ),
            ),
          ),
          title: Text(
            p.fullName,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
          subtitle: Text(
            'UHID: ${p.uhid} • ${p.phone} • ${p.gender.toUpperCase()}',
            style: const TextStyle(
              fontSize: 12,
              color: AppTheme.textSecondary,
            ),
          ),
          trailing: const Icon(
            Icons.chevron_right,
            color: AppTheme.textSecondary,
            size: 20,
          ),
        );
      },
    );
  }
}
