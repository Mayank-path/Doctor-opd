enum DosageForm {
  tablet,
  capsule,
  syrup,
  injection,
  ointment,
  drops,
  inhaler,
  other;

  String toBackendString() => name.toUpperCase();

  String get displayName {
    switch (this) {
      case DosageForm.tablet:
        return 'Tablet';
      case DosageForm.capsule:
        return 'Capsule';
      case DosageForm.syrup:
        return 'Syrup';
      case DosageForm.injection:
        return 'Injection';
      case DosageForm.ointment:
        return 'Ointment';
      case DosageForm.drops:
        return 'Drops';
      case DosageForm.inhaler:
        return 'Inhaler';
      case DosageForm.other:
        return 'Other';
    }
  }

  static DosageForm fromString(String? value) {
    if (value == null) return DosageForm.tablet;
    final normalized = value.trim().toUpperCase();
    return DosageForm.values.firstWhere(
      (e) => e.toBackendString() == normalized,
      orElse: () => DosageForm.tablet,
    );
  }
}

enum MedicationRoute {
  oral,
  topical,
  intravenous,
  intramuscular,
  sublingual,
  inhalation,
  ophthalmic,
  nasal,
  otic;

  String toBackendString() => name.toUpperCase();

  String get displayName {
    switch (this) {
      case MedicationRoute.oral:
        return 'Oral';
      case MedicationRoute.topical:
        return 'Topical';
      case MedicationRoute.intravenous:
        return 'Intravenous (IV)';
      case MedicationRoute.intramuscular:
        return 'Intramuscular (IM)';
      case MedicationRoute.sublingual:
        return 'Sublingual';
      case MedicationRoute.inhalation:
        return 'Inhalation';
      case MedicationRoute.ophthalmic:
        return 'Ophthalmic (Eye)';
      case MedicationRoute.nasal:
        return 'Nasal';
      case MedicationRoute.otic:
        return 'Otic (Ear)';
    }
  }

  static MedicationRoute fromString(String? value) {
    if (value == null) return MedicationRoute.oral;
    final normalized = value.trim().toUpperCase();
    return MedicationRoute.values.firstWhere(
      (e) => e.toBackendString() == normalized,
      orElse: () => MedicationRoute.oral,
    );
  }
}

enum MedicationTiming {
  beforeMeals,
  afterMeals,
  withMeals,
  emptyStomach,
  atBedtime,
  asNeeded;

  String toBackendString() {
    switch (this) {
      case MedicationTiming.beforeMeals:
        return 'BEFORE_MEALS';
      case MedicationTiming.afterMeals:
        return 'AFTER_MEALS';
      case MedicationTiming.withMeals:
        return 'WITH_MEALS';
      case MedicationTiming.emptyStomach:
        return 'EMPTY_STOMACH';
      case MedicationTiming.atBedtime:
        return 'AT_BEDTIME';
      case MedicationTiming.asNeeded:
        return 'AS_NEEDED';
    }
  }

  String get displayName {
    switch (this) {
      case MedicationTiming.beforeMeals:
        return 'Before Meals';
      case MedicationTiming.afterMeals:
        return 'After Meals';
      case MedicationTiming.withMeals:
        return 'With Meals';
      case MedicationTiming.emptyStomach:
        return 'Empty Stomach';
      case MedicationTiming.atBedtime:
        return 'At Bedtime';
      case MedicationTiming.asNeeded:
        return 'As Needed (SOS)';
    }
  }

  static MedicationTiming fromString(String? value) {
    if (value == null) return MedicationTiming.afterMeals;
    final normalized = value.trim().toUpperCase();
    switch (normalized) {
      case 'BEFORE_MEALS':
      case 'BEFORE_FOOD':
        return MedicationTiming.beforeMeals;
      case 'AFTER_MEALS':
      case 'AFTER_FOOD':
        return MedicationTiming.afterMeals;
      case 'WITH_MEALS':
      case 'WITH_FOOD':
        return MedicationTiming.withMeals;
      case 'EMPTY_STOMACH':
        return MedicationTiming.emptyStomach;
      case 'AT_BEDTIME':
        return MedicationTiming.atBedtime;
      case 'AS_NEEDED':
        return MedicationTiming.asNeeded;
      default:
        return MedicationTiming.afterMeals;
    }
  }
}

