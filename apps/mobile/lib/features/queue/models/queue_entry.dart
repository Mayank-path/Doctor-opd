import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Supported Queue Statuses matching backend QueueStatus enum
enum QueueStatus {
  waiting,
  called,
  inConsultation,
  completed,
  skipped,
  cancelled;

  static QueueStatus fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'CALLED':
        return QueueStatus.called;
      case 'IN_CONSULTATION':
        return QueueStatus.inConsultation;
      case 'COMPLETED':
        return QueueStatus.completed;
      case 'SKIPPED':
        return QueueStatus.skipped;
      case 'CANCELLED':
        return QueueStatus.cancelled;
      case 'WAITING':
      default:
        return QueueStatus.waiting;
    }
  }

  String toBackendString() {
    switch (this) {
      case QueueStatus.called:
        return 'CALLED';
      case QueueStatus.inConsultation:
        return 'IN_CONSULTATION';
      case QueueStatus.completed:
        return 'COMPLETED';
      case QueueStatus.skipped:
        return 'SKIPPED';
      case QueueStatus.cancelled:
        return 'CANCELLED';
      case QueueStatus.waiting:
        return 'WAITING';
    }
  }

  String get label {
    switch (this) {
      case QueueStatus.called:
        return 'Called';
      case QueueStatus.inConsultation:
        return 'In Consultation';
      case QueueStatus.completed:
        return 'Completed';
      case QueueStatus.skipped:
        return 'Skipped';
      case QueueStatus.cancelled:
        return 'Cancelled';
      case QueueStatus.waiting:
        return 'Waiting';
    }
  }

  Color get color {
    switch (this) {
      case QueueStatus.called:
        return Colors.blue.shade700;
      case QueueStatus.inConsultation:
        return Colors.purple.shade700;
      case QueueStatus.completed:
        return AppTheme.successGreen;
      case QueueStatus.skipped:
        return Colors.orange.shade800;
      case QueueStatus.cancelled:
        return AppTheme.errorRed;
      case QueueStatus.waiting:
        return Colors.amber.shade800;
    }
  }

  IconData get icon {
    switch (this) {
      case QueueStatus.called:
        return Icons.record_voice_over_rounded;
      case QueueStatus.inConsultation:
        return Icons.medical_information_rounded;
      case QueueStatus.completed:
        return Icons.check_circle_rounded;
      case QueueStatus.skipped:
        return Icons.redo_rounded;
      case QueueStatus.cancelled:
        return Icons.cancel_rounded;
      case QueueStatus.waiting:
        return Icons.hourglass_top_rounded;
    }
  }
}

/// Patient summary included in OpdQueueEntry responses
class QueuePatientSummary {
  final String id;
  final String uhid;
  final String fullName;
  final String? gender;
  final String? dateOfBirth;
  final String? phone;

  const QueuePatientSummary({
    required this.id,
    required this.uhid,
    required this.fullName,
    this.gender,
    this.dateOfBirth,
    this.phone,
  });

  factory QueuePatientSummary.fromJson(Map<String, dynamic> json) {
    return QueuePatientSummary(
      id: json['id'] as String? ?? '',
      uhid: json['uhid'] as String? ?? '',
      fullName: json['fullName'] as String? ?? 'Patient',
      gender: json['gender'] as String?,
      dateOfBirth: json['dateOfBirth'] as String?,
      phone: json['phone'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'uhid': uhid,
      'fullName': fullName,
      if (gender != null) 'gender': gender,
      if (dateOfBirth != null) 'dateOfBirth': dateOfBirth,
      if (phone != null) 'phone': phone,
    };
  }

  /// Calculates approximate age from dateOfBirth if available
  int? get ageYears {
    if (dateOfBirth == null || dateOfBirth!.isEmpty) return null;
    try {
      final dob = DateTime.parse(dateOfBirth!);
      final today = DateTime.now();
      int calculatedAge = today.year - dob.year;
      if (today.month < dob.month ||
          (today.month == dob.month && today.day < dob.day)) {
        calculatedAge--;
      }
      return calculatedAge >= 0 ? calculatedAge : null;
    } catch (_) {
      return null;
    }
  }
}

/// Doctor summary included in OpdQueueEntry responses
class QueueDoctorSummary {
  final String userId;
  final String role;
  final String fullName;
  final String? email;

