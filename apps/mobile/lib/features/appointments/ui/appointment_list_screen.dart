import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../patients/services/patients_service.dart';
import '../models/appointment.dart';
import '../models/paginated_appointments_response.dart';
import '../services/appointments_service.dart';
import 'appointment_create_screen.dart';
import 'appointment_details_screen.dart';

/// Screen displaying the appointments list for a selected date with filtering and pagination
class AppointmentListScreen extends StatefulWidget {
  final String? initialDate;
  final AppointmentsService? appointmentsService;
  final PatientsService? patientsService;

  const AppointmentListScreen({
    super.key,
    this.initialDate,
    this.appointmentsService,
    this.patientsService,
  });

  @override
  State<AppointmentListScreen> createState() => _AppointmentListScreenState();
}

class _AppointmentListScreenState extends State<AppointmentListScreen> {
  late final AppointmentsService _appointmentsService;
  late final PatientsService _patientsService;
  final ScrollController _scrollController = ScrollController();

  late DateTime _selectedDate;
  AppointmentStatus? _selectedStatus;

  List<Appointment> _appointments = [];
  AppointmentPaginationMeta _meta = const AppointmentPaginationMeta(
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  );

  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _appointmentsService =
        widget.appointmentsService ?? AppointmentsService();
    _patientsService = widget.patientsService ?? PatientsService();

    final dateStr =
        widget.initialDate ?? AppointmentsService.getClinicLocalDate();
    try {
      _selectedDate = DateTime.parse('${dateStr}T00:00:00Z');
    } catch (_) {
      _selectedDate = DateTime.now();
    }

