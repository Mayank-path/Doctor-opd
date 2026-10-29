import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/core/network/api_client.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/amend_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/approve_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/create_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/prescription.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/prescription_item.dart';
import 'package:doctor_opd_mobile/features/prescriptions/models/update_prescription_request.dart';
import 'package:doctor_opd_mobile/features/prescriptions/services/prescriptions_service.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _mockResponse(
  dynamic data, {
  String path = '/',
  int statusCode = 200,
}) {
  return Response(
    requestOptions: RequestOptions(path: path),
    statusCode: statusCode,
    data: data,
  );
}

void main() {
  late MockApiClient mockApiClient;
  late PrescriptionsService prescriptionsService;

  const validClinicId = '11111111-1111-1111-1111-111111111111';
  const validPatientId = '22222222-2222-2222-2222-222222222222';
  const validConsultationId = '33333333-3333-3333-3333-333333333333';
  const validPrescriptionId = '44444444-4444-4444-4444-444444444444';

  const testItem = PrescriptionItem(
    medicationName: 'Amoxicillin',
    brandName: 'Mox',
    dosageForm: DosageForm.capsule,
    strength: '500 mg',
    route: MedicationRoute.oral,
    frequency: '1-0-1',
    durationValue: 5,
    durationUnit: 'DAYS',
    timing: MedicationTiming.afterMeals,
  );

  final sampleRxJson = {
    'id': validPrescriptionId,
    'clinicId': validClinicId,
    'patientId': validPatientId,
    'consultationId': validConsultationId,
    'doctorId': 'doc-1',
    'versionNumber': 1,
    'status': 'DRAFT',
    'notes': 'Take after food',
    'createdAt': '2026-10-27T00:00:00.000Z',
    'updatedAt': '2026-10-27T00:00:00.000Z',
    'items': [
      {
        'id': 'item-1',
        'medicationName': 'Amoxicillin',
        'brandName': 'Mox',
        'dosageForm': 'CAPSULE',
        'strength': '500 mg',
        'route': 'ORAL',
        'frequency': '1-0-1',
        'durationValue': 5,
        'durationUnit': 'DAYS',
        'timing': 'AFTER_MEALS',
      }
    ],
  };

  setUp(() {
    mockApiClient = MockApiClient();
    prescriptionsService = PrescriptionsService(apiClient: mockApiClient);
  });

  group('createDraft Tests', () {
    test('sends POST /prescriptions for standalone draft and returns Prescription', () async {
      when(() => mockApiClient.post(
            '/prescriptions',
            data: any(named: 'data'),
          )).thenAnswer((_) async => _mockResponse(sampleRxJson, statusCode: 201));

      const request = CreatePrescriptionRequest(
        patientId: validPatientId,
        items: [testItem],
        notes: 'Take after food',
      );

      final result = await prescriptionsService.createDraft(request);

      expect(result.id, validPrescriptionId);
      expect(result.patientId, validPatientId);
      expect(result.items.length, 1);
      expect(result.status, PrescriptionStatus.draft);

      verify(() => mockApiClient.post(
            '/prescriptions',
            data: any(named: 'data'),
          )).called(1);
    });

    test('sends POST /consultations/:id/prescriptions for consultation-linked draft', () async {
      when(() => mockApiClient.post(
            '/consultations/$validConsultationId/prescriptions',
            data: any(named: 'data'),
          )).thenAnswer((_) async => _mockResponse(sampleRxJson, statusCode: 201));

      const request = CreatePrescriptionRequest(
        patientId: validPatientId,
        consultationId: validConsultationId,
        items: [testItem],
      );

      final result = await prescriptionsService.createDraft(request);

      expect(result.consultationId, validConsultationId);
      verify(() => mockApiClient.post(
            '/consultations/$validConsultationId/prescriptions',
            data: any(named: 'data'),
          )).called(1);
    });

    test('validates request client-side and throws 400 ApiException without calling network', () async {
      const invalidRequest = CreatePrescriptionRequest(
        patientId: '',
        items: [],
      );

      expect(
        () => prescriptionsService.createDraft(invalidRequest),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 400)),
      );

      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });
  });

  group('getPrescriptions & getPrescriptionById Tests', () {
    test('sends GET /prescriptions with query parameters and parses PaginatedPrescriptionsResponse', () async {
      final listJson = {
        'data': [sampleRxJson],
        'meta': {
          'total': 1,
          'page': 1,
          'limit': 20,
          'totalPages': 1,
        }
      };

      when(() => mockApiClient.get(
            '/prescriptions',
            queryParameters: any(named: 'queryParameters'),
          )).thenAnswer((_) async => _mockResponse(listJson));

      final res = await prescriptionsService.getPrescriptions(
        page: 1,
        limit: 20,
        patientId: validPatientId,
        status: PrescriptionStatus.draft,
      );

      expect(res.data.length, 1);
      expect(res.total, 1);
      expect(res.items.first.id, validPrescriptionId);

      verify(() => mockApiClient.get(
            '/prescriptions',
            queryParameters: {
              'page': 1,
              'limit': 20,
              'patientId': validPatientId,
              'status': 'DRAFT',
            },
          )).called(1);
    });

    test('sends GET /prescriptions/:id and returns parsed Prescription', () async {
      when(() => mockApiClient.get('/prescriptions/$validPrescriptionId'))
          .thenAnswer((_) async => _mockResponse(sampleRxJson));

      final rx = await prescriptionsService.getPrescriptionById(validPrescriptionId);

      expect(rx.id, validPrescriptionId);
      expect(rx.isDraft, isTrue);
    });

    test('rethrows ApiException when prescription is not found', () async {
      when(() => mockApiClient.get('/prescriptions/unknown-id'))
          .thenThrow(const ApiException(statusCode: 404, message: 'Prescription not found'));

      expect(
        () => prescriptionsService.getPrescriptionById('unknown-id'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404)),
      );
    });
  });

  group('updateDraft Tests', () {
    test('sends PATCH /prescriptions/:id and returns updated draft', () async {
      when(() => mockApiClient.patch(
            '/prescriptions/$validPrescriptionId',
            data: any(named: 'data'),
          )).thenAnswer((_) async => _mockResponse(sampleRxJson));

      const req = UpdatePrescriptionRequest(
        notes: 'Updated advice',
        items: [testItem],
      );

      final updated = await prescriptionsService.updateDraft(validPrescriptionId, req);

      expect(updated.id, validPrescriptionId);
      verify(() => mockApiClient.patch(
            '/prescriptions/$validPrescriptionId',
            data: any(named: 'data'),
          )).called(1);
    });

    test('rethrows 409 Conflict ApiException when prescription is already approved', () async {
      when(() => mockApiClient.patch(
            '/prescriptions/$validPrescriptionId',
            data: any(named: 'data'),
          )).thenThrow(const ConflictException(message: 'Approved prescriptions cannot be edited'));

      const req = UpdatePrescriptionRequest(
        items: [testItem],
      );

      expect(
        () => prescriptionsService.updateDraft(validPrescriptionId, req),
        throwsA(isA<ConflictException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });
  });

  group('approve Tests', () {
    test('sends POST /prescriptions/:id/approve with confirmApproval=true', () async {
      final approvedJson = Map<String, dynamic>.from(sampleRxJson);
      approvedJson['status'] = 'APPROVED';
      approvedJson['approvedAt'] = '2026-10-27T01:00:00.000Z';

      when(() => mockApiClient.post(
            '/prescriptions/$validPrescriptionId/approve',
            data: any(named: 'data'),
          )).thenAnswer((_) async => _mockResponse(approvedJson));

      const req = ApprovePrescriptionRequest(
        confirmApproval: true,
        doctorNotes: 'Prescription verified',
      );

      final approved = await prescriptionsService.approve(validPrescriptionId, req);

      expect(approved.isApproved, isTrue);
      expect(approved.status, PrescriptionStatus.approved);

      verify(() => mockApiClient.post(
            '/prescriptions/$validPrescriptionId/approve',
            data: {
              'confirmApproval': true,
              'doctorNotes': 'Prescription verified',
            },
          )).called(1);
    });

    test('rejects approval client-side when confirmApproval is false', () async {
      const invalidReq = ApprovePrescriptionRequest(confirmApproval: false);

      expect(
        () => prescriptionsService.approve(validPrescriptionId, invalidReq),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 400)),
      );

      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });
  });

  group('amend Tests', () {
    test('sends POST /prescriptions/:id/amend with mandatory amendmentReason', () async {
      final amendedJson = Map<String, dynamic>.from(sampleRxJson);
      amendedJson['id'] = 'rx-amended-v2';
      amendedJson['versionNumber'] = 2;
      amendedJson['status'] = 'DRAFT';
      amendedJson['supersedesPrescriptionId'] = validPrescriptionId;
      amendedJson['amendmentReason'] = 'Reduced dose due to mild nausea';

      when(() => mockApiClient.post(
            '/prescriptions/$validPrescriptionId/amend',
            data: any(named: 'data'),
          )).thenAnswer((_) async => _mockResponse(amendedJson, statusCode: 201));

      const req = AmendPrescriptionRequest(
        amendmentReason: 'Reduced dose due to mild nausea',
        items: [testItem],
      );

      final amended = await prescriptionsService.amend(validPrescriptionId, req);

      expect(amended.id, 'rx-amended-v2');
      expect(amended.versionNumber, 2);
      expect(amended.amendmentVersion, 2);
      expect(amended.supersedesPrescriptionId, validPrescriptionId);

      verify(() => mockApiClient.post(
            '/prescriptions/$validPrescriptionId/amend',
            data: any(named: 'data'),
          )).called(1);
    });

    test('rejects amendment client-side when amendmentReason is shorter than 5 chars', () async {
      const shortReasonReq = AmendPrescriptionRequest(
        amendmentReason: 'Tiny',
        items: [testItem],
      );

      expect(
        () => prescriptionsService.amend(validPrescriptionId, shortReasonReq),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 400)),
      );

      verifyNever(() => mockApiClient.post(any(), data: any(named: 'data')));
    });
  });

  group('downloadPdf Tests', () {
    test('sends GET /prescriptions/:id/pdf accepting application/pdf and returns Uint8List bytes', () async {
      final fakeBytes = [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]; // %PDF-1.4

      when(() => mockApiClient.get<List<int>>(
            '/prescriptions/$validPrescriptionId/pdf',
            options: any(named: 'options'),
          )).thenAnswer((_) async => Response<List<int>>(
            requestOptions: RequestOptions(path: '/prescriptions/$validPrescriptionId/pdf'),
            statusCode: 200,
            data: fakeBytes,
          ));

      final bytes = await prescriptionsService.downloadPdf(validPrescriptionId);

      expect(bytes, isA<Uint8List>());
      expect(bytes.length, 8);
      expect(bytes[0], 0x25); // '%'
      expect(bytes[1], 0x50); // 'P'
      expect(bytes[2], 0x44); // 'D'
      expect(bytes[3], 0x46); // 'F'

      verify(() => mockApiClient.get<List<int>>(
            '/prescriptions/$validPrescriptionId/pdf',
            options: any(named: 'options'),
          )).called(1);
    });

    test('rethrows 403 Forbidden ApiException on unauthorized PDF request', () async {
      when(() => mockApiClient.get<List<int>>(
            '/prescriptions/$validPrescriptionId/pdf',
            options: any(named: 'options'),
          )).thenThrow(const ForbiddenException(message: 'Access to patient prescription is restricted'));

      expect(
        () => prescriptionsService.downloadPdf(validPrescriptionId),
        throwsA(isA<ForbiddenException>()),
      );
    });
  });
}

