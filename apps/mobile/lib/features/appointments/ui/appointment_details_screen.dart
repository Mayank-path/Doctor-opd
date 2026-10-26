import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../patients/services/patients_service.dart';
import '../../patients/ui/patient_details_screen.dart';
import '../models/appointment.dart';
import '../services/appointments_service.dart';
import 'components/appointment_cancel_dialog.dart';
import 'components/appointment_reschedule_sheet.dart';

/// Screen displaying complete details for an appointment and managing lifecycle actions
class AppointmentDetailsScreen extends StatefulWidget {
  final String appointmentId;
  final Appointment? initialAppointment;
  final AppointmentsService? appointmentsService;
  final PatientsService? patientsService;

  const AppointmentDetailsScreen({
    super.key,
    required this.appointmentId,
    this.initialAppointment,
    this.appointmentsService,
    this.patientsService,
  });

  @override
  State<AppointmentDetailsScreen> createState() =>
      _AppointmentDetailsScreenState();
}

class _AppointmentDetailsScreenState extends State<AppointmentDetailsScreen> {
  late final AppointmentsService _appointmentsService;
  late final PatientsService _patientsService;

  Appointment? _appointment;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _appointmentsService =
        widget.appointmentsService ?? AppointmentsService();
    _patientsService = widget.patientsService ?? PatientsService();

    if (widget.initialAppointment != null) {
      _appointment = widget.initialAppointment;
    } else {
      _loadAppointment();
    }
  }

  Future<void> _loadAppointment() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apt = await _appointmentsService.getAppointmentById(
        widget.appointmentId,
      );
      if (mounted) {
        setState(() {
          _appointment = apt;
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
          _errorMessage = 'Failed to load appointment: ${e.toString()}';
        });
      }
    }
  }

  Future<void> _handleReschedule() async {
    if (_appointment == null || !_appointment!.canReschedule) return;

    final replacement = await showModalBottomSheet<Appointment>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => AppointmentRescheduleSheet(
        appointment: _appointment!,
        appointmentsService: _appointmentsService,
      ),
    );

    if (replacement != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Appointment successfully rescheduled'),
          backgroundColor: AppTheme.successGreen,
        ),
      );
      // Replace with new replacement appointment
      setState(() {
        _appointment = replacement;
      });
    }
  }

  Future<void> _handleCancel() async {
    if (_appointment == null || !_appointment!.canCancel) return;

    final cancelled = await showDialog<Appointment>(
      context: context,
      builder: (ctx) => AppointmentCancelDialog(
        appointment: _appointment!,
        appointmentsService: _appointmentsService,
      ),
    );

    if (cancelled != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Appointment has been cancelled'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      setState(() {
        _appointment = cancelled;
      });
    }
  }

  void _navigateToPatientDetails(String patientId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PatientDetailsScreen(
          patientId: patientId,
          patientsService: _patientsService,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Appointment Details'),
        backgroundColor: AppTheme.primaryNavy,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loadAppointment,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _appointment == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null && _appointment == null) {
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
                onPressed: _loadAppointment,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_appointment == null) {
      return const Center(child: Text('Appointment not found'));
    }

    final apt = _appointment!;
    final typeColor = apt.type.color;
    final statusColor = apt.status.color;

    return RefreshIndicator(
      onRefresh: _loadAppointment,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status and Type Header Bar
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: typeColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: typeColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.label_rounded, size: 14, color: typeColor),
                      const SizedBox(width: 4),
                      Text(
                        apt.type.label.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: typeColor,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border:
                        Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    apt.status.label.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Schedule Card
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppTheme.borderGray),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SCHEDULE & TIMING',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_rounded,
                            size: 18, color: AppTheme.primaryNavy),
                        const SizedBox(width: 10),
                        Text(
                          apt.formattedServiceDate,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.access_time_rounded,
                            size: 18, color: AppTheme.primaryNavy),
                        const SizedBox(width: 10),
                        Text(
                          apt.formattedTimeRange,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Patient Card
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppTheme.borderGray),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'PATIENT INFORMATION',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        if (apt.patient != null)
                          TextButton(
                            onPressed: () =>
                                _navigateToPatientDetails(apt.patientId),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: const Text(
                              'View Profile',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      apt.patient?.fullName ?? 'Patient (ID: ${apt.patientId})',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'UHID: ${apt.patient?.uhid ?? "N/A"} • Phone: ${apt.patient?.phone ?? "N/A"}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Doctor Card
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppTheme.borderGray),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ASSIGNED CLINICIAN',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        CircleAvatar(
                          backgroundColor:
                              AppTheme.primaryNavy.withValues(alpha: 0.1),
                          child: const Icon(Icons.medical_services_rounded,
                              color: AppTheme.primaryNavy, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                apt.doctor != null
                                    ? 'Dr. ${apt.doctor!.fullName}'
                                    : 'Assigned Doctor (${apt.doctorId})',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              if (apt.doctor?.email != null)
                                Text(
                                  apt.doctor!.email!,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Queue Information (if checked in)
            if (apt.queueEntry != null) ...[
              Card(
                elevation: 1,
                color: Colors.amber.shade50,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.amber.shade300),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade800,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '#${apt.queueEntry!.tokenNumber}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'OPD Queue Token • ${apt.queueEntry!.status}',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Colors.amber.shade900,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Checked in at ${Appointment.formatTime(apt.queueEntry!.checkInTime)}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.amber.shade900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Cancellation Notice (if cancelled)
            if (apt.status == AppointmentStatus.cancelled) ...[
              Card(
                elevation: 1,
                color: AppTheme.errorRed.withValues(alpha: 0.08),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: AppTheme.errorRed.withValues(alpha: 0.3),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.cancel_rounded,
                              color: AppTheme.errorRed, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'CANCELLATION DETAILS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.errorRed,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        apt.cancellationReason ?? 'No reason recorded',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      if (apt.cancelledAt != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Cancelled on: ${Appointment.formatTime(apt.cancelledAt!)}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Rescheduled Note (if rescheduled)
            if (apt.rescheduledFromId != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blueGrey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.blueGrey.shade200),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.history_rounded,
                        color: Colors.blueGrey, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'This appointment was rescheduled from previous appointment ID: ${apt.rescheduledFromId!.substring(0, 8)}...',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.blueGrey,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Clinical & Administrative Notes
            if (apt.chiefComplaint != null &&
                apt.chiefComplaint!.isNotEmpty) ...[
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppTheme.borderGray),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'CHIEF COMPLAINT',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        apt.chiefComplaint!,
                        style: const TextStyle(
                          fontSize: 14,
                          height: 1.4,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            if (apt.notes != null && apt.notes!.isNotEmpty) ...[
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppTheme.borderGray),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'VISIT NOTES',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        apt.notes!,
                        style: const TextStyle(
                          fontSize: 14,
                          height: 1.4,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            const SizedBox(height: 16),

            // Action Buttons
            if (apt.canReschedule || apt.canCancel) ...[
              Row(
                children: [
                  if (apt.canReschedule)
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.schedule_rounded, size: 18),
                        label: const Text('Reschedule'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.blue.shade700,
                          side: BorderSide(color: Colors.blue.shade700),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: _handleReschedule,
                      ),
                    ),
                  if (apt.canReschedule && apt.canCancel)
                    const SizedBox(width: 12),
                  if (apt.canCancel)
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.cancel_outlined, size: 18),
                        label: const Text('Cancel Visit'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.errorRed,
                          side: const BorderSide(color: AppTheme.errorRed),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: _handleCancel,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ],
        ),
      ),
    );
  }
}
