import 'appointment.dart';

/// Pagination metadata accompanying appointment responses
class AppointmentPaginationMeta {
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const AppointmentPaginationMeta({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory AppointmentPaginationMeta.fromJson(Map<String, dynamic> json) {
    return AppointmentPaginationMeta(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'page': page,
      'limit': limit,
      'total': total,
      'totalPages': totalPages,
    };
  }

  bool get hasNextPage => page < totalPages;
}

/// Paginated appointments response matching backend PaginatedAppointmentResponse
class PaginatedAppointmentsResponse {
  final List<Appointment> data;
  final AppointmentPaginationMeta meta;

  const PaginatedAppointmentsResponse({
    required this.data,
    required this.meta,
  });

  factory PaginatedAppointmentsResponse.fromJson(Map<String, dynamic> json) {
    final rawList = json['data'] as List<dynamic>? ??
        json['items'] as List<dynamic>? ??
        [];
    final appointments = rawList
        .map((item) => Appointment.fromJson(item as Map<String, dynamic>))
        .toList();

    final metaJson = json['meta'] as Map<String, dynamic>? ?? {};
    final meta = AppointmentPaginationMeta.fromJson(metaJson);

    return PaginatedAppointmentsResponse(
      data: appointments,
      meta: meta,
    );
  }

  factory PaginatedAppointmentsResponse.empty() {
    return const PaginatedAppointmentsResponse(
      data: [],
      meta: AppointmentPaginationMeta(page: 1, limit: 20, total: 0, totalPages: 1),
    );
  }
}
