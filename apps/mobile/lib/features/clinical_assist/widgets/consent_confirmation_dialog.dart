import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../patients/models/patient.dart';

/// Modal dialog requiring explicit clinical attestation of patient consent
/// prior to cloud speech-to-text processing.
class ConsentConfirmationDialog extends StatelessWidget {
  final Patient patient;

  const ConsentConfirmationDialog({
    super.key,
    required this.patient,
  });

  static Future<bool?> show(BuildContext context, {required Patient patient}) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => ConsentConfirmationDialog(patient: patient),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.accentTeal.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.verified_user_rounded,
              color: AppTheme.accentTeal,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Patient Consent Required',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppTheme.primaryNavy,
              ),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Patient Scope Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person_rounded, size: 18, color: AppTheme.primaryNavy),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${patient.fullName} (${patient.uhid})',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            const Text(
              'Before uploading audio for clinical transcription, please confirm you have obtained the patient\'s informed consent:',
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            _buildBulletPoint(
              Icons.cloud_upload_outlined,
              'Cloud Processing',
              'Audio will be transmitted via encrypted TLS to a secure cloud transcription provider.',
            ),
            const SizedBox(height: 8),
            _buildBulletPoint(
              Icons.visibility_outlined,
              'Clinician Review',
              'The transcript is editable and must be reviewed and verified by you before any clinical use.',
            ),
            const SizedBox(height: 8),
            _buildBulletPoint(
              Icons.auto_delete_outlined,
              'Ephemeral Audio',
              'Raw audio is processed transiently and is not permanently stored on the DOCTOR-OPD backend.',
            ),
            const SizedBox(height: 14),

            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 18, color: Colors.orange),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Doctor attestation: Tapping "Confirm & Proceed" certifies that verbal patient consent has been obtained for this session.',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF7A4B00),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.accentTeal,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text(
            'Confirm & Proceed',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  Widget _buildBulletPoint(IconData icon, String title, String description) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppTheme.accentTeal),
        const SizedBox(width: 10),
        Expanded(
          child: Text.rich(
            TextSpan(
              style: const TextStyle(fontSize: 12, color: AppTheme.textPrimary, height: 1.3),
              children: [
                TextSpan(
                  text: '$title: ',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                TextSpan(text: description),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
