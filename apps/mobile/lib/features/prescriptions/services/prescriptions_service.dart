import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/amend_prescription_request.dart';
import '../models/approve_prescription_request.dart';
import '../models/create_prescription_request.dart';
import '../models/paginated_prescriptions_response.dart';
import '../models/prescription.dart';
import '../models/update_prescription_request.dart';

/// Service coordinating prescription operations with backend NestJS PrescriptionsController.
class PrescriptionsService {
  final ApiClient _apiClient;

  PrescriptionsService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Creates a new prescription draft (standalone or linked to consultation).
  Future<Prescription> createDraft(CreatePrescriptionRequest request) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        statusCode: 400,
        message: validationErrors.values.first,
      );
    }

    final Response response;
    if (request.consultationId != null &&
        request.consultationId!.trim().isNotEmpty) {
      response = await _apiClient.post(
        '/consultations/${request.consultationId}/prescriptions',
        data: {
          if (request.notes != null) 'notes': request.notes,
          'items': request.items.map((e) => e.toJson()).toList(),
        },
      );
    } else {
      response = await _apiClient.post(
        '/prescriptions',
        data: request.toJson(),
      );
    }

    if (response.data is Map<String, dynamic>) {
      return Prescription.fromJson(response.data as Map<String, dynamic>);
    }

    throw const ApiException(
      statusCode: 500,
      message: 'Invalid response format from server while creating prescription',
    );
  }

  /// Lists prescriptions with optional filters and pagination.
  Future<PaginatedPrescriptionsResponse> getPrescriptions({
    int page = 1,
    int limit = 20,
    String? patientId,
    String? consultationId,
    PrescriptionStatus? status,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };

    if (patientId != null && patientId.isNotEmpty) {
      queryParams['patientId'] = patientId;
    }

    if (consultationId != null && consultationId.isNotEmpty) {
      queryParams['consultationId'] = consultationId;
    }

    if (status != null) {
      queryParams['status'] = status.toBackendString();
    }

    final response = await _apiClient.get(
      '/prescriptions',
      queryParameters: queryParams,
    );

    if (response.data is Map<String, dynamic>) {
      return PaginatedPrescriptionsResponse.fromJson(
        response.data as Map<String, dynamic>,
      );
    }

    return const PaginatedPrescriptionsResponse(
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  /// Retrieves prescriptions specifically linked to a consultation.
  Future<List<Prescription>> getConsultationPrescriptions(
    String consultationId,
  ) async {
    final response = await _apiClient.get(
      '/consultations/$consultationId/prescriptions',
    );

    if (response.data is Map<String, dynamic>) {
      final res = PaginatedPrescriptionsResponse.fromJson(
        response.data as Map<String, dynamic>,
      );
      return res.data;
    }

    return [];
  }

  /// Retrieves single prescription by ID with verified clinic, patient, and doctor models.
  Future<Prescription> getPrescriptionById(String id) async {
    final response = await _apiClient.get('/prescriptions/$id');

    if (response.data is Map<String, dynamic>) {
      return Prescription.fromJson(response.data as Map<String, dynamic>);
    }

    throw const ApiException(
      statusCode: 404,
      message: 'Prescription not found',
    );
  }

  /// Updates notes and items on an existing DRAFT prescription.
  Future<Prescription> updateDraft(
    String id,
    UpdatePrescriptionRequest request,
  ) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        statusCode: 400,
        message: validationErrors.values.first,
      );
    }

    final response = await _apiClient.patch(
      '/prescriptions/$id',
      data: request.toJson(),
    );

    if (response.data is Map<String, dynamic>) {
      return Prescription.fromJson(response.data as Map<String, dynamic>);
    }

    throw const ApiException(
      statusCode: 500,
      message: 'Invalid response format from server while updating prescription draft',
    );
  }

  /// Explicitly approves and locks a prescription draft.
  Future<Prescription> approve(
    String id,
    ApprovePrescriptionRequest request,
  ) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        statusCode: 400,
        message: validationErrors.values.first,
      );
    }

    final response = await _apiClient.post(
      '/prescriptions/$id/approve',
      data: request.toJson(),
    );

    if (response.data is Map<String, dynamic>) {
      return Prescription.fromJson(response.data as Map<String, dynamic>);
    }

    throw const ApiException(
      statusCode: 500,
      message: 'Invalid response format from server while approving prescription',
    );
  }

  /// Creates an amended prescription version (N+1) linked to supersedesPrescriptionId.
  Future<Prescription> amend(
    String id,
    AmendPrescriptionRequest request,
  ) async {
    final validationErrors = request.validate();
    if (validationErrors.isNotEmpty) {
      throw ApiException(
        statusCode: 400,
        message: validationErrors.values.first,
      );
    }

    final response = await _apiClient.post(
      '/prescriptions/$id/amend',
      data: request.toJson(),
    );

    if (response.data is Map<String, dynamic>) {
      return Prescription.fromJson(response.data as Map<String, dynamic>);
    }

    throw const ApiException(
      statusCode: 500,
      message: 'Invalid response format from server while amending prescription',
    );
  }

  /// Streams authenticated binary PDF bytes from the backend.
  Future<Uint8List> downloadPdf(String id) async {
    final response = await _apiClient.get<List<int>>(
      '/prescriptions/$id/pdf',
      options: Options(
        responseType: ResponseType.bytes,
        headers: {'Accept': 'application/pdf'},
      ),
    );

    if (response.data is List<int>) {
      return Uint8List.fromList(response.data!);
    }

    throw const ApiException(
      statusCode: 500,
      message: 'Failed to download PDF binary from server',
    );
  }
}

