import 'prescription_item.dart';

class UpdatePrescriptionRequest {
  final String? notes;
  final List<PrescriptionItem>? items;

  const UpdatePrescriptionRequest({
    this.notes,
    this.items,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (notes != null) {
      map['notes'] = notes!.trim();
    }
    if (items != null) {
      map['items'] = items!.map((e) => e.toJson()).toList();
    }
    return map;
  }

  Map<String, String> validate() {
    final errors = <String, String>{};

    if (items != null) {
      if (items!.isEmpty) {
        errors['items'] = 'If items are updated, at least one item is required';
      }
      for (int i = 0; i < items!.length; i++) {
        final itemErrors = items![i].validate();
        if (itemErrors.isNotEmpty) {
          errors['item_$i'] =
              'Item #${i + 1}: ${itemErrors.values.first}';
        }
      }
    }

    if (notes != null && notes!.length > 2000) {
      errors['notes'] = 'Notes cannot exceed 2000 characters';
    }

    return errors;
  }
}

