import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Supported Appointment Types matching backend AppointmentType enum
enum AppointmentType {
  scheduled,
  walkIn,
  followUp,
  emergency;

  static AppointmentType fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'WALK_IN':
        return AppointmentType.walkIn;
      case 'FOLLOW_UP':
        return AppointmentType.followUp;
      case 'EMERGENCY':
        return AppointmentType.emergency;
      case 'SCHEDULED':
      default:
        return AppointmentType.scheduled;
    }
  }

  String toBackendString() {
    switch (this) {
      case AppointmentType.walkIn:
        return 'WALK_IN';
      case AppointmentType.followUp:
        return 'FOLLOW_UP';
      case AppointmentType.emergency:
        return 'EMERGENCY';
      case AppointmentType.scheduled:
        return 'SCHEDULED';
    }
  }

  String get label {
    switch (this) {
      case AppointmentType.walkIn:
        return 'Walk-in';
      case AppointmentType.followUp:
        return 'Follow-up';
      case AppointmentType.emergency:
        return 'Emergency';
      case AppointmentType.scheduled:
        return 'Scheduled';
    }
  }

  Color get color {
    switch (this) {
      case AppointmentType.walkIn:
        return Colors.orange.shade700;
      case AppointmentType.followUp:
        return AppTheme.accentTeal;
      case AppointmentType.emergency:
        return AppTheme.errorRed;
      case AppointmentType.scheduled:
        return Colors.blue.shade700;
    }
  }
}

/// Supported Appointment Statuses matching backend AppointmentStatus enum
enum AppointmentStatus {
  scheduled,
  confirmed,
  checkedIn,
  inConsultation,
  completed,
  cancelled,
  rescheduled,
  noShow;

  static AppointmentStatus fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'CONFIRMED':
        return AppointmentStatus.confirmed;
      case 'CHECKED_IN':
        return AppointmentStatus.checkedIn;
      case 'IN_CONSULTATION':
        return AppointmentStatus.inConsultation;
      case 'COMPLETED':
        return AppointmentStatus.completed;
      case 'CANCELLED':
        return AppointmentStatus.cancelled;
      case 'RESCHEDULED':
        return AppointmentStatus.rescheduled;
      case 'NO_SHOW':
        return AppointmentStatus.noShow;
      case 'SCHEDULED':
      default:
        return AppointmentStatus.scheduled;
    }
  }

  String toBackendString() {
    switch (this) {
      case AppointmentStatus.confirmed:
        return 'CONFIRMED';
      case AppointmentStatus.checkedIn:
        return 'CHECKED_IN';
      case AppointmentStatus.inConsultation:
        return 'IN_CONSULTATION';
      case AppointmentStatus.completed:
        return 'COMPLETED';
      case AppointmentStatus.cancelled:
        return 'CANCELLED';
      case AppointmentStatus.rescheduled:
        return 'RESCHEDULED';
      case AppointmentStatus.noShow:
        return 'NO_SHOW';
      case AppointmentStatus.scheduled:
        return 'SCHEDULED';
    }
  }

  String get label {
    switch (this) {
      case AppointmentStatus.confirmed:
        return 'Confirmed';
      case AppointmentStatus.checkedIn:
        return 'Checked In';
      case AppointmentStatus.inConsultation:
        return 'In Consultation';
      case AppointmentStatus.completed:
        return 'Completed';
      case AppointmentStatus.cancelled:
        return 'Cancelled';
      case AppointmentStatus.rescheduled:
        return 'Rescheduled';
      case AppointmentStatus.noShow:
        return 'No Show';
      case AppointmentStatus.scheduled:
        return 'Scheduled';
    }
  }

  Color get color {
    switch (this) {
      case AppointmentStatus.confirmed:
        return AppTheme.accentTeal;
      case AppointmentStatus.checkedIn:
        return Colors.amber.shade800;
      case AppointmentStatus.inConsultation:
        return Colors.purple.shade700;
      case AppointmentStatus.completed:
        return AppTheme.successGreen;
      case AppointmentStatus.cancelled:
      case AppointmentStatus.noShow:
        return AppTheme.errorRed;
      case AppointmentStatus.rescheduled:
        return Colors.blueGrey;
      case AppointmentStatus.scheduled:
        return Colors.blue.shade700;
    }
  }
}

/// Patient summary included in Appointment responses
class AppointmentPatientSummary {
  final String id;
  final String uhid;
  final String fullName;
  final String? gender;
  final String? dateOfBirth;
  final String? phone;

  const AppointmentPatientSummary({
    required this.id,
    required this.uhid,
    required this.fullName,
    this.gender,
    this.dateOfBirth,
    this.phone,
  });

