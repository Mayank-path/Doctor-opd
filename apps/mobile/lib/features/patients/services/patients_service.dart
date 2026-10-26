import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/create_patient_request.dart';
import '../models/paginated_patients_response.dart';
import '../models/patient.dart';
import '../models/patient_consultation_summary.dart';
import '../models/update_patient_request.dart';

/// Patient Management Service coordinating API calls with backend NestJS PatientsController.
class PatientsService {
  final ApiClient _apiClient;

  PatientsService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Searches and lists active, non-deleted patients within the active clinic.
  /// Note: The backend enforces that if 'q' is supplied, it must be at least 2 characters.
  Future<PaginatedPatientsResponse> getPatients({
    int page = 1,
    int limit = 20,
    String? query,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };

    if (query != null && query.trim().length >= 2) {
      queryParams['q'] = query.trim();
    }

    final response = await _apiClient.get(
      '/patients',
      queryParameters: queryParams,
    );

    if (response.data is Map<String, dynamic>) {
      return PaginatedPatientsResponse.fromJson(
        response.data as Map<String, dynamic>,
      );
    }

    return PaginatedPatientsResponse.empty();
  }

  /// Retrieves a single patient by UUID strictly scoped to the active clinic.
  Future<Patient> getPatientById(String id) async {
    final response = await _apiClient.get('/patients/$id');
    return Patient.fromJson(response.data as Map<String, dynamic>);
  }

  /// Registers a new patient within the active clinic.
  /// Returns the newly created Patient with the server-allocated UHID.
  Future<Patient> createPatient(CreatePatientRequest request) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(message: validationErrors.values.first, statusCode: 400);
    }

    final response = await _apiClient.post(
      '/patients',
      data: request.toJson(),
    );

    return Patient.fromJson(response.data as Map<String, dynamic>);
  }

  /// Updates patient demographics in the active clinic.
  Future<Patient> updatePatient(String id, UpdatePatientRequest request) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(message: validationErrors.values.first, statusCode: 400);
    }

    if (!request.hasUpdates) {
      throw ApiException(
        message: 'At least one field must be modified to update',
        statusCode: 400,
      );
    }

    final response = await _apiClient.patch(
      '/patients/$id',
      data: request.toJson(),
    );

    return Patient.fromJson(response.data as Map<String, dynamic>);
  }

  /// Retrieves clinical consultation history for a patient.
  /// Backend strictly requires DOCTOR role.
  Future<List<PatientConsultationSummary>> getPatientConsultationHistory(
    String patientId, {
    int page = 1,
    int limit = 10,
  }) async {
    final response = await _apiClient.get(
      '/patients/$patientId/consultations',
      queryParameters: {'page': page, 'limit': limit},
    );

    if (response.data is Map<String, dynamic>) {
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ?? [];
      return list
          .map((e) => PatientConsultationSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    return [];
  }
}
