import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/services/audio_recording_service.dart';

class MockAudioRecorder extends Mock implements AudioRecorder {}
class MockAudioPlayer extends Mock implements AudioPlayer {}

void main() {
  late MockAudioRecorder mockRecorder;
  late MockAudioPlayer mockPlayer;
  late DefaultAudioRecordingService service;
  late Directory tempDir;

  setUpAll(() {
    registerFallbackValue(const RecordConfig());
    registerFallbackValue(DeviceFileSource(''));
    registerFallbackValue(PlayerMode.mediaPlayer);
    registerFallbackValue(AudioContext());
    registerFallbackValue(Duration.zero);
  });

  setUp(() {
    mockRecorder = MockAudioRecorder();
    mockPlayer = MockAudioPlayer();

    when(() => mockPlayer.onPositionChanged)
        .thenAnswer((_) => const Stream<Duration>.empty());
    when(() => mockPlayer.onDurationChanged)
        .thenAnswer((_) => const Stream<Duration>.empty());
    when(() => mockPlayer.onPlayerStateChanged)
        .thenAnswer((_) => const Stream<PlayerState>.empty());
    when(() => mockPlayer.onPlayerComplete)
        .thenAnswer((_) => const Stream<void>.empty());

    when(() => mockPlayer.stop()).thenAnswer((_) async {});
    when(() => mockPlayer.pause()).thenAnswer((_) async {});
    when(() => mockPlayer.resume()).thenAnswer((_) async {});
    when(() => mockPlayer.dispose()).thenAnswer((_) async {});
    when(() => mockPlayer.setAudioContext(any())).thenAnswer((_) async {});
    when(() => mockPlayer.setPlayerMode(any())).thenAnswer((_) async {});
    when(() => mockPlayer.setVolume(any())).thenAnswer((_) async {});
    when(() => mockPlayer.play(any())).thenAnswer((_) async {});
    when(() => mockPlayer.seek(any())).thenAnswer((_) async {});

    when(() => mockRecorder.dispose()).thenAnswer((_) async {});

    tempDir = Directory.systemTemp.createTempSync('audio_rec_test_');

    service = DefaultAudioRecordingService(
      recorder: mockRecorder,
      player: mockPlayer,
    );
  });

  tearDown(() {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  group('AudioRecordingService Tests (Phase 5D.2)', () {
    test('hasPermission delegates to recorder.hasPermission', () async {
      when(() => mockRecorder.hasPermission()).thenAnswer((_) async => true);
      expect(await service.hasPermission(), true);

      when(() => mockRecorder.hasPermission()).thenAnswer((_) async => false);
      expect(await service.hasPermission(), false);
    });

    test('startRecording stops playback and starts recorder with AAC LC config', () async {
      when(() => mockRecorder.start(any(), path: any(named: 'path')))
          .thenAnswer((_) async {});

      final testPath = '${tempDir.path}/test.m4a';
      await service.startRecording(testPath);

      expect(service.isRecording, true);
      expect(service.isPaused, false);
      verify(() => mockRecorder.start(any(), path: testPath)).called(1);
    });

    test('pauseRecording and resumeRecording toggle state correctly', () async {
      when(() => mockRecorder.start(any(), path: any(named: 'path')))
          .thenAnswer((_) async {});
      when(() => mockRecorder.pause()).thenAnswer((_) async {});
      when(() => mockRecorder.resume()).thenAnswer((_) async {});

      await service.startRecording('${tempDir.path}/test.m4a');
      expect(service.isRecording, true);

      await service.pauseRecording();
      expect(service.isPaused, true);
      verify(() => mockRecorder.pause()).called(1);

      await service.resumeRecording();
      expect(service.isPaused, false);
      verify(() => mockRecorder.resume()).called(1);
    });

    test('stopRecording returns recorded file path when file exists and is non-empty', () async {
      final testPath = '${tempDir.path}/recorded.m4a';
      File(testPath).writeAsStringSync('valid recorded audio bytes');

      when(() => mockRecorder.start(any(), path: any(named: 'path')))
          .thenAnswer((_) async {});
      when(() => mockRecorder.stop()).thenAnswer((_) async => testPath);

      await service.startRecording(testPath);
      final result = await service.stopRecording();

      expect(result, testPath);
      expect(service.isRecording, false);
      expect(service.isPaused, false);
    });

    test('playAudio checks file existence and throws when file is missing', () async {
      final missingPath = '${tempDir.path}/non_existent.m4a';
      expect(
        () => service.playAudio(missingPath),
        throwsA(isA<FileSystemException>()),
      );
      verifyNever(() => mockPlayer.play(any()));
    });

    test('playAudio throws when file is empty (0 bytes)', () async {
      final emptyFile = File('${tempDir.path}/empty.m4a')..writeAsStringSync('');
      expect(
        () => service.playAudio(emptyFile.path),
        throwsA(isA<FileSystemException>()),
      );
      verifyNever(() => mockPlayer.play(any()));
    });

    test('playAudio configures speaker audio context, volume, and plays exact file', () async {
      final audioFile = File('${tempDir.path}/valid_audio.m4a')
        ..writeAsStringSync('aac audio content header');

      await service.playAudio(audioFile.path);

      expect(service.isPlaying, true);
      expect(service.isPlaybackPaused, false);
      verify(() => mockPlayer.setAudioContext(any())).called(1);
      verify(() => mockPlayer.setPlayerMode(PlayerMode.mediaPlayer)).called(1);
      verify(() => mockPlayer.setVolume(1.0)).called(1);
      verify(() => mockPlayer.play(any())).called(1);
    });

    test('pausePlayback and resumePlayback toggle playback state correctly', () async {
      final audioFile = File('${tempDir.path}/valid_audio.m4a')
        ..writeAsStringSync('audio data');

      await service.playAudio(audioFile.path);
      expect(service.isPlaying, true);

      await service.pausePlayback();
      expect(service.isPlaybackPaused, true);
      verify(() => mockPlayer.pause()).called(1);

      await service.resumePlayback();
      expect(service.isPlaybackPaused, false);
      expect(service.isPlaying, true);
      verify(() => mockPlayer.resume()).called(1);
    });

    test('stopPlayback stops player and resets position and flags', () async {
      final audioFile = File('${tempDir.path}/valid_audio.m4a')
        ..writeAsStringSync('audio data');

      await service.playAudio(audioFile.path);
      await service.stopPlayback();

      expect(service.isPlaying, false);
      expect(service.isPlaybackPaused, false);
      expect(service.currentPosition, Duration.zero);
      verify(() => mockPlayer.stop()).called(greaterThanOrEqualTo(1));
    });

    test('seekPlayback seeks to target position', () async {
      const seekTarget = Duration(seconds: 15);
      await service.seekPlayback(seekTarget);
      expect(service.currentPosition, seekTarget);
      verify(() => mockPlayer.seek(seekTarget)).called(1);
    });

    test('getAmplitudeNormalized clamps between 0.05 and 1.0', () async {
      when(() => mockRecorder.start(any(), path: any(named: 'path')))
          .thenAnswer((_) async {});
      when(() => mockRecorder.getAmplitude()).thenAnswer(
        (_) async => Amplitude(current: -10.0, max: 0.0),
      );

      await service.startRecording('${tempDir.path}/test.m4a');
      final normalized = await service.getAmplitudeNormalized();

      expect(normalized, greaterThan(0.0));
      expect(normalized, lessThanOrEqualTo(1.0));
    });

    test('deleteAudioFile stops player and deletes local file if exists', () async {
      final file = File('${tempDir.path}/temp.m4a')..writeAsStringSync('audio data');
      expect(file.existsSync(), true);

      await service.deleteAudioFile(file.path);
      expect(file.existsSync(), false);
      verify(() => mockPlayer.stop()).called(greaterThanOrEqualTo(1));
    });

    test('dispose stops and cleans up player and recorder', () async {
      await service.dispose();
      verify(() => mockPlayer.stop()).called(1);
      verify(() => mockPlayer.dispose()).called(1);
      verify(() => mockRecorder.dispose()).called(1);
    });
  });
}
