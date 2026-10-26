import 'queue_entry.dart';

/// Response payload returned by GET /queue matching backend response shape
class QueueListResponse {
  final List<QueueEntry> data;
  final int total;

  const QueueListResponse({
    required this.data,
    required this.total,
  });

  factory QueueListResponse.fromJson(Map<String, dynamic> json) {
    final rawList = json['data'] as List<dynamic>? ??
        json['items'] as List<dynamic>? ??
        [];
    final entries = rawList
        .map((item) => QueueEntry.fromJson(item as Map<String, dynamic>))
        .toList();

    final total = (json['total'] as num?)?.toInt() ?? entries.length;

    return QueueListResponse(
      data: entries,
      total: total,
    );
  }

  factory QueueListResponse.empty() {
    return const QueueListResponse(
      data: [],
      total: 0,
    );
  }

  // Summary counts for convenience
  int get waitingCount =>
      data.where((e) => e.status == QueueStatus.waiting).length;
  int get calledCount =>
      data.where((e) => e.status == QueueStatus.called).length;
  int get inConsultationCount =>
      data.where((e) => e.status == QueueStatus.inConsultation).length;
  int get completedCount =>
      data.where((e) => e.status == QueueStatus.completed).length;
  int get skippedCount =>
      data.where((e) => e.status == QueueStatus.skipped).length;
  int get cancelledCount =>
      data.where((e) => e.status == QueueStatus.cancelled).length;
}
