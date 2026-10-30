import 'dart:math';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Animated clinical waveform visualizer responding to voice amplitude levels.
class AudioRecordingWaveform extends StatefulWidget {
  final bool isRecording;
  final bool isPaused;
  final double currentAmplitude; // 0.0 to 1.0 normalized
  final Color? barColor;

  const AudioRecordingWaveform({
    super.key,
    required this.isRecording,
    required this.isPaused,
    this.currentAmplitude = 0.0,
    this.barColor,
  });

  @override
  State<AudioRecordingWaveform> createState() => _AudioRecordingWaveformState();
}

class _AudioRecordingWaveformState extends State<AudioRecordingWaveform>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  final Random _random = Random();
  static const int _barCount = 28;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    )..addListener(() {
        if (mounted) setState(() {});
      });

    if (widget.isRecording && !widget.isPaused) {
      _animController.repeat();
    }
  }

  @override
  void didUpdateWidget(AudioRecordingWaveform oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRecording && !widget.isPaused) {
      if (!_animController.isAnimating) {
        _animController.repeat();
      }
    } else {
      if (_animController.isAnimating) {
        _animController.stop();
      }
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeColor = widget.barColor ??
        (widget.isRecording
            ? (widget.isPaused ? Colors.orange : AppTheme.accentTeal)
            : AppTheme.borderGray);

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: widget.isRecording
              ? (widget.isPaused
                  ? Colors.orange.withValues(alpha: 0.4)
                  : AppTheme.accentTeal.withValues(alpha: 0.4))
              : AppTheme.borderGray,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: List.generate(_barCount, (index) {
          final barHeight = _computeBarHeight(index);
          return AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            curve: Curves.easeOut,
            width: 3.5,
            height: barHeight,
            decoration: BoxDecoration(
              color: activeColor,
              borderRadius: BorderRadius.circular(4),
            ),
          );
        }),
      ),
    );
  }

  double _computeBarHeight(int index) {
    if (!widget.isRecording) {
      return 6.0; // Idle baseline
    }
    if (widget.isPaused) {
      return 8.0; // Paused baseline
    }

    final amp = widget.currentAmplitude.clamp(0.05, 1.0);
    // Add jitter around the center bars for natural voice wave appearance
    final centerDistance = (index - (_barCount / 2)).abs() / (_barCount / 2);
    final centerWeight = 1.0 - (centerDistance * 0.4);
    final randomJitter = 0.7 + (_random.nextDouble() * 0.6);

    final height = 48.0 * amp * centerWeight * randomJitter;
    return height.clamp(8.0, 48.0);
  }
}
