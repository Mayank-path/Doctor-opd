import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/models/differential_evaluation_models.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/screens/differential_diagnosis_screen.dart';
import 'package:doctor_opd_mobile/features/clinical_assist/services/differential_diagnosis_service.dart';
import 'package:doctor_opd_mobile/features/patients/models/patient.dart';

class MockDifferentialDiagnosisService extends Mock
    implements DifferentialDiagnosisService {}

void main() {
  setUpAll(() {
    registerFallbackValue(const EvaluateDifferentialRequest(
      patientId: 'dummy-id',
      findings: [],
    ));
  });

  late MockDifferentialDiagnosisService mockService;

  final samplePatient = Patient(
    id: '11111111-1111-1111-1111-111111111111',
    clinicId: '22222222-2222-2222-2222-222222222222',
    uhid: 'UHID-100234',
    fullName: 'Ramesh Gupta',
    gender: 'MALE',
    dateOfBirth: '1985-05-15',
    phone: '+919876543210',
    isActive: true,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  final sampleEvaluatedResponse = DifferentialEvaluationResponse(
    status: DifferentialEvaluationStatus.evaluated,
    evaluatedAt: '2026-10-31T01:00:00.000Z',
    engineVersion: '1.0.0',
    knowledgePack: const KnowledgePackMetadata(
      domain: 'GENERAL_MEDICINE',
      version: '1.0.0',
      releaseStatus: 'RELEASED',
      releaseScope: 'GLOBAL',
      checksumSha256: 'sha256abc',
    ),
    patientContext: const ResolvedPatientDemographicContext(
      patientId: '11111111-1111-1111-1111-111111111111',
      resolvedAgeYears: 39,
      ageSource: 'PATIENT_DOB',
      gender: 'MALE',
    ),
    infectionSuspicion: InfectionSuspicionState.suspected,
    hasUrgentRedFlags: true,
    redFlags: const [
      RedFlagAlert(
        flagCode: 'RF-QSOFA-SEPSIS',
        title: 'qSOFA Sepsis Screening Alert',
        urgencyLevel: RedFlagUrgency.immediate,
        triggered: true,
        clinicalAction: 'Immediate senior clinical assessment and lactate evaluation',
        disclaimer: 'qSOFA is an assistive bedside screening tool.',
        isProvisional: true,
        quarantinedPredicates: ['Dizziness'],
        missingAssessmentNotice: 'Altered mentation not assessed',
        gatingExplanation: 'Adult suspected infection context active',
      ),
    ],
    candidateMatches: const [
      ConditionCandidateMatch(
        conditionCode: 'COND-APP-01',
        conditionDisplayName: 'Acute Appendicitis',
        category: 'Gastroenterology',
        ruleCode: 'R-APP-01',
        ruleTitle: 'Acute Appendicitis Rule',
        tier: DifferentialMatchTier.strongMatch,
        minMajorCount: 2,
        majorSupportingMatchedCount: 2,
        mandatoryResult: CriterionDetail(
          satisfied: true,
          result: 'SATISFIED',
          explanation: 'Abdominal pain documented',
        ),
        majorSupportingResults: [
          CriterionDetail(
            satisfied: true,
            result: 'SATISFIED',
            explanation: 'RLQ tenderness present',
          ),
        ],
        missingInformation: [
          MissingInfoAlert(
            prompt: 'Assess rebound tenderness',
            reason: 'Rule confirmation',
          ),
        ],
        unperformedAssessments: [
          UnperformedAssessmentAlert(
            examination: 'Per rectal examination',
            prompt: 'Clinician omitted',
            reason: 'Patient refused',
          ),
        ],
        suggestedInvestigations: ['Ultrasound Abdomen', 'CBC'],
        rationale: 'Deterministic criteria for strong match satisfied.',
      ),
      ConditionCandidateMatch(
        conditionCode: 'COND-MES-01',
        conditionDisplayName: 'Mesenteric Adenitis',
        category: 'Gastroenterology',
        ruleCode: 'R-MES-01',
        ruleTitle: 'Mesenteric Adenitis Rule',
        tier: DifferentialMatchTier.possibleMatch,
        rationale: 'Possible alternative presentation.',
      ),
    ],
    tierSummary: const DifferentialTierSummary(
      strongMatchCount: 1,
      moderateMatchCount: 0,
      possibleMatchCount: 1,
      contradictedMatchCount: 0,
      unmatchedCount: 0,
    ),
    warnings: ['Adult qSOFA criteria active'],
    requiresDoctorReview: true,
    disclaimer: 'DOCTOR-OPD assistive decision support under NMC regulations.',
  );

  setUp(() {
    mockService = MockDifferentialDiagnosisService();
  });

  Widget buildTestWidget() {
    return MaterialApp(
      home: DifferentialDiagnosisScreen(
        patient: samplePatient,
        initialFindings: const [
          DifferentialFindingInput(
            canonicalTerm: 'Abdominal pain',
            status: EvaluationFindingStatus.present,
          ),
        ],
        service: mockService,
      ),
    );
  }

  group('DifferentialDiagnosisScreen Widget Tests', () {
    testWidgets('renders patient header, disclaimer, red flags, and candidates on EVALUATED',
        (tester) async {
      when(() => mockService.evaluateDifferential(any()))
          .thenAnswer((_) async => sampleEvaluatedResponse);

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Verify Patient Header
      expect(find.textContaining('Ramesh Gupta'), findsOneWidget);
      expect(find.textContaining('UHID-100234'), findsOneWidget);

      // Verify Disclaimer Card
      expect(find.textContaining('NMC regulations'), findsOneWidget);

      // Verify Urgent Red Flag Banner
      expect(find.text('qSOFA Sepsis Screening Alert'), findsOneWidget);
      expect(find.text('IMMEDIATE RED FLAG'), findsOneWidget);
      expect(find.text('PROVISIONAL'), findsOneWidget);
      expect(find.textContaining('Quarantined: Dizziness'), findsOneWidget);

      // Verify Candidate Conditions
      expect(find.text('Acute Appendicitis'), findsOneWidget);
      expect(find.text('Mesenteric Adenitis'), findsOneWidget);
      expect(find.text('Strong Match'), findsOneWidget);
      expect(find.text('Possible Match'), findsOneWidget);
    });

    testWidgets('expands candidate card to inspect evidence and unperformed assessments',
        (tester) async {
      tester.view.physicalSize = const Size(1200, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      when(() => mockService.evaluateDifferential(any()))
          .thenAnswer((_) async => sampleEvaluatedResponse);

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Find and tap View Evidence Details on first candidate
      final viewEvidenceButtons = find.text('View Evidence Details');
      expect(viewEvidenceButtons, findsWidgets);
      await tester.tap(viewEvidenceButtons.first);
      await tester.pumpAndSettle();

      // Verify mandatory and unperformed assessment details are visible
      expect(find.textContaining('Abdominal pain documented'), findsOneWidget);
      expect(find.textContaining('Per rectal examination'), findsOneWidget);
      expect(find.textContaining('Assess rebound tenderness'), findsOneWidget);
    });

    testWidgets('allows doctor to select primary and differential candidates and apply to consultation',
        (tester) async {
      tester.view.physicalSize = const Size(1200, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      when(() => mockService.evaluateDifferential(any()))
          .thenAnswer((_) async => sampleEvaluatedResponse);

      DoctorDifferentialReviewResult? poppedResult;

      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              final res = await Navigator.of(context).push<DoctorDifferentialReviewResult>(
                MaterialPageRoute(
                  builder: (_) => DifferentialDiagnosisScreen(
                    patient: samplePatient,
                    initialFindings: const [],
                    service: mockService,
                  ),
                ),
              );
              poppedResult = res;
            },
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Initially, bottom apply button is disabled
      final applyButton = find.byType(ElevatedButton).last;
      expect(tester.widget<ElevatedButton>(applyButton).enabled, isFalse);

      // Select 'Primary' for Acute Appendicitis
      final primaryButtons = find.text('Primary');
      await tester.tap(primaryButtons.first);
      await tester.pumpAndSettle();

      // Select 'Differential' for Mesenteric Adenitis
      final differentialButtons = find.text('Differential');
      await tester.tap(differentialButtons.last);
      await tester.pumpAndSettle();

      // Now bottom button is enabled and shows count
      expect(find.textContaining('Apply Selected to Consultation (2)'), findsOneWidget);

      // Tap Apply
      await tester.tap(find.textContaining('Apply Selected to Consultation'));
      await tester.pumpAndSettle();

      // Verify Confirmation Dialog appears with draft safeguard notice
      expect(find.text('Confirm Selected Diagnoses'), findsOneWidget);
      expect(find.textContaining('Safety Safeguard: Consultation remains in DRAFT'), findsOneWidget);
      expect(find.text('Acute Appendicitis'), findsWidgets);

      // Tap Confirm & Apply
      await tester.tap(find.text('Confirm & Apply'));
      await tester.pumpAndSettle();

      // Verify result popped back with correct selections
      expect(poppedResult, isNotNull);
      expect(poppedResult!.primaryDiagnosis?.conditionDisplayName, 'Acute Appendicitis');
      expect(poppedResult!.differentialDiagnoses.length, 1);
      expect(poppedResult!.differentialDiagnoses.first.conditionDisplayName, 'Mesenteric Adenitis');
      expect(poppedResult!.formatForConsultationDiagnosis(),
          'Acute Appendicitis (Differential: Mesenteric Adenitis)');
    });

    testWidgets('renders UNAVAILABLE state safely with explanation and retry button',
        (tester) async {
      final unavailableResponse = DifferentialEvaluationResponse(
        status: DifferentialEvaluationStatus.unavailable,
        evaluatedAt: '2026-10-31T01:00:00.000Z',
        patientContext: const ResolvedPatientDemographicContext(
          patientId: '11111111-1111-1111-1111-111111111111',
          ageSource: 'UNRECORDED',
        ),
        requiresDoctorReview: true,
        disclaimer: 'Assistive tool only',
        message: 'No eligible verified and released knowledge pack found',
      );

      when(() => mockService.evaluateDifferential(any()))
          .thenAnswer((_) async => unavailableResponse);

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Verify Unavailable banner
      expect(find.text('Knowledge Pack Unavailable'), findsOneWidget);
      expect(find.textContaining('No eligible verified and released knowledge pack'), findsOneWidget);
      expect(find.textContaining('fails closed for patient safety'), findsOneWidget);
      expect(find.text('Retry Evaluation'), findsOneWidget);

      // Verify zero speculative candidate cards
      expect(find.byType(Card), findsNothing);
    });

    testWidgets('renders ERROR state when ApiException occurs with retry capability',
        (tester) async {
      when(() => mockService.evaluateDifferential(any()))
          .thenThrow(const ApiException(message: 'Network connection timed out'));

      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Evaluation Error'), findsOneWidget);
      expect(find.text('Network connection timed out'), findsOneWidget);
      expect(find.text('Retry Evaluation'), findsOneWidget);
    });
  });
}
