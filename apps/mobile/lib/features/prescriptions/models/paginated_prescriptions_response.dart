import 'prescription.dart';

class PaginatedPrescriptionsResponse {
  final List<Prescription> data;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  const PaginatedPrescriptionsResponse({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  /// Alias for data matching paginated items
  List<Prescription> get items => data;

  factory PaginatedPrescriptionsResponse.fromJson(Map<String, dynamic> json) {
    final rawData = json['data'] ?? json['items'];
    final list = rawData is List
        ? rawData.map((e) => Prescription.fromJson(e as Map<String, dynamic>)).toList()
        : <Prescription>[];

    final meta = json['meta'] as Map<String, dynamic>?;

    return PaginatedPrescriptionsResponse(
      data: list,
      total: (meta?['total'] as num?)?.toInt() ?? list.length,
      page: (meta?['page'] as num?)?.toInt() ?? 1,
      limit: (meta?['limit'] as num?)?.toInt() ?? 20,
      totalPages: (meta?['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

