import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../consultations/ui/consultation_details_screen.dart';
import '../models/disease_search.dart';
import '../services/analytics_service.dart';

/// Standalone Disease & Clinical History Search Screen.
/// Allows doctor to search historical consultations by disease or clinical term,
/// with clear separation between confirmed diagnoses and clinical note mentions.
class DiseaseSearchScreen extends StatefulWidget {
  final AnalyticsService analyticsService;

  const DiseaseSearchScreen({
    super.key,
    required this.analyticsService,
  });

  @override
  State<DiseaseSearchScreen> createState() => _DiseaseSearchScreenState();
}

class _DiseaseSearchScreenState extends State<DiseaseSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  String _selectedPeriod = 'all';
  DateTime? _customStartDate;
  DateTime? _customEndDate;

  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _errorMessage;

  DiseaseSearchResponse? _searchResponse;
  List<DiseaseSearchResultItem> _results = [];
  int _currentPage = 1;

  List<String> _suggestions = [];
  bool _isLoadingSuggestions = false;

  @override
  void initState() {
    super.initState();
    _loadSuggestions();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadSuggestions() async {
    setState(() => _isLoadingSuggestions = true);
    try {
      final suggestions = await widget.analyticsService.fetchDiseaseSuggestions();
      if (mounted) {
        setState(() {
          _suggestions = suggestions;
          _isLoadingSuggestions = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingSuggestions = false);
      }
    }
  }

  Future<void> _executeSearch({bool isLoadMore = false}) async {
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      setState(() {
        _searchResponse = null;
        _results = [];
        _errorMessage = null;
      });
      return;
    }

    if (isLoadMore) {
      setState(() => _isLoadingMore = true);
    } else {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
        _currentPage = 1;
      });
    }

    try {
      final targetPage = isLoadMore ? _currentPage + 1 : 1;
      final response = await widget.analyticsService.searchDiseases(
        q: query,
        period: _selectedPeriod,
        startDate: _customStartDate,
        endDate: _customEndDate,
        page: targetPage,
        limit: 20,
      );

      if (mounted) {
        setState(() {
          _searchResponse = response;
          if (isLoadMore) {
            _results.addAll(response.results);
            _currentPage = targetPage;
          } else {
            _results = List.from(response.results);
            _currentPage = 1;
          }
          _isLoading = false;
          _isLoadingMore = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.message;
          _isLoading = false;
          _isLoadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to execute disease search. Please retry.';
          _isLoading = false;
          _isLoadingMore = false;
        });
      }
    }
  }

  void _onPeriodChanged(String period) {
    if (period == 'custom') {
      _showCustomDateRangePicker();
    } else {
      setState(() {
        _selectedPeriod = period;
        _customStartDate = null;
        _customEndDate = null;
      });
      if (_searchController.text.trim().isNotEmpty) {
        _executeSearch();
      }
    }
  }

  Future<void> _showCustomDateRangePicker() async {
    final initialDateRange = DateTimeRange(
      start: _customStartDate ?? DateTime.now().subtract(const Duration(days: 30)),
      end: _customEndDate ?? DateTime.now(),
    );

    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: initialDateRange,
    );

    if (picked != null && mounted) {
      setState(() {
        _selectedPeriod = 'custom';
        _customStartDate = picked.start;
        _customEndDate = picked.end;
      });
      if (_searchController.text.trim().isNotEmpty) {
        _executeSearch();
      }
    }
  }

  void _applySuggestion(String term) {
    _searchController.text = term;
    _searchFocusNode.unfocus();
    _executeSearch();
  }

  void _navigateToConsultation(String consultationId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ConsultationDetailsScreen(
          consultationId: consultationId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(
        title: Text(
          'Disease Search',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: context.colors.textPrimary,
          ),
        ),
        backgroundColor: context.colors.surface,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: context.colors.textPrimary),
      ),
      body: Column(
        children: [
          _buildSearchAndFiltersHeader(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildSearchAndFiltersHeader() {
    return Container(
      color: context.colors.surface,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Search input
          TextField(
            controller: _searchController,
            focusNode: _searchFocusNode,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _executeSearch(),
            decoration: InputDecoration(
              hintText: 'Search disease, diagnosis or clinical term...',
              hintStyle: TextStyle(color: context.colors.textMuted, fontSize: 14),
              prefixIcon: Icon(Icons.search_rounded, color: context.colors.primaryAccent),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 20),
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _searchResponse = null;
                          _results = [];
                          _errorMessage = null;
                        });
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              filled: true,
              fillColor: context.colors.surfaceContainer,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.colors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.colors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: context.colors.primaryAccent, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('all', 'All Time'),
                _buildFilterChip('today', 'Today'),
                _buildFilterChip('7d', 'Last 7 Days'),
                _buildFilterChip('30d', 'Last 30 Days'),
                _buildFilterChip('90d', 'Last 90 Days'),
                _buildFilterChip('custom', _customStartDate != null ? 'Custom Range' : 'Custom'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _selectedPeriod == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => _onPeriodChanged(key),
        selectedColor: context.colors.primaryAccent,
        backgroundColor: context.colors.surfaceContainer,
        labelStyle: TextStyle(
          color: isSelected
              ? (context.isDarkMode ? const Color(0xFF111315) : Colors.white)
              : context.colors.textPrimary,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          fontSize: 12,
        ),
        side: BorderSide(
          color: isSelected ? context.colors.primaryAccent : context.colors.border,
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: context.colors.primaryAccent),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: AppTheme.errorRed, size: 48),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(color: context.colors.textPrimary, fontSize: 15),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => _executeSearch(),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: context.colors.primaryAccent,
                  foregroundColor: context.isDarkMode
                      ? const Color(0xFF111315)
                      : Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Initial state (no search performed yet)
    if (_searchResponse == null) {
      return _buildInitialPromptState();
    }

    // Zero results
    if (_results.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.manage_search_rounded, size: 56, color: context.colors.textMuted),
              const SizedBox(height: 12),
              Text(
                'No consultations found matching "${_searchResponse!.searchTerm}"',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: context.colors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Try broadening your date filter or searching a different clinical term.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: context.colors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildAggregationMetricsBanner(),
        const SizedBox(height: 12),
        _buildResultsSummaryBar(),
        const SizedBox(height: 12),
        ..._results.map(_buildResultCard),
        if (_searchResponse!.page < _searchResponse!.totalPages) ...[
          const SizedBox(height: 16),
          Center(
            child: _isLoadingMore
                ? CircularProgressIndicator(color: context.colors.primaryAccent)
                : OutlinedButton.icon(
                    onPressed: () => _executeSearch(isLoadMore: true),
                    icon: const Icon(Icons.expand_more_rounded),
                    label: Text('Load More Patients (${_results.length} of ${_searchResponse!.uniquePatients})'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: context.colors.primaryAccent,
                      side: BorderSide(color: context.colors.primaryAccent),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    ),
                  ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildResultsSummaryBar() {
    final r = _searchResponse!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(Icons.people_alt_rounded, size: 16, color: context.colors.primaryAccent),
              const SizedBox(width: 6),
              Text(
                'Total unique patients: ${r.uniquePatients}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: context.colors.textPrimary,
                ),
              ),
            ],
          ),
          Text(
            'Showing: Latest ${_results.length} patients',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: context.colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInitialPromptState() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: context.colors.primaryAccent.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.manage_search_rounded,
              color: context.colors.primaryAccent,
              size: 40,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Search Historical Consultations',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: context.colors.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Find finalized clinical records by confirmed diagnosis, symptoms, chief complaints, or examination findings.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: context.colors.textSecondary, height: 1.4),
        ),
        const SizedBox(height: 24),
        if (_isLoadingSuggestions)
          Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: context.colors.primaryAccent),
            ),
          )
        else if (_suggestions.isNotEmpty) ...[
          Row(
            children: [
              Icon(Icons.lightbulb_outline_rounded, size: 16, color: context.colors.primaryAccent),
              const SizedBox(width: 6),
              Text(
                'Recorded Diagnoses in Practice',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: context.colors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _suggestions.map((s) {
              return ActionChip(
                label: Text(s),
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: context.colors.primaryAccent,
                ),
                backgroundColor: context.isDarkMode
                    ? context.colors.surfaceContainer
                    : AppTheme.accentTeal.withValues(alpha: 0.08),
                side: BorderSide(
                  color: context.isDarkMode
                      ? context.colors.border
                      : AppTheme.accentTeal.withValues(alpha: 0.3),
                ),
                onPressed: () => _applySuggestion(s),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildAggregationMetricsBanner() {
    final r = _searchResponse!;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.colors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Results for "${r.searchTerm}"',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: context.colors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: context.isDarkMode
                      ? context.colors.accentContainer
                      : AppTheme.accentTeal.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                  border: context.isDarkMode
                      ? Border.all(color: context.colors.accentBorder)
                      : null,
                ),
                child: Text(
                  '${r.totalConsultations} Consultations',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: context.colors.primaryAccent,
                  ),
                ),
              ),
            ],
          ),
          Divider(height: 20, color: context.colors.divider),
          Row(
            children: [
              _buildMiniMetric('Unique Patients', '${r.uniquePatients}', Icons.people_outline_rounded),
              _buildMiniMetric('Diagnosis Matches', '${r.diagnosisMatchesCount}', Icons.medical_services_outlined),
              _buildMiniMetric('Clinical Note Matches', '${r.clinicalNoteMatchesCount}', Icons.description_outlined),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniMetric(String label, String value, IconData icon) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: context.colors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, color: context.colors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: context.colors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultCard(DiseaseSearchResultItem item) {
    Color badgeColor;
    Color badgeTextColor;
    IconData badgeIcon;

    switch (item.matchCategory) {
      case MatchCategory.diagnosis:
        badgeColor = context.isDarkMode
            ? context.colors.accentContainer
            : AppTheme.accentTeal.withValues(alpha: 0.15);
        badgeTextColor = context.colors.primaryAccent;
        badgeIcon = Icons.verified_rounded;
        break;
      case MatchCategory.both:
        badgeColor = context.isDarkMode
            ? const Color(0xFF581C87).withValues(alpha: 0.3)
            : Colors.purple.withValues(alpha: 0.15);
        badgeTextColor = context.isDarkMode
            ? const Color(0xFFD8B4FE)
            : Colors.purple.shade700;
        badgeIcon = Icons.library_books_rounded;
        break;
      case MatchCategory.clinicalNote:
        badgeColor = context.isDarkMode
            ? const Color(0xFF78350F).withValues(alpha: 0.3)
            : Colors.amber.withValues(alpha: 0.2);
        badgeTextColor = context.isDarkMode
            ? const Color(0xFFFDE68A)
            : Colors.brown.shade800;
        badgeIcon = Icons.edit_note_rounded;
        break;
    }

    final formattedDate =
        '${item.consultationDate.year}-${item.consultationDate.month.toString().padLeft(2, '0')}-${item.consultationDate.day.toString().padLeft(2, '0')}';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.colors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: () => _navigateToConsultation(item.consultationId),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Patient Name, UHID, Date
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.patientName,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: context.colors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'UHID: ${item.patientUhid} • $formattedDate',
                          style: TextStyle(
                            fontSize: 12,
                            color: context.colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: badgeColor,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(badgeIcon, size: 14, color: badgeTextColor),
                        const SizedBox(width: 4),
                        Text(
                          item.matchCategory.label,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: badgeTextColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              // Recorded Diagnosis (Clinical safety: explicitly truthful)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: context.colors.surfaceContainer,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: context.colors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'RECORDED DIAGNOSIS',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: context.colors.textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.recordedDiagnosis != null && item.recordedDiagnosis!.trim().isNotEmpty
                          ? item.recordedDiagnosis!
                          : 'No confirmed diagnosis recorded',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: item.recordedDiagnosis != null && item.recordedDiagnosis!.trim().isNotEmpty
                            ? context.colors.textPrimary
                            : context.colors.textSecondary,
                        fontStyle: item.recordedDiagnosis != null && item.recordedDiagnosis!.trim().isNotEmpty
                            ? FontStyle.normal
                            : FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),
              if (item.snippet.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.format_quote_rounded, size: 14, color: context.colors.primaryAccent),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        item.snippet,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: context.colors.textSecondary,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              // Matched Fields tags & View Action
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Wrap(
                    spacing: 4,
                    children: item.matchedFields.map((f) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: context.colors.surfaceContainer,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: context.colors.border),
                        ),
                        child: Text(
                          f,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: context.colors.textSecondary,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  Row(
                    children: [
                      Text(
                        'View Record',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: context.colors.primaryAccent,
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, size: 16, color: context.colors.primaryAccent),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
