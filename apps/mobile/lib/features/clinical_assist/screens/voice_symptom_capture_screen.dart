import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../consultations/ui/components/patient_search_selector.dart';
import '../../patients/models/patient.dart';
import '../../patients/services/patients_service.dart';
import '../services/audio_recording_service.dart';
import '../services/clinical_assist_service.dart';
import '../widgets/audio_recorder_controls.dart';
import '../widgets/audio_recording_waveform.dart';
import '../widgets/consent_confirmation_dialog.dart';
import 'transcript_review_screen.dart';

/// Screen allowing doctors to capture clinical voice symptoms, record audio,
/// request cloud transcription, and review transcripts.
class VoiceSymptomCaptureScreen extends StatefulWidget {
  final Patient? initialPatient;
  final PatientsService? patientsService;
  final ClinicalAssistService? clinicalAssistService;
  final AudioRecordingService? audioRecordingService;
  final Future<String> Function()? tempDirectoryProvider;

  const VoiceSymptomCaptureScreen({
    super.key,
    this.initialPatient,
    this.patientsService,
    this.clinicalAssistService,
    this.audioRecordingService,
    this.tempDirectoryProvider,
  });

  @override
  State<VoiceSymptomCaptureScreen> createState() => _VoiceSymptomCaptureScreenState();
}

class _VoiceSymptomCaptureScreenState extends State<VoiceSymptomCaptureScreen> {
  late final PatientsService _patientsService;
  late final ClinicalAssistService _clinicalAssistService;
  late final AudioRecordingService _audioRecordingService;

  Patient? _selectedPatient;
  bool _consentVerified = false;
  String _selectedLanguageHint = 'auto'; // 'auto', 'hi-IN', 'en-IN', 'hi', 'en'

  // Recording State
  bool _isRecording = false;
  bool _isPaused = false;
  bool _isPlayingPreview = false;
  bool _isUploading = false;
  String? _recordedAudioPath;
  int _elapsedSeconds = 0;
  double _currentAmplitude = 0.0;
  Timer? _recordingTimer;
  Timer? _amplitudeTimer;
  String? _errorMessage;

  static const int _maxDurationSeconds = 180; // 3 minutes limit

  @override
  void initState() {
    super.initState();
    _patientsService = widget.patientsService ?? PatientsService();
    _clinicalAssistService = widget.clinicalAssistService ?? ClinicalAssistService();
    _audioRecordingService = widget.audioRecordingService ?? DefaultAudioRecordingService();
    _selectedPatient = widget.initialPatient;
  }

  @override
  void dispose() {
    _recordingTimer?.cancel();
    _amplitudeTimer?.cancel();
    _cleanupAudioFile();
    _audioRecordingService.dispose();
    super.dispose();
  }

  Future<void> _cleanupAudioFile() async {
    final path = _recordedAudioPath;
    if (path != null) {
      _recordedAudioPath = null;
      await _audioRecordingService.deleteAudioFile(path);
    }
  }

  void _onPatientSelected(Patient? patient) {
    setState(() {
      _selectedPatient = patient;
      _consentVerified = false; // Reset consent when patient changes
      _errorMessage = null;
    });
  }

  Future<void> _onStartRecording() async {
    if (_selectedPatient == null) {
      setState(() {
        _errorMessage = 'Please select a registered patient before recording audio.';
      });
      return;
    }

    final hasPerm = await _audioRecordingService.hasPermission();
    if (!hasPerm) {
      setState(() {
        _errorMessage = 'Microphone permission is required to record voice symptoms. Please allow microphone access in device settings.';
      });
      return;
    }

    try {
      final dirPath = widget.tempDirectoryProvider != null
          ? await widget.tempDirectoryProvider!()
          : (await getTemporaryDirectory()).path;
      final path = '$dirPath/symptoms_${DateTime.now().millisecondsSinceEpoch}.m4a';

      await _audioRecordingService.startRecording(path);

      setState(() {
        _recordedAudioPath = path;
        _isRecording = true;
        _isPaused = false;
        _isPlayingPreview = false;
        _elapsedSeconds = 0;
        _currentAmplitude = 0.1;
        _errorMessage = null;
      });

      _startTimers();
    } catch (e) {
      setState(() {
        _isRecording = false;
        _errorMessage = 'Failed to start recording: ${e.toString()}';
      });
    }
  }