  const QueueDoctorSummary({
    required this.userId,
    required this.role,
    required this.fullName,
    this.email,
  });

  factory QueueDoctorSummary.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return QueueDoctorSummary(
      userId: json['userId'] as String? ?? '',
      role: json['role'] as String? ?? 'DOCTOR',
      fullName: user?['fullName'] as String? ?? 'Doctor',
      email: user?['email'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'role': role,
      'user': {
        'id': userId,
        'fullName': fullName,
        if (email != null) 'email': email,
      },
    };
  }
}

/// Appointment summary included in OpdQueueEntry responses when linked
class QueueAppointmentSummary {
  final String id;
  final String? startTime;
  final String? endTime;
  final String? type;
  final String? status;
  final String? chiefComplaint;

  const QueueAppointmentSummary({
    required this.id,
    this.startTime,
    this.endTime,
    this.type,
    this.status,
    this.chiefComplaint,
  });

  factory QueueAppointmentSummary.fromJson(Map<String, dynamic> json) {
    return QueueAppointmentSummary(
      id: json['id'] as String? ?? '',
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
      type: json['type'] as String?,
      status: json['status'] as String?,
      chiefComplaint: json['chiefComplaint'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      if (startTime != null) 'startTime': startTime,
      if (endTime != null) 'endTime': endTime,
      if (type != null) 'type': type,
      if (status != null) 'status': status,
      if (chiefComplaint != null) 'chiefComplaint': chiefComplaint,
    };
  }

  /// Formatted appointment time range string (e.g. 10:00 AM - 10:30 AM)
  String get formattedTimeRange {
    if (startTime == null) return 'Appt Linked';
    try {
      final startDt = DateTime.parse(startTime!).toLocal();
      final startHour = startDt.hour % 12 == 0 ? 12 : startDt.hour % 12;
      final startMin = startDt.minute.toString().padLeft(2, '0');
      final startAmpm = startDt.hour >= 12 ? 'PM' : 'AM';
      final startStr = '$startHour:$startMin $startAmpm';

      if (endTime == null) return startStr;
      final endDt = DateTime.parse(endTime!).toLocal();
      final endHour = endDt.hour % 12 == 0 ? 12 : endDt.hour % 12;
      final endMin = endDt.minute.toString().padLeft(2, '0');
      final endAmpm = endDt.hour >= 12 ? 'PM' : 'AM';
      final endStr = '$endHour:$endMin $endAmpm';
      return '$startStr - $endStr';
    } catch (_) {
      return 'Appt Linked';
    }
  }
}

/// Complete OPD Queue Entry model matching backend Prisma OpdQueueEntry entity
class QueueEntry {
  final String id;
  final String clinicId;
  final String patientId;
  final String doctorId;
  final String? appointmentId;
  final String? idempotencyKey;
  final String serviceDate;
  final int tokenNumber;
  final QueueStatus status;
  final int priority;
  final String checkInTime;
  final String? calledAt;
  final String? consultationStartTime;
  final String? consultationEndTime;
  final String createdAt;
  final String updatedAt;
  final QueuePatientSummary? patient;
  final QueueDoctorSummary? doctor;
  final QueueAppointmentSummary? appointment;

  const QueueEntry({
    required this.id,
    required this.clinicId,
    required this.patientId,
    required this.doctorId,
    this.appointmentId,
    this.idempotencyKey,
    required this.serviceDate,
    required this.tokenNumber,
    required this.status,
    required this.priority,
    required this.checkInTime,
    this.calledAt,
    this.consultationStartTime,
    this.consultationEndTime,
    required this.createdAt,
    required this.updatedAt,
    this.patient,
    this.doctor,
    this.appointment,
  });

