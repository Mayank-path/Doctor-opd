import 'queue_entry.dart';

/// Request DTO for transitioning queue entry status matching backend UpdateQueueStatusDto
class UpdateQueueStatusRequest {
  final QueueStatus status;

  const UpdateQueueStatusRequest({
    required this.status,
  });

  Map<String, dynamic> toJson() {
    return {
      'status': status.toBackendString(),
    };
  }
}
