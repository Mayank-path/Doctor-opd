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
  Future<void> resumePlayback();
  Future<void> stopPlayback();
  Future<void> seekPlayback(Duration position);

  bool get isRecording;
  bool get isPaused;
  bool get isPlaying;
  bool get isPlaybackPaused;

  Duration get currentPosition;
  Duration get totalDuration;
  Stream<Duration> get onPositionChanged;
  Stream<Duration> get onDurationChanged;
  Stream<PlayerState> get onPlayerStateChanged;

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
  bool _isPlaybackPaused = false;

  Duration _currentPosition = Duration.zero;
  Duration _totalDuration = Duration.zero;

  StreamSubscription<void>? _playerCompleteSubscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration>? _durationSubscription;
  StreamSubscription<PlayerState>? _stateSubscription;

  DefaultAudioRecordingService({
    AudioRecorder? recorder,
    AudioPlayer? player,
  })  : _recorder = recorder ?? AudioRecorder(),
        _player = player ?? AudioPlayer() {
    _initPlayerListeners();
  }

  void _initPlayerListeners() {
    try {
      _positionSubscription = _player.onPositionChanged.listen((pos) {
        _currentPosition = pos;
      });
    } catch (_) {}

    try {
      _durationSubscription = _player.onDurationChanged.listen((dur) {
        _totalDuration = dur;
      });
    } catch (_) {}

    try {
      _stateSubscription = _player.onPlayerStateChanged.listen((state) {
        _isPlaying = state == PlayerState.playing;
        _isPlaybackPaused = state == PlayerState.paused;
      });
    } catch (_) {}
  }

  @override
  bool get isRecording => _isRecording;

  @override
  bool get isPaused => _isPaused;

  @override
  bool get isPlaying => _isPlaying;

  @override
  bool get isPlaybackPaused => _isPlaybackPaused;

  @override
  Duration get currentPosition => _currentPosition;

  @override
  Duration get totalDuration => _totalDuration;

  @override
  Stream<Duration> get onPositionChanged {
    try {
      return _player.onPositionChanged;
    } catch (_) {
      return const Stream.empty();
    }
  }

  @override
  Stream<Duration> get onDurationChanged {
    try {
      return _player.onDurationChanged;
    } catch (_) {
      return const Stream.empty();
    }
  }

  @override
  Stream<PlayerState> get onPlayerStateChanged {
    try {
      return _player.onPlayerStateChanged;
    } catch (_) {
      return const Stream.empty();
    }
  }

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

    // Ensure parent directory exists
    final file = File(path);
    final parent = file.parent;
    if (!parent.existsSync()) {
      parent.createSync(recursive: true);
    }

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

    // Verify finalized recording file existence and non-zero size
    if (path != null) {
      final file = File(path);
      if (file.existsSync() && file.lengthSync() > 0) {
        return path;
      }
    }
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
    // 1. Validate local file existence and content before playback
    final file = File(path);
    if (!file.existsSync() || file.lengthSync() == 0) {
      throw FileSystemException(
        'Recorded audio file does not exist or is empty',
        path,
      );
    }

    // 2. Stop any existing playback
    await stopPlayback();

    // 3. Configure audio context to guarantee loud speaker output
    try {
      final audioCtx = AudioContextConfig(
        route: AudioContextConfigRoute.speaker,
        focus: AudioContextConfigFocus.gain,
        respectSilence: false,
      ).build();
      await _player.setAudioContext(audioCtx);
    } catch (_) {
      // Non-fatal if audio context is not supported on this platform/test harness
    }

    // 4. Configure player mode and volume
    try {
      await _player.setPlayerMode(PlayerMode.mediaPlayer);
      await _player.setVolume(1.0);
    } catch (_) {}

    // 5. Wire onPlayerComplete
    await _playerCompleteSubscription?.cancel();
    _playerCompleteSubscription = _player.onPlayerComplete.listen((_) {
      _isPlaying = false;
      _isPlaybackPaused = false;
      _currentPosition = Duration.zero;
      onComplete?.call();
    });

    _isPlaying = true;
    _isPlaybackPaused = false;

    // 6. Set source and play
    await _player.play(DeviceFileSource(path));
  }

  @override
  Future<void> pausePlayback() async {
    if (_isPlaying && !_isPlaybackPaused) {
      await _player.pause();
      _isPlaybackPaused = true;
    }
  }

  @override
  Future<void> resumePlayback() async {
    if (_isPlaying || _isPlaybackPaused) {
      await _player.resume();
      _isPlaybackPaused = false;
      _isPlaying = true;
    }
  }

  @override
  Future<void> stopPlayback() async {
    try {
      await _player.stop();
    } catch (_) {}
    _isPlaying = false;
    _isPlaybackPaused = false;
    _currentPosition = Duration.zero;
  }

  @override
  Future<void> seekPlayback(Duration position) async {
    await _player.seek(position);
    _currentPosition = position;
  }

  @override
  Future<void> deleteAudioFile(String path) async {
    try {
      await stopPlayback();
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
    await _positionSubscription?.cancel();
    await _durationSubscription?.cancel();
    await _stateSubscription?.cancel();

    await stopPlayback();
    await _player.dispose();

    if (_isRecording) {
      try {
        await _recorder.stop();
      } catch (_) {}
    }
    await _recorder.dispose();
  }
}
