import 'patient.dart';

/// Pagination metadata matching backend PaginatedPatientResponse meta structure.
class PaginationMeta {
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const PaginationMeta({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  bool get hasNextPage => page < totalPages;

  factory PaginationMeta.fromJson(Map<String, dynamic> json) {
    return PaginationMeta(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  factory PaginationMeta.empty() {
    return const PaginationMeta(page: 1, limit: 20, total: 0, totalPages: 1);
  }
}

/// Paginated patient response matching backend GET /patients contract.
class PaginatedPatientsResponse {
  final List<Patient> data;
  final PaginationMeta meta;

  const PaginatedPatientsResponse({
    required this.data,
    required this.meta,
  });

  factory PaginatedPatientsResponse.fromJson(Map<String, dynamic> json) {
    final list = json['data'] as List<dynamic>? ?? [];
    final patients = list
        .map((e) => Patient.fromJson(e as Map<String, dynamic>))
        .toList();
    final metaMap = json['meta'] as Map<String, dynamic>? ?? {};

    return PaginatedPatientsResponse(
      data: patients,
      meta: PaginationMeta.fromJson(metaMap),
    );
  }

  factory PaginatedPatientsResponse.empty() {
    return PaginatedPatientsResponse(
      data: const [],
      meta: PaginationMeta.empty(),
    );
  }
}
