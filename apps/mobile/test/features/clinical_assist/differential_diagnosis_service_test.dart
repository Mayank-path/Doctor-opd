import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/differential_evaluation_models.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/services/differential_diagnosis_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late DifferentialDiagnosisService service;

  setUp(() {
    mockApiClient = MockApiClient();
    service = DifferentialDiagnosisService(apiClient: mockApiClient);
  });

  group('DifferentialDiagnosisService Input Validation', () {
    test('throws BadRequestException when patientId is empty', () async {
      const req = EvaluateDifferentialRequest(
        patientId: '   ',
        findings: [
          DifferentialFindingInput(
            canonicalTerm: 'Cough',
            status: EvaluationFindingStatus.present,
          ),
        ],
      );

      expect(
        () => service.evaluateDifferential(req),
        throwsA(isA<BadRequestException>().having(
          (e) => e.message,
          'message',
          contains('A registered patient must be specified'),
        )),
      );
    });

    test('throws BadRequestException when findings count exceeds 50', () async {
      final req = EvaluateDifferentialRequest(
        patientId: 'p-123',
        findings: List.generate(
          51,
          (i) => DifferentialFindingInput(
            canonicalTerm: 'Symptom $i',
            status: EvaluationFindingStatus.present,
          ),
        ),
      );

      expect(
        () => service.evaluateDifferential(req),
        throwsA(isA<BadRequestException>().having(
          (e) => e.message,
          'message',
          contains('Findings count cannot exceed 50 items'),
        )),
      );
    });
  });

  group('DifferentialDiagnosisService Network Calls', () {
    test('successfully sends POST request and parses EVALUATED response', () async {
      const req = EvaluateDifferentialRequest(
        patientId: '11111111-1111-1111-1111-111111111111',
        findings: [
          DifferentialFindingInput(
            canonicalTerm: 'Fever',
            status: EvaluationFindingStatus.present,
          ),
        ],
        vitals: DifferentialVitalsInput(temperatureC: 38.5),
      );

      final backendResponseData = {
        'status': 'EVALUATED',
        'evaluatedAt': '2026-10-31T01:00:00.000Z',
        'engineVersion': '1.0.0',
        'knowledgePack': {
          'domain': 'GENERAL_MEDICINE',
          'version': '1.0.0',
          'releaseStatus': 'RELEASED',
          'releaseScope': 'GLOBAL',
          'checksumSha256': 'sha256checksum',
        },
        'patientContext': {
          'patientId': '11111111-1111-1111-1111-111111111111',
          'resolvedAgeYears': 35,
          'ageSource': 'PATIENT_DOB',
          'gender': 'FEMALE',
        },
        'infectionSuspicion': 'SUSPECTED',
        'hasUrgentRedFlags': false,
        'redFlags': [],
        'candidateMatches': [
          {
            'conditionCode': 'COND-URTI-01',
            'conditionDisplayName': 'Acute Viral Pharyngitis',
            'category': 'Respiratory',
            'ruleCode': 'R-URTI-01',
            'ruleTitle': 'Pharyngitis Rule',
            'tier': 'STRONG_MATCH',
            'minMajorCount': 1,
            'majorSupportingMatchedCount': 1,
            'mandatoryResult': {
              'satisfied': true,
              'result': 'SATISFIED',
              'explanation': 'Sore throat documented',
            },
            'majorSupportingResults': [],
            'minorSupportingResults': [],
            'contradictionResults': [],
            'contradictionTriggered': false,
            'missingInformation': [],
            'unperformedAssessments': [],
            'suggestedInvestigations': ['Rapid Antigen Test'],
            'isComplete': true,
            'rationale': 'Strong match criteria met',
          }
        ],
        'tierSummary': {
          'strongMatchCount': 1,
          'moderateMatchCount': 0,
          'possibleMatchCount': 0,
          'contradictedMatchCount': 0,
          'unmatchedCount': 0,
        },
        'warnings': [],
        'requiresDoctorReview': true,
        'disclaimer': 'Clinical decision support disclaimer',
      };

      when(() => mockApiClient.post<Map<String, dynamic>>(
            '/clinical-assist/differential-diagnosis/evaluate',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer((_) async => Response(
            data: backendResponseData,
            statusCode: 200,
            requestOptions: RequestOptions(path: '/clinical-assist/differential-diagnosis/evaluate'),
          ));

      final response = await service.evaluateDifferential(req);

      expect(response.status, DifferentialEvaluationStatus.evaluated);
      expect(response.isEvaluated, isTrue);
      expect(response.candidateMatches.length, 1);
      expect(response.candidateMatches.first.conditionDisplayName, 'Acute Viral Pharyngitis');
      expect(response.tierSummary?.strongMatchCount, 1);

      verify(() => mockApiClient.post<Map<String, dynamic>>(
            '/clinical-assist/differential-diagnosis/evaluate',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).called(1);
    });

    test('rethrows ApiException when backend returns 403 or 400', () async {
      const req = EvaluateDifferentialRequest(
        patientId: '11111111-1111-1111-1111-111111111111',
        findings: [],
      );

      when(() => mockApiClient.post<Map<String, dynamic>>(
            '/clinical-assist/differential-diagnosis/evaluate',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenThrow(const ForbiddenException(message: 'Active clinic context is required'));

      expect(
        () => service.evaluateDifferential(req),
        throwsA(isA<ForbiddenException>().having(
          (e) => e.message,
          'message',
          contains('Active clinic context is required'),
        )),
      );
    });

    test('throws ApiException when response data is null', () async {
      const req = EvaluateDifferentialRequest(
        patientId: '11111111-1111-1111-1111-111111111111',
        findings: [],
      );

      when(() => mockApiClient.post<Map<String, dynamic>>(
            '/clinical-assist/differential-diagnosis/evaluate',
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer((_) async => Response(
            data: null,
            statusCode: 200,
            requestOptions: RequestOptions(path: '/clinical-assist/differential-diagnosis/evaluate'),
          ));

      expect(
        () => service.evaluateDifferential(req),
        throwsA(isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('Received empty response body'),
        )),
      );
    });
  });
}

