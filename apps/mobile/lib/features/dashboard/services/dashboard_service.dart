import 'package:dio/dio.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/clinic_dashboard_stats.dart';
import '../models/patient_summary.dart';

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
    final clinicOptions = Options(headers: {'x-clinic-id': clinicId});

    // 1. Fetch Patients (ADMIN, DOCTOR, RECEPTIONIST authorized)
    int totalPatients = 0;
    List<PatientSummary> recentPatients = [];
    try {
      final patientRes = await _apiClient.get(
        '/patients',
        queryParameters: {'page': 1, 'limit': 5},
        options: clinicOptions,
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
      if (e.statusCode == 403 || e.statusCode == 401 || e.statusCode == 400) {
        rethrow;
      }
    }

    // 2. Probe Consultations endpoint to verify DOCTOR vs other role authorization
    bool isDoctor = false;
    String detectedRole = 'UNKNOWN';
    String? consultationRestrictionMessage;

    try {
      await _apiClient.get(
        '/consultations',
        queryParameters: {'limit': 1},
        options: clinicOptions,
      );
      isDoctor = true;
      detectedRole = 'DOCTOR';
    } on ApiException catch (e) {
      if (e.statusCode == 403) {
        isDoctor = false;
        final msg = e.message.toUpperCase();
        if (msg.contains('NOT A MEMBER') || msg.contains('MEMBERSHIP STATUS IS')) {
          rethrow;
        } else if (msg.contains('ROLE ADMIN')) {
          detectedRole = 'ADMIN';
        } else if (msg.contains('ROLE RECEPTIONIST')) {
          detectedRole = 'RECEPTIONIST';
        } else if (msg.contains('ROLE STAFF')) {
          detectedRole = 'STAFF';
        } else {
          detectedRole = 'UNKNOWN';
        }
        consultationRestrictionMessage =
            'Clinical consultation records are restricted to Doctor role under clinical privacy rules.';
      } else {
        rethrow;
      }
    } catch (_) {
      detectedRole = 'UNKNOWN';
    }

    // 3. Check Health status
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
      isDoctor: isDoctor,
      detectedRole: detectedRole,
      consultationRestrictionMessage: consultationRestrictionMessage,
      healthStatus: healthStatus,
      lastRefreshed: DateTime.now(),
    );
  }
}
