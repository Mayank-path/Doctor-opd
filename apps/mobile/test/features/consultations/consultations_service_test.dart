import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/consultations/models/consultation.dart';
import 'package:doctor_opd_mobile/features/consultations/models/create_consultation_request.dart';
import 'package:doctor_opd_mobile/features/consultations/models/update_consultation_request.dart';
import 'package:doctor_opd_mobile/features/consultations/services/consultations_service.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _mockResponse(dynamic data, {String path = '/', int statusCode = 200}) {
  return Response(
    requestOptions: RequestOptions(path: path),
    statusCode: statusCode,
    data: data,
  );
}

void main() {
  late MockApiClient mockApiClient;
  late ConsultationsService consultationsService;

  const validClinicId = '11111111-1111-1111-1111-111111111111';
  const validPatientId = '22222222-2222-2222-2222-222222222222';
  const validDoctorId = '33333333-3333-3333-3333-333333333333';
  const validConsultationId = '44444444-4444-4444-4444-444444444444';

  final sampleDraftJson = {
    'id': validConsultationId,
    'clinicId': validClinicId,
    'patientId': validPatientId,
    'clinicianId': validDoctorId,
    'encounterDate': '2026-10-26T10:00:00.000Z',
    'chiefComplaint': 'Persistent high fever with cough',
    'symptoms': 'Chills, dry cough for 3 days',
    'examination': 'Throat congested, chest clear',
    'diagnosis': 'Acute Pharyngitis',
    'treatmentPlan': 'Antibiotics and hydration',
    'followUpDate': '2026-10-31',
    'status': 'DRAFT',
    'bpSystolic': 122,
    'bpDiastolic': 78,
    'pulse': 82,
    'temperature': 101.2,
    'weightKg': 68.0,
    'heightCm': 172.0,
    'spo2': 97,
    'respiratoryRate': 18,
    'finalizedAt': null,
    'createdAt': '2026-10-26T10:00:00.000Z',
    'updatedAt': '2026-10-26T10:00:00.000Z',
    'patient': {
      'id': validPatientId,
      'uhid': 'UHID-2026-009',
      'fullName': 'Aarav Patel',
    },
    'clinician': {
      'id': validDoctorId,
      'fullName': 'Dr. Sharma',
    },
  };

  setUp(() {
    mockApiClient = MockApiClient();
    consultationsService = ConsultationsService(apiClient: mockApiClient);
  });

  group('ConsultationsService Tests', () {
    test('createDraft sends POST /consultations and parses created Consultation', () async {
      when(() => mockApiClient.post(
            '/consultations',
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _mockResponse(sampleDraftJson, path: '/consultations'),
      );

      final request = CreateConsultationRequest(
        patientId: validPatientId,
        chiefComplaint: 'Persistent high fever with cough',
        symptoms: 'Chills, dry cough for 3 days',
        examination: 'Throat congested, chest clear',
        diagnosis: 'Acute Pharyngitis',
        treatmentPlan: 'Antibiotics and hydration',
        followUpDate: '2026-10-31',
        bpSystolic: 122,
        bpDiastolic: 78,
        pulse: 82,
        temperature: 101.2,
        weightKg: 68.0,
        heightCm: 172.0,
        spo2: 97,
        respiratoryRate: 18,
      );

      final result = await consultationsService.createDraft(request);

      verify(() => mockApiClient.post(
            '/consultations',
            data: any(named: 'data'),
          )).called(1);

      expect(result.id, validConsultationId);
      expect(result.status, ConsultationStatus.draft);
      expect(result.chiefComplaint, 'Persistent high fever with cough');
      expect(result.bpSystolic, 122);
    });

    test('getConsultations sends GET /consultations with query params and parses response', () async {
      when(() => mockApiClient.get(
            '/consultations',
            queryParameters: any(named: 'queryParameters'),
          )).thenAnswer(
        (_) async => _mockResponse({
          'data': [sampleDraftJson],
          'meta': {
            'total': 1,
            'page': 1,
            'limit': 10,
            'totalPages': 1,
          },
        }, path: '/consultations'),
      );

      final result = await consultationsService.getConsultations(
        status: ConsultationStatus.draft,
        page: 1,
        limit: 10,
      );

      verify(() => mockApiClient.get(
            '/consultations',
            queryParameters: {
              'page': 1,
              'limit': 10,
              'status': 'DRAFT',
            },
          )).called(1);

      expect(result.total, 1);
      expect(result.data.length, 1);
      expect(result.data.first.id, validConsultationId);
    });

    test('getConsultationById sends GET /consultations/:id and parses single record', () async {
      when(() => mockApiClient.get(
            '/consultations/$validConsultationId',
          )).thenAnswer(
        (_) async => _mockResponse(sampleDraftJson, path: '/consultations/$validConsultationId'),
      );

      final result = await consultationsService.getConsultationById(validConsultationId);

      verify(() => mockApiClient.get('/consultations/$validConsultationId')).called(1);
      expect(result.id, validConsultationId);
      expect(result.patient?.fullName, 'Aarav Patel');
    });

    test('updateDraft sends PATCH /consultations/:id with changes and parses updated record', () async {
      final updatedJson = Map<String, dynamic>.from(sampleDraftJson);
      updatedJson['diagnosis'] = 'Bacterial Pharyngitis';

      when(() => mockApiClient.patch(
            '/consultations/$validConsultationId',
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _mockResponse(updatedJson, path: '/consultations/$validConsultationId'),
      );

      const updateReq = UpdateConsultationRequest(
        diagnosis: 'Bacterial Pharyngitis',
      );

      final result = await consultationsService.updateDraft(validConsultationId, updateReq);

      verify(() => mockApiClient.patch(
            '/consultations/$validConsultationId',
            data: {'diagnosis': 'Bacterial Pharyngitis'},
          )).called(1);

      expect(result.diagnosis, 'Bacterial Pharyngitis');
    });

    test('finalize sends POST /consultations/:id/finalize and returns finalized record', () async {
      final finalizedJson = Map<String, dynamic>.from(sampleDraftJson);
      finalizedJson['status'] = 'FINALIZED';
      finalizedJson['finalizedAt'] = '2026-10-26T10:45:00.000Z';

      when(() => mockApiClient.post(
            '/consultations/$validConsultationId/finalize',
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _mockResponse(finalizedJson, path: '/consultations/$validConsultationId/finalize'),
      );

      final result = await consultationsService.finalize(validConsultationId);

      verify(() => mockApiClient.post(
            '/consultations/$validConsultationId/finalize',
            data: any(named: 'data'),
          )).called(1);

      expect(result.status, ConsultationStatus.finalized);
      expect(result.isFinalized, isTrue);
      expect(result.finalizedAt, isNotNull);
    });

    test('getPatientHistory sends GET /patients/:patientId/consultations', () async {
      when(() => mockApiClient.get(
            '/patients/$validPatientId/consultations',
            queryParameters: any(named: 'queryParameters'),
          )).thenAnswer(
        (_) async => _mockResponse({
          'data': [sampleDraftJson],
          'meta': {
            'total': 1,
            'page': 1,
            'limit': 10,
            'totalPages': 1,
          },
        }, path: '/patients/$validPatientId/consultations'),
      );

      final result = await consultationsService.getPatientHistory(validPatientId);

      verify(() => mockApiClient.get(
            '/patients/$validPatientId/consultations',
            queryParameters: {'page': 1, 'limit': 20},
          )).called(1);

      expect(result.total, 1);
      expect(result.data.first.patientId, validPatientId);
    });

    test('handles 403 Forbidden safely when non-doctor or non-assigned clinician calls API', () async {
      when(() => mockApiClient.patch(
            '/consultations/$validConsultationId',
            data: any(named: 'data'),
          )).thenThrow(
        ApiException(
          message: 'Only the assigned clinician may update this draft',
          statusCode: 403,
        ),
      );

      expect(
        () => consultationsService.updateDraft(
          validConsultationId,
          const UpdateConsultationRequest(diagnosis: 'New Diagnosis'),
        ),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'statusCode', 403),
        ),
      );
    });

    test('handles 409 Conflict when attempting to edit or finalize already finalized record', () async {
      when(() => mockApiClient.post(
            '/consultations/$validConsultationId/finalize',
            data: any(named: 'data'),
          )).thenThrow(
        ApiException(
          message: 'Cannot finalize: consultation is already finalized',
          statusCode: 409,
        ),
      );

      expect(
        () => consultationsService.finalize(validConsultationId),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409),
        ),
      );
    });

    test('handles 404 Not Found when consultation does not exist', () async {
      when(() => mockApiClient.get('/consultations/unknown-id')).thenThrow(
        ApiException(
          message: 'Consultation not found',
          statusCode: 404,
        ),
      );

      expect(
        () => consultationsService.getConsultationById('unknown-id'),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404),
        ),
      );
    });
  });
}
