import 'prescription_item.dart';

class CreatePrescriptionRequest {
  final String patientId;
  final String? consultationId;
  final String? notes;
  final List<PrescriptionItem> items;

  const CreatePrescriptionRequest({
    required this.patientId,
    this.consultationId,
    this.notes,
    required this.items,
  });

  Map<String, dynamic> toJson() {
    return {
      'patientId': patientId,
      if (consultationId != null && consultationId!.isNotEmpty)
        'consultationId': consultationId,
      if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      'items': items.map((e) => e.toJson()).toList(),
    };
  }

  /// Client-side validation matching NestJS class-validator requirements
  Map<String, String> validate() {
    final errors = <String, String>{};

    if (patientId.trim().isEmpty) {
      errors['patientId'] = 'Patient selection is required';
    }

    if (items.isEmpty) {
      errors['items'] = 'At least one medication item is required';
    }

    for (int i = 0; i < items.length; i++) {
      final itemErrors = items[i].validate();
      if (itemErrors.isNotEmpty) {
        errors['item_$i'] =
            'Item #${i + 1}: ${itemErrors.values.first}';
      }
    }

    if (notes != null && notes!.length > 2000) {
      errors['notes'] = 'Notes cannot exceed 2000 characters';
    }

    return errors;
  }
}

