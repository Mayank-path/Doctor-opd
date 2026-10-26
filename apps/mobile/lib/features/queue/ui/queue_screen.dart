import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../appointments/services/appointments_service.dart';
import '../../appointments/ui/appointment_details_screen.dart';
import '../../auth/models/auth_user.dart';
import '../../patients/services/patients_service.dart';
import '../../patients/ui/patient_details_screen.dart';
import '../models/queue_entry.dart';
import '../models/queue_list_response.dart';
import '../models/update_queue_status_request.dart';
import '../services/queue_service.dart';
import 'components/check_in_appointment_sheet.dart';
import 'components/queue_cancel_dialog.dart';
import 'components/walk_in_check_in_sheet.dart';
import '../../consultations/ui/consultation_create_screen.dart';

/// Screen displaying the active OPD Queue for a clinic service date,
/// allowing token tracking, status transitions, check-in, and linked record navigation.
class QueueScreen extends StatefulWidget {
  final QueueService? queueService;
  final AppointmentsService? appointmentsService;
  final PatientsService? patientsService;
  final SecureStorageService? storageService;
  final String? initialDate;

  const QueueScreen({
    super.key,
    this.queueService,
    this.appointmentsService,
    this.patientsService,
    this.storageService,
    this.initialDate,
  });

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  late final QueueService _queueService;
  late final AppointmentsService _appointmentsService;
  late final PatientsService _patientsService;
  late final SecureStorageService _storageService;

  late String _selectedDate;
  QueueStatus? _selectedStatusFilter;
  AuthUser? _currentUser;

  bool _isLoading = true;
  String? _errorMessage;
  QueueListResponse? _queueResponse;

  /// Tracks entry ID currently executing an action to prevent duplicate clicks
  String? _inFlightEntryId;

  @override
  void initState() {
    super.initState();
    _queueService = widget.queueService ?? QueueService();
    _appointmentsService = widget.appointmentsService ?? AppointmentsService();
    _patientsService = widget.patientsService ?? PatientsService();
    _storageService = widget.storageService ?? SecureStorageService();

    _selectedDate =
        widget.initialDate ?? AppointmentsService.getClinicLocalDate();

    _loadUserContext();
    _loadQueue();
  }

  Future<void> _loadUserContext() async {
    final user = await _storageService.getUser();
    if (mounted && user != null) {
      setState(() {
        _currentUser = user;
      });
    }
  }

  Future<void> _loadQueue() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _queueService.getQueue(
        serviceDate: _selectedDate,
        status: _selectedStatusFilter,
      );