/// Typed model for an individual medication item within a prescription.
class PrescriptionItem {
  final String? id;
  final String? prescriptionId;
  final String? clinicId;
  final String medicationName;
  final String? brandName;
  final DosageForm dosageForm;
  final String strength;
  final MedicationRoute route;
  final String frequency;
  final int durationValue;
  final String durationUnit;
  final MedicationTiming timing;
  final String? specialInstructions;
  final int sortOrder;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const PrescriptionItem({
    this.id,
    this.prescriptionId,
    this.clinicId,
    required this.medicationName,
    this.brandName,
    this.dosageForm = DosageForm.tablet,
    required this.strength,
    this.route = MedicationRoute.oral,
    required this.frequency,
    required this.durationValue,
    this.durationUnit = 'DAYS',
    this.timing = MedicationTiming.afterMeals,
    this.specialInstructions,
    this.sortOrder = 0,
    this.createdAt,
    this.updatedAt,
  });

  factory PrescriptionItem.fromJson(Map<String, dynamic> json) {
    return PrescriptionItem(
      id: json['id'] as String?,
      prescriptionId: json['prescriptionId'] as String?,
      clinicId: json['clinicId'] as String?,
      medicationName: json['medicationName'] as String? ?? '',
      brandName: json['brandName'] as String?,
      dosageForm: DosageForm.fromString(json['dosageForm'] as String?),
      strength: json['strength'] as String? ?? '',
      route: MedicationRoute.fromString(json['route'] as String?),
      frequency: json['frequency'] as String? ?? '',
      durationValue: (json['durationValue'] as num?)?.toInt() ?? 1,
      durationUnit: json['durationUnit'] as String? ?? 'DAYS',
      timing: MedicationTiming.fromString(json['timing'] as String?),
      specialInstructions: json['specialInstructions'] as String?,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (prescriptionId != null) 'prescriptionId': prescriptionId,
      'medicationName': medicationName.trim(),
      if (brandName != null && brandName!.trim().isNotEmpty)
        'brandName': brandName!.trim(),
      'dosageForm': dosageForm.toBackendString(),
      'strength': strength.trim(),
      'route': route.toBackendString(),
      'frequency': frequency.trim(),
      'durationValue': durationValue,
      'durationUnit': durationUnit.trim().toUpperCase(),
      'timing': timing.toBackendString(),
      if (specialInstructions != null && specialInstructions!.trim().isNotEmpty)
        'specialInstructions': specialInstructions!.trim(),
      'sortOrder': sortOrder,
    };
  }

  PrescriptionItem copyWith({
    String? id,
    String? prescriptionId,
    String? clinicId,
    String? medicationName,
    String? brandName,
    DosageForm? dosageForm,
    String? strength,
    MedicationRoute? route,
    String? frequency,
    int? durationValue,
    String? durationUnit,
    MedicationTiming? timing,
    String? specialInstructions,
    int? sortOrder,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return PrescriptionItem(
      id: id ?? this.id,
      prescriptionId: prescriptionId ?? this.prescriptionId,
      clinicId: clinicId ?? this.clinicId,
      medicationName: medicationName ?? this.medicationName,
      brandName: brandName ?? this.brandName,
      dosageForm: dosageForm ?? this.dosageForm,
      strength: strength ?? this.strength,
      route: route ?? this.route,
      frequency: frequency ?? this.frequency,
      durationValue: durationValue ?? this.durationValue,
      durationUnit: durationUnit ?? this.durationUnit,
      timing: timing ?? this.timing,
      specialInstructions: specialInstructions ?? this.specialInstructions,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Client-side validation matching backend DTO rules
  Map<String, String> validate() {
    final errors = <String, String>{};
    if (medicationName.trim().isEmpty) {
      errors['medicationName'] = 'Medication name is required';
    } else if (medicationName.trim().length > 200) {
      errors['medicationName'] = 'Medication name cannot exceed 200 characters';
    }

    if (strength.trim().isEmpty) {
      errors['strength'] = 'Strength/dosage is required (e.g., 500 mg)';
    } else if (strength.trim().length > 100) {
      errors['strength'] = 'Strength cannot exceed 100 characters';
    }

    if (frequency.trim().isEmpty) {
      errors['frequency'] = 'Frequency is required (e.g., 1-0-1, OD)';
    } else if (frequency.trim().length > 50) {
      errors['frequency'] = 'Frequency cannot exceed 50 characters';
    }

    if (durationValue < 1 || durationValue > 365) {
      errors['durationValue'] = 'Duration must be between 1 and 365';
    }

    if (durationUnit.trim().isEmpty) {
      errors['durationUnit'] = 'Duration unit is required';
    }

    return errors;
  }
}