  factory QueueEntry.fromJson(Map<String, dynamic> json) {
    return QueueEntry(
      id: json['id'] as String? ?? '',
      clinicId: json['clinicId'] as String? ?? '',
      patientId: json['patientId'] as String? ?? '',
      doctorId: json['doctorId'] as String? ?? '',
      appointmentId: json['appointmentId'] as String?,
      idempotencyKey: json['idempotencyKey'] as String?,
      serviceDate: json['serviceDate'] as String? ?? '',
      tokenNumber: (json['tokenNumber'] as num?)?.toInt() ?? 0,
      status: QueueStatus.fromString(json['status'] as String?),
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      checkInTime: json['checkInTime'] as String? ?? '',
      calledAt: json['calledAt'] as String?,
      consultationStartTime: json['consultationStartTime'] as String?,
      consultationEndTime: json['consultationEndTime'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      patient: json['patient'] != null
          ? QueuePatientSummary.fromJson(json['patient'] as Map<String, dynamic>)
          : null,
      doctor: json['doctor'] != null
          ? QueueDoctorSummary.fromJson(json['doctor'] as Map<String, dynamic>)
          : null,
      appointment: json['appointment'] != null
          ? QueueAppointmentSummary.fromJson(
              json['appointment'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'clinicId': clinicId,
      'patientId': patientId,
      'doctorId': doctorId,
      if (appointmentId != null) 'appointmentId': appointmentId,
      if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      'serviceDate': serviceDate,
      'tokenNumber': tokenNumber,
      'status': status.toBackendString(),
      'priority': priority,
      'checkInTime': checkInTime,
      if (calledAt != null) 'calledAt': calledAt,
      if (consultationStartTime != null)
        'consultationStartTime': consultationStartTime,
      if (consultationEndTime != null)
        'consultationEndTime': consultationEndTime,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      if (patient != null) 'patient': patient!.toJson(),
      if (doctor != null) 'doctor': doctor!.toJson(),
      if (appointment != null) 'appointment': appointment!.toJson(),
    };
  }

  /// Whether this entry is in waiting status
  bool get isWaiting => status == QueueStatus.waiting;

  /// Whether this entry is in a terminal state
  bool get isTerminal =>
      status == QueueStatus.completed || status == QueueStatus.cancelled;

  /// Whether this entry can be called by clinician / receptionist
  bool get canCall =>
      status == QueueStatus.waiting ||
      status == QueueStatus.called ||
      status == QueueStatus.skipped;

  /// Whether consultation can be started
  /// (Strict backend rule: Must be CALLED, and only assigned DOCTOR can start)
  bool canStartConsultation(String? currentUserId, String? currentUserRole) {
    if (status != QueueStatus.called) return false;
    final isDoctorRole = currentUserRole?.toUpperCase() == 'DOCTOR';
    return isDoctorRole && currentUserId == doctorId;
  }

  /// Whether consultation can be completed
  /// (Strict backend rule: Must be IN_CONSULTATION, and only assigned DOCTOR can complete)
  bool canComplete(String? currentUserId, String? currentUserRole) {
    if (status != QueueStatus.inConsultation) return false;
    final isDoctorRole = currentUserRole?.toUpperCase() == 'DOCTOR';
    return isDoctorRole && currentUserId == doctorId;
  }

  /// Whether this entry can be skipped
  bool get canSkip =>
      status == QueueStatus.waiting || status == QueueStatus.called;

  /// Whether this entry can be cancelled
  bool get canCancel => !isTerminal;

  /// Whether this entry is linked to an appointment
  bool get isAppointmentCheckIn => appointmentId != null;

  /// Formats check-in timestamp
  String get formattedCheckInTime => _formatTime(checkInTime);

  /// Formats called timestamp
  String? get formattedCalledAt =>
      calledAt != null ? _formatTime(calledAt!) : null;

  /// Formats consultation start timestamp
  String? get formattedConsultationStartTime =>
      consultationStartTime != null ? _formatTime(consultationStartTime!) : null;

  /// Formats consultation end timestamp
  String? get formattedConsultationEndTime =>
      consultationEndTime != null ? _formatTime(consultationEndTime!) : null;

  static String _formatTime(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final minute = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$hour:$minute $ampm';
    } catch (_) {
      return isoString;
    }
  }
}
