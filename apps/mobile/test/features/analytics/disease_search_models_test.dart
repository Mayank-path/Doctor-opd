import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/features/analytics/models/disease_search.dart';

void main() {
  group('DiseaseSearch Models Unit Tests', () {
    test('parses MatchCategory strings correctly', () {
      expect(MatchCategoryExtension.fromString('DIAGNOSIS'), MatchCategory.diagnosis);
      expect(MatchCategoryExtension.fromString('CLINICAL_NOTE'), MatchCategory.clinicalNote);
      expect(MatchCategoryExtension.fromString('BOTH'), MatchCategory.both);
      expect(MatchCategoryExtension.fromString('UNKNOWN'), MatchCategory.clinicalNote);
      expect(MatchCategoryExtension.fromString(null), MatchCategory.clinicalNote);

      expect(MatchCategory.diagnosis.label, 'Diagnosis Match');
      expect(MatchCategory.clinicalNote.label, 'Clinical Note Match');
      expect(MatchCategory.both.label, 'Diagnosis & Note Match');
    });

    test('parses DiseaseSearchResultItem and preserves diagnosis integrity', () {
      final json = {
        'consultationId': 'c-100',
        'consultationDate': '2026-11-07T12:00:00.000Z',
        'patientId': 'p-200',
        'patientName': 'Alice Wonderland',
        'patientUhid': 'UHID-ALICE',
        'recordedDiagnosis': 'Hypertension Stage 1',
        'matchCategory': 'DIAGNOSIS',
        'matchedFields': ['Diagnosis'],
        'snippet': '...diagnosed with Hypertension Stage 1...',
        'status': 'FINALIZED',
      };

      final item = DiseaseSearchResultItem.fromJson(json);
      expect(item.consultationId, 'c-100');
      expect(item.patientName, 'Alice Wonderland');
      expect(item.patientUhid, 'UHID-ALICE');
      expect(item.recordedDiagnosis, 'Hypertension Stage 1');
      expect(item.matchCategory, MatchCategory.diagnosis);
      expect(item.matchedFields, ['Diagnosis']);
      expect(item.snippet, contains('Hypertension'));
      expect(item.status, 'FINALIZED');

      final serialized = item.toJson();
      expect(serialized['consultationId'], 'c-100');
      expect(serialized['matchCategory'], 'DIAGNOSIS');
    });

    test('parses DiseaseSearchResponse with aggregated metrics', () {
      final json = {
        'searchTerm': 'fever',
        'totalConsultations': 3,
        'uniquePatients': 2,
        'diagnosisMatchesCount': 1,
        'clinicalNoteMatchesCount': 3,
        'page': 1,
        'limit': 20,
        'totalPages': 1,
        'results': [
          {
            'consultationId': 'c-1',
            'consultationDate': '2026-11-07T10:00:00.000Z',
            'patientId': 'p-1',
            'patientName': 'Mayan',
            'patientUhid': 'UHID-001',
            'recordedDiagnosis': 'Acute URTI',
            'matchCategory': 'CLINICAL_NOTE',
            'matchedFields': ['Symptoms', 'Chief Complaint'],
            'snippet': 'Fever for 3 days',
            'status': 'FINALIZED',
          }
        ],
      };

      final response = DiseaseSearchResponse.fromJson(json);
      expect(response.searchTerm, 'fever');
      expect(response.totalConsultations, 3);
      expect(response.uniquePatients, 2);
      expect(response.diagnosisMatchesCount, 1);
      expect(response.clinicalNoteMatchesCount, 3);
      expect(response.results, hasLength(1));
      expect(response.results[0].matchCategory, MatchCategory.clinicalNote);
      expect(response.results[0].recordedDiagnosis, 'Acute URTI');
    });

    test('parses DiseaseSuggestionsResponse', () {
      final json = {
        'query': 'pharyng',
        'suggestions': ['Acute Pharyngitis', 'Viral Pharyngitis'],
      };

      final sugg = DiseaseSuggestionsResponse.fromJson(json);
      expect(sugg.query, 'pharyng');
      expect(sugg.suggestions, ['Acute Pharyngitis', 'Viral Pharyngitis']);
    });
  });
}