    _scrollController.addListener(_onScroll);
    _loadAppointments();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_isLoadingMore &&
        !_isLoading &&
        _meta.hasNextPage) {
      _loadMoreAppointments();
    }
  }

  String _formatSelectedDateString() {
    final year = _selectedDate.year.toString().padLeft(4, '0');
    final month = _selectedDate.month.toString().padLeft(2, '0');
    final day = _selectedDate.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  Future<void> _loadAppointments() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final dateStr = _formatSelectedDateString();
      final res = await _appointmentsService.getAppointments(
        serviceDate: dateStr,
        status: _selectedStatus,
        page: 1,
        limit: 20,
      );

      if (mounted) {
        setState(() {
          _appointments = res.data;
          _meta = res.meta;
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
          _errorMessage = 'Failed to load appointments: ${e.toString()}';
        });
      }
    }
  }

  Future<void> _loadMoreAppointments() async {
    if (_isLoadingMore || !_meta.hasNextPage) return;

    setState(() {
      _isLoadingMore = true;
    });

    try {
      final dateStr = _formatSelectedDateString();
      final res = await _appointmentsService.getAppointments(
        serviceDate: dateStr,
        status: _selectedStatus,
        page: _meta.page + 1,
        limit: 20,
      );

      if (mounted) {
        setState(() {
          _appointments.addAll(res.data);
          _meta = res.meta;
          _isLoadingMore = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoadingMore = false;
        });
      }
    }
  }

  void _previousDay() {
    setState(() {
      _selectedDate = _selectedDate.subtract(const Duration(days: 1));
    });
    _loadAppointments();
  }

  void _nextDay() {
    setState(() {
      _selectedDate = _selectedDate.add(const Duration(days: 1));
    });
    _loadAppointments();
  }

  void _jumpToToday() {
    final todayStr = AppointmentsService.getClinicLocalDate();
    setState(() {
      _selectedDate = DateTime.parse('${todayStr}T00:00:00Z');
    });
    _loadAppointments();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
      _loadAppointments();
    }
  }

  Future<void> _openBooking() async {
    final created = await Navigator.of(context).push<Appointment>(
      MaterialPageRoute(
        builder: (_) => AppointmentCreateScreen(
          patientsService: _patientsService,
          appointmentsService: _appointmentsService,
        ),
      ),
    );

    if (created != null && mounted) {
      _loadAppointments();
    }
  }

  Future<void> _openDetails(Appointment appointment) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AppointmentDetailsScreen(
          appointmentId: appointment.id,
          initialAppointment: appointment,
          appointmentsService: _appointmentsService,
          patientsService: _patientsService,
        ),
      ),
    );

    if (mounted) {
      _loadAppointments();
    }
  }

  @override
  Widget build(BuildContext context) {
    final todayStr = AppointmentsService.getClinicLocalDate();
    final currentStr = _formatSelectedDateString();
    final isToday = todayStr == currentStr;

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final displayDate =
        '${_selectedDate.day.toString().padLeft(2, '0')} ${months[_selectedDate.month - 1]} ${_selectedDate.year}';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Appointments'),
        backgroundColor: AppTheme.primaryNavy,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loadAppointments,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openBooking,
        backgroundColor: Colors.blue.shade700,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Book Appointment'),
      ),
      body: Column(
        children: [
          // Date Selector Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: AppTheme.borderGray)),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left_rounded),
                  onPressed: _previousDay,
                  tooltip: 'Previous Day',
                ),
                Expanded(
                  child: InkWell(
                    onTap: _pickDate,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.calendar_today_rounded,
                              size: 16, color: AppTheme.primaryNavy),
                          const SizedBox(width: 8),
                          Text(
                            displayDate,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          if (isToday) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.blue.shade50,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'Today',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.blue.shade800,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right_rounded),
                  onPressed: _nextDay,
                  tooltip: 'Next Day',
                ),
                if (!isToday)
                  TextButton(
                    onPressed: _jumpToToday,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: Size.zero,
                    ),
                    child: const Text('Today', style: TextStyle(fontSize: 12)),
                  ),
              ],
            ),
          ),

          // Status Filter Chips
          Container(
            height: 48,
            color: AppTheme.backgroundLight,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                _buildFilterChip('All', null),
                const SizedBox(width: 6),
                _buildFilterChip('Scheduled', AppointmentStatus.scheduled),
                const SizedBox(width: 6),
                _buildFilterChip('Confirmed', AppointmentStatus.confirmed),
                const SizedBox(width: 6),
                _buildFilterChip('Checked In', AppointmentStatus.checkedIn),
                const SizedBox(width: 6),
                _buildFilterChip('In Consultation', AppointmentStatus.inConsultation),
                const SizedBox(width: 6),
                _buildFilterChip('Completed', AppointmentStatus.completed),
                const SizedBox(width: 6),
                _buildFilterChip('Cancelled', AppointmentStatus.cancelled),
                const SizedBox(width: 6),
                _buildFilterChip('Rescheduled', AppointmentStatus.rescheduled),
              ],
            ),
          ),

          // Appointments List Content
          Expanded(
            child: _buildListContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, AppointmentStatus? status) {
    final isSelected = _selectedStatus == status;
    return ChoiceChip(
      label: Text(label),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
        color: isSelected ? Colors.white : AppTheme.textPrimary,
      ),
      selected: isSelected,
      selectedColor: AppTheme.primaryNavy,
      backgroundColor: Colors.white,
      showCheckmark: false,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isSelected ? AppTheme.primaryNavy : AppTheme.borderGray,
        ),
      ),
      onSelected: (_) {
        setState(() {
          _selectedStatus = status;
        });
        _loadAppointments();
      },
    );
  }

  Widget _buildListContent() {
    if (_isLoading && _appointments.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null && _appointments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: AppTheme.errorRed, size: 48),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppTheme.errorRed,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadAppointments,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_appointments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.event_available_rounded,
                  size: 48, color: Colors.blue.shade200),
              const SizedBox(height: 12),
              const Text(
                'No appointments scheduled',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'There are no appointments matching this date or status filter.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _openBooking,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Book New Appointment'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadAppointments,
      child: ListView.separated(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        itemCount: _appointments.length + (_isLoadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (ctx, index) {
          if (index == _appointments.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            );
          }

          final apt = _appointments[index];
          return _buildAppointmentCard(apt);
        },
      ),
    );
  }

  Widget _buildAppointmentCard(Appointment apt) {
    final statusColor = apt.status.color;
    final typeColor = apt.type.color;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.borderGray),
      ),
      child: InkWell(
        onTap: () => _openDetails(apt),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Row: Time Range & Status
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          apt.formattedTimeRange,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.blue.shade900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: typeColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          apt.type.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: typeColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      apt.status.label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Middle: Patient info
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor:
                        AppTheme.accentTeal.withValues(alpha: 0.15),
                    child: Text(
                      (apt.patient?.fullName.isNotEmpty ?? false)
                          ? apt.patient!.fullName[0].toUpperCase()
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
                          apt.patient?.fullName ?? 'Patient',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'UHID: ${apt.patient?.uhid ?? "N/A"} • Doctor: ${apt.doctor != null ? "Dr. ${apt.doctor!.fullName}" : "OPD"}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (apt.queueEntry != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade100,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.amber.shade300),
                      ),
                      child: Text(
                        'Token #${apt.queueEntry!.tokenNumber}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                ],
              ),

              if (apt.chiefComplaint != null &&
                  apt.chiefComplaint!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Complaint: ${apt.chiefComplaint}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
