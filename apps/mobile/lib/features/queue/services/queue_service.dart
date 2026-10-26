import 'dart:math';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/check_in_request.dart';
import '../models/queue_entry.dart';
import '../models/queue_list_response.dart';
import '../models/update_queue_status_request.dart';

/// Service coordinating OPD Queue operations with backend NestJS QueueController.
class QueueService {
  final ApiClient _apiClient;

  QueueService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Formats date in Asia/Kolkata timezone (UTC+05:30) as YYYY-MM-DD
  static String getClinicLocalDate([DateTime? dateTime]) {
    final utc = (dateTime ?? DateTime.now()).toUtc();
    final kolkataTime = utc.add(const Duration(hours: 5, minutes: 30));
    final year = kolkataTime.year.toString().padLeft(4, '0');
    final month = kolkataTime.month.toString().padLeft(2, '0');
    final day = kolkataTime.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  /// Generates a pseudo-random unique client idempotency key
  static String generateIdempotencyKey() {
    final random = Random();
    final timestamp = DateTime.now().microsecondsSinceEpoch;
    final r1 = random.nextInt(0xFFFFFFFF).toRadixString(16).padLeft(8, '0');
    final r2 = random.nextInt(0xFFFF).toRadixString(16).padLeft(4, '0');
    return 'q-$timestamp-$r1-$r2';
  }

  /// Retrieves the OPD queue for a required serviceDate with optional filters.
  /// Scoped strictly to active clinic via x-clinic-id header in ApiClient.
  Future<QueueListResponse> getQueue({
    required String serviceDate,
    String? doctorId,
    QueueStatus? status,
  }) async {
    final queryParams = <String, dynamic>{
      'serviceDate': serviceDate,
    };

    if (doctorId != null && doctorId.isNotEmpty) {
      queryParams['doctorId'] = doctorId;
    }

    if (status != null) {
      queryParams['status'] = status.toBackendString();
    }

    final response = await _apiClient.get(
      '/queue',
      queryParameters: queryParams,
    );

    if (response.data is Map<String, dynamic>) {
      return QueueListResponse.fromJson(
        response.data as Map<String, dynamic>,
      );
    }

    return QueueListResponse.empty();
  }

  /// Checks in an appointment or walk-in patient, issuing an atomic token number.
  /// Automatically attaches an idempotency key if not explicitly provided.
  Future<QueueEntry> checkIn(CheckInRequest request) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        message: validationErrors.values.first,
        statusCode: 400,
      );
    }

    // Attach client idempotency key if absent to guarantee safe retries
    final key = request.idempotencyKey ?? generateIdempotencyKey();
    final data = Map<String, dynamic>.from(request.toJson());
    data['idempotencyKey'] = key;

    final response = await _apiClient.post(
      '/queue/check-in',
      data: data,
    );

    return QueueEntry.fromJson(response.data as Map<String, dynamic>);
  }

  /// Updates queue status with state machine transitions and role checks.
  Future<QueueEntry> updateStatus(
    String queueEntryId,
    UpdateQueueStatusRequest request,
  ) async {
    final response = await _apiClient.patch(
      '/queue/$queueEntryId/status',
      data: request.toJson(),
    );

    return QueueEntry.fromJson(response.data as Map<String, dynamic>);
  }
}
