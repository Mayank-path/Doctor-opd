import 'package:intl/intl.dart';
import '../../patients/models/patient.dart';
import 'prescription_item.dart';

enum PrescriptionStatus {
  draft,
  approved,
  superseded,
  cancelled;

  String toBackendString() => name.toUpperCase();

  String get displayName {
    switch (this) {
      case PrescriptionStatus.draft:
        return 'Draft';
      case PrescriptionStatus.approved:
        return 'Approved';
      case PrescriptionStatus.superseded:
        return 'Superseded';
      case PrescriptionStatus.cancelled:
        return 'Cancelled';
    }
  }

  static PrescriptionStatus fromString(String? value) {
    if (value == null) return PrescriptionStatus.draft;
    final normalized = value.trim().toUpperCase();
    return PrescriptionStatus.values.firstWhere(
      (e) => e.toBackendString() == normalized,
      orElse: () => PrescriptionStatus.draft,
    );
  }
}

/// Lightweight consultation summary attached to prescription responses
class PrescriptionConsultationSummary {
  final String id;
  final DateTime? encounterDate;
  final String? chiefComplaint;
  final String? diagnosis;
  final int? bpSystolic;
  final int? bpDiastolic;
  final int? pulse;
  final double? temperature;
  final int? spo2;
  final double? weightKg;
  final double? heightCm;

  const PrescriptionConsultationSummary({
    required this.id,
    this.encounterDate,
    this.chiefComplaint,
    this.diagnosis,
    this.bpSystolic,
    this.bpDiastolic,
    this.pulse,
    this.temperature,
    this.spo2,
    this.weightKg,
    this.heightCm,
  });

  factory PrescriptionConsultationSummary.fromJson(Map<String, dynamic> json) {
    return PrescriptionConsultationSummary(
      id: json['id'] as String? ?? '',
      encounterDate: json['encounterDate'] != null
          ? DateTime.tryParse(json['encounterDate'].toString())
          : null,
      chiefComplaint: json['chiefComplaint'] as String?,
      diagnosis: json['diagnosis'] as String?,
      bpSystolic: (json['bpSystolic'] as num?)?.toInt(),
      bpDiastolic: (json['bpDiastolic'] as num?)?.toInt(),
      pulse: (json['pulse'] as num?)?.toInt(),
      temperature: (json['temperature'] as num?)?.toDouble(),
      spo2: (json['spo2'] as num?)?.toInt(),
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      heightCm: (json['heightCm'] as num?)?.toDouble(),
    );
  }
}

/// Doctor summary attached to prescription responses
class PrescriptionDoctorSummary {
  final String? id;
  final String? userId;
  final String? role;
  final String fullName;
  final String? email;
  final String? phone;

  const PrescriptionDoctorSummary({
    this.id,
    this.userId,
    this.role,
    required this.fullName,
    this.email,
    this.phone,
  });

  factory PrescriptionDoctorSummary.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return PrescriptionDoctorSummary(
      id: json['id'] as String?,
      userId: json['userId'] as String?,
      role: json['role'] as String?,
      fullName: user?['fullName'] as String? ?? json['fullName'] as String? ?? 'Doctor',
      email: user?['email'] as String?,
      phone: user?['phone'] as String?,
    );
  }
}

/// Core domain entity for a clinical prescription.
class Prescription {
  final String id;
  final String clinicId;
  final String patientId;
  final String? consultationId;
  final String doctorId;
  final int versionNumber;
  final PrescriptionStatus status;
  final String? supersedesPrescriptionId;
  final String? amendmentReason;
  final String? notes;
  final DateTime? approvedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  final Patient? patient;
  final PrescriptionDoctorSummary? doctor;
  final PrescriptionConsultationSummary? consultation;
  final List<PrescriptionItem> items;

  const Prescription({
    required this.id,
    required this.clinicId,
    required this.patientId,
    this.consultationId,
    required this.doctorId,
    this.versionNumber = 1,
    this.status = PrescriptionStatus.draft,
    this.supersedesPrescriptionId,
    this.amendmentReason,
    this.notes,
    this.approvedAt,
    required this.createdAt,
    required this.updatedAt,
    this.patient,
    this.doctor,
    this.consultation,
    this.items = const [],
  });