  void _startTimers() {
    _recordingTimer?.cancel();
    _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_isRecording && !_isPaused) {
        setState(() {
          _elapsedSeconds++;
          if (_elapsedSeconds >= _maxDurationSeconds) {
            _onStopRecording();
          }
        });
      }
    });

    _amplitudeTimer?.cancel();
    _amplitudeTimer = Timer.periodic(const Duration(milliseconds: 150), (_) async {
      if (!mounted) return;
      if (_isRecording && !_isPaused) {
        final amp = await _audioRecordingService.getAmplitudeNormalized();
        if (mounted) {
          setState(() {
            _currentAmplitude = amp;
          });
        }
      }
    });
  }

  Future<void> _onPauseRecording() async {
    await _audioRecordingService.pauseRecording();
    setState(() {
      _isPaused = true;
      _currentAmplitude = 0.0;
    });
  }

  Future<void> _onResumeRecording() async {
    await _audioRecordingService.resumeRecording();
    setState(() {
      _isPaused = false;
    });
  }

  Future<void> _onStopRecording() async {
    _recordingTimer?.cancel();
    _amplitudeTimer?.cancel();

    final path = await _audioRecordingService.stopRecording();
    setState(() {
      _isRecording = false;
      _isPaused = false;
      _currentAmplitude = 0.0;
      if (path != null) {
        _recordedAudioPath = path;
      }
    });
  }

  Future<void> _onTogglePlayback() async {
    final path = _recordedAudioPath;
    if (path == null) return;

    if (_isPlayingPreview) {
      await _audioRecordingService.stopPlayback();
      setState(() {
        _isPlayingPreview = false;
      });
    } else {
      await _audioRecordingService.playAudio(
        path,
        onComplete: () {
          if (mounted) {
            setState(() {
              _isPlayingPreview = false;
            });
          }
        },
      );
      setState(() {
        _isPlayingPreview = true;
      });
    }
  }

  Future<void> _onDiscardRecording() async {
    await _audioRecordingService.stopPlayback();
    await _cleanupAudioFile();

    setState(() {
      _isRecording = false;
      _isPaused = false;
      _isPlayingPreview = false;
      _elapsedSeconds = 0;
      _currentAmplitude = 0.0;
      _recordedAudioPath = null;
      _errorMessage = null;
    });
  }

  Future<void> _onUploadAndTranscribe() async {
    final path = _recordedAudioPath;
    final patient = _selectedPatient;

    if (patient == null) {
      setState(() {
        _errorMessage = 'Patient selection is required.';
      });
      return;
    }

    if (path == null || !File(path).existsSync()) {
      setState(() {
        _errorMessage = 'No valid recorded audio found. Please record symptoms first.';
      });
      return;
    }

    // 1. Verify Patient Consent
    if (!_consentVerified) {
      final consentResult = await ConsentConfirmationDialog.show(
        context,
        patient: patient,
      );

      if (!mounted) return;
      if (consentResult != true) {
        return; // Clinician cancelled consent
      }

      setState(() {
        _consentVerified = true;
      });
    }

    // 2. Perform Upload and Transcription
    setState(() {
      _isUploading = true;
      _errorMessage = null;
    });

    try {
      final response = await _clinicalAssistService.transcribeAudio(
        audioPath: path,
        patientId: patient.id,
        patientConsentVerified: _consentVerified,
        languageHint: _selectedLanguageHint == 'auto' ? null : _selectedLanguageHint,
      );

      if (!mounted) return;
      setState(() {
        _isUploading = false;
      });

      // 3. Open Transcript Review Screen
      final confirmedResult = await Navigator.of(context).push<dynamic>(
        MaterialPageRoute(
          builder: (context) => TranscriptReviewScreen(
            patient: patient,
            response: response,
          ),
        ),
      );

      // If doctor confirmed the transcript or structured extraction, return it to calling workflow
      if (confirmedResult != null) {
        await _cleanupAudioFile();
        if (mounted) {
          Navigator.of(context).pop<dynamic>(confirmedResult);
        }
      }
    } on ApiException catch (apiErr) {
      if (!mounted) return;
      setState(() {
        _isUploading = false;
        _errorMessage = apiErr.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isUploading = false;
        _errorMessage = 'Unexpected upload failure: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPatientLocked = widget.initialPatient != null;
    final hasAudio = _recordedAudioPath != null && !_isRecording;

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text(
          'Voice Symptom Capture',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Patient Selection Section
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppTheme.borderGray),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.person_search_rounded, color: AppTheme.primaryNavy, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Target Patient',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      PatientSearchSelector(
                        patientsService: _patientsService,
                        selectedPatient: _selectedPatient,
                        onPatientSelected: _onPatientSelected,
                        isLocked: isPatientLocked,
                        lockReason: isPatientLocked ? 'Locked from active consultation context' : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // 2. Language Hint Selector
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppTheme.borderGray),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.language_rounded, color: AppTheme.primaryNavy, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Speech Language Hint',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        children: [
                          _buildLanguageChip('auto', 'Auto-Detect'),
                          _buildLanguageChip('hi-IN', 'Hindi / Hinglish'),
                          _buildLanguageChip('en-IN', 'Indian English'),
                          _buildLanguageChip('hi', 'Hindi'),
                          _buildLanguageChip('en', 'English'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // 3. Error Banner (if any)
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorRed.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.error_outline_rounded, color: AppTheme.errorRed, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.errorRed,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // 4. Voice Recording Area
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: _isRecording ? AppTheme.accentTeal : AppTheme.borderGray,
                    width: _isRecording ? 1.5 : 1.0,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    children: [
                      // Animated Waveform
                      AudioRecordingWaveform(
                        isRecording: _isRecording,
                        isPaused: _isPaused,
                        currentAmplitude: _currentAmplitude,
                      ),
                      const SizedBox(height: 20),

                      // Recorder Controls
                      AudioRecorderControls(
                        isRecording: _isRecording,
                        isPaused: _isPaused,
                        hasRecordedAudio: hasAudio,
                        isPlayingPreview: _isPlayingPreview,
                        isUploading: _isUploading,
                        elapsedSeconds: _elapsedSeconds,
                        maxDurationSeconds: _maxDurationSeconds,
                        onStartRecording: _onStartRecording,
                        onPauseRecording: _onPauseRecording,
                        onResumeRecording: _onResumeRecording,
                        onStopRecording: _onStopRecording,
                        onTogglePlayback: _onTogglePlayback,
                        onDiscardRecording: _onDiscardRecording,
                        onUploadAndTranscribe: _onUploadAndTranscribe,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // 5. Clinical Safety Notice
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blueGrey.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.security_rounded, size: 18, color: AppTheme.textSecondary),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Cloud transcription aids symptom capture. Transcripts must be verified by the attending clinician before clinical use. Raw audio is not stored.',
                        style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLanguageChip(String code, String label) {
    final isSelected = _selectedLanguageHint == code;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: _isRecording || _isUploading
          ? null
          : (selected) {
              if (selected) {
                setState(() {
                  _selectedLanguageHint = code;
                });
              }
            },
      selectedColor: AppTheme.accentTeal.withValues(alpha: 0.18),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
        color: isSelected ? AppTheme.primaryNavy : AppTheme.textPrimary,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: isSelected ? AppTheme.accentTeal : AppTheme.borderGray,
        ),
      ),
    );
  }
}
