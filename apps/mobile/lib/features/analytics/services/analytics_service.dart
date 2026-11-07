import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/disease_search.dart';
import '../models/practice_analytics.dart';

/// Service coordinating practice and revenue analytics with NestJS backend AnalyticsController.
///
/// Multi-tenancy & Security:
/// - Handled via ApiClient which attaches JWT token and `x-clinic-id`.
/// - Access is strictly authorized for DOCTOR and ADMIN memberships.
class AnalyticsService {
  final ApiClient _apiClient;

  AnalyticsService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  Map<String, dynamic> _buildQueryParams(
    String period,
    DateTime? startDate,
    DateTime? endDate,
  ) {
    final params = <String, dynamic>{'period': period};
    if (period == 'custom' && startDate != null && endDate != null) {
      params['startDate'] = startDate.toIso8601String();
      params['endDate'] = endDate.toIso8601String();
    }
    return params;
  }

  /// Fetch practice performance overview.
  Future<PracticeOverview> fetchOverview({
    String period = '30d',
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final params = _buildQueryParams(period, startDate, endDate);
    final response = await _apiClient.get(
      '/analytics/overview',
      queryParameters: params,
    );

    if (response.data is Map<String, dynamic>) {
      return PracticeOverview.fromJson(response.data as Map<String, dynamic>);
    }
    throw const ApiException(
      message: 'Invalid response format for practice overview',
      statusCode: 500,
    );
  }

  /// Fetch detailed patient growth, return rates, and daily consultation trends.
  Future<PatientAnalytics> fetchPatientAnalytics({
    String period = '30d',
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final params = _buildQueryParams(period, startDate, endDate);
    final response = await _apiClient.get(
      '/analytics/patients',
      queryParameters: params,
    );

    if (response.data is Map<String, dynamic>) {
      return PatientAnalytics.fromJson(response.data as Map<String, dynamic>);
    }
    throw const ApiException(
      message: 'Invalid response format for patient analytics',
      statusCode: 500,
    );
  }

  /// Fetch practice collected revenue, payment methods distribution, and trend timelines.
  Future<RevenueAnalytics> fetchRevenueAnalytics({
    String period = '30d',
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final params = _buildQueryParams(period, startDate, endDate);
    final response = await _apiClient.get(
      '/analytics/revenue',
      queryParameters: params,
    );

    if (response.data is Map<String, dynamic>) {
      return RevenueAnalytics.fromJson(response.data as Map<String, dynamic>);
    }
    throw const ApiException(
      message: 'Invalid response format for revenue analytics',
      statusCode: 500,
    );
  }

  /// Record a payment for a consultation.
  Future<Map<String, dynamic>> recordPayment({
    String? consultationId,
    String? patientId,
    required double amount,
    required String method,
    String status = 'COMPLETED',
    String? notes,
    String? idempotencyKey,
  }) async {
    final body = <String, dynamic>{
      'amount': amount,
      'method': method,
      'status': status,
    };
    if (consultationId != null) body['consultationId'] = consultationId;
    if (patientId != null) body['patientId'] = patientId;
    if (notes != null) body['notes'] = notes;
    if (idempotencyKey != null) body['idempotencyKey'] = idempotencyKey;

    final response = await _apiClient.post('/payments', data: body);
    if (response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    throw const ApiException(
      message: 'Invalid response format for payment creation',
      statusCode: 500,
    );
  }

  /// Search historical clinical consultation records by disease or clinical term.
  /// Scoped to active clinic, FINALIZED records only.
  Future<DiseaseSearchResponse> searchDiseases({
    required String q,
    String? period,
    DateTime? startDate,
    DateTime? endDate,
    int page = 1,
    int limit = 20,
  }) async {
    final params = <String, dynamic>{
      'q': q,
      'page': page,
      'limit': limit,
    };
    if (period != null && period.isNotEmpty) {
      params['period'] = period;
    }
    if (period == 'custom' && startDate != null && endDate != null) {
      params['startDate'] = startDate.toIso8601String();
      params['endDate'] = endDate.toIso8601String();
    }

    final response = await _apiClient.get(
      '/analytics/disease-search',
      queryParameters: params,
    );

    if (response.data is Map<String, dynamic>) {
      return DiseaseSearchResponse.fromJson(response.data as Map<String, dynamic>);
    }
    throw const ApiException(
      message: 'Invalid response format for disease search',
      statusCode: 500,
    );
  }

  /// Fetch disease search suggestions derived from clinic's existing diagnoses.
  Future<List<String>> fetchDiseaseSuggestions({String? q}) async {
    final params = <String, dynamic>{};
    if (q != null && q.isNotEmpty) {
      params['q'] = q;
    }
    final response = await _apiClient.get(
      '/analytics/disease-search/suggestions',
      queryParameters: params,
    );

    if (response.data is Map<String, dynamic>) {
      final res = DiseaseSuggestionsResponse.fromJson(response.data as Map<String, dynamic>);
      return res.suggestions;
    }
    return [];
  }
}


