/// Response model from the NestJS cloud speech-to-text endpoint (`/api/v1/clinical-assist/transcribe`).
class TranscriptionResponse {
  final String transcript;
  final String? languageHint;
  final String? detectedLanguage;
  final double? durationSeconds;
  final String provider;
  final String model;

  const TranscriptionResponse({
    required this.transcript,
    this.languageHint,
    this.detectedLanguage,
    this.durationSeconds,
    required this.provider,
    required this.model,
  });

  factory TranscriptionResponse.fromJson(Map<String, dynamic> json) {
    double? parsedDuration;
    if (json['durationSeconds'] != null) {
      if (json['durationSeconds'] is num) {
        parsedDuration = (json['durationSeconds'] as num).toDouble();
      } else if (json['durationSeconds'] is String) {
        parsedDuration = double.tryParse(json['durationSeconds'] as String);
      }
    }

    return TranscriptionResponse(
      transcript: json['transcript'] as String? ?? '',
      languageHint: json['languageHint'] as String?,
      detectedLanguage: json['detectedLanguage'] as String?,
      durationSeconds: parsedDuration,
      provider: json['provider'] as String? ?? 'unknown',
      model: json['model'] as String? ?? 'unknown',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'transcript': transcript,
      if (languageHint != null) 'languageHint': languageHint,
      if (detectedLanguage != null) 'detectedLanguage': detectedLanguage,
      if (durationSeconds != null) 'durationSeconds': durationSeconds,
      'provider': provider,
      'model': model,
    };
  }

  TranscriptionResponse copyWith({
    String? transcript,
    String? languageHint,
    String? detectedLanguage,
    double? durationSeconds,
    String? provider,
    String? model,
  }) {
    return TranscriptionResponse(
      transcript: transcript ?? this.transcript,
      languageHint: languageHint ?? this.languageHint,
      detectedLanguage: detectedLanguage ?? this.detectedLanguage,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      provider: provider ?? this.provider,
      model: model ?? this.model,
    );
  }

  @override
  String toString() {
    return 'TranscriptionResponse(transcriptLength: ${transcript.length}, provider: $provider, model: $model, duration: ${durationSeconds}s)';
  }
}