      if (mounted) {
        setState(() {
          _queueResponse = res;
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.message;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load queue: $e';
          _isLoading = false;
        });
      }
    }
  }

  void _onDateChanged(DateTime newDate) {
    final dateStr = AppointmentsService.getClinicLocalDate(newDate);
    if (dateStr != _selectedDate) {
      setState(() {
        _selectedDate = dateStr;
      });
      _loadQueue();
    }
  }

  void _shiftDate(int dayOffset) {
    try {
      final current = DateTime.parse('${_selectedDate}T00:00:00Z');
      final updated = current.add(Duration(days: dayOffset));
      _onDateChanged(updated);
    } catch (_) {
      _onDateChanged(DateTime.now());
    }
  }

  Future<void> _pickDate() async {
    DateTime initial;
    try {
      initial = DateTime.parse('${_selectedDate}T00:00:00Z');
    } catch (_) {
      initial = DateTime.now();
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );

    if (picked != null) {
      _onDateChanged(picked);
    }
  }

  Future<void> _updateStatus(QueueEntry entry, QueueStatus newStatus) async {
    if (_inFlightEntryId != null) return;

    setState(() {
      _inFlightEntryId = entry.id;
    });

    try {
      await _queueService.updateStatus(
        entry.id,
        UpdateQueueStatusRequest(status: newStatus),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Token #${entry.tokenNumber} marked as ${newStatus.label}',
            ),
            backgroundColor: AppTheme.accentTeal,
            duration: const Duration(seconds: 2),
          ),
        );
        _loadQueue();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Action failed: ${e.message}'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Unexpected error: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _inFlightEntryId = null;
        });
      }
    }
  }

  Future<void> _confirmCancel(QueueEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => QueueCancelDialog(
        entry: entry,
        queueService: _queueService,
      ),
    );

    if (confirmed == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Token #${entry.tokenNumber} has been cancelled'),
          backgroundColor: Colors.red.shade700,
        ),
      );
      _loadQueue();
    }
  }

  Future<void> _openCheckInAppointmentSheet() async {
    final result = await showModalBottomSheet<QueueEntry>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CheckInAppointmentSheet(
        serviceDate: _selectedDate,
        appointmentsService: _appointmentsService,
        queueService: _queueService,
      ),
    );

    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Token #${result.tokenNumber} allocated for ${result.patient?.fullName ?? "patient"}',
          ),
          backgroundColor: AppTheme.accentTeal,
        ),
      );
      _loadQueue();
    }
  }

  Future<void> _openWalkInCheckInSheet() async {
    final result = await showModalBottomSheet<QueueEntry>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => WalkInCheckInSheet(
        serviceDate: _selectedDate,
        patientsService: _patientsService,
        queueService: _queueService,
        storageService: _storageService,
      ),
    );

    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Walk-In Token #${result.tokenNumber} allocated successfully',
          ),
          backgroundColor: AppTheme.accentTeal,
        ),
      );
      _loadQueue();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text(
          'OPD Queue',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Queue',
            onPressed: _isLoading ? null : _loadQueue,
          ),
          PopupMenuButton<String>(
            tooltip: 'Check-In Options',
            icon: const Icon(Icons.person_add_alt_1),
            onSelected: (val) {
              if (val == 'appointment') {
                _openCheckInAppointmentSheet();
              } else if (val == 'walkin') {
                _openWalkInCheckInSheet();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'appointment',
                child: Row(
                  children: [
                    Icon(Icons.how_to_reg, color: AppTheme.accentTeal),
                    SizedBox(width: 8),
                    Text('Check-In Appointment'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'walkin',
                child: Row(
                  children: [
                    Icon(Icons.directions_walk, color: Colors.blue),
                    SizedBox(width: 8),
                    Text('Walk-In Check-In'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          _buildDateSelector(),
          _buildMetricsBar(),
          _buildFilterChips(),
          Expanded(child: _buildBody()),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('queueCheckInFab'),
        onPressed: () {
          showModalBottomSheet(
            context: context,
            backgroundColor: Colors.white,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            builder: (ctx) => SafeArea(
              child: Wrap(
                children: [
                  ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: AppTheme.accentTeal,
                      child: Icon(Icons.how_to_reg, color: Colors.white),
                    ),
                    title: const Text('Check-In Scheduled Appointment'),
                    subtitle: const Text('From pre-booked appointments'),
                    onTap: () {
                      Navigator.of(ctx).pop();
                      _openCheckInAppointmentSheet();
                    },
                  ),
                  ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Colors.blue,
                      child: Icon(Icons.directions_walk, color: Colors.white),
                    ),
                    title: const Text('Walk-In Patient Check-In'),
                    subtitle: const Text('Allocate token directly for walk-in'),
                    onTap: () {
                      Navigator.of(ctx).pop();
                      _openWalkInCheckInSheet();
                    },
                  ),
                ],
              ),
            ),
          );
        },
        backgroundColor: AppTheme.accentTeal,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          'Check-In',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildDateSelector() {
    final todayStr = AppointmentsService.getClinicLocalDate();
    final isToday = _selectedDate == todayStr;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            tooltip: 'Previous Day',
            onPressed: () => _shiftDate(-1),
          ),
          Expanded(
            child: InkWell(
              onTap: _pickDate,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                alignment: Alignment.center,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.calendar_today,
                      size: 16,
                      color: AppTheme.accentTeal,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _selectedDate,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    if (isToday) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.accentTeal.withAlpha(25),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'TODAY',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.accentTeal,
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
            icon: const Icon(Icons.chevron_right),
            tooltip: 'Next Day',
            onPressed: () => _shiftDate(1),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricsBar() {
    if (_queueResponse == null) return const SizedBox.shrink();

    final res = _queueResponse!;
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          _buildMetricItem('Total', res.total, Colors.grey.shade700),
          _buildMetricDivider(),
          _buildMetricItem('Waiting', res.waitingCount, Colors.blue.shade700),
          _buildMetricDivider(),
          _buildMetricItem('Called', res.calledCount, Colors.purple.shade700),
          _buildMetricDivider(),
          _buildMetricItem(
            'Consulting',
            res.inConsultationCount,
            Colors.amber.shade800,
          ),
          _buildMetricDivider(),
          _buildMetricItem(
            'Done',
            res.completedCount,
            Colors.green.shade700,
          ),
        ],
      ),
    );
  }

  Widget _buildMetricItem(String label, int count, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricDivider() {
    return Container(
      height: 24,
      width: 1,
      color: Colors.grey.shade200,
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      (null, 'All'),
      (QueueStatus.waiting, 'Waiting'),
      (QueueStatus.called, 'Called'),
      (QueueStatus.inConsultation, 'Consulting'),
      (QueueStatus.completed, 'Completed'),
      (QueueStatus.skipped, 'Skipped'),
      (QueueStatus.cancelled, 'Cancelled'),
    ];

    return Container(
      height: 44,
      color: Colors.white,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final filter = filters[index];
          final isSelected = _selectedStatusFilter == filter.$1;

          return FilterChip(
            selected: isSelected,
            label: Text(
              filter.$2,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? AppTheme.accentTeal : Colors.grey.shade700,
              ),
            ),
            backgroundColor: Colors.grey.shade100,
            selectedColor: AppTheme.accentTeal.withAlpha(30),
            checkmarkColor: AppTheme.accentTeal,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(
                color: isSelected ? AppTheme.accentTeal : Colors.transparent,
              ),
            ),
            onSelected: (selected) {
              setState(() {
                _selectedStatusFilter = isSelected ? null : filter.$1;
              });
              _loadQueue();
            },
          );
        },
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(strokeWidth: 2.5),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 12),
              Text(
                'Unable to load OPD Queue',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loadQueue,
                icon: const Icon(Icons.refresh),
                label: const Text('Try Again'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentTeal,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final entries = _queueResponse?.data ?? [];

    if (entries.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadQueue,
        child: ListView(
          padding: const EdgeInsets.all(32),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.15),
            Icon(
              Icons.format_list_numbered_rounded,
              size: 56,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            const Center(
              child: Text(
                'OPD Queue is Empty',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Center(
              child: Text(
                _selectedStatusFilter != null
                    ? 'No queue entries with status "${_selectedStatusFilter!.label}" on $_selectedDate.'
                    : 'No patients have been checked in for $_selectedDate.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              ),
            ),
            const SizedBox(height: 24),
            Center(
              child: OutlinedButton.icon(
                onPressed: _openCheckInAppointmentSheet,
                icon: const Icon(Icons.how_to_reg),
                label: const Text('Check-In Appointment'),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadQueue,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        itemCount: entries.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final entry = entries[index];
          return _buildQueueCard(entry);
        },
      ),
    );
  }

  Widget _buildQueueCard(QueueEntry entry) {
    final isProcessing = _inFlightEntryId == entry.id;
    final patient = entry.patient;
    final doctor = entry.doctor;
    final appointment = entry.appointment;

    final currentUserId = _currentUser?.id;
    final currentUserRole = _currentUser?.role;

    final canStartConsult =
        entry.canStartConsultation(currentUserId, currentUserRole);
    final canCompleteConsult =
        entry.canComplete(currentUserId, currentUserRole);

    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: entry.isWaiting
              ? AppTheme.accentTeal.withAlpha(60)
              : Colors.grey.shade200,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Token Badge, Status Badge, Cancel Icon
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Token number
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: entry.status.color.withAlpha(25),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: entry.status.color.withAlpha(100),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        entry.status.icon,
                        size: 16,
                        color: entry.status.color,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '#${entry.tokenNumber}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: entry.status.color,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                // Priority Badge (if > 0)
                if (entry.priority > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: entry.priority >= 10
                          ? Colors.red.shade50
                          : Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: entry.priority >= 10
                            ? Colors.red.shade300
                            : Colors.amber.shade400,
                      ),
                    ),
                    child: Text(
                      entry.priority >= 10 ? 'EMERGENCY' : 'PRIORITY',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: entry.priority >= 10
                            ? Colors.red.shade700
                            : Colors.amber.shade900,
                      ),
                    ),
                  ),

                const Spacer(),

                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: entry.status.color.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    entry.status.label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: entry.status.color,
                    ),
                  ),
                ),

                // Cancel Menu Option (if not terminal)
                if (!entry.isTerminal)
                  IconButton(
                    icon: Icon(
                      Icons.cancel_outlined,
                      size: 20,
                      color: Colors.red.shade400,
                    ),
                    tooltip: 'Cancel Token',
                    onPressed: isProcessing ? null : () => _confirmCancel(entry),
                  ),
              ],
            ),

            const SizedBox(height: 12),

            // Patient Information (Tappable to Patient Details)
            InkWell(
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => PatientDetailsScreen(
                      patientId: entry.patientId,
                      patientsService: _patientsService,
                    ),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                patient?.fullName ?? 'Unknown Patient',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: Colors.grey.shade400,
                              ),
                            ],
                          ),
                          Text(
                            'UHID: ${patient?.uhid ?? "N/A"} • ${patient?.gender ?? ""} • ${patient?.ageYears ?? "--"} yrs',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 8),

            // Doctor and Appointment Information
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 12,
              runSpacing: 6,
              children: [
                if (doctor != null)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.medical_services_outlined,
                        size: 14,
                        color: Colors.grey.shade600,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Dr. ${doctor.fullName}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey.shade800,
                        ),
                      ),
                    ],
                  ),

                // Linked appointment or walk-in
                if (entry.appointmentId != null)
                  InkWell(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => AppointmentDetailsScreen(
                            appointmentId: entry.appointmentId!,
                            appointmentsService: _appointmentsService,
                            patientsService: _patientsService,
                          ),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.link,
                          size: 14,
                          color: AppTheme.accentTeal,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          appointment?.formattedTimeRange ?? 'Appt Linked',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.accentTeal,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.blue.withAlpha(20),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'Walk-In',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: Colors.blue,
                      ),
                    ),
                  ),
              ],
            ),

            // Timestamps row
            const SizedBox(height: 10),
            _buildTimestamps(entry),

            // Action Buttons
            if (!entry.isTerminal) ...[
              const Divider(height: 20),
              if (isProcessing)
                const Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else
                _buildActionButtons(
                  entry: entry,
                  canStartConsult: canStartConsult,
                  canCompleteConsult: canCompleteConsult,
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTimestamps(QueueEntry entry) {
    final items = <String>[];
    if (entry.formattedCheckInTime.isNotEmpty) {
      items.add('In: ${entry.formattedCheckInTime}');
    }
    if (entry.formattedCalledAt != null) {
      items.add('Called: ${entry.formattedCalledAt!}');
    }
    if (entry.formattedConsultationStartTime != null) {
      items.add('Consult: ${entry.formattedConsultationStartTime!}');
    }
    if (entry.formattedConsultationEndTime != null) {
      items.add('Done: ${entry.formattedConsultationEndTime!}');
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Text(
      items.join(' • '),
      style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
    );
  }

  Widget _buildActionButtons({
    required QueueEntry entry,
    required bool canStartConsult,
    required bool canCompleteConsult,
  }) {
    switch (entry.status) {
      case QueueStatus.waiting:
        return SizedBox(
          width: double.infinity,
          height: 38,
          child: ElevatedButton.icon(
            key: Key('callButton_${entry.id}'),
            onPressed: () => _updateStatus(entry, QueueStatus.called),
            icon: const Icon(Icons.campaign, size: 18),
            label: const Text('Call Patient'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.purple.shade700,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              elevation: 0,
            ),
          ),
        );

      case QueueStatus.called:
        return Row(
          children: [
            // Start Consultation (DOCTOR role and assigned doctor only)
            if (canStartConsult) ...[
              Expanded(
                flex: 2,
                child: SizedBox(
                  height: 38,
                  child: ElevatedButton.icon(
                    key: Key('startConsultButton_${entry.id}'),
                    onPressed: () =>
                        _updateStatus(entry, QueueStatus.inConsultation),
                    icon: const Icon(Icons.play_arrow, size: 18),
                    label: const Text('Start Consult'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber.shade800,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],

            // Re-call
            Expanded(
              child: SizedBox(
                height: 38,
                child: OutlinedButton(
                  key: Key('reCallButton_${entry.id}'),
                  onPressed: () => _updateStatus(entry, QueueStatus.called),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text('Re-Call', style: TextStyle(fontSize: 12)),
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Skip
            Expanded(
              child: SizedBox(
                height: 38,
                child: OutlinedButton(
                  key: Key('skipButton_${entry.id}'),
                  onPressed: () => _updateStatus(entry, QueueStatus.skipped),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.orange.shade800,
                    side: BorderSide(color: Colors.orange.shade300),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text('Skip', style: TextStyle(fontSize: 12)),
                ),
              ),
            ),
          ],
        );

      case QueueStatus.skipped:
        return Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 38,
                child: ElevatedButton.icon(
                  key: Key('recallSkippedButton_${entry.id}'),
                  onPressed: () => _updateStatus(entry, QueueStatus.called),
                  icon: const Icon(Icons.campaign, size: 18),
                  label: const Text('Call Patient'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple.shade700,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: SizedBox(
                height: 38,
                child: OutlinedButton(
                  key: Key('returnToWaitingButton_${entry.id}'),
                  onPressed: () => _updateStatus(entry, QueueStatus.waiting),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text('Return to Waiting'),
                ),
              ),
            ),
          ],
        );

      case QueueStatus.inConsultation:
        if (canCompleteConsult) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: double.infinity,
                height: 38,
                child: ElevatedButton.icon(
                  key: Key('openConsultationButton_${entry.id}'),
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ConsultationCreateScreen(
                          patientId: entry.patientId,
                          patientName: entry.patient?.fullName,
                          patientUhid: entry.patient?.uhid,
                          patientGender: entry.patient?.gender,
                          patientAge: entry.patient?.ageYears,
                          appointmentId: entry.appointmentId,
                          queueEntryId: entry.id,
                        ),
                      ),
                    );
                    _loadQueue();
                  },
                  icon: const Icon(Icons.edit_note, size: 18),
                  label: const Text('Open Clinical Consultation'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                height: 38,
                child: OutlinedButton.icon(
                  key: Key('completeButton_${entry.id}'),
                  onPressed: () => _updateStatus(entry, QueueStatus.completed),
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: const Text('Complete Queue Entry'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.green.shade700,
                    side: BorderSide(color: Colors.green.shade700),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ],
          );
        } else {
          return Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.lock_clock,
                  size: 16,
                  color: Colors.amber.shade800,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'In consultation with Dr. ${entry.doctor?.fullName ?? "assigned doctor"}. Only the attending doctor can complete.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.amber.shade900,
                    ),
                  ),
                ),
              ],
            ),
          );
        }

      default:
        return const SizedBox.shrink();
    }
  }
}
