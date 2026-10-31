import 'package:flutter/material.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../consultations/ui/components/patient_search_selector.dart';
import '../../patients/models/patient.dart';
import '../../patients/services/patients_service.dart';
import '../models/differential_evaluation_models.dart';
import '../services/differential_diagnosis_service.dart';
import '../widgets/differential_candidate_card.dart';
import '../widgets/differential_disclaimer_card.dart';
import '../widgets/differential_red_flags_banner.dart';

/// Screen allowing clinicians to run deterministic AST evaluation and review
/// differential diagnosis candidates with full human-in-the-loop control.
///
/// Invariants:
/// - Assistive clinical decision support only; never autonomously finalizes or prescribes.
/// - Requires explicit doctor review and selection of primary or differential candidates.
/// - Strictly respects knowledge-pack availability (`UNAVAILABLE` displays transparently).
class DifferentialDiagnosisScreen extends StatefulWidget {
  final Patient? patient;
  final String? consultationId;
  final List<DifferentialFindingInput> initialFindings;
  final DifferentialVitalsInput? initialVitals;
  final InfectionSuspicionState initialInfectionSuspicion;
  final List<DifferentialAssessmentInput>? initialAssessments;
  final DifferentialDiagnosisService? service;
  final PatientsService? patientsService;

  const DifferentialDiagnosisScreen({
    super.key,
    this.patient,
    this.consultationId,
    this.initialFindings = const [],
    this.initialVitals,
    this.initialInfectionSuspicion = InfectionSuspicionState.unknown,
    this.initialAssessments,
    this.service,
    this.patientsService,
  });

  @override
  State<DifferentialDiagnosisScreen> createState() =>
      _DifferentialDiagnosisScreenState();
}

