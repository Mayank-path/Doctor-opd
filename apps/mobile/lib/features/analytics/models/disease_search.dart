// Model classes for Standalone Disease and Clinical History Search

enum MatchCategory {
  diagnosis,
  clinicalNote,
  both,
}

extension MatchCategoryExtension on MatchCategory {
  String get label {
    switch (this) {
      case MatchCategory.diagnosis:
        return 'Diagnosis Match';
      case MatchCategory.clinicalNote:
        return 'Clinical Note Match';
      case MatchCategory.both:
        return 'Diagnosis & Note Match';
    }
  }

  static MatchCategory fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'DIAGNOSIS':
        return MatchCategory.diagnosis;
      case 'CLINICAL_NOTE':
        return MatchCategory.clinicalNote;
      case 'BOTH':
        return MatchCategory.both;
      default:
        return MatchCategory.clinicalNote;
    }
  }
}

class DiseaseSearchResultItem {
  final String consultationId;
  final DateTime consultationDate;
  final String patientId;
  final String patientName;
  final String patientUhid;
  final String? recordedDiagnosis;
  final MatchCategory matchCategory;
  final List<String> matchedFields;
  final String snippet;
  final String status;

  const DiseaseSearchResultItem({
    required this.consultationId,
    required this.consultationDate,
    required this.patientId,
    required this.patientName,
    required this.patientUhid,
    this.recordedDiagnosis,
    required this.matchCategory,
    required this.matchedFields,
    required this.snippet,
    required this.status,
  });

  factory DiseaseSearchResultItem.fromJson(Map<String, dynamic> json) {
    return DiseaseSearchResultItem(
      consultationId: json['consultationId'] as String? ?? '',
      consultationDate: DateTime.tryParse(json['consultationDate'] as String? ?? '') ?? DateTime.now(),
      patientId: json['patientId'] as String? ?? '',
      patientName: json['patientName'] as String? ?? 'Unknown Patient',
      patientUhid: json['patientUhid'] as String? ?? 'N/A',
      recordedDiagnosis: json['recordedDiagnosis'] as String?,
      matchCategory: MatchCategoryExtension.fromString(json['matchCategory'] as String?),
      matchedFields: (json['matchedFields'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      snippet: json['snippet'] as String? ?? '',
      status: json['status'] as String? ?? 'FINALIZED',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'consultationId': consultationId,
      'consultationDate': consultationDate.toIso8601String(),
      'patientId': patientId,
      'patientName': patientName,
      'patientUhid': patientUhid,
      'recordedDiagnosis': recordedDiagnosis,
      'matchCategory': matchCategory.name.toUpperCase(),
      'matchedFields': matchedFields,
      'snippet': snippet,
      'status': status,
    };
  }
}

class DiseaseSearchResponse {
  final String searchTerm;
  final int totalConsultations;
  final int uniquePatients;
  final int diagnosisMatchesCount;
  final int clinicalNoteMatchesCount;
  final int page;
  final int limit;
  final int totalPages;
  final List<DiseaseSearchResultItem> results;

  const DiseaseSearchResponse({
    required this.searchTerm,
    required this.totalConsultations,
    required this.uniquePatients,
    required this.diagnosisMatchesCount,
    required this.clinicalNoteMatchesCount,
    required this.page,
    required this.limit,
    required this.totalPages,
    required this.results,
  });

  factory DiseaseSearchResponse.fromJson(Map<String, dynamic> json) {
    return DiseaseSearchResponse(
      searchTerm: json['searchTerm'] as String? ?? '',
      totalConsultations: (json['totalConsultations'] as num?)?.toInt() ?? 0,
      uniquePatients: (json['uniquePatients'] as num?)?.toInt() ?? 0,
      diagnosisMatchesCount: (json['diagnosisMatchesCount'] as num?)?.toInt() ?? 0,
      clinicalNoteMatchesCount: (json['clinicalNoteMatchesCount'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
      results: (json['results'] as List<dynamic>?)
              ?.map((item) => DiseaseSearchResultItem.fromJson(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'searchTerm': searchTerm,
      'totalConsultations': totalConsultations,
      'uniquePatients': uniquePatients,
      'diagnosisMatchesCount': diagnosisMatchesCount,
      'clinicalNoteMatchesCount': clinicalNoteMatchesCount,
      'page': page,
      'limit': limit,
      'totalPages': totalPages,
      'results': results.map((r) => r.toJson()).toList(),
    };
  }
}

class DiseaseSuggestionsResponse {
  final String query;
  final List<String> suggestions;

  const DiseaseSuggestionsResponse({
    required this.query,
    required this.suggestions,
  });

  factory DiseaseSuggestionsResponse.fromJson(Map<String, dynamic> json) {
    return DiseaseSuggestionsResponse(
      query: json['query'] as String? ?? '',
      suggestions: (json['suggestions'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
    );
  }
}

