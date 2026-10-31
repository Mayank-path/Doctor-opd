import 'package:dio/dio.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/differential_evaluation_models.dart';

/// Service managing communication with the backend Differential Diagnosis AST Evaluation API.
class DifferentialDiagnosisService {
  final ApiClient _apiClient;

  static const int maxFindingsAllowed = 50;

  DifferentialDiagnosisService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Submits structured clinical findings, vitals, demographics, and infection suspicion
  /// to the backend deterministic AST evaluator.
  ///
  /// Requirements:
  /// - [request.patientId] must be a valid registered patient UUID.
  /// - [request.findings] cannot exceed 50 entries.
  /// - Attaches Bearer authentication token and active clinic selector (x-clinic-id)
  ///   via [AuthInterceptor].
  Future<DifferentialEvaluationResponse> evaluateDifferential(
    EvaluateDifferentialRequest request,
  ) async {
    // 1. Client-side input validation
    if (request.patientId.trim().isEmpty) {
      throw const BadRequestException(
        message: 'A registered patient must be specified for differential evaluation.',
      );
    }

    if (request.findings.length > maxFindingsAllowed) {
      throw const BadRequestException(
        message: 'Findings count cannot exceed 50 items.',
      );
    }

    // 2. Post to backend endpoint
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/clinical-assist/differential-diagnosis/evaluate',
        data: request.toJson(),
        options: Options(
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
        ),
      );

      final data = response.data;
      if (data == null) {
        throw const ApiException(
          message: 'Received empty response body from differential diagnosis server.',
        );
      }

      return DifferentialEvaluationResponse.fromJson(data);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        message: 'Differential diagnosis evaluation failed: ${e.toString()}',
      );
    }
  }

  /// Retrieves an existing differential diagnosis evaluation audit record by ID.
  Future<Map<String, dynamic>> getDifferentialEvaluation(String id) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/clinical-assist/differential-diagnosis/$id',
      );
      return response.data ?? {};
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        message: 'Failed to retrieve differential diagnosis audit: ${e.toString()}',
      );
    }
  }

  /// Submits doctor review decisions on candidate differential diagnoses for an evaluation audit.
  Future<Map<String, dynamic>> submitDifferentialReview({
    required String id,
    required List<Map<String, dynamic>> decisions,
    String? reviewNotes,
    String? consultationId,
    String? patientId,
  }) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/clinical-assist/differential-diagnosis/$id/review',
        data: {
          'decisions': decisions,
          if (reviewNotes != null && reviewNotes.isNotEmpty)
            'reviewNotes': reviewNotes,
          if (consultationId != null) 'consultationId': consultationId,
          if (patientId != null) 'patientId': patientId,
        },
      );
      return response.data ?? {};
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        message: 'Failed to record differential diagnosis review: ${e.toString()}',
      );
    }
  }

  /// Lists available clinical knowledge packs for the active clinic.
  Future<List<dynamic>> listKnowledgePacks() async {
    try {
      final response = await _apiClient.get<List<dynamic>>(
        '/clinical-assist/knowledge-packs',
      );
      return response.data ?? [];
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        message: 'Failed to list clinical knowledge packs: ${e.toString()}',
      );
    }
  }

  /// Retrieves version metadata for a specified knowledge pack.
  Future<Map<String, dynamic>> getKnowledgePackVersion(String id) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/clinical-assist/knowledge-packs/$id/version',
      );
      return response.data ?? {};
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        message: 'Failed to retrieve knowledge pack version: ${e.toString()}',
      );
    }
  }
}

