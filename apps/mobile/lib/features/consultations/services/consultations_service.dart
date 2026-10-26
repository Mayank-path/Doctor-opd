import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/consultation.dart';
import '../models/create_consultation_request.dart';
import '../models/paginated_consultations_response.dart';
import '../models/update_consultation_request.dart';

/// Service coordinating clinical consultation operations with backend NestJS ConsultationsController.
///
/// Security & Multi-tenancy:
/// - Every request uses ApiClient which attaches the active clinic ID via `x-clinic-id`.
/// - Every consultation endpoint strictly requires the authenticated DOCTOR role.
/// - Clinical narratives are never logged or stored insecurely.
class ConsultationsService {
  final ApiClient _apiClient;

  ConsultationsService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Creates a new clinical consultation draft for an existing patient.
  /// Backend strictly requires ACTIVE DOCTOR membership in the active clinic.
  Future<Consultation> createDraft(CreateConsultationRequest request) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        statusCode: 400,
        message: validationErrors.values.first,
      );
    }

    final response = await _apiClient.post(
      '/consultations',
      data: request.toJson(),
    );

    if (response.data is Map<String, dynamic>) {
      return Consultation.fromJson(response.data as Map<String, dynamic>);
    }

    throw ApiException(
      statusCode: 500,
      message: 'Invalid response format from server while creating consultation draft',
    );
  }

  /// Lists consultations for the active clinic with optional filters and pagination.
  Future<PaginatedConsultationsResponse> getConsultations({
    int page = 1,
    int limit = 20,
    ConsultationStatus? status,
    String? patientId,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };

    if (status != null) {
      queryParams['status'] = status.toBackendString();
    }

    if (patientId != null && patientId.isNotEmpty) {
      queryParams['patientId'] = patientId;
    }

    final response = await _apiClient.get(
      '/consultations',
      queryParameters: queryParams,
    );

    if (response.data is Map<String, dynamic>) {
      return PaginatedConsultationsResponse.fromJson(
        response.data as Map<String, dynamic>,
      );
    }

    return const PaginatedConsultationsResponse(
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  /// Retrieves consultation details by ID strictly scoped to active clinic.
  Future<Consultation> getConsultationById(String id) async {
    final response = await _apiClient.get('/consultations/$id');

    if (response.data is Map<String, dynamic>) {
      return Consultation.fromJson(response.data as Map<String, dynamic>);
    }

    throw ApiException(
      statusCode: 404,
      message: 'Consultation not found',
    );
  }

  /// Updates clinical narrative and vital signs on an existing consultation draft.
  /// Strict backend rules:
  /// - Only assigned clinician may update (403 Forbidden).
  /// - Cannot edit a finalized consultation (409 Conflict).
  /// - Concurrency-safe atomic compare-and-swap.
  Future<Consultation> updateDraft(
    String id,
    UpdateConsultationRequest request,
  ) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        statusCode: 400,
        message: validationErrors.values.first,
      );
    }

    final response = await _apiClient.patch(
      '/consultations/$id',
      data: request.toJson(),
    );

    if (response.data is Map<String, dynamic>) {
      return Consultation.fromJson(response.data as Map<String, dynamic>);
    }

    throw ApiException(
      statusCode: 500,
      message: 'Invalid response format from server while updating consultation draft',
    );
  }

  /// Finalizes an active consultation draft, transitioning its status to FINALIZED
  /// and setting finalizedAt timestamp to server time.
  /// Also transactionally completes any associated walk-in queue entry on the backend.
  /// Strict backend rules:
  /// - Only assigned clinician can finalize (403 Forbidden).
  /// - Cannot finalize an already finalized consultation (409 Conflict).
  Future<Consultation> finalize(String id) async {
    final response = await _apiClient.post(
      '/consultations/$id/finalize',
      data: {},
    );

    if (response.data is Map<String, dynamic>) {
      return Consultation.fromJson(response.data as Map<String, dynamic>);
    }

    throw ApiException(
      statusCode: 500,
      message: 'Invalid response format from server while finalizing consultation',
    );
  }

  /// Retrieves consultation visit history for a specific patient within the active clinic.
  Future<PaginatedConsultationsResponse> getPatientHistory(
    String patientId, {
    int page = 1,
    int limit = 20,
    ConsultationStatus? status,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };

    if (status != null) {
      queryParams['status'] = status.toBackendString();
    }

    final response = await _apiClient.get(
      '/patients/$patientId/consultations',
      queryParameters: queryParams,
    );

    if (response.data is Map<String, dynamic>) {
      return PaginatedConsultationsResponse.fromJson(
        response.data as Map<String, dynamic>,
      );
    }

    return const PaginatedConsultationsResponse(
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  /// Helper to find an active DRAFT consultation for a patient by the attending doctor,
  /// avoiding redundant orphan drafts.
  Future<Consultation?> findActiveDraftForPatient(String patientId) async {
    try {
      final res = await getConsultations(
        patientId: patientId,
        status: ConsultationStatus.draft,
        limit: 1,
      );
      if (res.data.isNotEmpty) {
        return res.data.first;
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
