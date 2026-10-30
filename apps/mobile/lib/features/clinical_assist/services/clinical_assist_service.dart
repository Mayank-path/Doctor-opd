import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../models/structured_clinical_extraction.dart';
import '../models/transcription_response.dart';

/// Service managing communication with the backend Speech-to-Text transcription
/// and Structured Clinical Extraction APIs.
class ClinicalAssistService {
  final ApiClient _apiClient;

  static const int maxAudioFileSizeBytes = 10 * 1024 * 1024; // 10MB limit
  static const int maxClinicalTextLength = 5000;

  static final RegExp _prohibitedControlCharsRegex = RegExp(
    r'[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]',
  );

  ClinicalAssistService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Submits recorded clinical audio for transcription.
  ///
  /// Requirements:
  /// - [audioPath] must point to a valid, non-empty audio file under 10MB.
  /// - [patientId] must be a valid registered patient UUID.
  /// - [patientConsentVerified] must be explicitly `true`.
  /// - [languageHint] can be 'hi', 'en', 'hi-IN', 'en-IN', or 'auto'.
  Future<TranscriptionResponse> transcribeAudio({
    required String audioPath,
    required String patientId,
    required bool patientConsentVerified,
    String? languageHint,
  }) async {
    // 1. Validate Consent Attestation
    if (!patientConsentVerified) {
      throw const BadRequestException(
        message: 'Patient consent for cloud audio processing must be explicitly verified.',
      );
    }

    // 2. Validate Patient ID
    if (patientId.trim().isEmpty) {
      throw const BadRequestException(
        message: 'A registered patient must be selected before transcribing audio.',
      );
    }

    // 3. Validate Local Audio File
    final file = File(audioPath);
    if (!file.existsSync()) {
      throw const BadRequestException(
        message: 'Recorded audio file does not exist on device storage.',
      );
    }

    final fileSizeBytes = await file.length();
    if (fileSizeBytes == 0) {
      throw const BadRequestException(
        message: 'Recorded audio file is empty (0 bytes). Please re-record.',
      );
    }

    if (fileSizeBytes > maxAudioFileSizeBytes) {
      throw const BadRequestException(
        message: 'Recorded audio exceeds the maximum allowed upload limit of 10MB.',
      );
    }

    // Extract filename and derive clean multipart file
    final filename = file.uri.pathSegments.isNotEmpty
        ? file.uri.pathSegments.last
        : 'recording.m4a';

    final formData = FormData.fromMap({
      'audio': await MultipartFile.fromFile(
        audioPath,
        filename: filename,
      ),
      'patientId': patientId.trim(),
      'patientConsentVerified': 'true',
      if (languageHint != null && languageHint.trim().isNotEmpty)
        'languageHint': languageHint.trim(),
    });

    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/clinical-assist/transcribe',
        data: formData,
        options: Options(
          sendTimeout: const Duration(seconds: 45),
          receiveTimeout: const Duration(seconds: 45),
        ),
      );

      final data = response.data;
      if (data == null) {
        throw const ApiException(
          message: 'Received empty response body from transcription server.',
        );
      }

      return TranscriptionResponse.fromJson(data);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(message: 'Transcription failed: ${e.toString()}');
    }
  }

  /// Submits doctor-confirmed clinical consultation text for deterministic structured extraction.
  ///
  /// Requirements:
  /// - [text] must be a non-empty string between 1 and 5000 characters.
  /// - [text] must not contain prohibited ASCII C0 control characters or BiDi overrides.
  /// - Client authentication (Bearer token) and active clinic context (x-clinic-id)
  ///   are attached automatically by [AuthInterceptor].
  Future<StructuredClinicalExtractionResult> extractStructuredClinical(String text) async {
    // 1. Validate local text length and emptiness
    if (text.trim().isEmpty) {
      throw const BadRequestException(
        message: 'Clinical text must be a non-empty string',
      );
    }

    if (text.length > maxClinicalTextLength) {
      throw const BadRequestException(
        message: 'Clinical text exceeds maximum allowed length of 5000 characters',
      );
    }

    // 2. Reject prohibited control characters matching backend validation
    if (_prohibitedControlCharsRegex.hasMatch(text)) {
      throw const BadRequestException(
        message: 'Clinical text contains prohibited control characters',
      );
    }

    // 3. Post to backend extraction endpoint
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/clinical-assist/extract-structured',
        data: {'text': text},
        options: Options(
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
        ),
      );

      final data = response.data;
      if (data == null) {
        throw const ApiException(
          message: 'Received empty response body from extraction server.',
        );
      }

      return StructuredClinicalExtractionResult.fromJson(data);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(message: 'Structured clinical extraction failed: ${e.toString()}');
    }
  }
}
