import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Supported Consultation Status matching backend Prisma ConsultationStatus enum
enum ConsultationStatus {
  draft,
  finalized;

  static ConsultationStatus fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'FINALIZED':
        return ConsultationStatus.finalized;
      case 'DRAFT':
      default:
        return ConsultationStatus.draft;
    }
  }

  String toBackendString() {
    switch (this) {
      case ConsultationStatus.finalized:
        return 'FINALIZED';
      case ConsultationStatus.draft:
        return 'DRAFT';
    }
  }

  String get label {
    switch (this) {
      case ConsultationStatus.finalized:
        return 'Finalized';
      case ConsultationStatus.draft:
        return 'Draft';
    }
  }

  Color get color {
    switch (this) {
      case ConsultationStatus.finalized:
        return AppTheme.successGreen;
      case ConsultationStatus.draft:
        return AppTheme.warningAmber;
    }
  }

  IconData get icon {
    switch (this) {
      case ConsultationStatus.finalized:
        return Icons.verified_rounded;
      case ConsultationStatus.draft:
        return Icons.edit_note_rounded;
    }
  }
}

/// Patient summary included in Consultation responses
class ConsultationPatientSummary {
  final String id;
  final String uhid;
  final String fullName;
  final String? gender;
  final String? dateOfBirth;
  final String? phone;

  const ConsultationPatientSummary({
    required this.id,
    required this.uhid,
    required this.fullName,
    this.gender,
    this.dateOfBirth,
    this.phone,
  });

