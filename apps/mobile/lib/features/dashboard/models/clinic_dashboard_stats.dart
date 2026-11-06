import 'patient_summary.dart';

/// Aggregated dashboard statistics and summaries fetched from existing backend endpoints.
class ClinicDashboardStats {
  final String clinicId;
  final String serviceDate;
  final int totalPatients;
  final List<PatientSummary> recentPatients;
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
      isDoctor: false,
      detectedRole: 'UNKNOWN',
      healthStatus: 'unknown',
      lastRefreshed: DateTime.now(),
    );
  }
}
