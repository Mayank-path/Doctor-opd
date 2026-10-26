import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Form component for entering or reviewing patient vital signs.
/// Supports both editable mode (draft) and read-only display (finalized record).
class VitalsInputGrid extends StatelessWidget {
  final TextEditingController? bpSystolicController;
  final TextEditingController? bpDiastolicController;
  final TextEditingController? pulseController;
  final TextEditingController? temperatureController;
  final TextEditingController? weightController;
  final TextEditingController? heightController;
  final TextEditingController? spo2Controller;
  final TextEditingController? respiratoryRateController;
  final bool isReadOnly;

  // Read-only values (if controllers not used)
  final int? bpSystolic;
  final int? bpDiastolic;
  final int? pulse;
  final double? temperature;
  final double? weightKg;
  final double? heightCm;
  final int? spo2;
  final int? respiratoryRate;

  const VitalsInputGrid({
    super.key,
    this.bpSystolicController,
    this.bpDiastolicController,
    this.pulseController,
    this.temperatureController,
    this.weightController,
    this.heightController,
    this.spo2Controller,
    this.respiratoryRateController,
    this.isReadOnly = false,
    this.bpSystolic,
    this.bpDiastolic,
    this.pulse,
    this.temperature,
    this.weightKg,
    this.heightCm,
    this.spo2,
    this.respiratoryRate,
  });

  @override
  Widget build(BuildContext context) {
    if (isReadOnly) {
      return _buildReadOnlyView();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // BP & Pulse Row
        Row(
          children: [
            Expanded(
              child: TextFormField(
                key: const Key('bpSystolicField'),
                controller: bpSystolicController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'BP Systolic',
                  hintText: '120',
                  suffixText: 'mmHg',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = int.tryParse(val.trim());
                  if (n == null || n < 40 || n > 300) {
                    return '40-300';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                key: const Key('bpDiastolicField'),
                controller: bpDiastolicController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'BP Diastolic',
                  hintText: '80',
                  suffixText: 'mmHg',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = int.tryParse(val.trim());
                  if (n == null || n < 20 || n > 200) {
                    return '20-200';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                key: const Key('pulseField'),
                controller: pulseController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Pulse',
                  hintText: '72',
                  suffixText: 'bpm',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = int.tryParse(val.trim());
                  if (n == null || n < 30 || n > 300) {
                    return '30-300';
                  }
                  return null;
                },
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // Temperature & SpO2 Row
        Row(
          children: [
            Expanded(
              child: TextFormField(
                key: const Key('temperatureField'),
                controller: temperatureController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'Temperature',
                  hintText: '98.6',
                  suffixText: '°F',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = double.tryParse(val.trim());
                  if (n == null || n < 70.0 || n > 115.0) {
                    return '70-115 °F';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                key: const Key('spo2Field'),
                controller: spo2Controller,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'SpO2',
                  hintText: '98',
                  suffixText: '%',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = int.tryParse(val.trim());
                  if (n == null || n < 50 || n > 100) {
                    return '50-100%';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                key: const Key('respiratoryRateField'),
                controller: respiratoryRateController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Resp Rate',
                  hintText: '16',
                  suffixText: '/min',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = int.tryParse(val.trim());
                  if (n == null || n < 5 || n > 100) {
                    return '5-100';
                  }
                  return null;
                },
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // Weight & Height Row
        Row(
          children: [
            Expanded(
              child: TextFormField(
                key: const Key('weightField'),
                controller: weightController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'Weight',
                  hintText: '65.0',
                  suffixText: 'kg',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = double.tryParse(val.trim());
                  if (n == null || n < 0.5 || n > 500.0) {
                    return '0.5-500 kg';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                key: const Key('heightField'),
                controller: heightController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'Height',
                  hintText: '170.0',
                  suffixText: 'cm',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return null;
                  final n = double.tryParse(val.trim());
                  if (n == null || n < 20.0 || n > 300.0) {
                    return '20-300 cm';
                  }
                  return null;
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildReadOnlyView() {
    final items = <Widget>[];

    if (bpSystolic != null || bpDiastolic != null) {
      final val = '${bpSystolic ?? "-"} / ${bpDiastolic ?? "-"} mmHg';
      items.add(_buildReadOnlyBadge('Blood Pressure', val, Icons.favorite));
    }

    if (pulse != null) {
      items.add(_buildReadOnlyBadge('Pulse / HR', '$pulse bpm', Icons.monitor_heart));
    }

    if (temperature != null) {
      items.add(_buildReadOnlyBadge('Temperature', '$temperature °F', Icons.thermostat));
    }

    if (spo2 != null) {
      items.add(_buildReadOnlyBadge('SpO2', '$spo2 %', Icons.air));
    }

    if (respiratoryRate != null) {
      items.add(_buildReadOnlyBadge('Resp Rate', '$respiratoryRate /min', Icons.speed));
    }

    if (weightKg != null) {
      items.add(_buildReadOnlyBadge('Weight', '$weightKg kg', Icons.scale));
    }

    if (heightCm != null) {
      items.add(_buildReadOnlyBadge('Height', '$heightCm cm', Icons.height));
    }

    if (weightKg != null && heightCm != null && heightCm! > 0) {
      final h = heightCm! / 100.0;
      final bmi = (weightKg! / (h * h)).toStringAsFixed(1);
      items.add(_buildReadOnlyBadge('BMI', '$bmi kg/m²', Icons.accessibility_new));
    }

    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Text(
          'No vital signs recorded during this encounter.',
          style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
        ),
      );
    }

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: items,
    );
  }

  Widget _buildReadOnlyBadge(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppTheme.accentTeal),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.textSecondary,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
