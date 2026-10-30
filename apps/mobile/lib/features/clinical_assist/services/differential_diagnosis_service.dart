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
}