  factory ConsultationPatientSummary.fromJson(Map<String, dynamic> json) {
    return ConsultationPatientSummary(
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

  /// Approximate age derived from date of birth
  int? get age {
    if (dateOfBirth == null || dateOfBirth!.isEmpty) return null;
    try {
      final dob = DateTime.parse(dateOfBirth!);
      final today = DateTime.now();
      int calculated = today.year - dob.year;
      if (today.month < dob.month ||
          (today.month == dob.month && today.day < dob.day)) {
        calculated--;
      }
      return calculated >= 0 ? calculated : null;
    } catch (_) {
      return null;
    }
  }
}

/// Domain model matching backend Prisma Consultation entity
class Consultation {
  final String id;
  final String clinicId;
  final String patientId;
  final String clinicianId;
  final String encounterDate;
  final ConsultationStatus status;
  final String? finalizedAt;

  // Clinical narrative
  final String chiefComplaint;
  final String? symptoms;
  final String? examination;
  final String? diagnosis;
  final String? treatmentPlan;
  final String? followUpDate;

  // Vitals
  final int? bpSystolic;
  final int? bpDiastolic;
  final int? pulse;
  final double? temperature;
  final double? weightKg;
  final double? heightCm;
  final int? spo2;
  final int? respiratoryRate;

  final String createdAt;
  final String updatedAt;
  final ConsultationPatientSummary? patient;

  const Consultation({
    required this.id,
    required this.clinicId,
    required this.patientId,
    required this.clinicianId,
    required this.encounterDate,
    required this.status,
    this.finalizedAt,
    required this.chiefComplaint,
    this.symptoms,
    this.examination,
    this.diagnosis,
    this.treatmentPlan,
    this.followUpDate,
    this.bpSystolic,
    this.bpDiastolic,
    this.pulse,
    this.temperature,
    this.weightKg,
    this.heightCm,
    this.spo2,
    this.respiratoryRate,
    required this.createdAt,
    required this.updatedAt,
    this.patient,
  });

  factory Consultation.fromJson(Map<String, dynamic> json) {
    return Consultation(
      id: json['id'] as String? ?? '',
      clinicId: json['clinicId'] as String? ?? '',
      patientId: json['patientId'] as String? ?? '',
      clinicianId: json['clinicianId'] as String? ?? '',
      encounterDate: json['encounterDate'] as String? ?? '',
      status: ConsultationStatus.fromString(json['status'] as String?),
      finalizedAt: json['finalizedAt'] as String?,
      chiefComplaint: json['chiefComplaint'] as String? ?? '',
      symptoms: json['symptoms'] as String?,
      examination: json['examination'] as String?,
      diagnosis: json['diagnosis'] as String?,
      treatmentPlan: json['treatmentPlan'] as String?,
      followUpDate: json['followUpDate'] as String?,
      bpSystolic: (json['bpSystolic'] as num?)?.toInt(),
      bpDiastolic: (json['bpDiastolic'] as num?)?.toInt(),
      pulse: (json['pulse'] as num?)?.toInt(),
      temperature: (json['temperature'] as num?)?.toDouble(),
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      heightCm: (json['heightCm'] as num?)?.toDouble(),
      spo2: (json['spo2'] as num?)?.toInt(),
      respiratoryRate: (json['respiratoryRate'] as num?)?.toInt(),
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      patient: json['patient'] != null
          ? ConsultationPatientSummary.fromJson(
              json['patient'] as Map<String, dynamic>,
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'clinicId': clinicId,
      'patientId': patientId,
      'clinicianId': clinicianId,
      'encounterDate': encounterDate,
      'status': status.toBackendString(),
      if (finalizedAt != null) 'finalizedAt': finalizedAt,
      'chiefComplaint': chiefComplaint,
      if (symptoms != null) 'symptoms': symptoms,
      if (examination != null) 'examination': examination,
      if (diagnosis != null) 'diagnosis': diagnosis,
      if (treatmentPlan != null) 'treatmentPlan': treatmentPlan,
      if (followUpDate != null) 'followUpDate': followUpDate,
      if (bpSystolic != null) 'bpSystolic': bpSystolic,
      if (bpDiastolic != null) 'bpDiastolic': bpDiastolic,
      if (pulse != null) 'pulse': pulse,
      if (temperature != null) 'temperature': temperature,
      if (weightKg != null) 'weightKg': weightKg,
      if (heightCm != null) 'heightCm': heightCm,
      if (spo2 != null) 'spo2': spo2,
      if (respiratoryRate != null) 'respiratoryRate': respiratoryRate,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      if (patient != null) 'patient': patient!.toJson(),
    };
  }

  /// Whether consultation is in finalized state (strictly immutable)
  bool get isFinalized => status == ConsultationStatus.finalized;

  /// Whether consultation is in draft state (editable by attending doctor)
  bool get isDraft => status == ConsultationStatus.draft;

  /// Whether the user is authorized to edit this draft
  /// (Must be DRAFT status, DOCTOR role, and matching clinicianId)
  bool canEdit(String? currentUserId, String? currentUserRole) {
    if (isFinalized) return false;
    final isDoctorRole = currentUserRole?.toUpperCase() == 'DOCTOR';
    return isDoctorRole && currentUserId == clinicianId;
  }

  /// Whether the user is authorized to finalize this draft
  /// (Must be DRAFT status, DOCTOR role, and matching clinicianId)
  bool canFinalize(String? currentUserId, String? currentUserRole) {
    if (isFinalized) return false;
    final isDoctorRole = currentUserRole?.toUpperCase() == 'DOCTOR';
    return isDoctorRole && currentUserId == clinicianId;
  }

  /// Formatted blood pressure string (e.g. 120/80 mmHg)
  String? get bloodPressureFormatted {
    if (bpSystolic != null && bpDiastolic != null) {
      return '$bpSystolic/$bpDiastolic mmHg';
    } else if (bpSystolic != null) {
      return '$bpSystolic/- mmHg';
    } else if (bpDiastolic != null) {
      return '-/$bpDiastolic mmHg';
    }
    return null;
  }

  /// Calculated Body Mass Index (BMI = kg / m^2)
  double? get bmi {
    if (weightKg != null && heightCm != null && heightCm! > 0) {
      final heightM = heightCm! / 100.0;
      final val = weightKg! / (heightM * heightM);
      return double.parse(val.toStringAsFixed(1));
    }
    return null;
  }

  /// Formatted encounter date string (YYYY-MM-DD)
  String get formattedEncounterDate {
    try {
      final dt = DateTime.parse(encounterDate).toLocal();
      final year = dt.year.toString().padLeft(4, '0');
      final month = dt.month.toString().padLeft(2, '0');
      final day = dt.day.toString().padLeft(2, '0');
      return '$year-$month-$day';
    } catch (_) {
      return encounterDate.length >= 10
          ? encounterDate.substring(0, 10)
          : encounterDate;
    }
  }

  /// Formatted finalized timestamp string
  String? get formattedFinalizedAt {
    if (finalizedAt == null) return null;
    try {
      final dt = DateTime.parse(finalizedAt!).toLocal();
      final year = dt.year.toString().padLeft(4, '0');
      final month = dt.month.toString().padLeft(2, '0');
      final day = dt.day.toString().padLeft(2, '0');
      final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final minute = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$year-$month-$day $hour:$minute $ampm';
    } catch (_) {
      return finalizedAt;
    }
  }
}
