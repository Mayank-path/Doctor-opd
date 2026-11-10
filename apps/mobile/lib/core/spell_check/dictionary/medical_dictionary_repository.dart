import 'dart:math' as math;
import 'package:flutter/services.dart' show rootBundle;
import '../engine/candidate_ranker.dart';

/// Repository for offline medical, general English, and clinical abbreviation dictionaries.
class MedicalDictionaryRepository {
  final Set<String> _commonClinicalWords = <String>{};
  final Set<String> _commonEnglishWords = <String>{};
  final Set<String> _medicalWords = <String>{};
  final Set<String> _englishWords = <String>{};
  final Set<String> _abbreviations = <String>{};

  // Maps word to frequency rank index (lower rank = higher frequency)
  final Map<String, int> _wordFrequencyRanks = <String, int>{};

  // Grouped by length for fast candidate suggestion filtering
  final Map<int, List<String>> _wordsByLength = {};

  bool _isInitialized = false;

  MedicalDictionaryRepository({
    Set<String>? initialEnglishWords,
    Set<String>? initialMedicalWords,
    Set<String>? initialAbbreviations,
    Set<String>? initialCommonClinicalWords,
  }) {
    if (initialEnglishWords != null && initialEnglishWords.isNotEmpty) {
      _loadWordsIntoListAndSet(initialEnglishWords, _englishWords, isEnglish: true);
    }
    if (initialMedicalWords != null && initialMedicalWords.isNotEmpty) {
      _loadWordsIntoListAndSet(initialMedicalWords, _medicalWords, isEnglish: false);
    }
    if (initialAbbreviations != null && initialAbbreviations.isNotEmpty) {
      for (final a in initialAbbreviations) {
        final lower = a.trim().toLowerCase();
        if (lower.isNotEmpty) _abbreviations.add(lower);
      }
    }
    if (initialCommonClinicalWords != null && initialCommonClinicalWords.isNotEmpty) {
      for (final c in initialCommonClinicalWords) {
        final lower = c.trim().toLowerCase();
        if (lower.isNotEmpty) _commonClinicalWords.add(lower);
      }
    }

    _populateCoreCommonClinical();

    if (_englishWords.isNotEmpty || _medicalWords.isNotEmpty) {
      _rebuildIndex();
      _isInitialized = true;
    }
  }

  bool get isInitialized => _isInitialized;
  int get englishWordCount => _englishWords.length;
  int get medicalWordCount => _medicalWords.length;
  int get abbreviationCount => _abbreviations.length;

  /// Loads bundled dictionary text assets from `assets/dictionaries/`.
  Future<void> initialize() async {
    if (_isInitialized) return;

    _populateCoreCommonClinical();

    try {
      final engContent =
          await rootBundle.loadString('assets/dictionaries/english_words.txt');
      _loadContentIntoEnglish(engContent);
    } catch (_) {
      // Fallback core English words for testing or minimal environments
      _loadContentIntoEnglish(_defaultCoreEnglishWords);
    }

    try {
      final medContent =
          await rootBundle.loadString('assets/dictionaries/medical_words.txt');
      _loadContentIntoMedical(medContent);
    } catch (_) {
      // Fallback core medical words for testing
      _loadContentIntoMedical(_defaultCoreMedicalWords);
    }

    try {
      final abbrContent = await rootBundle
          .loadString('assets/dictionaries/clinical_abbreviations.txt');
      _loadLinesIntoSet(abbrContent, _abbreviations);
    } catch (_) {
      _loadLinesIntoSet(_defaultCoreAbbreviations, _abbreviations);
    }

    _rebuildIndex();
    _isInitialized = true;
  }

  void _loadContentIntoEnglish(String content) {
    final lines = content.split('\n');
    var rank = 0;
    for (var line in lines) {
      line = line.trim().toLowerCase();
      if (line.isNotEmpty) {
        if (_englishWords.add(line)) {
          _wordFrequencyRanks[line] = rank;
          // First 15,000 words in SCOWL are designated Tier 1 (Common English)
          if (rank < 15000) {
            _commonEnglishWords.add(line);
          }
          rank++;
        }
      }
    }
  }

  void _loadContentIntoMedical(String content) {
    final lines = content.split('\n');
    var rank = 0;
    for (var line in lines) {
      line = line.trim().toLowerCase();
      if (line.isNotEmpty) {
        if (_medicalWords.add(line)) {
          // First 2,000 words in medical list are common clinical vocabulary
          if (rank < 2000) {
            _commonClinicalWords.add(line);
          }
          rank++;
        }
      }
    }
  }

