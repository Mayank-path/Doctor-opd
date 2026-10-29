import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/prescription_item.dart';

/// Modal bottom sheet for adding or editing a prescription medication item.
class MedicationItemEditorSheet extends StatefulWidget {
  final PrescriptionItem? initialItem;
  final ValueChanged<PrescriptionItem> onSave;

  const MedicationItemEditorSheet({
    super.key,
    this.initialItem,
    required this.onSave,
  });

  static Future<void> show(
    BuildContext context, {
    PrescriptionItem? item,
    required ValueChanged<PrescriptionItem> onSave,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MedicationItemEditorSheet(
        initialItem: item,
        onSave: onSave,
      ),
    );
  }

  @override
  State<MedicationItemEditorSheet> createState() =>
      _MedicationItemEditorSheetState();
}

class _MedicationItemEditorSheetState extends State<MedicationItemEditorSheet> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameController;
  late final TextEditingController _brandController;
  late final TextEditingController _strengthController;
  late final TextEditingController _frequencyController;
  late final TextEditingController _durationValueController;
  late final TextEditingController _instructionsController;

  late DosageForm _dosageForm;
  late MedicationRoute _route;
  late String _durationUnit;
  late MedicationTiming _timing;

  final List<String> _quickFrequencies = [
    '1-0-1',
    '1-1-1',
    '1-0-0',
    '0-0-1',
    'OD',
    'BD',
    'TDS',
    'QID',
    'SOS',
  ];

  @override
  void initState() {
    super.initState();
    final item = widget.initialItem;
    _nameController = TextEditingController(text: item?.medicationName ?? '');
    _brandController = TextEditingController(text: item?.brandName ?? '');
    _strengthController = TextEditingController(text: item?.strength ?? '');
    _frequencyController = TextEditingController(text: item?.frequency ?? '1-0-1');
    _durationValueController =
        TextEditingController(text: (item?.durationValue ?? 5).toString());
    _instructionsController =
        TextEditingController(text: item?.specialInstructions ?? '');

    _dosageForm = item?.dosageForm ?? DosageForm.tablet;
    _route = item?.route ?? MedicationRoute.oral;
    _durationUnit = item?.durationUnit ?? 'DAYS';
    _timing = item?.timing ?? MedicationTiming.afterMeals;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _brandController.dispose();
    _strengthController.dispose();
    _frequencyController.dispose();
    _durationValueController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final durationVal = int.tryParse(_durationValueController.text.trim()) ?? 1;

    final item = PrescriptionItem(
      id: widget.initialItem?.id,
      prescriptionId: widget.initialItem?.prescriptionId,
      medicationName: _nameController.text.trim(),
      brandName: _brandController.text.trim().isEmpty
          ? null
          : _brandController.text.trim(),
      dosageForm: _dosageForm,
      strength: _strengthController.text.trim(),
      route: _route,
      frequency: _frequencyController.text.trim(),
      durationValue: durationVal,
      durationUnit: _durationUnit,
      timing: _timing,
      specialInstructions: _instructionsController.text.trim().isEmpty
          ? null
          : _instructionsController.text.trim(),
      sortOrder: widget.initialItem?.sortOrder ?? 0,
    );

    widget.onSave(item);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.initialItem != null;
    final keyboardPadding = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: keyboardPadding + 20,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isEditing ? 'Edit Medication' : 'Add Medication Item',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.darkSlate,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(height: 16),

              // Medication & Brand
              TextFormField(
                key: const Key('medicationNameInput'),
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Medication Name (Generic)*',
                  hintText: 'e.g. Amoxicillin, Paracetamol',
                  prefixIcon: Icon(Icons.medication),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Medication name is required';
                  }
                  if (val.trim().length > 200) {
                    return 'Maximum 200 characters allowed';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _brandController,
                      decoration: const InputDecoration(
                        labelText: 'Brand Name (Optional)',
                        hintText: 'e.g. Augmentin, Calpol',
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      key: const Key('medicationStrengthInput'),
                      controller: _strengthController,
                      decoration: const InputDecoration(
                        labelText: 'Strength / Dose*',
                        hintText: 'e.g. 500 mg, 5 ml',
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Strength is required';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Dosage Form & Route Dropdowns
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<DosageForm>(
                      initialValue: _dosageForm,
                      decoration: const InputDecoration(
                        labelText: 'Form',
                      ),
                      items: DosageForm.values.map((f) {
                        return DropdownMenuItem(
                          value: f,
                          child: Text(f.displayName, style: const TextStyle(fontSize: 13)),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _dosageForm = val);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<MedicationRoute>(
                      initialValue: _route,
                      decoration: const InputDecoration(
                        labelText: 'Route',
                      ),
                      items: MedicationRoute.values.map((r) {
                        return DropdownMenuItem(
                          value: r,
                          child: Text(r.displayName, style: const TextStyle(fontSize: 13)),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _route = val);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Frequency
              TextFormField(
                controller: _frequencyController,
                decoration: const InputDecoration(
                  labelText: 'Regimen / Frequency*',
                  hintText: 'e.g. 1-0-1, OD, TDS',
                  prefixIcon: Icon(Icons.repeat),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Frequency is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: _quickFrequencies.map((freq) {
                  final isSelected = _frequencyController.text.trim() == freq;
                  return ChoiceChip(
                    label: Text(freq, style: TextStyle(fontSize: 11, color: isSelected ? Colors.white : AppTheme.darkSlate)),
                    selected: isSelected,
                    selectedColor: AppTheme.primaryTeal,
                    backgroundColor: Colors.grey.shade100,
                    onSelected: (_) {
                      setState(() {
                        _frequencyController.text = freq;
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),

              // Duration & Timing
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: _durationValueController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Duration*',
                      ),
                      validator: (val) {
                        final v = int.tryParse(val?.trim() ?? '');
                        if (v == null || v < 1 || v > 365) {
                          return '1-365';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: DropdownButtonFormField<String>(
                      initialValue: _durationUnit,
                      decoration: const InputDecoration(
                        labelText: 'Unit',
                      ),
                      items: const [
                        DropdownMenuItem(value: 'DAYS', child: Text('Days')),
                        DropdownMenuItem(value: 'WEEKS', child: Text('Weeks')),
                        DropdownMenuItem(value: 'MONTHS', child: Text('Months')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _durationUnit = val);
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 4,
                    child: DropdownButtonFormField<MedicationTiming>(
                      initialValue: _timing,
                      decoration: const InputDecoration(
                        labelText: 'Timing',
                      ),
                      items: MedicationTiming.values.map((t) {
                        return DropdownMenuItem(
                          value: t,
                          child: Text(t.displayName, style: const TextStyle(fontSize: 12)),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _timing = val);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Instructions
              TextFormField(
                controller: _instructionsController,
                decoration: const InputDecoration(
                  labelText: 'Instructions & Advice (Optional)',
                  hintText: 'e.g. Take with warm water, complete course',
                  prefixIcon: Icon(Icons.info_outline),
                ),
                maxLines: 2,
              ),
              const SizedBox(height: 20),

              // Action button
              ElevatedButton.icon(
                key: const Key('submitMedicationButton'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryTeal,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _submit,
                icon: Icon(isEditing ? Icons.check : Icons.add),
                label: Text(
                  isEditing ? 'Save Changes' : 'Add Medication',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

