import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/patients/models/create_patient_request.dart';
import 'package:doctor_opd_mobile/features/patients/models/paginated_patients_response.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';
import 'package:doctor_opd_mobile/features/patients/models/update_patient_request.dart';

void main() {
  group('Patient Entity Model Tests', () {
    final sampleJson = {
      'id': 'pat-uuid-1',
      'clinicId': 'clinic-uuid-1',
      'uhid': 'UHID-000001',
      'fullName': 'Aarav Sharma',
      'gender': 'MALE',
      'dateOfBirth': '1995-04-12T00:00:00.000Z',
      'phone': '+919876543210',
      'alternatePhone': '+919876543211',
      'email': 'aarav@health.in',
      'address': '123 MG Road',
      'city': 'Bengaluru',
      'pincode': '560001',
      'isActive': true,
      'deletedAt': null,
      'createdAt': '2026-10-24T10:00:00.000Z',
      'updatedAt': '2026-10-24T10:00:00.000Z',
    };

    test('Patient.fromJson parses all fields and formats date of birth', () {
      final patient = Patient.fromJson(sampleJson);

      expect(patient.id, equals('pat-uuid-1'));
      expect(patient.uhid, equals('UHID-000001'));
      expect(patient.fullName, equals('Aarav Sharma'));
      expect(patient.gender, equals('MALE'));
      expect(patient.formattedDob, equals('1995-04-12'));
      expect(patient.age, isNotNull);
      expect(patient.age!, greaterThanOrEqualTo(30));
      expect(patient.phone, equals('+919876543210'));
      expect(patient.city, equals('Bengaluru'));
      expect(patient.isActive, isTrue);
    });

    test('Patient.fromJson handles null optional fields gracefully', () {
      final minimalJson = {
        'id': 'pat-uuid-2',
        'clinicId': 'clinic-uuid-1',
        'uhid': 'UHID-000002',
        'fullName': 'Sunita Rao',
        'gender': 'FEMALE',
        'phone': '+919876543212',
      };

      final patient = Patient.fromJson(minimalJson);

      expect(patient.id, equals('pat-uuid-2'));
      expect(patient.dateOfBirth, isNull);
      expect(patient.formattedDob, isNull);
      expect(patient.age, isNull);
      expect(patient.email, isNull);
      expect(patient.city, isNull);
    });

    test('PaginatedPatientsResponse correctly parses items and pagination metadata', () {
      final paginatedJson = {
        'data': [sampleJson],
        'meta': {
          'page': 1,
          'limit': 20,
          'total': 45,
          'totalPages': 3,
        },
      };

      final response = PaginatedPatientsResponse.fromJson(paginatedJson);

      expect(response.data.length, equals(1));
      expect(response.meta.page, equals(1));
      expect(response.meta.total, equals(45));
      expect(response.meta.totalPages, equals(3));
      expect(response.meta.hasNextPage, isTrue);
    });
  });

  group('CreatePatientRequest Validation Tests', () {
    test('passes validation for valid mandatory and optional fields', () {
      const request = CreatePatientRequest(
        fullName: 'Vikram Singh',
        gender: 'MALE',
        phone: '+919876543210',
        dateOfBirth: '1990-01-15',
        email: 'vikram@clinic.in',
      );

      final errors = request.validate();
      expect(errors, isEmpty);
    });

    test('rejects empty or whitespace full name', () {
      const request = CreatePatientRequest(
        fullName: '   ',
        gender: 'MALE',
        phone: '+919876543210',
      );

      final errors = request.validate();
      expect(errors['fullName'], contains('required'));
    });

    test('rejects full name exceeding 128 characters', () {
      final request = CreatePatientRequest(
        fullName: 'A' * 129,
        gender: 'MALE',
        phone: '+919876543210',
      );

      final errors = request.validate();
      expect(errors['fullName'], contains('128'));
    });

    test('rejects invalid gender value', () {
      const request = CreatePatientRequest(
        fullName: 'Deepa Verma',
        gender: 'UNKNOWN',
        phone: '+919876543210',
      );

      final errors = request.validate();
      expect(errors['gender'], contains('MALE, FEMALE, or OTHER'));
    });

    test('rejects malformed telephone format', () {
      const request = CreatePatientRequest(
        fullName: 'Deepa Verma',
        gender: 'FEMALE',
        phone: '123', // too short (<7)
      );

      final errors = request.validate();
      expect(errors['phone'], contains('7 and 20'));
    });

    test('rejects future date of birth', () {
      const request = CreatePatientRequest(
        fullName: 'Ananya Roy',
        gender: 'FEMALE',
        phone: '+919876543210',
        dateOfBirth: '2099-12-31',
      );

      final errors = request.validate();
      expect(errors['dateOfBirth'], contains('cannot be in the future'));
    });

    test('rejects malformed email address', () {
      const request = CreatePatientRequest(
        fullName: 'Ananya Roy',
        gender: 'FEMALE',
        phone: '+919876543210',
        email: 'not-an-email',
      );

      final errors = request.validate();
      expect(errors['email'], contains('valid email'));
    });
  });

  group('UpdatePatientRequest Tests', () {
    test('detects hasUpdates correctly', () {
      const emptyUpdate = UpdatePatientRequest();
      expect(emptyUpdate.hasUpdates, isFalse);

      const validUpdate = UpdatePatientRequest(city: 'Pune');
      expect(validUpdate.hasUpdates, isTrue);
      expect(validUpdate.validate(), isEmpty);
    });

    test('validates modified fields in update request', () {
      const invalidUpdate = UpdatePatientRequest(phone: 'bad');
      final errors = invalidUpdate.validate();
      expect(errors['phone'], contains('7 and 20'));
    });
  });
}