  bool get isDraft => status == PrescriptionStatus.draft;
  bool get isApproved => status == PrescriptionStatus.approved;
  bool get isSuperseded => status == PrescriptionStatus.superseded;
  bool get isCancelled => status == PrescriptionStatus.cancelled;
  int get amendmentVersion => versionNumber;

  String get formattedCreatedAt => DateFormat('MMM dd, yyyy • hh:mm a').format(createdAt);
  String? get formattedApprovedAt =>
      approvedAt != null ? DateFormat('MMM dd, yyyy • hh:mm a').format(approvedAt!) : null;

  factory Prescription.fromJson(Map<String, dynamic> json) {
    return Prescription(
      id: json['id'] as String? ?? '',
      clinicId: json['clinicId'] as String? ?? '',
      patientId: json['patientId'] as String? ?? '',
      consultationId: json['consultationId'] as String?,
      doctorId: json['doctorId'] as String? ?? '',
      versionNumber: (json['versionNumber'] as num?)?.toInt() ?? 1,
      status: PrescriptionStatus.fromString(json['status'] as String?),
      supersedesPrescriptionId: json['supersedesPrescriptionId'] as String?,
      amendmentReason: json['amendmentReason'] as String?,
      notes: json['notes'] as String?,
      approvedAt: json['approvedAt'] != null
          ? DateTime.tryParse(json['approvedAt'].toString())
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      patient: json['patient'] is Map<String, dynamic>
          ? Patient.fromJson(json['patient'] as Map<String, dynamic>)
          : null,
      doctor: json['doctor'] is Map<String, dynamic>
          ? PrescriptionDoctorSummary.fromJson(json['doctor'] as Map<String, dynamic>)
          : null,
      consultation: json['consultation'] is Map<String, dynamic>
          ? PrescriptionConsultationSummary.fromJson(json['consultation'] as Map<String, dynamic>)
          : null,
      items: json['items'] is List
          ? (json['items'] as List)
              .map((e) => PrescriptionItem.fromJson(e as Map<String, dynamic>))
              .toList()
          : [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'clinicId': clinicId,
      'patientId': patientId,
      if (consultationId != null) 'consultationId': consultationId,
      'doctorId': doctorId,
      'versionNumber': versionNumber,
      'status': status.toBackendString(),
      if (supersedesPrescriptionId != null)
        'supersedesPrescriptionId': supersedesPrescriptionId,
      if (amendmentReason != null) 'amendmentReason': amendmentReason,
      if (notes != null) 'notes': notes,
      if (approvedAt != null) 'approvedAt': approvedAt!.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'items': items.map((e) => e.toJson()).toList(),
    };
  }

  Prescription copyWith({
    String? id,
    String? clinicId,
    String? patientId,
    String? consultationId,
    String? doctorId,
    int? versionNumber,
    PrescriptionStatus? status,
    String? supersedesPrescriptionId,
    String? amendmentReason,
    String? notes,
    DateTime? approvedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    Patient? patient,
    PrescriptionDoctorSummary? doctor,
    PrescriptionConsultationSummary? consultation,
    List<PrescriptionItem>? items,
  }) {
    return Prescription(
      id: id ?? this.id,
      clinicId: clinicId ?? this.clinicId,
      patientId: patientId ?? this.patientId,
      consultationId: consultationId ?? this.consultationId,
      doctorId: doctorId ?? this.doctorId,
      versionNumber: versionNumber ?? this.versionNumber,
      status: status ?? this.status,
      supersedesPrescriptionId:
          supersedesPrescriptionId ?? this.supersedesPrescriptionId,
      amendmentReason: amendmentReason ?? this.amendmentReason,
      notes: notes ?? this.notes,
      approvedAt: approvedAt ?? this.approvedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      patient: patient ?? this.patient,
      doctor: doctor ?? this.doctor,
      consultation: consultation ?? this.consultation,
      items: items ?? this.items,
    );
  }
}

