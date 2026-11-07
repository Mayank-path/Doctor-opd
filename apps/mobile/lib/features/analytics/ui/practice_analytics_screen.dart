import 'package:flutter/material.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../models/practice_analytics.dart';
import '../services/analytics_service.dart';
import 'widgets/analytics_charts.dart';
import 'widgets/analytics_stat_card.dart';

/// Screen for displaying doctor practice performance and revenue analytics.
class PracticeAnalyticsScreen extends StatefulWidget {
  final AnalyticsService analyticsService;

  const PracticeAnalyticsScreen({
    super.key,
    required this.analyticsService,
  });

  @override
  State<PracticeAnalyticsScreen> createState() =>
      _PracticeAnalyticsScreenState();
}

class _PracticeAnalyticsScreenState extends State<PracticeAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  String _selectedPeriod = '30d';
  DateTime? _customStartDate;
  DateTime? _customEndDate;

  bool _isLoading = true;
  String? _errorMessage;

  PracticeOverview? _overview;
  PatientAnalytics? _patientAnalytics;
  RevenueAnalytics? _revenueAnalytics;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadAllAnalytics();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAllAnalytics() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final overviewFuture = widget.analyticsService.fetchOverview(
        period: _selectedPeriod,
        startDate: _customStartDate,
        endDate: _customEndDate,
      );
      final patientFuture = widget.analyticsService.fetchPatientAnalytics(
        period: _selectedPeriod,
        startDate: _customStartDate,
        endDate: _customEndDate,
      );
      final revenueFuture = widget.analyticsService.fetchRevenueAnalytics(
        period: _selectedPeriod,
        startDate: _customStartDate,
        endDate: _customEndDate,
      );

      final results = await Future.wait([
        overviewFuture,
        patientFuture,
        revenueFuture,
      ]);

      if (mounted) {
        setState(() {
          _overview = results[0] as PracticeOverview;
          _patientAnalytics = results[1] as PatientAnalytics;
          _revenueAnalytics = results[2] as RevenueAnalytics;
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
          _errorMessage = 'Failed to load analytics: $e';
        });
      }
    }
  }

  void _onPeriodChanged(String period) {
    if (period == 'custom') {
      _pickCustomDateRange();
      return;
    }
    setState(() {
      _selectedPeriod = period;
      _customStartDate = null;
      _customEndDate = null;
    });
    _loadAllAnalytics();
  }

  Future<void> _pickCustomDateRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
      initialDateRange: DateTimeRange(
        start: now.subtract(const Duration(days: 14)),
        end: now,
      ),
    );

    if (picked != null && mounted) {
      setState(() {
        _selectedPeriod = 'custom';
        _customStartDate = picked.start;
        _customEndDate = picked.end;
      });
      _loadAllAnalytics();
    }
  }

  Widget _buildPeriodFilterChips() {
    final periods = [
      {'key': 'today', 'label': 'Today'},
      {'key': '7d', 'label': 'Last 7 Days'},
      {'key': '30d', 'label': 'Last 30 Days'},
      {'key': '90d', 'label': 'Last 90 Days'},
      {'key': 'custom', 'label': 'Custom'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: periods.map((p) {
          final isSelected = _selectedPeriod == p['key'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(p['label']!),
              selected: isSelected,
              onSelected: (_) => _onPeriodChanged(p['key']!),
              selectedColor: AppTheme.accentTeal.withValues(alpha: 0.15),
              labelStyle: TextStyle(
                color: isSelected ? AppTheme.accentTeal : AppTheme.textSecondary,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                fontSize: 12,
              ),
              side: BorderSide(
                color: isSelected ? AppTheme.accentTeal : AppTheme.borderGray,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildOverviewTab() {
    final o = _overview;
    if (o == null) return const SizedBox.shrink();

    return RefreshIndicator(
      onRefresh: _loadAllAnalytics,
      color: AppTheme.accentTeal,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: AnalyticsStatCard(
                  title: "Today's Revenue",
                  value: '₹${o.todayRevenue.toStringAsFixed(2)}',
                  subtitle: 'Collected today',
                  icon: Icons.currency_rupee_rounded,
                  iconColor: AppTheme.successGreen,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Selected Period',
                  value: '₹${o.periodRevenue.toStringAsFixed(2)}',
                  subtitle: '${o.totalSuccessfulPayments} successful payments',
                  icon: Icons.account_balance_wallet_rounded,
                  iconColor: AppTheme.accentTeal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Total Patients',
                  value: '${o.totalPatients}',
                  subtitle: 'Registered lifetime',
                  icon: Icons.people_alt_rounded,
                  iconColor: Colors.blue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AnalyticsStatCard(
                  title: 'New Patients',
                  value: '${o.newPatients}',
                  subtitle: 'Joined in period',
                  icon: Icons.person_add_alt_1_rounded,
                  iconColor: Colors.deepPurple,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Returning Patients',
                  value: '${o.returningPatients}',
                  subtitle: 'Repeat clinical visits',
                  icon: Icons.replay_rounded,
                  iconColor: Colors.teal,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Total Consultations',
                  value: '${o.totalConsultations}',
                  subtitle: 'Encounters conducted',
                  icon: Icons.medical_services_rounded,
                  iconColor: Colors.purple,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Unique Patients Seen',
                  value: '${o.uniquePatientsSeen}',
                  subtitle: 'Distinct patients in period',
                  icon: Icons.assignment_ind_rounded,
                  iconColor: Colors.indigo,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Avg. Patients / Day',
                  value: '${o.averagePatientsPerDay}',
                  subtitle: 'Per active calendar day',
                  icon: Icons.trending_up_rounded,
                  iconColor: Colors.orange.shade800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPatientsTab() {
    final p = _patientAnalytics;
    if (p == null) return const SizedBox.shrink();

    final regItems = p.dailyRegistrations
        .map((r) => DailyBarChartItem(label: r.date, value: r.count.toDouble()))
        .toList();
    final consultItems = p.dailyConsultations
        .map((c) => DailyBarChartItem(
              label: c.date,
              value: c.consultationCount.toDouble(),
            ))
        .toList();

    return RefreshIndicator(
      onRefresh: _loadAllAnalytics,
      color: AppTheme.accentTeal,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: AnalyticsStatCard(
                  title: 'New Registrations',
                  value: '${p.newPatients}',
                  subtitle: 'Added in period',
                  icon: Icons.person_add_rounded,
                  iconColor: Colors.deepPurple,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Returning Patients',
                  value: '${p.returningPatients}',
                  subtitle: 'Seen previously',
                  icon: Icons.replay_rounded,
                  iconColor: Colors.teal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          DailyBarChart(
            title: 'Daily Patient Consultations',
            items: consultItems,
            barColor: Colors.purple.shade600,
            emptyMessage: 'No consultations recorded in this period',
          ),
          const SizedBox(height: 16),
          DailyBarChart(
            title: 'Daily New Patient Registrations',
            items: regItems,
            barColor: AppTheme.accentTeal,
            emptyMessage: 'No new patient registrations in this period',
          ),
        ],
      ),
    );
  }

  Widget _buildRevenueTab() {
    final r = _revenueAnalytics;
    if (r == null) return const SizedBox.shrink();

    final revenueBars = r.dailyRevenue
        .map((d) => DailyBarChartItem(label: d.date, value: d.amount))
        .toList();

    return RefreshIndicator(
      onRefresh: _loadAllAnalytics,
      color: AppTheme.accentTeal,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: AnalyticsStatCard(
                  title: "Today's Revenue",
                  value: '₹${r.todayRevenue.toStringAsFixed(2)}',
                  subtitle: 'Collected today',
                  icon: Icons.today_rounded,
                  iconColor: AppTheme.successGreen,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AnalyticsStatCard(
                  title: 'This Month',
                  value: '₹${r.monthlyRevenue.toStringAsFixed(2)}',
                  subtitle: 'Calendar month total',
                  icon: Icons.calendar_month_rounded,
                  iconColor: AppTheme.accentTeal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Last 7 Days',
                  value: '₹${r.last7DaysRevenue.toStringAsFixed(2)}',
                  subtitle: 'Rolling 7-day total',
                  icon: Icons.date_range_rounded,
                  iconColor: Colors.blue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AnalyticsStatCard(
                  title: 'Last 30 Days',
                  value: '₹${r.last30DaysRevenue.toStringAsFixed(2)}',
                  subtitle: 'Rolling 30-day total',
                  icon: Icons.calendar_today_rounded,
                  iconColor: Colors.indigo,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          DailyBarChart(
            title: 'Daily Revenue Trend (₹)',
            items: revenueBars,
            valuePrefix: '₹',
            barColor: AppTheme.successGreen,
            emptyMessage: 'No collected revenue in this period',
          ),
          const SizedBox(height: 16),
          PaymentMethodDistributionWidget(
            items: r.paymentMethodDistribution,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Practice Analytics'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.textPrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Analytics',
            onPressed: _loadAllAnalytics,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.accentTeal,
          unselectedLabelColor: AppTheme.textSecondary,
          indicatorColor: AppTheme.accentTeal,
          tabs: const [
            Tab(text: 'Overview', icon: Icon(Icons.dashboard_rounded, size: 20)),
            Tab(text: 'Patients', icon: Icon(Icons.people_alt_rounded, size: 20)),
            Tab(text: 'Revenue', icon: Icon(Icons.currency_rupee_rounded, size: 20)),
          ],
        ),
      ),
      body: Column(
        children: [
          _buildPeriodFilterChips(),
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: AppTheme.accentTeal,
                    ),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.error_outline_rounded,
                                size: 48,
                                color: AppTheme.errorRed,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: _loadAllAnalytics,
                                icon: const Icon(Icons.refresh_rounded, size: 18),
                                label: const Text('Retry'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.accentTeal,
                                  foregroundColor: Colors.white,
                                  minimumSize: Size.zero,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                    vertical: 10,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _buildOverviewTab(),
                          _buildPatientsTab(),
                          _buildRevenueTab(),
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}

