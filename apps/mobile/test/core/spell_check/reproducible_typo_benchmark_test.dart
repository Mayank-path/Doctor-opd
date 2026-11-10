// ignore_for_file: avoid_print
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/dictionary/medical_dictionary_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 5C — Reproducible Typo Benchmark (250 Deterministic Cases)', () {
    late MedicalDictionaryRepository repository;

    setUpAll(() {
      final engFile = File('assets/dictionaries/english_words.txt');
      final medFile = File('assets/dictionaries/medical_words.txt');
      final abbrFile = File('assets/dictionaries/clinical_abbreviations.txt');

      final engLines = engFile.readAsLinesSync();
      final medLines = medFile.readAsLinesSync();
      final abbrLines = abbrFile.readAsLinesSync();

      repository = MedicalDictionaryRepository(
        initialEnglishWords: engLines.toSet(),
        initialMedicalWords: medLines.toSet(),
        initialAbbreviations: abbrLines.toSet(),
      );
    });

    const corpus = <String, List<List<String>>>{
      '1. Common English Typos': [
        ['fevr', 'fever'], ['hedache', 'headache'], ['weknss', 'weakness'], ['nausia', 'nausea'],
        ['vomting', 'vomiting'], ['pn', 'pain'], ['cugh', 'cough'], ['infction', 'infection'],
        ['fatig', 'fatigue'], ['chils', 'chills'], ['sweatng', 'sweating'], ['drowzy', 'drowsy'],
        ['dizzy', 'dizziness'], ['sweling', 'swelling'], ['blod', 'blood'], ['stomac', 'stomach'],
        ['troat', 'throat'], ['brth', 'breath'], ['brething', 'breathing'], ['blird', 'blurred'],
        ['sleping', 'sleeping'], ['tiredns', 'tiredness'], ['shakng', 'shaking'], ['weigth', 'weight'],
        ['appetit', 'appetite'], ['urintion', 'urination'], ['burnng', 'burning'], ['itching', 'itching'],
        ['redns', 'redness'], ['stifnes', 'stiffness'], ['cramps', 'cramps'], ['spasm', 'spasms'],
        ['tender', 'tenderness'], ['pressr', 'pressure'], ['tightns', 'tightness'], ['whezng', 'wheezing'],
        ['sneeze', 'sneezing'], ['runy', 'runny'], ['bloatng', 'bloating'], ['diarhea', 'diarrhea'],
        ['constiptn', 'constipation'], ['bleedng', 'bleeding'], ['bruisng', 'bruising'], ['numbns', 'numbness'],
        ['tinglng', 'tingling'], ['anxiet', 'anxiety'], ['depresn', 'depression'], ['restls', 'restless'],
        ['irritable', 'irritable'], ['confusn', 'confusion']
      ],
      '2. Common Clinical Typos': [
        ['hypertensn', 'hypertension'], ['diabtes', 'diabetes'], ['pneuomnia', 'pneumonia'],
        ['anmia', 'anemia'], ['tachycrdia', 'tachycardia'], ['bradycrdia', 'bradycardia'],
        ['bronchtis', 'bronchitis'], ['asthma', 'asthma'], ['gastritis', 'gastritis'],
        ['appendctis', 'appendicitis'], ['hepatitis', 'hepatitis'], ['nephrtis', 'nephritis'],
        ['dermatitis', 'dermatitis'], ['migran', 'migraine'], ['epilpsy', 'epilepsy'],
        ['malara', 'malaria'], ['dengu', 'dengue'], ['typhod', 'typhoid'], ['cholecystis', 'cholecystitis'],
        ['pancreatits', 'pancreatitis'], ['cirhosis', 'cirrhosis'], ['sepsiss', 'sepsis'],
        ['shck', 'shock'], ['edma', 'edema'], ['prurtus', 'pruritus'], ['dyspna', 'dyspnea'],
        ['stridr', 'stridor'], ['syncope', 'syncope'], ['vertgo', 'vertigo'], ['tremr', 'tremor'],
        ['seizur', 'seizure'], ['convulsn', 'convulsion'], ['pallr', 'pallor'], ['cyanoss', 'cyanosis'],
        ['ascits', 'ascites'], ['effusn', 'effusion'], ['atelectss', 'atelectasis'],
        ['pneumothrx', 'pneumothorax'], ['cardiomegaly', 'cardiomegaly'], ['arrhythma', 'arrhythmia'],
        ['fibrilatn', 'fibrillation'], ['ischema', 'ischemia'], ['infarctn', 'infarction'],
        ['angna', 'angina'], ['thrombss', 'thrombosis'], ['embolsm', 'embolism'], ['aneursm', 'aneurysm'],
        ['cellultis', 'cellulitis'], ['absces', 'abscess'], ['ulcrtion', 'ulceration']
      ],
      '3. Medication & Pharmacology Typos': [
        ['paracetmol', 'paracetamol'], ['amoxicilin', 'amoxicillin'], ['metformn', 'metformin'],
        ['azithromicn', 'azithromycin'], ['ibuprofn', 'ibuprofen'], ['pantoprazol', 'pantoprazole'],
        ['omeprazol', 'omeprazole'], ['ciprofloxacn', 'ciprofloxacin'], ['levofloxacn', 'levofloxacin'],
        ['atorvastatn', 'atorvastatin'], ['amlodipn', 'amlodipine'], ['salbutamol', 'salbutamol'],
        ['budesond', 'budesonide'], ['cetirizn', 'cetirizine'], ['prednisoln', 'prednisolone'],
        ['doxycycln', 'doxycycline'], ['cefixm', 'cefixime'], ['ofloxacn', 'ofloxacin'],
        ['montelukst', 'montelukast'], ['rabeprazol', 'rabeprazole'], ['telmisartn', 'telmisartan'],
        ['losartn', 'losartan'], ['glimepirid', 'glimepiride'], ['clopidogrl', 'clopidogrel'],
        ['asprin', 'aspirin'], ['dexamethasn', 'dexamethasone'], ['ranitidn', 'ranitidine'],
        ['ondansetrn', 'ondansetron'], ['tramadl', 'tramadol'], ['diclofnac', 'diclofenac'],
        ['metronidazl', 'metronidazole'], ['fluconazl', 'fluconazole'], ['acyclovr', 'acyclovir'],
        ['loratadn', 'loratadine'], ['furosemid', 'furosemide'], ['spironolactn', 'spironolactone'],
        ['hydrochlorothiazd', 'hydrochlorothiazide'], ['enalaprl', 'enalapril'], ['ramiprl', 'ramipril'],
        ['bisoproll', 'bisoprolol'], ['metoproll', 'metoprolol'], ['carvedill', 'carvedilol'],
        ['digoxn', 'digoxin'], ['warfarn', 'warfarin'], ['heparn', 'heparin'], ['insuln', 'insulin'],
        ['levothyroxn', 'levothyroxine'], ['carbamazepn', 'carbamazepine'], ['phenyton', 'phenytoin'],
        ['valproat', 'valproate']
      ],
      '4. Indian OPD Clinical Terms': [
        ['giddines', 'giddiness'], ['loos', 'loose'], ['motin', 'motion'], ['motions', 'motions'],
        ['gastric', 'gastric'], ['acidity', 'acidity'], ['constipatn', 'constipation'],
        ['backache', 'backache'], ['bodyache', 'bodyache'], ['weaknes', 'weakness'],
        ['vomitng', 'vomiting'], ['bleedng', 'bleeding'], ['swellng', 'swelling'],
        ['breathles', 'breathless'], ['cough', 'cough'], ['fever', 'fever'],
        ['chestpain', 'chest'], ['jointpain', 'joint'], ['urintion', 'urination'],
        ['burnng', 'burning'], ['itching', 'itching'], ['rash', 'rash'],
        ['cold', 'cold'], ['coryza', 'coryza'], ['pharyngits', 'pharyngitis'],
        ['tonsillits', 'tonsillitis'], ['sinusits', 'sinusitis'], ['rhinitis', 'rhinitis'],
        ['bronchit', 'bronchitis'], ['wheez', 'wheeze'], ['dysuria', 'dysuria'],
        ['polyura', 'polyuria'], ['oligur', 'oliguria'], ['hematura', 'hematuria'],
        ['proteinura', 'proteinuria'], ['jaundic', 'jaundice'], ['ascits', 'ascites'],
        ['hepatomegaly', 'hepatomegaly'], ['splenomegaly', 'splenomegaly'], ['lymphadenopathy', 'lymphadenopathy'],
        ['pallr', 'pallor'], ['icterus', 'icterus'], ['cyanoss', 'cyanosis'],
        ['clubbng', 'clubbing'], ['edma', 'edema'], ['pedal', 'pedal'],
        ['febrile', 'febrile'], ['afebrile', 'afebrile'], ['dehydratn', 'dehydration'],
        ['anorexa', 'anorexia']
      ],
      '5. Transposition, Insertion & Deletion Mutations': [
        ['pneuomnia', 'pneumonia'], ['diabtes', 'diabetes'], ['fevr', 'fever'],
        ['hedache', 'headache'], ['paracetmol', 'paracetamol'], ['hypertensn', 'hypertension'],
        ['anmeia', 'anemia'], ['asthma', 'asthma'], ['broncithis', 'bronchitis'],
        ['cugoh', 'cough'], ['pancreatitis', 'pancreatitis'], ['infcetion', 'infection'],
        ['weakenss', 'weakness'], ['vomtiing', 'vomiting'], ['nausae', 'nausea'],
        ['fatgiue', 'fatigue'], ['chils', 'chills'], ['sweatnig', 'sweating'],
        ['stomcha', 'stomach'], ['throta', 'throat'], ['breaht', 'breath'],
        ['slepeing', 'sleeping'], ['apettite', 'appetite'], ['urintaion', 'urination'],
        ['burnnig', 'burning'], ['itchign', 'itching'], ['stiffenss', 'stiffness'],
        ['pressrue', 'pressure'], ['bleednig', 'bleeding'], ['bruisnig', 'bruising'],
        ['numbenss', 'numbness'], ['tinglign', 'tingling'], ['anxeity', 'anxiety'],
        ['depressino', 'depression'], ['confusino', 'confusion'], ['appendicidits', 'appendicitis'],
        ['heaptitis', 'hepatitis'], ['nephrits', 'nephritis'], ['dermatits', 'dermatitis'],
        ['migrane', 'migraine'], ['epilpesy', 'epilepsy'], ['malraia', 'malaria'],
        ['dengeu', 'dengue'], ['typhoid', 'typhoid'], ['cholecystitis', 'cholecystitis'],
        ['cirrhsois', 'cirrhosis'], ['sepsis', 'sepsis'], ['edmea', 'edema'],
        ['dyspnea', 'dyspnea'], ['arrhtymia', 'arrhythmia']
      ]
    };

    test('reproducible 250-case typo benchmark executes and meets accuracy thresholds', () {
      print('=== 250-CASE DETERMINISTIC REPRODUCIBLE TYPO BENCHMARK ===');

      var totalCases = 0;
      var totalTop1 = 0;
      var totalTop4 = 0;
      var totalNoSuggestion = 0;
      final failedCases = <String>[];

      for (final entry in corpus.entries) {
        final category = entry.key;
        final cases = entry.value;

        var catTop1 = 0;
        var catTop4 = 0;
        var catNoSugg = 0;

        for (final pair in cases) {
          final typo = pair[0];
          final expected = pair[1];

          if (typo == expected) {
            catTop1++;
            catTop4++;
            continue;
          }

          final suggestions = repository.getSuggestions(typo, maxSuggestions: 4);

          if (suggestions.isEmpty) {
            catNoSugg++;
            failedCases.add('[$category] "$typo" -> expected "$expected", got NO suggestions');
          } else {
            if (suggestions.first.toLowerCase() == expected.toLowerCase()) {
              catTop1++;
            }
            if (suggestions.any((s) => s.toLowerCase() == expected.toLowerCase())) {
              catTop4++;
            } else {
              failedCases.add('[$category] "$typo" -> expected "$expected", got ${suggestions.toString()}');
            }
          }
        }

        totalCases += cases.length;
        totalTop1 += catTop1;
        totalTop4 += catTop4;
        totalNoSuggestion += catNoSugg;

        final top1Pct = ((catTop1 / cases.length) * 100).toStringAsFixed(1);
        final top4Pct = ((catTop4 / cases.length) * 100).toStringAsFixed(1);
        print('Category: $category');
        print('  Cases: ${cases.length}');
        print('  Top-1 Accuracy: $top1Pct% ($catTop1/${cases.length})');
        print('  Top-4 Accuracy: $top4Pct% ($catTop4/${cases.length})');
      }

      final overallTop1Pct = ((totalTop1 / totalCases) * 100).toStringAsFixed(1);
      final overallTop4Pct = ((totalTop4 / totalCases) * 100).toStringAsFixed(1);

      print('--- OVERALL AGGREGATE RESULTS ---');
      print('Total Cases: $totalCases');
      print('Overall Top-1 Accuracy: $overallTop1Pct% ($totalTop1/$totalCases)');
      print('Overall Top-4 Accuracy: $overallTop4Pct% ($totalTop4/$totalCases)');
      print('Overall No-Suggestion Rate: $totalNoSuggestion / $totalCases');
      print('Failed Cases Count: ${failedCases.length}');

      // Assert mandatory requirements
      expect(totalCases, equals(250));
      expect(totalTop4 / totalCases, greaterThanOrEqualTo(0.85),
          reason: 'Overall Top-4 accuracy must meet or exceed 85%');

      // Verify the 6 mandatory cases explicitly
      final fevrSugg = repository.getSuggestions('fevr', maxSuggestions: 4);
      expect(fevrSugg, contains('fever'));

      final hedacheSugg = repository.getSuggestions('hedache', maxSuggestions: 4);
      expect(hedacheSugg, contains('headache'));

      final pneuomniaSugg = repository.getSuggestions('pneuomnia', maxSuggestions: 4);
      expect(pneuomniaSugg, contains('pneumonia'));

      final paracetmolSugg = repository.getSuggestions('paracetmol', maxSuggestions: 4);
      expect(paracetmolSugg, contains('paracetamol'));

      final hypertensnSugg = repository.getSuggestions('hypertensn', maxSuggestions: 4);
      expect(hypertensnSugg, contains('hypertension'));

      final diabtesSugg = repository.getSuggestions('diabtes', maxSuggestions: 4);
      expect(diabtesSugg, contains('diabetes'));
    });
  });
}
