import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/services/clinical_assist_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late ClinicalAssistService service;
  late Directory tempDir;
  late File validAudioFile;

  setUpAll(() {
    registerFallbackValue(FormData());
    registerFallbackValue(Options());
  });

  setUp(() {
    mockApiClient = MockApiClient();
    service = ClinicalAssistService(apiClient: mockApiClient);

    tempDir = Directory.systemTemp.createTempSync('clinical_assist_test_');
    validAudioFile = File('${tempDir.path}/test_recording.m4a')
      ..writeAsBytesSync(List.generate(1024, (i) => i % 256));
  });

  tearDown(() {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  group('ClinicalAssistService Tests', () {
    const testPatientId = '123e4567-e89b-12d3-a456-426614174000';

    test('rejects transcription if patientConsentVerified is false', () async {
      expect(
        () => service.transcribeAudio(
          audioPath: validAudioFile.path,
          patientId: testPatientId,
          patientConsentVerified: false,
        ),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('rejects transcription if patientId is empty', () async {
      expect(
        () => service.transcribeAudio(
          audioPath: validAudioFile.path,
          patientId: '   ',
          patientConsentVerified: true,
        ),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('rejects transcription if local audio file does not exist', () async {
      expect(
        () => service.transcribeAudio(
          audioPath: '${tempDir.path}/non_existent.m4a',
          patientId: testPatientId,
          patientConsentVerified: true,
        ),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('rejects transcription if local audio file is 0 bytes (empty)', () async {
      final emptyFile = File('${tempDir.path}/empty.m4a')..writeAsBytesSync([]);

      expect(
        () => service.transcribeAudio(
          audioPath: emptyFile.path,
          patientId: testPatientId,
          patientConsentVerified: true,
        ),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('rejects transcription if audio file exceeds 10MB limit', () async {
      final mockLargeFile = File('${tempDir.path}/large.m4a');
      final raf = await mockLargeFile.open(mode: FileMode.write);
      await raf.truncate(10 * 1024 * 1024 + 1024);
      await raf.close();

      expect(
        () => service.transcribeAudio(
          audioPath: mockLargeFile.path,
          patientId: testPatientId,
          patientConsentVerified: true,
        ),
        throwsA(isA<BadRequestException>()),
      );
    });

    test('successfully uploads audio and parses TranscriptionResponse', () async {
      FormData? capturedFormData;

      when(() => mockApiClient.post<Map<String, dynamic>>(
            '/clinical-assist/transcribe',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer((invocation) async {
        capturedFormData = invocation.namedArguments[#data] as FormData;
        return Response<Map<String, dynamic>>(
          requestOptions: RequestOptions(path: '/clinical-assist/transcribe'),
          statusCode: 200,
          data: {
            'transcript': 'Mareez ko do din se tez bukhar hai.',
            'languageHint': 'hi-IN',
            'detectedLanguage': 'hi',
            'durationSeconds': 5.2,
            'provider': 'openai',
            'model': 'gpt-4o-transcribe',
          },
        );
      });

      final result = await service.transcribeAudio(
        audioPath: validAudioFile.path,
        patientId: testPatientId,
        patientConsentVerified: true,
        languageHint: 'hi-IN',
      );

      expect(result.transcript, 'Mareez ko do din se tez bukhar hai.');
      expect(result.detectedLanguage, 'hi');
      expect(result.durationSeconds, 5.2);
      expect(result.provider, 'openai');
      expect(result.model, 'gpt-4o-transcribe');

      expect(capturedFormData, isNotNull);
      final fields = Map.fromEntries(capturedFormData!.fields);
      expect(fields['patientId'], testPatientId);
      expect(fields['patientConsentVerified'], 'true');
      expect(fields['languageHint'], 'hi-IN');
      expect(capturedFormData!.files.length, 1);
      expect(capturedFormData!.files.first.key, 'audio');
    });

    test('rethrows ApiException when backend returns 403 Forbidden or 404', () async {
      when(() => mockApiClient.post<Map<String, dynamic>>(
            '/clinical-assist/transcribe',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenThrow(const ForbiddenException(message: 'Not an active doctor in this clinic'));

      expect(
        () => service.transcribeAudio(
          audioPath: validAudioFile.path,
          patientId: testPatientId,
          patientConsentVerified: true,
        ),
        throwsA(isA<ForbiddenException>()),
      );
    });

    group('extractStructuredClinical Tests', () {
      test('rejects empty or whitespace clinical text with BadRequestException', () async {
        expect(
          () => service.extractStructuredClinical(''),
          throwsA(isA<BadRequestException>()),
        );
        expect(
          () => service.extractStructuredClinical('   \n  \t  '),
          throwsA(isA<BadRequestException>()),
        );
      });

      test('rejects clinical text exceeding 5000 characters with BadRequestException', () async {
        final hugeText = 'a' * 5001;
        expect(
          () => service.extractStructuredClinical(hugeText),
          throwsA(isA<BadRequestException>()),
        );
      });

      test('rejects clinical text containing prohibited control characters', () async {
        // ASCII C0 Null byte
        expect(
          () => service.extractStructuredClinical('Mareez ko \u0000 bukhar hai'),
          throwsA(isA<BadRequestException>()),
        );
        // Unicode BiDi override
        expect(
          () => service.extractStructuredClinical('Mareez ko \u202E bukhar hai'),
          throwsA(isA<BadRequestException>()),
        );
      });

      test('successfully calls /clinical-assist/extract-structured and returns StructuredClinicalExtractionResult', () async {
        Map<String, dynamic>? capturedBody;

        when(() => mockApiClient.post<Map<String, dynamic>>(
              '/clinical-assist/extract-structured',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((invocation) async {
          capturedBody = invocation.namedArguments[#data] as Map<String, dynamic>;
          return Response<Map<String, dynamic>>(
            requestOptions: RequestOptions(path: '/clinical-assist/extract-structured'),
            statusCode: 200,
            data: {
              'schemaVersion': '1.0.0',
              'extractionEngineVersion': '1.0.0',
              'normalizationEngineVersion': '1.0.0',
              'source': {
                'originalDoctorConfirmedText': 'Mareez ko bukhar hai',
                'detectedLanguage': 'HINGLISH',
                'characterCount': 20,
              },
              'findings': [
                {
                  'id': 'finding-fever-0',
                  'canonicalTermId': 'SYM-FEVER',
                  'canonicalDisplayName': 'Fever',
                  'originalExpression': 'bukhar',
                  'conceptCategory': 'SYMPTOM',
                  'status': 'PRESENT',
                  'certainty': 'CONFIRMED',
                  'temporalStatements': [],
                  'chronologicalRelationships': [],
                  'severityAssessment': {
                    'state': 'NOT_MENTIONED',
                    'level': null,
                    'evidence': null,
                  },
                  'bodyLocation': {
                    'name': null,
                    'isDefault': false,
                    'evidenceSpan': null,
                  },
                  'provenance': [],
                  'validationWarnings': [],
                }
              ],
              'clinicalAssessments': [],
              'unmappedExpressions': [],
              'summaryCounts': {
                'totalFindings': 1,
                'presentCount': 1,
                'absentCount': 0,
                'uncertainCount': 0,
                'unknownCount': 0,
                'unmappedCount': 0,
                'clinicalAssessmentsCount': 0,
              },
              'review': {
                'requiresDoctorReview': true,
                'reviewStatus': 'PENDING_REVIEW',
                'systemSafetyNotice': 'Extraction is an assistive aid only.',
              },
            },
          );
        });

        const testText = 'Mareez ko bukhar hai';
        final result = await service.extractStructuredClinical(testText);

        expect(capturedBody, {'text': testText});
        expect(result.findings.length, 1);
        expect(result.findings.first.canonicalDisplayName, 'Fever');
        expect(result.summaryCounts.presentCount, 1);
        expect(result.review.requiresDoctorReview, isTrue);
      });

      test('rethrows typed ApiException on 401 Unauthorized or 403 Forbidden', () async {
        when(() => mockApiClient.post<Map<String, dynamic>>(
              '/clinical-assist/extract-structured',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenThrow(const UnauthorizedException(message: 'Invalid session'));

        expect(
          () => service.extractStructuredClinical('Mareez ko bukhar hai'),
          throwsA(isA<UnauthorizedException>()),
        );
      });

      test('rethrows RateLimitedException when backend returns 429', () async {
        when(() => mockApiClient.post<Map<String, dynamic>>(
              '/clinical-assist/extract-structured',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenThrow(const RateLimitedException(message: 'Rate limit exceeded'));

        expect(
          () => service.extractStructuredClinical('Mareez ko bukhar hai'),
          throwsA(isA<RateLimitedException>()),
        );
      });

      test('throws ApiException when backend returns null data', () async {
        when(() => mockApiClient.post<Map<String, dynamic>>(
              '/clinical-assist/extract-structured',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => Response<Map<String, dynamic>>(
              requestOptions: RequestOptions(path: '/clinical-assist/extract-structured'),
              statusCode: 200,
              data: null,
            ));

        expect(
          () => service.extractStructuredClinical('Mareez ko bukhar hai'),
          throwsA(isA<ApiException>()),
        );
      });
    });
  });
}
