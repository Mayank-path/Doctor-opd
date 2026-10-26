import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/appointment_summary.dart';
import '../models/clinic_dashboard_stats.dart';
import '../models/patient_summary.dart';
import '../models/queue_summary.dart';

/// Service coordinating data fetching for the Clinic Dashboard
/// using existing backend endpoints.
class DashboardService {
  final ApiClient _apiClient;

  DashboardService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Formats the current date in Asia/Kolkata timezone (UTC+05:30)
  /// to match backend clinic local calendar dates (YYYY-MM-DD).
  static String getClinicLocalDate([DateTime? dateTime]) {
    final utc = (dateTime ?? DateTime.now()).toUtc();
    final kolkataTime = utc.add(const Duration(hours: 5, minutes: 30));
    final year = kolkataTime.year.toString().padLeft(4, '0');
    final month = kolkataTime.month.toString().padLeft(2, '0');
    final day = kolkataTime.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  /// Fetches real clinic statistics for the given clinic ID and optional service date.
  /// Enforces tenant context via x-clinic-id header in ApiClient.
  Future<ClinicDashboardStats> fetchDashboardStats({
    required String clinicId,
    String? serviceDate,
  }) async {
    final date = serviceDate ?? getClinicLocalDate();

    // 1. Fetch Patients (ADMIN, DOCTOR, RECEPTIONIST authorized)
    int totalPatients = 0;
    List<PatientSummary> recentPatients = [];
    try {
      final patientRes = await _apiClient.get(
        '/patients',
        queryParameters: {'page': 1, 'limit': 5},
      );
      if (patientRes.data is Map<String, dynamic>) {
        final dataMap = patientRes.data as Map<String, dynamic>;
        final meta = dataMap['meta'] as Map<String, dynamic>?;
        totalPatients = (meta?['total'] as num?)?.toInt() ?? 0;
        final list = dataMap['data'] as List<dynamic>? ?? [];
        recentPatients = list
            .map((e) => PatientSummary.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } on ApiException catch (e) {
      // If user is not authorized or not a member of the clinic, fail fast
      if (e.statusCode == 403 || e.statusCode == 401) {
        rethrow;
      }
    }

    // 2. Fetch Appointments for today (serviceDate required)
    int totalAppointments = 0;
    List<AppointmentSummary> appointmentsToday = [];
    try {
      final aptRes = await _apiClient.get(
        '/appointments',
        queryParameters: {'serviceDate': date, 'limit': 10},
      );
      if (aptRes.data is Map<String, dynamic>) {
        final dataMap = aptRes.data as Map<String, dynamic>;
        final meta = dataMap['meta'] as Map<String, dynamic>?;
        totalAppointments = (meta?['total'] as num?)?.toInt() ?? 0;
        final list = dataMap['data'] as List<dynamic>? ?? [];
        appointmentsToday = list
            .map((e) => AppointmentSummary.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } on ApiException catch (e) {
      if (e.statusCode == 403 || e.statusCode == 401) {
        rethrow;
      }
    }

    // 3. Fetch OPD Queue for today (serviceDate required)
    int totalQueue = 0;
    int waitingCount = 0;
    int calledCount = 0;
    int inConsultationCount = 0;
    int completedCount = 0;
    List<QueueSummary> queueEntries = [];
    try {
      final queueRes = await _apiClient.get(
        '/queue',
        queryParameters: {'serviceDate': date},
      );
      if (queueRes.data is Map<String, dynamic>) {
        final dataMap = queueRes.data as Map<String, dynamic>;
        totalQueue = (dataMap['total'] as num?)?.toInt() ?? 0;
        final list = dataMap['data'] as List<dynamic>? ?? [];
        queueEntries = list
            .map((e) => QueueSummary.fromJson(e as Map<String, dynamic>))
            .toList();

        for (final entry in queueEntries) {
          switch (entry.status) {
            case 'WAITING':
              waitingCount++;
              break;
            case 'CALLED':
              calledCount++;
              break;
            case 'IN_CONSULTATION':
              inConsultationCount++;
              break;
            case 'COMPLETED':
              completedCount++;
              break;
          }
        }
      }
    } on ApiException catch (e) {
      if (e.statusCode == 403 || e.statusCode == 401) {
        rethrow;
      }
    }

    // 4. Probe Consultations endpoint to verify DOCTOR vs ADMIN role authorization
    bool isDoctor = false;
    String detectedRole = 'ADMIN';
    String? consultationRestrictionMessage;

    try {
      await _apiClient.get(
        '/consultations',
        queryParameters: {'limit': 1},
      );
      isDoctor = true;
      detectedRole = 'DOCTOR';
    } on ApiException catch (e) {
      if (e.statusCode == 403) {
        isDoctor = false;
        final msg = e.message.toUpperCase();
        if (msg.contains('ROLE ADMIN')) {
          detectedRole = 'ADMIN';
        } else if (msg.contains('ROLE RECEPTIONIST')) {
          detectedRole = 'RECEPTIONIST';
        } else if (msg.contains('ROLE STAFF')) {
          detectedRole = 'STAFF';
        } else if (msg.contains('NOT A MEMBER')) {
          rethrow;
        } else {
          detectedRole = 'ADMIN';
        }
        consultationRestrictionMessage =
            'Clinical consultation records are restricted to Doctor role under clinical privacy rules.';
      }
    } catch (_) {
      // Keep detectedRole fallback
    }

    // 5. Check Health status
    String healthStatus = 'online';
    try {
      final healthRes = await _apiClient.get('/health');
      if (healthRes.data is Map<String, dynamic>) {
        final status = (healthRes.data as Map<String, dynamic>)['status'];
        healthStatus = status == 'ok' ? 'online' : status.toString();
      }
    } catch (_) {
      healthStatus = 'unreachable';
    }

    return ClinicDashboardStats(
      clinicId: clinicId,
      serviceDate: date,
      totalPatients: totalPatients,
      recentPatients: recentPatients,
      totalAppointmentsToday: totalAppointments,
      appointmentsToday: appointmentsToday,
      totalQueueToday: totalQueue,
      queueWaitingCount: waitingCount,
      queueCalledCount: calledCount,
      queueInConsultationCount: inConsultationCount,
      queueCompletedCount: completedCount,
      queueEntriesToday: queueEntries,
      isDoctor: isDoctor,
      detectedRole: detectedRole,
      consultationRestrictionMessage: consultationRestrictionMessage,
      healthStatus: healthStatus,
      lastRefreshed: DateTime.now(),
    );
  }
}
