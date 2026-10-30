import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../patients/models/patient.dart';
import '../models/doctor_extraction_review.dart';
import '../models/transcription_response.dart';
import '../services/clinical_assist_service.dart';
import '../widgets/transcript_editor.dart';
import 'structured_extraction_review_screen.dart';

/// Screen for reviewing, editing, and confirming speech-to-text transcripts,
/// with support for initiating structured clinical extraction or confirming plain text.
class TranscriptReviewScreen extends StatefulWidget {
  final Patient patient;
  final TranscriptionResponse response;
  final ClinicalAssistService? clinicalAssistService;

  const TranscriptReviewScreen({
    super.key,
    required this.patient,
    required this.response,
    this.clinicalAssistService,
  });

  @override
  State<TranscriptReviewScreen> createState() => _TranscriptReviewScreenState();
}

class _TranscriptReviewScreenState extends State<TranscriptReviewScreen> {
  late final TextEditingController _transcriptController;
  late final String _originalTranscript;
  late final ClinicalAssistService _clinicalAssistService;

  bool _isExtracting = false;
  String? _extractionError;

  @override
  void initState() {
    super.initState();
    _originalTranscript = widget.response.transcript;
    _transcriptController = TextEditingController(text: _originalTranscript);
    _clinicalAssistService = widget.clinicalAssistService ?? ClinicalAssistService();

    _transcriptController.addListener(_onTranscriptEdited);
  }

  void _onTranscriptEdited() {
    if (_extractionError != null) {
      setState(() {
        _extractionError = null;
      });
    }
  }

  @override
  void dispose() {
    _transcriptController.removeListener(_onTranscriptEdited);
    _transcriptController.dispose();
    super.dispose();
  }

  void _onResetToOriginal() {
    setState(() {
      _transcriptController.text = _originalTranscript;
      _extractionError = null;
    });
  }

  Future<void> _onExtractStructuredFindings() async {
    if (_isExtracting) return;

    final text = _transcriptController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Transcript cannot be empty. Please enter or speak symptoms.'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    if (text.length > 5000) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Transcript exceeds 5,000 character limit. Please shorten the text.'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    setState(() {
      _isExtracting = true;
      _extractionError = null;
    });

    try {
      final extractionResult = await _clinicalAssistService.extractStructuredClinical(text);
      if (!mounted) return;

      setState(() {
        _isExtracting = false;
      });

      // Navigate to Structured Extraction Review Screen
      final reviewResult = await Navigator.of(context).push<ClinicalExtractionFormattingResult?>(
        MaterialPageRoute(
          builder: (context) => StructuredExtractionReviewScreen(
            patient: widget.patient,
            extractionResult: extractionResult,
            sourceTranscript: text,
          ),
        ),
      );

      // If clinician confirmed structured findings in review screen, pop back to caller
      if (reviewResult != null && mounted) {
        Navigator.of(context).pop<dynamic>(reviewResult);
      }
    } on ApiException catch (apiErr) {
      if (!mounted) return;
      setState(() {
        _isExtracting = false;
        _extractionError = apiErr.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(apiErr.message),
          backgroundColor: AppTheme.errorRed,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isExtracting = false;
        _extractionError = 'Clinical extraction failed. You can still confirm the plain transcript.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Clinical extraction failed. You can still confirm the plain transcript.'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
    }
  }

  Future<void> _onConfirmTranscript() async {
    final text = _transcriptController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Transcript cannot be empty. Please enter or speak symptoms.'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Row(
          children: [
            Icon(Icons.check_circle_outline_rounded, color: AppTheme.accentTeal),
            SizedBox(width: 10),
            Text('Confirm Transcript', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          ],
        ),
        content: const Text(
          'Confirm that you have reviewed and verified this transcript for clinical accuracy. This text will be returned to your consultation workflow.',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Review Again', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.accentTeal,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.of(context).pop<dynamic>(text);
    }
  }

  Future<void> _onDiscard() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('Discard Transcript?'),
        content: const Text(
          'Are you sure you want to discard this transcript? All unrecognized speech and edits will be removed.',
          style: TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep Editing', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Discard', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.of(context).pop<dynamic>(null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text(
          'Review Transcript',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: _onDiscard,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.errorRed),
            tooltip: 'Discard Transcript',
            onPressed: _onDiscard,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Patient Demographics Banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.borderGray),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: AppTheme.primaryNavy,
                      child: Text(
                        widget.patient.fullName.isNotEmpty
                            ? widget.patient.fullName[0].toUpperCase()
                            : 'P',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.patient.fullName,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'UHID: ${widget.patient.uhid} • ${widget.patient.gender} • Age: ${widget.patient.age ?? "N/A"}',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.verified_rounded, size: 14, color: Colors.green),
                          SizedBox(width: 4),
                          Text(
                            'CONSENT VERIFIED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.green,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // 2. Transcription Metadata Chips
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (widget.response.detectedLanguage != null)
                    _buildMetaChip(
                      Icons.translate_rounded,
                      'Detected: ${widget.response.detectedLanguage}',
                    ),
                  if (widget.response.languageHint != null)
                    _buildMetaChip(
                      Icons.language_rounded,
                      'Hint: ${widget.response.languageHint}',
                    ),
                  if (widget.response.durationSeconds != null)
                    _buildMetaChip(
                      Icons.timer_outlined,
                      '${widget.response.durationSeconds!.toStringAsFixed(1)}s audio',
                    ),
                  _buildMetaChip(
                    Icons.cloud_done_outlined,
                    '${widget.response.provider} (${widget.response.model})',
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // 3. Clinical Verification Guidance
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.blue.withValues(alpha: 0.2)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.rate_review_outlined, color: AppTheme.primaryNavy, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Clinician Review: Check medical terminology, Hindi/Hinglish phrasing, dosage numbers, and durations before confirming.',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.primaryNavy,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Error Banner (if extraction failed)
              if (_extractionError != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline_rounded, color: Colors.red.shade800, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _extractionError!,
                          style: TextStyle(fontSize: 12, color: Colors.red.shade900),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // 4. Transcript Editor
              TranscriptEditor(
                controller: _transcriptController,
                originalTranscript: _originalTranscript,
                onResetToOriginal: _onResetToOriginal,
              ),
              const SizedBox(height: 20),

              // 5. Extract Clinical Findings CTA (Primary AI Workflow)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 2,
                  ),
                  onPressed: _isExtracting ? null : _onExtractStructuredFindings,
                  icon: _isExtracting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Icon(Icons.psychology_outlined),
                  label: Text(
                    _isExtracting ? 'Extracting Clinical Findings...' : 'Extract Clinical Findings',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // 6. Confirm Plain Transcript CTA (Fallback Plain Text Workflow)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.accentTeal,
                    side: const BorderSide(color: AppTheme.accentTeal, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                  onPressed: _isExtracting ? null : _onConfirmTranscript,
                  icon: const Icon(Icons.check_circle_outline_rounded),
                  label: const Text(
                    'Confirm Final Transcript (Plain Text)',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Discard Button
              Center(
                child: TextButton.icon(
                  style: TextButton.styleFrom(foregroundColor: AppTheme.errorRed),
                  onPressed: _isExtracting ? null : _onDiscard,
                  icon: const Icon(Icons.close_rounded, size: 18),
                  label: const Text('Discard and Exit'),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetaChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderGray),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppTheme.accentTeal),
          const SizedBox(width: 6),
          Text(
            text,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
