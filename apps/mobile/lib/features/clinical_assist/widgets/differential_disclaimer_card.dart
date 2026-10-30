import 'package:flutter/material.dart';

/// Clinical decision support disclaimer banner for Differential Diagnosis screens.
class DifferentialDisclaimerCard extends StatelessWidget {
  final String? customText;

  const DifferentialDisclaimerCard({
    super.key,
    this.customText,
  });

  @override
  Widget build(BuildContext context) {
    final text = customText?.isNotEmpty == true
        ? customText!
        : 'DOCTOR-OPD Clinical Assist Differential Diagnosis is an assistive clinical decision support tool for registered medical practitioners under NMC regulations. It does NOT generate autonomous diagnoses, clinical directives, prescriptions, or drug dosages. The attending physician retains sole clinical authority and responsibility.';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF), // soft clinical light blue
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.shield_outlined,
            size: 16,
            color: Color(0xFF1D4ED8),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 11,
                height: 1.4,
                color: Color(0xFF1E3A8A),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

