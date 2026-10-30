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
  });

  setUp(() {
    mockRecorder = MockAudioRecorder();
    mockPlayer = MockAudioPlayer();
    service = DefaultAudioRecordingService(
      recorder: mockRecorder,
      player: mockPlayer,
    );
    tempDir = Directory.systemTemp.createTempSync('audio_rec_test_');
  });

  tearDown(() {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  group('AudioRecordingService Tests', () {
    test('hasPermission delegates to recorder.hasPermission', () async {
      when(() => mockRecorder.hasPermission()).thenAnswer((_) async => true);
      expect(await service.hasPermission(), true);

      when(() => mockRecorder.hasPermission()).thenAnswer((_) async => false);
      expect(await service.hasPermission(), false);
    });

    test('startRecording stops playback and starts recorder with AAC LC config', () async {
      when(() => mockPlayer.stop()).thenAnswer((_) async {});
      when(() => mockRecorder.start(any(), path: any(named: 'path')))
          .thenAnswer((_) async {});

      final testPath = '${tempDir.path}/test.m4a';
      await service.startRecording(testPath);

      expect(service.isRecording, true);
      expect(service.isPaused, false);
      verify(() => mockRecorder.start(any(), path: testPath)).called(1);
    });

    test('pauseRecording and resumeRecording toggle state correctly', () async {
      when(() => mockPlayer.stop()).thenAnswer((_) async {});
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

    test('stopRecording returns recorded file path and resets flags', () async {
      when(() => mockPlayer.stop()).thenAnswer((_) async {});
      when(() => mockRecorder.start(any(), path: any(named: 'path')))
          .thenAnswer((_) async {});
      final testPath = '${tempDir.path}/recorded.m4a';
      when(() => mockRecorder.stop()).thenAnswer((_) async => testPath);

      await service.startRecording(testPath);
      final result = await service.stopRecording();

      expect(result, testPath);
      expect(service.isRecording, false);
      expect(service.isPaused, false);
    });

    test('getAmplitudeNormalized clamps between 0.05 and 1.0', () async {
      when(() => mockPlayer.stop()).thenAnswer((_) async {});
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

    test('deleteAudioFile deletes local file if exists', () async {
      final file = File('${tempDir.path}/temp.m4a')..writeAsStringSync('audio data');
      expect(file.existsSync(), true);

      await service.deleteAudioFile(file.path);
      expect(file.existsSync(), false);
    });
  });
}