  factory AppointmentPatientSummary.fromJson(Map<String, dynamic> json) {
    return AppointmentPatientSummary(
      id: json['id'] as String? ?? '',
      uhid: json['uhid'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
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
}

/// Doctor summary included in Appointment responses
class AppointmentDoctorSummary {
  final String userId;
  final String role;
  final String fullName;
  final String? email;

  const AppointmentDoctorSummary({
    required this.userId,
    required this.role,
    required this.fullName,
    this.email,
  });

  factory AppointmentDoctorSummary.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return AppointmentDoctorSummary(
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

/// Queue entry summary included when appointment is checked in
class AppointmentQueueSummary {
  final String id;
  final int tokenNumber;
  final String status;
  final String? priority;
  final String checkInTime;
  final String? calledAt;

  const AppointmentQueueSummary({
    required this.id,
    required this.tokenNumber,
    required this.status,
    this.priority,
    required this.checkInTime,
    this.calledAt,
  });

  factory AppointmentQueueSummary.fromJson(Map<String, dynamic> json) {
    return AppointmentQueueSummary(
      id: json['id'] as String? ?? '',
      tokenNumber: (json['tokenNumber'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'WAITING',
      priority: json['priority'] as String?,
      checkInTime: json['checkInTime'] as String? ?? '',
      calledAt: json['calledAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tokenNumber': tokenNumber,
      'status': status,
      if (priority != null) 'priority': priority,
      'checkInTime': checkInTime,
      if (calledAt != null) 'calledAt': calledAt,
    };
  }
}

/// Complete Appointment domain model matching backend Prisma Appointment entity
class Appointment {
  final String id;
  final String clinicId;
  final String patientId;
  final String doctorId;
  final String serviceDate;
  final String startTime;
  final String? endTime;
  final AppointmentType type;
  final AppointmentStatus status;
  final String? chiefComplaint;
  final String? notes;
  final String? cancellationReason;
  final String? cancelledAt;
  final String? rescheduledFromId;
  final String createdAt;
  final String updatedAt;
  final AppointmentPatientSummary? patient;
  final AppointmentDoctorSummary? doctor;
  final AppointmentQueueSummary? queueEntry;

  const Appointment({
    required this.id,
    required this.clinicId,
    required this.patientId,
    required this.doctorId,
    required this.serviceDate,
    required this.startTime,
    this.endTime,
    required this.type,
    required this.status,
    this.chiefComplaint,
    this.notes,
    this.cancellationReason,
    this.cancelledAt,
    this.rescheduledFromId,
    required this.createdAt,
    required this.updatedAt,
    this.patient,
    this.doctor,
    this.queueEntry,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'] as String? ?? '',
      clinicId: json['clinicId'] as String? ?? '',
      patientId: json['patientId'] as String? ?? '',
      doctorId: json['doctorId'] as String? ?? '',
      serviceDate: json['serviceDate'] as String? ?? '',
      startTime: json['startTime'] as String? ?? '',
      endTime: json['endTime'] as String?,
      type: AppointmentType.fromString(json['type'] as String?),
      status: AppointmentStatus.fromString(json['status'] as String?),
      chiefComplaint: json['chiefComplaint'] as String?,
      notes: json['notes'] as String?,
      cancellationReason: json['cancellationReason'] as String?,
      cancelledAt: json['cancelledAt'] as String?,
      rescheduledFromId: json['rescheduledFromId'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      patient: json['patient'] != null
          ? AppointmentPatientSummary.fromJson(
              json['patient'] as Map<String, dynamic>)
          : null,
      doctor: json['doctor'] != null
          ? AppointmentDoctorSummary.fromJson(
              json['doctor'] as Map<String, dynamic>)
          : null,
      queueEntry: json['queueEntry'] != null
          ? AppointmentQueueSummary.fromJson(
              json['queueEntry'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'clinicId': clinicId,
      'patientId': patientId,
      'doctorId': doctorId,
      'serviceDate': serviceDate,
      'startTime': startTime,
      if (endTime != null) 'endTime': endTime,
      'type': type.toBackendString(),
      'status': status.toBackendString(),
      if (chiefComplaint != null) 'chiefComplaint': chiefComplaint,
      if (notes != null) 'notes': notes,
      if (cancellationReason != null) 'cancellationReason': cancellationReason,
      if (cancelledAt != null) 'cancelledAt': cancelledAt,
      if (rescheduledFromId != null) 'rescheduledFromId': rescheduledFromId,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      if (patient != null) 'patient': patient!.toJson(),
      if (doctor != null) 'doctor': doctor!.toJson(),
      if (queueEntry != null) 'queueEntry': queueEntry!.toJson(),
    };
  }

  /// Whether this appointment can be rescheduled
  /// (Must be SCHEDULED or CONFIRMED, and not checked-in)
  bool get canReschedule {
    if (status == AppointmentStatus.checkedIn || queueEntry != null) {
      return false;
    }
    return status == AppointmentStatus.scheduled ||
        status == AppointmentStatus.confirmed;
  }

  /// Whether this appointment can be cancelled
  /// (Must not be CHECKED_IN, IN_CONSULTATION, COMPLETED, CANCELLED, or RESCHEDULED)
  bool get canCancel {
    if (status == AppointmentStatus.checkedIn || queueEntry != null) {
      return false;
    }
    return status == AppointmentStatus.scheduled ||
        status == AppointmentStatus.confirmed;
  }

  /// Extracts formatted calendar date (e.g. "26 Oct 2026")
  String get formattedServiceDate {
    try {
      DateTime dt;
      if (serviceDate.contains('T')) {
        dt = DateTime.parse(serviceDate).toLocal();
      } else {
        dt = DateTime.parse('${serviceDate}T00:00:00Z').toLocal();
      }
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return serviceDate;
    }
  }

  /// Formatted single time or time range (e.g. "09:30 AM" or "09:30 AM - 10:00 AM")
  String get formattedTimeRange {
    final start = formatTime(startTime);
    if (endTime != null && endTime!.isNotEmpty) {
      final end = formatTime(endTime!);
      return '$start - $end';
    }
    return start;
  }

  static String formatTime(String isoString) {
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
