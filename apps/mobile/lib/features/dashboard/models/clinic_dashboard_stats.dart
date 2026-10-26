import 'appointment_summary.dart';
import 'patient_summary.dart';
import 'queue_summary.dart';

/// Aggregated dashboard statistics and summaries fetched from existing backend endpoints.
class ClinicDashboardStats {
  final String clinicId;
  final String serviceDate;
  final int totalPatients;
  final List<PatientSummary> recentPatients;
  final int totalAppointmentsToday;
  final List<AppointmentSummary> appointmentsToday;
  final int totalQueueToday;
  final int queueWaitingCount;
  final int queueCalledCount;
  final int queueInConsultationCount;
  final int queueCompletedCount;
  final List<QueueSummary> queueEntriesToday;
  final bool isDoctor;
  final String detectedRole;
  final String? consultationRestrictionMessage;
  final String healthStatus;
  final DateTime lastRefreshed;

  const ClinicDashboardStats({
    required this.clinicId,
    required this.serviceDate,
    required this.totalPatients,
    required this.recentPatients,
    required this.totalAppointmentsToday,
    required this.appointmentsToday,
    required this.totalQueueToday,
    required this.queueWaitingCount,
    required this.queueCalledCount,
    required this.queueInConsultationCount,
    required this.queueCompletedCount,
    required this.queueEntriesToday,
    required this.isDoctor,
    required this.detectedRole,
    this.consultationRestrictionMessage,
    required this.healthStatus,
    required this.lastRefreshed,
  });

  /// Factory creating an initial/empty state when no data has loaded yet
  factory ClinicDashboardStats.empty({
    String clinicId = '',
    String serviceDate = '',
  }) {
    return ClinicDashboardStats(
      clinicId: clinicId,
      serviceDate: serviceDate,
      totalPatients: 0,
      recentPatients: const [],
      totalAppointmentsToday: 0,
      appointmentsToday: const [],
      totalQueueToday: 0,
      queueWaitingCount: 0,
      queueCalledCount: 0,
      queueInConsultationCount: 0,
      queueCompletedCount: 0,
      queueEntriesToday: const [],
      isDoctor: false,
      detectedRole: 'UNKNOWN',
      healthStatus: 'unknown',
      lastRefreshed: DateTime.now(),
    );
  }
}
