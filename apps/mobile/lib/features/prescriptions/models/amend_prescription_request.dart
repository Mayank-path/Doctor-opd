import 'prescription_item.dart';

class AmendPrescriptionRequest {
  final String amendmentReason;
  final String? notes;
  final List<PrescriptionItem> items;

  const AmendPrescriptionRequest({
    required this.amendmentReason,
    this.notes,
    required this.items,
  });

  Map<String, dynamic> toJson() {
    return {
      'amendmentReason': amendmentReason.trim(),
      if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      'items': items.map((e) => e.toJson()).toList(),
    };
  }

  Map<String, String> validate() {
    final errors = <String, String>{};

    if (amendmentReason.trim().isEmpty) {
      errors['amendmentReason'] =
          'Amendment reason is required for legal and clinical traceability';
    } else if (amendmentReason.trim().length < 5) {
      errors['amendmentReason'] =
          'Amendment reason must be at least 5 characters long';
    } else if (amendmentReason.trim().length > 1000) {
      errors['amendmentReason'] =
          'Amendment reason cannot exceed 1000 characters';
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

