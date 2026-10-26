import 'consultation.dart';

/// Paginated consultations response matching backend `PaginatedConsultationResponse<Consultation>`
class PaginatedConsultationsResponse {
  final List<Consultation> data;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  const PaginatedConsultationsResponse({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  factory PaginatedConsultationsResponse.fromJson(Map<String, dynamic> json) {
    final list = (json['data'] as List<dynamic>?) ??
        (json['items'] as List<dynamic>?) ??
        [];

    final items = list
        .map((e) => Consultation.fromJson(e as Map<String, dynamic>))
        .toList();

    final meta = json['meta'] as Map<String, dynamic>?;

    return PaginatedConsultationsResponse(
      data: items,
      total: (meta?['total'] as num?)?.toInt() ??
          (json['total'] as num?)?.toInt() ??
          items.length,
      page: (meta?['page'] as num?)?.toInt() ??
          (json['page'] as num?)?.toInt() ??
          1,
      limit: (meta?['limit'] as num?)?.toInt() ??
          (json['limit'] as num?)?.toInt() ??
          20,
      totalPages: (meta?['totalPages'] as num?)?.toInt() ??
          (json['totalPages'] as num?)?.toInt() ??
          1,
    );
  }
}
