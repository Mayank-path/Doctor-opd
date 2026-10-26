import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/appointment.dart';
import '../models/cancel_appointment_request.dart';
import '../models/create_appointment_request.dart';
import '../models/paginated_appointments_response.dart';
import '../models/reschedule_appointment_request.dart';

/// Service coordinating appointment lifecycle operations with backend NestJS AppointmentsController.
class AppointmentsService {
  final ApiClient _apiClient;

  AppointmentsService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Returns calendar date string (YYYY-MM-DD) in Asia/Kolkata timezone (UTC+05:30)
  static String getClinicLocalDate([DateTime? dateTime]) {
    final utc = (dateTime ?? DateTime.now()).toUtc();
    final kolkataTime = utc.add(const Duration(hours: 5, minutes: 30));
    final year = kolkataTime.year.toString().padLeft(4, '0');
    final month = kolkataTime.month.toString().padLeft(2, '0');
    final day = kolkataTime.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  /// Converts a calendar date and local hour/minute in clinic timezone into
  /// an ISO 8601 string with explicit Asia/Kolkata offset (+05:30)
  static String toKolkataIsoString(DateTime date, int hour, int minute) {
    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    final h = hour.toString().padLeft(2, '0');
    final m = minute.toString().padLeft(2, '0');
    return '$year-$month-${day}T$h:$m:00+05:30';
  }

  /// Lists appointments for a required serviceDate with pagination and optional filters.
  /// Scoped strictly to active clinic via x-clinic-id header in ApiClient.
  Future<PaginatedAppointmentsResponse> getAppointments({
    required String serviceDate,
    String? doctorId,
    AppointmentStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = <String, dynamic>{
      'serviceDate': serviceDate,
      'page': page,
      'limit': limit,
    };

    if (doctorId != null && doctorId.isNotEmpty) {
      queryParams['doctorId'] = doctorId;
    }

    if (status != null) {
      queryParams['status'] = status.toBackendString();
    }

    final response = await _apiClient.get(
      '/appointments',
      queryParameters: queryParams,
    );

    if (response.data is Map<String, dynamic>) {
      return PaginatedAppointmentsResponse.fromJson(
        response.data as Map<String, dynamic>,
      );
    }

    return PaginatedAppointmentsResponse.empty();
  }

  /// Retrieves a single appointment by UUID strictly scoped to the active clinic.
  Future<Appointment> getAppointmentById(String id) async {
    final response = await _apiClient.get('/appointments/$id');
    return Appointment.fromJson(response.data as Map<String, dynamic>);
  }

  /// Creates a new scheduled or walk-in appointment.
  /// Initial status is set by server to SCHEDULED.
  Future<Appointment> createAppointment(CreateAppointmentRequest request) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        message: validationErrors.values.first,
        statusCode: 400,
      );
    }

    final response = await _apiClient.post(
      '/appointments',
      data: request.toJson(),
    );

    return Appointment.fromJson(response.data as Map<String, dynamic>);
  }

  /// Reschedules an appointment in a single atomic transaction.
  /// Creates a replacement appointment and returns it.
  Future<Appointment> rescheduleAppointment(
    String id,
    RescheduleAppointmentRequest request,
  ) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        message: validationErrors.values.first,
        statusCode: 400,
      );
    }

    final response = await _apiClient.post(
      '/appointments/$id/reschedule',
      data: request.toJson(),
    );

    return Appointment.fromJson(response.data as Map<String, dynamic>);
  }

  /// Cancels an appointment conditionally and sets cancellation details.
  Future<Appointment> cancelAppointment(
    String id,
    CancelAppointmentRequest request,
  ) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        message: validationErrors.values.first,
        statusCode: 400,
      );
    }

    final response = await _apiClient.post(
      '/appointments/$id/cancel',
      data: request.toJson(),
    );

    return Appointment.fromJson(response.data as Map<String, dynamic>);
  }
}