  void _loadWordsIntoListAndSet(Iterable<String> source, Set<String> targetSet, {required bool isEnglish}) {
    var rank = 0;
    for (final raw in source) {
      final line = raw.trim().toLowerCase();
      if (line.isNotEmpty) {
        if (targetSet.add(line)) {
          if (isEnglish) {
            _wordFrequencyRanks[line] = rank;
            if (rank < 15000) _commonEnglishWords.add(line);
          }
          rank++;
        }
      }
    }
  }

  void _loadLinesIntoSet(String content, Set<String> targetSet) {
    final lines = content.split('\n');
    for (var line in lines) {
      line = line.trim().toLowerCase();
      if (line.isNotEmpty) {
        targetSet.add(line);
      }
    }
  }

  void _populateCoreCommonClinical() {
    const coreClinical = {
      'fever', 'fevers', 'headache', 'headaches', 'weakness', 'fatigue', 'nausea', 'vomiting', 'pain', 'pains',
      'cough', 'coughing', 'infection', 'infections', 'hypertension', 'diabetes', 'pneumonia', 'anemia',
      'tachycardia', 'bradycardia', 'bronchitis', 'asthma', 'gastroenteritis', 'appendicitis', 'hepatitis',
      'nephritis', 'dermatitis', 'migraine', 'epilepsy', 'paracetamol', 'amoxicillin', 'metformin', 'azithromycin',
      'ibuprofen', 'pantoprazole', 'omeprazole', 'ciprofloxacin', 'levofloxacin', 'atorvastatin', 'amlodipine',
      'salbutamol', 'budesonide', 'cetirizine', 'prednisolone', 'doxycycline', 'cefixime', 'ofloxacin',
      'montelukast', 'rabeprazole', 'telmisartan', 'losartan', 'glimepiride', 'clopidogrel', 'aspirin',
      'malaria', 'dengue', 'typhoid', 'chikungunya', 'jaundice', 'cirrhosis', 'pancreatitis', 'cholecystitis',
      'gastritis', 'colitis', 'sepsis', 'shock', 'edema', 'swelling', 'rash', 'pruritus', 'dyspnea',
      'wheezing', 'stridor', 'hemoptysis', 'hematemesis', 'melena', 'hematuria', 'dysuria', 'polyuria',
      'oliguria', 'proteinuria', 'syncope', 'vertigo', 'dizziness', 'tremor', 'seizure', 'seizures',
      // Verified clinical symptoms, anatomical locations & physiological findings
      'coryza', 'bodyache', 'retrosternal', 'subcostal', 'hypochondrium', 'suprapubic', 'epigastric',
      'periumbilical', 'odynophagia', 'rhinorrhea', 'nocturia', 'polydipsia', 'polyphagia',
      'tachypnea', 'bradypnea', 'orthopnea', 'pyrexia', 'afebrile', 'normotensive'
    };
    _commonClinicalWords.addAll(coreClinical);
  }

  void _rebuildIndex() {
    _wordsByLength.clear();
    final combined = {..._englishWords, ..._medicalWords, ..._commonClinicalWords};
    for (final word in combined) {
      _wordsByLength.putIfAbsent(word.length, () => []).add(word);
    }
  }

  /// Checks if a word is recognized as valid in the clinical/general dictionaries.
  bool isWordValid(String word) {
    final cleaned = _cleanWord(word);
    if (cleaned.isEmpty) return true;

    final lower = cleaned.toLowerCase();

    // 1. Check clinical abbreviations
    if (_abbreviations.contains(lower)) return true;

    // 2. Check common clinical words
    if (_commonClinicalWords.contains(lower)) return true;

    // 3. Check medical terminology
    if (_medicalWords.contains(lower)) return true;

    // 4. Check general English
    if (_englishWords.contains(lower)) return true;

    // 5. Check protected patterns (digits, measurements, doses, single chars)
    if (isProtectedToken(cleaned)) return true;

    return false;
  }

