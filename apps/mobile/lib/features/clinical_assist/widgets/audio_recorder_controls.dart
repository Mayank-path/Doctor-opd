import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Interactive clinical audio recorder controls.
///
/// Supports Start, Pause, Resume, Stop, Preview Playback, Discard, and Transcribe.
class AudioRecorderControls extends StatelessWidget {
  final bool isRecording;
  final bool isPaused;
  final bool hasRecordedAudio;
  final bool isPlayingPreview;
  final bool isUploading;
  final int elapsedSeconds;
  final int maxDurationSeconds; // 180 seconds target
  final VoidCallback onStartRecording;
  final VoidCallback onPauseRecording;
  final VoidCallback onResumeRecording;
  final VoidCallback onStopRecording;
  final VoidCallback onTogglePlayback;
  final VoidCallback onDiscardRecording;
  final VoidCallback onUploadAndTranscribe;

  const AudioRecorderControls({
    super.key,
    required this.isRecording,
    required this.isPaused,
    required this.hasRecordedAudio,
    required this.isPlayingPreview,
    required this.isUploading,
    required this.elapsedSeconds,
    this.maxDurationSeconds = 180,
    required this.onStartRecording,
    required this.onPauseRecording,
    required this.onResumeRecording,
    required this.onStopRecording,
    required this.onTogglePlayback,
    required this.onDiscardRecording,
    required this.onUploadAndTranscribe,
  });

  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainingSeconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final progress = (elapsedSeconds / maxDurationSeconds).clamp(0.0, 1.0);
    final remainingSeconds = maxDurationSeconds - elapsedSeconds;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 1. Duration & Progress Display
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                if (isRecording) ...[
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isPaused ? Colors.orange : Colors.red,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isPaused ? 'RECORDING PAUSED' : 'RECORDING LIVE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: isPaused ? Colors.orange : Colors.red,
                    ),
                  ),
                ] else if (hasRecordedAudio) ...[
                  const Icon(Icons.check_circle_rounded, size: 14, color: AppTheme.accentTeal),
                  const SizedBox(width: 6),
                  const Text(
                    'RECORDING READY FOR REVIEW',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: AppTheme.accentTeal,
                    ),
                  ),
                ] else ...[
                  const Icon(Icons.mic_none_rounded, size: 14, color: AppTheme.textSecondary),
                  const SizedBox(width: 6),
                  const Text(
                    'TAP MIC TO RECORD SYMPTOMS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
            Text(
              '${_formatDuration(elapsedSeconds)} / ${_formatDuration(maxDurationSeconds)}',
              style: const TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: AppTheme.primaryNavy,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),

        // Linear Progress Bar
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 5,
            backgroundColor: AppTheme.borderGray.withValues(alpha: 0.5),
            valueColor: AlwaysStoppedAnimation<Color>(
              remainingSeconds <= 15
                  ? Colors.red
                  : (isRecording ? AppTheme.accentTeal : AppTheme.primaryNavy),
            ),
          ),
        ),
        const SizedBox(height: 18),

        // 2. Action Controls
        if (isUploading) ...[
          // Uploading / Transcribing State
          Container(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: const Column(
              children: [
                CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(AppTheme.accentTeal),
                  strokeWidth: 3,
                ),
                SizedBox(height: 12),
                Text(
                  'Transcribing clinical audio...',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.primaryNavy,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Converting spoken Hindi, Hinglish, or English into text',
                  style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),
        ] else if (isRecording) ...[
          // Active Recording State
          Row(
            children: [
              // Pause / Resume Button
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isPaused ? AppTheme.accentTeal : Colors.orange,
                    side: BorderSide(
                      color: isPaused ? AppTheme.accentTeal : Colors.orange,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                  onPressed: isPaused ? onResumeRecording : onPauseRecording,
                  icon: Icon(isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded),
                  label: Text(isPaused ? 'Resume' : 'Pause'),
                ),
              ),
              const SizedBox(width: 12),

              // Stop & Complete Button
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                  onPressed: onStopRecording,
                  icon: const Icon(Icons.stop_rounded, color: Colors.red),
                  label: const Text(
                    'Stop & Save',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ] else if (hasRecordedAudio) ...[
          // Recorded Audio Preview & Actions
          Column(
            children: [
              Row(
                children: [
                  // Audio Preview Button
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.primaryNavy,
                        side: const BorderSide(color: AppTheme.primaryNavy),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      onPressed: onTogglePlayback,
                      icon: Icon(
                        isPlayingPreview ? Icons.stop_rounded : Icons.play_arrow_rounded,
                        color: isPlayingPreview ? Colors.red : AppTheme.accentTeal,
                      ),
                      label: Text(isPlayingPreview ? 'Stop Preview' : 'Play Audio'),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Discard & Re-record Button
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.errorRed,
                        side: const BorderSide(color: AppTheme.errorRed),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      onPressed: onDiscardRecording,
                      icon: const Icon(Icons.delete_outline_rounded, size: 20),
                      label: const Text('Re-record'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Upload and Transcribe CTA
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.accentTeal,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 2,
                  ),
                  onPressed: onUploadAndTranscribe,
                  icon: const Icon(Icons.cloud_upload_rounded),
                  label: const Text(
                    'Upload & Transcribe Audio',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ] else ...[
          // Idle State: Big Microphone Button
          GestureDetector(
            onTap: onStartRecording,
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.primaryNavy,
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Icon(
                Icons.mic_rounded,
                color: Colors.white,
                size: 38,
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Tap microphone to begin speaking symptoms',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ],
    );
  }
}
