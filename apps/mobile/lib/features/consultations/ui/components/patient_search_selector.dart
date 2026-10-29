import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../patients/models/patient.dart';
import '../../../patients/services/patients_service.dart';

/// Searchable Patient Selector Component for Consultation Workflows.
///
/// Features:
/// - Remote debounced search by patient name, UHID, or phone number.
/// - Stale search request protection (discards out-of-order API responses).
/// - Comprehensive states: idle prompt, loading indicator, empty results, network error with retry.
/// - Prominent display of selected patient (Name, UHID badge, Demographics, Phone).
/// - Non-destructive 'Change Patient' action to re-open search.
/// - Hides raw UUIDs from doctor interface while retaining real UUID internally.
class PatientSearchSelector extends StatefulWidget {
  final PatientsService patientsService;
  final Patient? selectedPatient;
  final ValueChanged<Patient?> onPatientSelected;
  final bool isLocked;
  final String? lockReason;

  const PatientSearchSelector({
    super.key,
    required this.patientsService,
    required this.selectedPatient,
    required this.onPatientSelected,
    this.isLocked = false,
    this.lockReason,
  });

  @override
  State<PatientSearchSelector> createState() => _PatientSearchSelectorState();
}

class _PatientSearchSelectorState extends State<PatientSearchSelector> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  Timer? _debounceTimer;

  int _currentRequestId = 0;
  bool _isSearching = false;
  String? _errorMessage;
  List<Patient> _searchResults = [];
  bool _hasSearched = false;
  String _lastQuery = '';

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounceTimer?.cancel();
    final trimmed = value.trim();

    if (trimmed.isEmpty) {
      setState(() {
        _isSearching = false;
        _errorMessage = null;
        _searchResults = [];
        _hasSearched = false;
        _lastQuery = '';
      });
      return;
    }

    if (trimmed.length < 2) {
      setState(() {
        _isSearching = false;
        _errorMessage = null;
        _searchResults = [];
        _hasSearched = false;
        _lastQuery = trimmed;
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      _executeSearch(trimmed);
    });
  }

  Future<void> _executeSearch(String query) async {
    final requestId = ++_currentRequestId;

    setState(() {
      _isSearching = true;
      _errorMessage = null;
      _hasSearched = true;
      _lastQuery = query;
    });

    try {
      final response = await widget.patientsService.getPatients(
        page: 1,
        limit: 20,
        query: query,
      );

      // Disregard stale responses if another search was triggered in the meantime
      if (!mounted || requestId != _currentRequestId) {
        return;
      }

      setState(() {
        _searchResults = response.data;
        _isSearching = false;
      });
    } on ApiException catch (e) {
      if (!mounted || requestId != _currentRequestId) return;
      setState(() {
        _isSearching = false;
        _errorMessage = e.statusCode == 403
            ? 'Access restricted: Not authorized to search patients.'
            : e.message;
      });
    } catch (e) {
      if (!mounted || requestId != _currentRequestId) return;
      setState(() {
        _isSearching = false;
        _errorMessage = 'Failed to search patients. Please retry.';
      });
    }
  }

  void _clearSearch() {
    _debounceTimer?.cancel();
    _searchController.clear();
    setState(() {
      _isSearching = false;
      _errorMessage = null;
      _searchResults = [];
      _hasSearched = false;
      _lastQuery = '';
    });
  }

  void _selectPatient(Patient patient) {
    _searchFocusNode.unfocus();
    _clearSearch();
    widget.onPatientSelected(patient);
  }

  void _clearSelection() {
    widget.onPatientSelected(null);
    Future.microtask(() {
      if (mounted) {
        _searchFocusNode.requestFocus();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.selectedPatient != null) {
      return _buildSelectedPatientCard(widget.selectedPatient!);
    }

    return _buildSearchPanel();
  }

  Widget _buildSelectedPatientCard(Patient patient) {
    return Card(
      elevation: 0,
      color: AppTheme.surfaceWhite,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.accentTeal, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.check_circle_rounded,
                  color: AppTheme.accentTeal,
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Selected Patient',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.accentTeal,
                    letterSpacing: 0.3,
                  ),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.accentTeal.withAlpha(25),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: AppTheme.accentTeal.withAlpha(50),
                    ),
                  ),
                  child: Text(
                    'UHID: ${patient.uhid}',
                    key: const Key('selectedPatientUhidBadge'),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              patient.fullName,
              key: const Key('selectedPatientFullName'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(
                  '${patient.gender} • ${patient.age != null ? '${patient.age} yrs' : 'Age N/A'}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.textSecondary,
                  ),
                ),
                if (patient.phone.isNotEmpty) ...[
                  const SizedBox(width: 12),
                  const Text('•', style: TextStyle(color: AppTheme.textMuted)),
                  const SizedBox(width: 12),
                  const Icon(
                    Icons.phone_outlined,
                    size: 14,
                    color: AppTheme.textSecondary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    patient.phone,
                    key: const Key('selectedPatientPhone'),
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
            if (widget.lockReason != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(
                    Icons.how_to_reg_outlined,
                    size: 14,
                    color: AppTheme.accentTeal,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    widget.lockReason!,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.teal.shade800,
                    ),
                  ),
                ],
              ),
            ],
            if (!widget.isLocked) ...[
              const Divider(height: 24),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  key: const Key('changePatientButton'),
                  onPressed: _clearSelection,
                  icon: const Icon(Icons.swap_horiz, size: 18),
                  label: const Text('Change Patient'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.accentTeal,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSearchPanel() {
    return Card(
      elevation: 0,
      color: AppTheme.surfaceWhite,
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
                  Icons.person_search_outlined,
                  color: AppTheme.primaryNavy,
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Search Patient',
                  style: TextStyle(
                    fontSize: 15,
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
              key: const Key('patientSearchInput'),
              controller: _searchController,
              focusNode: _searchFocusNode,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                labelText: 'Search Patient',
                hintText: 'Search by name, UHID or phone number',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _isSearching
                    ? const Padding(
                        padding: EdgeInsets.all(12.0),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : (_searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 20),
                            onPressed: _clearSearch,
                          )
                        : null),
                border: const OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(10)),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
              ),
            ),
            const SizedBox(height: 8),
            _buildSearchFeedback(),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchFeedback() {
    if (_errorMessage != null) {
      return Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.errorRed.withAlpha(20),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.errorRed),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: AppTheme.errorRed, size: 18),
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
            TextButton(
              key: const Key('retrySearchButton'),
              onPressed: () => _executeSearch(_lastQuery),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_isSearching) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 12),
              Text(
                'Searching patient records...',
                style: TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_hasSearched && _searchResults.isEmpty && _lastQuery.length >= 2) {
      return Container(
        key: const Key('patientSearchEmptyState'),
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: AppTheme.backgroundLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.borderSubtle),
        ),
        child: Center(
          child: Column(
            children: [
              const Icon(
                Icons.person_off_outlined,
                color: AppTheme.textMuted,
                size: 28,
              ),
              const SizedBox(height: 6),
              Text(
                'No patients found matching "$_lastQuery"',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Try searching with a different name, full UHID (e.g. UHID-000001), or phone number.',
                textAlign: TextAlign.center,
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

    if (_searchResults.isNotEmpty) {
      return Container(
        key: const Key('patientSearchResultsList'),
        margin: const EdgeInsets.only(top: 8),
        constraints: const BoxConstraints(maxHeight: 240),
        decoration: BoxDecoration(
          color: AppTheme.surfaceWhite,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.borderSubtle),
        ),
        child: ListView.separated(
          shrinkWrap: true,
          itemCount: _searchResults.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final patient = _searchResults[index];
            return _buildResultTile(patient);
          },
        ),
      );
    }

    // Idle prompt when no query or query < 2 chars
    return Padding(
      padding: const EdgeInsets.only(top: 6, left: 4),
      child: Text(
        _searchController.text.isNotEmpty && _searchController.text.trim().length < 2
            ? 'Type at least 2 characters to search'
            : 'Enter patient name, UHID, or phone number to find record',
        style: const TextStyle(
          fontSize: 12,
          color: AppTheme.textMuted,
        ),
      ),
    );
  }

  Widget _buildResultTile(Patient patient) {
    return InkWell(
      key: Key('patientResult_${patient.id}'),
      onTap: () => _selectPatient(patient),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: AppTheme.accentTeal.withAlpha(25),
              child: Text(
                patient.fullName.isNotEmpty
                    ? patient.fullName[0].toUpperCase()
                    : 'P',
                style: const TextStyle(
                  color: AppTheme.accentTeal,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          patient.fullName,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.accentTeal.withAlpha(20),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          patient.uhid,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.accentTeal,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${patient.gender} • ${patient.age != null ? '${patient.age} yrs' : 'Age N/A'}${patient.phone.isNotEmpty ? ' • ${patient.phone}' : ''}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              color: AppTheme.textMuted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