  /// Determines whether a token is protected clinical content (e.g. vitals, dosages, measurements).
  bool isProtectedToken(String token) {
    if (token.isEmpty) return true;

    // Single character tokens (e.g. 'a', 'I')
    if (token.length == 1) return true;

    // Any token containing numbers or clinical slash/hyphen expressions (e.g. '120/80', '500mg', '98.6F', '1-2', 'c/o', 'h/o')
    if (RegExp(r'\d').hasMatch(token)) return true;
    if (token.contains('/') || token.contains('-')) {
      final parts = token.split(RegExp(r'[/-]'));
      if (parts.every((p) => p.isEmpty || isWordValid(p) || isProtectedToken(p))) {
        return true;
      }
    }

    final lower = token.toLowerCase();

    // Standard clinical measurement units
    const units = {
      'mg', 'mcg', 'g', 'kg', 'ml', 'l', 'dl', 'meq', 'iu', 'u',
      'mmhg', 'bpm', 'cm', 'mm', 'm', 'mmol', 'min', 'sec', 'hr',
      'day', 'days', 'wk', 'wks', 'mo', 'mos', 'yr', 'yrs', 'c', 'f'
    };
    if (units.contains(lower)) return true;

    // Standard clinical abbreviations
    if (_abbreviations.contains(lower)) return true;

    return false;
  }

  /// Returns the logical vocabulary tier for [word].
  VocabularyTier getWordTier(String word) {
    final lower = word.toLowerCase();
    if (_commonClinicalWords.contains(lower)) {
      return VocabularyTier.commonClinical;
    }
    if (_commonEnglishWords.contains(lower)) {
      return VocabularyTier.commonEnglish;
    }
    if (_medicalWords.contains(lower)) {
      return VocabularyTier.specializedMedical;
    }
    return VocabularyTier.generalExtended;
  }

  /// Checks if [word] is part of clinical vocabulary (medical words or abbreviations).
  bool isClinicalWord(String word) {
    final lower = word.toLowerCase();
    return _commonClinicalWords.contains(lower) ||
        _medicalWords.contains(lower) ||
        _abbreviations.contains(lower);
  }

  /// Retrieves frequency rank for [word] if indexed, or -1.
  int getFrequencyRank(String word) {
    return _wordFrequencyRanks[word.toLowerCase()] ?? -1;
  }

  /// Generates top spelling correction suggestions for a misspelled word.
  List<String> getSuggestions(String word, {int maxSuggestions = 4}) {
    final cleaned = _cleanWord(word);
    if (cleaned.isEmpty || isWordValid(cleaned)) return const [];

    final lower = cleaned.toLowerCase();
    final wordLen = lower.length;

    // Fast candidate filter by length difference <= 2
    final candidates = <String>[];
    final minLen = math.max(1, wordLen - 2);
    final maxLen = wordLen + 2;

    for (var l = minLen; l <= maxLen; l++) {
      final list = _wordsByLength[l];
      if (list != null) {
        candidates.addAll(list);
      }
    }

    if (candidates.isEmpty) return const [];

    return CandidateRanker.rankCandidates(
      targetWord: cleaned,
      candidates: candidates,
      getWordTier: getWordTier,
      isClinicalWord: isClinicalWord,
      getFrequencyRank: getFrequencyRank,
      maxSuggestions: maxSuggestions,
    );
  }

  String _cleanWord(String word) {
    return word.replaceAll(RegExp(r"^[\s\p{P}]+|[\s\p{P}]+$", unicode: true), '');
  }

  // --- Fallback core vocabulary for test environments without asset bundle ---
  static const _defaultCoreEnglishWords = '''
patient patients doctor doctors clinic clinics hospital hospitals visit visits
present presents complaint complaints history illness symptom symptoms
examination examined diagnosis diagnosed treatment treated plan plans
fever fevers chills cough coughing headache headaches pain pains severe mild
acute chronic weakness fatigue nausea vomiting diarrhea abdominal stomach
skin rash swelling breath breathing normal clear bilateral left right
advised advice followup review noted reported states denies fear
''';

  static const _defaultCoreMedicalWords = '''
malaria dengue typhoid pneumonia bronchitis asthma diabetes hypertension
tachycardia bradycardia gastroenteritis appendicitis hepatitis nephritis
anemia dermatitis migraine epilepsy paracetamol amoxicillin metformin
azithromycin ibuprofen pantoprazole omeprazole ciprofloxacin levofloxacin
atorvastatin amlodipine salbutamol budesonide cetirizine prednisolone
urti lrti uti gerd htn copd cad ckd
''';

  static const _defaultCoreAbbreviations = '''
BP HR RR SpO2 SPO2 PR WT HT BMI ECG EKG CBC HB HBA1C CXR USG MRI CT
OD BD TDS QID SOS PRN STAT HS PO IV IM SC TAB CAP SYP INJ
OPD IPD ICU OT HX RX TX DX SX NAD WNL SOB mg mcg ml kg mmHg bpm
''';
}