class _DifferentialDiagnosisScreenState
    extends State<DifferentialDiagnosisScreen> {
  late final DifferentialDiagnosisService _service;
  late final PatientsService _patientsService;

  Patient? _selectedPatient;
  late InfectionSuspicionState _infectionSuspicion;
  late List<DifferentialFindingInput> _findings;
  late DifferentialVitalsInput? _vitals;
  late List<DifferentialAssessmentInput>? _assessments;

  final TextEditingController _manualSymptomController = TextEditingController();
  final TextEditingController _tempController = TextEditingController();
  final TextEditingController _bpSysController = TextEditingController();
  final TextEditingController _bpDiaController = TextEditingController();
  final TextEditingController _pulseController = TextEditingController();
  final TextEditingController _spO2Controller = TextEditingController();

  bool _showManualEntry = false;
  bool _isLoading = false;
  String? _errorMessage;
  DifferentialEvaluationResponse? _response;

  // Selected tier filter (null = all)
  DifferentialMatchTier? _selectedTierFilter;

  // Track doctor decisions: conditionCode -> DoctorCandidateDecision
  final Map<String, DoctorCandidateDecision> _doctorDecisions = {};

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? DifferentialDiagnosisService();
    _patientsService = widget.patientsService ?? PatientsService();
    _selectedPatient = widget.patient;
    _infectionSuspicion = widget.initialInfectionSuspicion;
    _findings = List.from(widget.initialFindings);
    _vitals = widget.initialVitals;
    _assessments = widget.initialAssessments != null
        ? List.from(widget.initialAssessments!)
        : null;

    if (_vitals != null) {
      if (_vitals!.temperatureC != null) {
        _tempController.text = _vitals!.temperatureC.toString();
      }
      if (_vitals!.systolicBp != null) {
        _bpSysController.text = _vitals!.systolicBp.toString();
      }
      if (_vitals!.diastolicBp != null) {
        _bpDiaController.text = _vitals!.diastolicBp.toString();
      }
      if (_vitals!.pulse != null) {
        _pulseController.text = _vitals!.pulse.toString();
      }
      if (_vitals!.spO2 != null) {
        _spO2Controller.text = _vitals!.spO2.toString();
      }
    }

    _showManualEntry = _findings.isEmpty;

    // Trigger initial evaluation on screen load if patient is pre-populated
    if (_selectedPatient != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _evaluateDifferential();
      });
    }
  }

  @override
  void dispose() {
    _manualSymptomController.dispose();
    _tempController.dispose();
    _bpSysController.dispose();
    _bpDiaController.dispose();
    _pulseController.dispose();
    _spO2Controller.dispose();
    super.dispose();
  }

  Future<void> _evaluateDifferential() async {
    final patient = _selectedPatient;
    if (patient == null) {
      setState(() {
        _errorMessage = 'Please select a registered patient before generating differential diagnosis.';
      });
      return;
    }

    final effectiveFindings = List<DifferentialFindingInput>.from(_findings);
    final manualText = _manualSymptomController.text.trim();
    if (manualText.isNotEmpty) {
      final lines = manualText
          .split(RegExp(r'[\n\r;]+'))
          .map((s) => s.replaceAll(RegExp(r'^[•\-\*]\s*'), '').trim())
          .where((s) => s.isNotEmpty)
          .toList();

      for (final line in lines) {
        if (!effectiveFindings.any((f) => f.canonicalTerm.toLowerCase() == line.toLowerCase())) {
          effectiveFindings.add(
            DifferentialFindingInput(
              canonicalTerm: line,
              status: EvaluationFindingStatus.present,
            ),
          );
        }
      }
    }

    final temp = double.tryParse(_tempController.text.trim());
    final sys = int.tryParse(_bpSysController.text.trim());
    final dia = int.tryParse(_bpDiaController.text.trim());
    final pulse = int.tryParse(_pulseController.text.trim());
    final spo2 = int.tryParse(_spO2Controller.text.trim());

    final effectiveVitals = (temp != null || sys != null || dia != null || pulse != null || spo2 != null)
        ? DifferentialVitalsInput(
            temperatureC: temp ?? _vitals?.temperatureC,
            systolicBp: sys ?? _vitals?.systolicBp,
            diastolicBp: dia ?? _vitals?.diastolicBp,
            pulse: pulse ?? _vitals?.pulse,
            spO2: spo2 ?? _vitals?.spO2,
            respiratoryRate: _vitals?.respiratoryRate,
          )
        : _vitals;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final req = EvaluateDifferentialRequest(
        patientId: patient.id,
        consultationId: widget.consultationId,
        domain: 'GENERAL_MEDICINE',
        findings: effectiveFindings,
        vitals: effectiveVitals,
        demographics: DifferentialDemographicsInput(
          ageYears: patient.age,
          gender: patient.gender,
        ),
        infectionSuspicion: _infectionSuspicion,
        assessments: _assessments,
      );

      final resp = await _service.evaluateDifferential(req);

      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _response = resp;
      });
    } on ApiException catch (apiErr) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = apiErr.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = 'An unexpected error occurred during evaluation: $e';
      });
    }
  }

  void _onCandidateActionChanged(
    ConditionCandidateMatch candidate,
    DoctorCandidateAction? action,
  ) {
    setState(() {
      if (action == null) {
        _doctorDecisions.remove(candidate.conditionCode);
      } else {
        // Enforce at most ONE primary diagnosis: if another candidate was primary, demote it to differential
        if (action == DoctorCandidateAction.acceptedAsPrimary) {
          _doctorDecisions.forEach((key, decision) {
            if (decision.action == DoctorCandidateAction.acceptedAsPrimary &&
                key != candidate.conditionCode) {
              _doctorDecisions[key] = decision.copyWith(
                action: DoctorCandidateAction.acceptedAsDifferential,
              );
            }
          });
        }

        _doctorDecisions[candidate.conditionCode] = DoctorCandidateDecision(
          conditionCode: candidate.conditionCode,
          conditionDisplayName: candidate.conditionDisplayName,
          tier: candidate.tier,
          action: action,
        );
      }
    });
  }

  Future<void> _onApplyToConsultation() async {
    final result = DoctorDifferentialReviewResult(
      decisions: Map.from(_doctorDecisions),
    );

    final primary = result.primaryDiagnosis;
    final diffs = result.differentialDiagnoses;
    final deferred = result.deferredInvestigations;

    // Show explicit confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Row(
          children: [
            Icon(Icons.assignment_turned_in_rounded, color: AppTheme.accentTeal),
            SizedBox(width: 8),
            Text(
              'Confirm Selected Diagnoses',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'The following clinician-reviewed diagnoses will be pre-filled into your consultation draft:',
                  style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 12),
                if (primary != null) ...[
                  const Text(
                    'PRIMARY DIAGNOSIS:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.accentTeal,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.accentTeal.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: AppTheme.accentTeal.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      primary.conditionDisplayName,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryNavy,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                if (diffs.isNotEmpty) ...[
                  const Text(
                    'DIFFERENTIAL DIAGNOSES:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0284C7),
                    ),
                  ),
                  const SizedBox(height: 2),
                  ...diffs.map((d) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          '• ${d.conditionDisplayName}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.primaryNavy,
                          ),
                        ),
                      )),
                  const SizedBox(height: 10),
                ],
                if (deferred.isNotEmpty) ...[
                  Text(
                    'DEFERRED FOR INVESTIGATION (${deferred.length}):',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Colors.purple.shade700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  ...deferred.map((d) => Text(
                        '• ${d.conditionDisplayName}',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.purple.shade900,
                        ),
                      )),
                  const SizedBox(height: 10),
                ],
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, size: 14, color: AppTheme.primaryNavy),
                      SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Safety Safeguard: Consultation remains in DRAFT. No autonomous diagnosis or prescription is generated.',
                          style: TextStyle(fontSize: 11, color: AppTheme.primaryNavy),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Back to Review',
                style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.accentTeal,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm & Apply',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.of(context).pop<DoctorDifferentialReviewResult>(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Differential Diagnosis'),
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Re-evaluate',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _isLoading ? null : _evaluateDifferential,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 1. Patient Context & Infection Suspicion Bar
            _buildPatientContextBar(),

            // 2. Main Content
            Expanded(
              child: _buildBody(),
            ),

            // 3. Bottom Doctor Action Bar
            _buildBottomActionBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildPatientContextBar() {
    final patient = _selectedPatient;
    if (patient == null) return const SizedBox.shrink();

    final isPatientLocked = widget.patient != null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppTheme.surfaceWhite,
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.person_outline, size: 18, color: AppTheme.accentTeal),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${patient.fullName} (${patient.uhid}) • ${patient.age ?? 'Age N/A'} y/o ${patient.gender}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryNavy,
                  ),
                ),
              ),
              if (!isPatientLocked)
                TextButton(
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(50, 30),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: () {
                    setState(() {
                      _selectedPatient = null;
                      _response = null;
                    });
                  },
                  child: const Text('Change', style: TextStyle(fontSize: 12)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          // Infection Suspicion Selector
          Row(
            children: [
              const Text(
                'Infection Suspicion: ',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textSecondary,
                ),
              ),
              Expanded(
                child: Container(
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.backgroundLight,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppTheme.borderSubtle),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<InfectionSuspicionState>(
                      value: _infectionSuspicion,
                      isDense: true,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.primaryNavy,
                      ),
                      items: InfectionSuspicionState.values.map((state) {
                        return DropdownMenuItem<InfectionSuspicionState>(
                          value: state,
                          child: Text(state.displayName),
                        );
                      }).toList(),
                      onChanged: (newState) {
                        if (newState != null && newState != _infectionSuspicion) {
                          setState(() {
                            _infectionSuspicion = newState;
                          });
                          _evaluateDifferential();
                        }
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_selectedPatient == null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PatientSearchSelector(
              patientsService: _patientsService,
              selectedPatient: _selectedPatient,
              onPatientSelected: (p) {
                setState(() {
                  _selectedPatient = p;
                  _errorMessage = null;
                });
              },
            ),
            const SizedBox(height: 16),
            const DifferentialDisclaimerCard(),
          ],
        ),
      );
    }

    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppTheme.accentTeal),
            SizedBox(height: 16),
            Text(
              'Evaluating deterministic clinical rules...',
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
          ],
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  size: 48, color: AppTheme.errorRed),
              const SizedBox(height: 12),
              const Text(
                'Evaluation Error',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 12, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentTeal,
                  foregroundColor: Colors.white,
                ),
                onPressed: _evaluateDifferential,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry Evaluation'),
              ),
            ],
          ),
        ),
      );
    }

    final resp = _response;
    if (resp == null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildManualFindingsSection(),
            const SizedBox(height: 12),
            const DifferentialDisclaimerCard(),
          ],
        ),
      );
    }

    // 1. UNAVAILABLE State Handling
    if (resp.isUnavailable) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber.shade300, width: 1.5),
                ),
                child: Column(
                  children: [
                    Icon(Icons.shield_outlined,
                        size: 44, color: Colors.amber.shade800),
                    const SizedBox(height: 12),
                    Text(
                      'Knowledge Pack Unavailable',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: Colors.amber.shade900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      resp.message ??
                          'No cryptographically verified, clinical review approved, and actively released knowledge pack is eligible for this clinic and domain.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.amber.shade900,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Differential Diagnosis AST evaluation fails closed for patient safety. Zero speculative diagnoses are generated.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontStyle: FontStyle.italic,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentTeal,
                  foregroundColor: Colors.white,
                ),
                onPressed: _evaluateDifferential,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry Evaluation'),
              ),
            ],
          ),
        ),
      );
    }

    // 2. EVALUATED State
    final candidates = _filteredCandidates(resp.candidateMatches);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildManualFindingsSection(),
          const SizedBox(height: 12),

          // Decision Support Disclaimer
          DifferentialDisclaimerCard(customText: resp.disclaimer),
          const SizedBox(height: 12),

          // Red-Flags Banner
          if (resp.hasUrgentRedFlags || resp.redFlags.any((f) => f.triggered)) ...[
            DifferentialRedFlagsBanner(redFlags: resp.redFlags),
          ],

          // Tier Filter Chips
          _buildTierFilterChips(resp),
          const SizedBox(height: 12),

          // Candidate Conditions List
          if (candidates.isEmpty) ...[
            Container(
              padding: const EdgeInsets.all(24),
              alignment: Alignment.center,
              child: const Text(
                'No candidate conditions match the selected tier filter.',
                style: TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ] else ...[
            ...candidates.map((cand) => DifferentialCandidateCard(
                  candidate: cand,
                  selectedAction: _doctorDecisions[cand.conditionCode]?.action,
                  onActionSelected: (action) =>
                      _onCandidateActionChanged(cand, action),
                )),
          ],

          // Warnings / Notices if present
          if (resp.warnings.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.blueGrey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blueGrey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Evaluation Notices & Limitations:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.blueGrey.shade800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ...resp.warnings.map((w) => Text(
                        '• $w',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.blueGrey.shade700,
                          height: 1.3,
                        ),
                      )),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  List<ConditionCandidateMatch> _filteredCandidates(
    List<ConditionCandidateMatch> all,
  ) {
    if (_selectedTierFilter == null) return all;
    return all.where((c) => c.tier == _selectedTierFilter).toList();
  }

  Widget _buildManualFindingsSection() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderSubtle),
      ),
      child: Material(
        color: AppTheme.surfaceWhite,
        borderRadius: BorderRadius.circular(10),
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            initiallyExpanded: _showManualEntry,
            title: Text(
              _findings.isNotEmpty
                  ? 'Clinical Findings & Vitals (${_findings.length} findings recorded)'
                  : 'Enter Symptoms & Vitals (Manual Workflow 2)',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
            subtitle: const Text(
              'Attending clinician manual entry for deterministic AST evaluation',
              style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
            ),
            childrenPadding: const EdgeInsets.all(12),
            children: [
              TextField(
                controller: _manualSymptomController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Symptoms & Complaints',
                  hintText: 'e.g. Cough, Fever, Chest pain, Dyspnea',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _tempController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Temp (°C)',
                        hintText: '38.5',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _bpSysController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'BP Sys',
                        hintText: '120',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _pulseController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Pulse',
                        hintText: '82',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _spO2Controller,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'SpO2 (%)',
                        hintText: '98',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: _isLoading ? null : _evaluateDifferential,
                  icon: const Icon(Icons.psychology_rounded, size: 18),
                  label: const Text(
                    'Generate Differential Diagnosis',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTierFilterChips(DifferentialEvaluationResponse resp) {
    final summary = resp.tierSummary;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildChip(
            label: 'All (${resp.candidateMatches.length})',
            isSelected: _selectedTierFilter == null,
            onTap: () => setState(() => _selectedTierFilter = null),
          ),
          const SizedBox(width: 6),
          _buildChip(
            label: 'Strong (${summary?.strongMatchCount ?? 0})',
            isSelected: _selectedTierFilter == DifferentialMatchTier.strongMatch,
            onTap: () => setState(
                () => _selectedTierFilter = DifferentialMatchTier.strongMatch),
          ),
          const SizedBox(width: 6),
          _buildChip(
            label: 'Moderate (${summary?.moderateMatchCount ?? 0})',
            isSelected: _selectedTierFilter == DifferentialMatchTier.moderateMatch,
            onTap: () => setState(
                () => _selectedTierFilter = DifferentialMatchTier.moderateMatch),
          ),
          const SizedBox(width: 6),
          _buildChip(
            label: 'Possible (${summary?.possibleMatchCount ?? 0})',
            isSelected: _selectedTierFilter == DifferentialMatchTier.possibleMatch,
            onTap: () => setState(
                () => _selectedTierFilter = DifferentialMatchTier.possibleMatch),
          ),
          const SizedBox(width: 6),
          _buildChip(
            label: 'Contradicted (${summary?.contradictedMatchCount ?? 0})',
            isSelected: _selectedTierFilter == DifferentialMatchTier.contradicted,
            onTap: () => setState(
                () => _selectedTierFilter = DifferentialMatchTier.contradicted),
          ),
        ],
      ),
    );
  }

  Widget _buildChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryNavy : AppTheme.surfaceWhite,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppTheme.primaryNavy : AppTheme.borderSubtle,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildBottomActionBar() {
    final selectedCount = _doctorDecisions.values
        .where((d) =>
            d.action == DoctorCandidateAction.acceptedAsPrimary ||
            d.action == DoctorCandidateAction.acceptedAsDifferential)
        .length;

    final primary = _doctorDecisions.values
        .where((d) => d.action == DoctorCandidateAction.acceptedAsPrimary)
        .firstOrNull;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceWhite,
        border: Border(top: BorderSide(color: AppTheme.borderSubtle)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (selectedCount > 0) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  const Icon(Icons.check_circle,
                      size: 14, color: AppTheme.accentTeal),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      primary != null
                          ? 'Primary: ${primary.conditionDisplayName} (+${selectedCount - 1} diff)'
                          : '$selectedCount differential(s) selected',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.primaryNavy,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentTeal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 13),
              ),
              onPressed: selectedCount > 0 ? _onApplyToConsultation : null,
              icon: const Icon(Icons.done_all_rounded),
              label: Text(
                selectedCount > 0
                    ? 'Apply Selected to Consultation ($selectedCount)'
                    : 'Select Candidate Diagnoses to Apply',
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

