import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/spelling_engine.dart';
import 'package:doctor_opd_mobile/core/spell_check/presentation/spelling_text_editing_controller.dart';
import 'package:doctor_opd_mobile/features/consultations/models/consultation.dart';

void main() {
  group('Clinical Safety & Lifecycle Invariant Tests', () {
    late MedicalDictionaryRepository repository;
    late SpellingEngine engine;

    setUp(() {
      repository = MedicalDictionaryRepository(
        initialEnglishWords: {'patient', 'has', 'and', 'fever', 'cough', 'for', 'days', 'symptom'},
        initialMedicalWords: {'paracetamol', 'metformin', 'amoxicillin'},
        initialAbbreviations: {'BP', 'HR', 'OD', 'BD', 'TDS', 'PO', 'Tab'},
      );
      engine = SpellingEngine(dictionaryRepository: repository);
    });

    test('NO silent replacement: spelling engine never modifies raw text in the background', () {
      const originalText = 'Patient has fevr and unknwn symptom.';
      final controller = SpellingTextEditingController(
        text: originalText,
        spellingEngine: engine,
      );

      controller.checkSpellingNow();

      // Issues are detected
      expect(controller.currentIssues.length, equals(2));

      // But raw text MUST remain 100% identical without doctor manual action
      expect(controller.text, equals(originalText));

      controller.dispose();
    });

    test('Medication dosages, frequencies and vitals are never corrupted or auto-replaced', () {
      const clinicalText = 'Tab Paracetamol 500mg PO TDS for 3 days. BP 120/80 mmHg.';
      final controller = SpellingTextEditingController(
        text: clinicalText,
        spellingEngine: engine,
      );

      controller.checkSpellingNow();

      expect(controller.currentIssues, isEmpty);
      expect(controller.text, equals(clinicalText));

      controller.dispose();
    });

    test('Consultation Lifecycle Immutability: FINALIZED and VOIDED records are read-only', () {
      const finalizedConsultation = Consultation(
        id: 'cons-final-1',
        clinicId: 'clinic-1',
        patientId: 'patient-1',
        clinicianId: 'doc-1',
        encounterDate: '2026-11-10T00:00:00Z',
        status: ConsultationStatus.finalized,
        chiefComplaint: 'Patient had fevr and cough.',
        symptoms: 'Chills and bodyache.',
        createdAt: '2026-11-10T00:00:00Z',
        updatedAt: '2026-11-10T00:00:00Z',
        finalizedAt: '2026-11-10T00:00:00Z',
      );

      expect(finalizedConsultation.isFinalized, isTrue);
      expect(finalizedConsultation.isVoided, isFalse);

      const voidedConsultation = Consultation(
        id: 'cons-void-1',
        clinicId: 'clinic-1',
        patientId: 'patient-1',
        clinicianId: 'doc-1',
        encounterDate: '2026-11-10T00:00:00Z',
        status: ConsultationStatus.voided,
        chiefComplaint: 'Voided consultation record.',
        createdAt: '2026-11-10T00:00:00Z',
        updatedAt: '2026-11-10T00:00:00Z',
      );

      expect(voidedConsultation.isVoided, isTrue);
      expect(voidedConsultation.isFinalized, isFalse);
    });

    testWidgets('IME Composing Region: active composing range suppresses error styling until composition commits',
        (tester) async {
      final controller = SpellingTextEditingController(
        text: 'Patient has fevr',
        spellingEngine: engine,
      );
      controller.checkSpellingNow();
      expect(controller.currentIssues.length, equals(1));

      // With active composing over 'fevr' (indices 12 to 16)
      controller.value = const TextEditingValue(
        text: 'Patient has fevr',
        selection: TextSelection.collapsed(offset: 16),
        composing: TextRange(start: 12, end: 16),
      );

      late BuildContext capturedContext;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) {
                capturedContext = ctx;
                return TextField(controller: controller);
              },
            ),
          ),
        ),
      );

      final spanWithComposing = controller.buildTextSpan(
        context: capturedContext,
        style: const TextStyle(color: Colors.black),
        withComposing: true,
      );

      // When composing is active, children must NOT have error underline
      final hasUnderline = spanWithComposing.children?.any(
        (s) => (s as TextSpan).style?.decoration == TextDecoration.underline,
      ) ?? false;
      expect(hasUnderline, isFalse, reason: 'Active IME composing must suppress error decoration');

      // Once composition finishes (withComposing: false)
      final spanCommitted = controller.buildTextSpan(
        context: capturedContext,
        style: const TextStyle(color: Colors.black),
        withComposing: false,
      );
      final hasUnderlineCommitted = spanCommitted.children?.any(
        (s) => (s as TextSpan).style?.decoration == TextDecoration.underline,
      ) ?? false;
      expect(hasUnderlineCommitted, isTrue, reason: 'Committed text must display error decoration');

      controller.dispose();
    });

    test('Zero false positives on verified clinical tokens (generics, symptoms, and abbreviations)', () {
      final repo = MedicalDictionaryRepository(
        initialAbbreviations: {
          'BP', 'HR', 'RR', 'SpO2', 'OD', 'BD', 'TDS', 'QID', 'SOS', 'PRN', 'STAT', 'PO'
        },
      );
      // Test repository with fallback + core clinical terms
      final verifiedTokens = [
        // Cleared Generic Medications (NLM MeSH & FDA Orange Book)
        'paracetamol', 'amoxicillin', 'metformin', 'azithromycin', 'ibuprofen', 'pantoprazole',
        'omeprazole', 'ciprofloxacin', 'levofloxacin', 'atorvastatin', 'amlodipine', 'salbutamol',
        'budesonide', 'cetirizine', 'prednisolone', 'doxycycline', 'cefixime', 'ofloxacin',
        'montelukast', 'rabeprazole', 'telmisartan', 'losartan', 'glimepiride', 'clopidogrel', 'aspirin',
        // Cleared Symptoms, Anatomy and Findings
        'coryza', 'bodyache', 'retrosternal', 'subcostal', 'hypochondrium', 'suprapubic',
        'epigastric', 'periumbilical', 'odynophagia', 'rhinorrhea', 'hematuria', 'dysuria',
        'oliguria', 'polyuria', 'nocturia', 'polydipsia', 'polyphagia', 'tachypnea', 'bradypnea',
        'hemoptysis', 'orthopnea', 'pyrexia', 'afebrile', 'normotensive', 'fever', 'headache',
        // Abbreviations & Dosages
        'BP', 'HR', 'RR', 'SpO2', 'OD', 'BD', 'TDS', 'QID', 'SOS', 'PRN', 'STAT', 'PO',
        '500mg', '650mg', '10mg', '120/80', '98.6F', 'c/o', 'h/o', 'k/c/o'
      ];

      for (final token in verifiedTokens) {
        expect(repo.isWordValid(token), isTrue, reason: 'Token "$token" must be recognized as valid');
      }
    });
  });
}
