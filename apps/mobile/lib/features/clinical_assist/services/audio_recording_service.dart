import 'dart:async';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:record/record.dart';

/// Abstract interface for audio recording and preview playback.
abstract class AudioRecordingService {
  Future<bool> hasPermission();
  Future<void> startRecording(String path);
  Future<void> pauseRecording();
  Future<void> resumeRecording();
  Future<String?> stopRecording();
  Future<double> getAmplitudeNormalized();

  Future<void> playAudio(String path, {void Function()? onComplete});
  Future<void> pausePlayback();
  Future<void> stopPlayback();

  bool get isRecording;
  bool get isPaused;
  bool get isPlaying;

  Future<void> deleteAudioFile(String path);
  Future<void> dispose();
}

/// Concrete implementation using [AudioRecorder] from `record` and [AudioPlayer] from `audioplayers`.
class DefaultAudioRecordingService implements AudioRecordingService {
  final AudioRecorder _recorder;
  final AudioPlayer _player;

  bool _isRecording = false;
  bool _isPaused = false;
  bool _isPlaying = false;
  StreamSubscription<void>? _playerCompleteSubscription;

  DefaultAudioRecordingService({
    AudioRecorder? recorder,
    AudioPlayer? player,
  })  : _recorder = recorder ?? AudioRecorder(),
        _player = player ?? AudioPlayer();

  @override
  bool get isRecording => _isRecording;

  @override
  bool get isPaused => _isPaused;

  @override
  bool get isPlaying => _isPlaying;

  @override
  Future<bool> hasPermission() async {
    try {
      return await _recorder.hasPermission();
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> startRecording(String path) async {
    await stopPlayback();

    const config = RecordConfig(
      encoder: AudioEncoder.aacLc,
      sampleRate: 44100,
      bitRate: 128000,
    );

    await _recorder.start(config, path: path);
    _isRecording = true;
    _isPaused = false;
  }

  @override
  Future<void> pauseRecording() async {
    if (_isRecording && !_isPaused) {
      await _recorder.pause();
      _isPaused = true;
    }
  }

  @override
  Future<void> resumeRecording() async {
    if (_isRecording && _isPaused) {
      await _recorder.resume();
      _isPaused = false;
    }
  }

  @override
  Future<String?> stopRecording() async {
    if (!_isRecording) return null;
    final path = await _recorder.stop();
    _isRecording = false;
    _isPaused = false;
    return path;
  }

  @override
  Future<double> getAmplitudeNormalized() async {
    if (!_isRecording || _isPaused) return 0.0;
    try {
      final amp = await _recorder.getAmplitude();
      // amp.current ranges from -160 to 0 dBFS
      final current = amp.current;
      if (current <= -60.0) return 0.05;
      if (current >= 0.0) return 1.0;
      return (current + 60.0) / 60.0;
    } catch (_) {
      return 0.1;
    }
  }

  @override
  Future<void> playAudio(String path, {void Function()? onComplete}) async {
    await _playerCompleteSubscription?.cancel();
    _playerCompleteSubscription = _player.onPlayerComplete.listen((_) {
      _isPlaying = false;
      onComplete?.call();
    });

    _isPlaying = true;
    await _player.play(DeviceFileSource(path));
  }

  @override
  Future<void> pausePlayback() async {
    if (_isPlaying) {
      await _player.pause();
      _isPlaying = false;
    }
  }

  @override
  Future<void> stopPlayback() async {
    if (_isPlaying) {
      await _player.stop();
      _isPlaying = false;
    }
  }

  @override
  Future<void> deleteAudioFile(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {
      // Ignored non-fatal file cleanup errors
    }
  }

  @override
  Future<void> dispose() async {
    await _playerCompleteSubscription?.cancel();
    if (_isPlaying) {
      await _player.stop();
    }
    await _player.dispose();
    if (_isRecording) {
      await _recorder.stop();
    }
    await _recorder.dispose();
  }
}

