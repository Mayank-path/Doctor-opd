import {
  ClinicalConceptCategory,
  DurationUnit,
  SymptomFrequency,
  SymptomSeverity,
  TerminologyEntry,
} from './clinical-normalization.types';

/**
 * Curated Symptom Terminology Registry Entries.
 * Each entry maps aliases across English, Roman Hindi / Hinglish, and Devanagari Hindi
 * to an authoritative canonical symptom term.
 *
 * Clinical Safety Rule: Every alias must represent a clinically equivalent subjective
 * symptom concept reported by a patient, NEVER a clinical sign, diagnosis, condition, or disease.
 */
export const CURATED_TERMINOLOGY_ENTRIES: TerminologyEntry[] = [
  {
    canonicalTerm: 'Fever',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'fever',
      'high fever',
      'low grade fever',
      'low-grade fever',
      'feverish',
      'febrile',
      'pyrexia',
      'bukhar',
      'bukaar',
      'bukhaar',
      'taap',
      'tez bukhar',
      'halka bukhar',
      'बुखार',
      'बुख़ार',
      'ताप',
      'ज्वर',
    ],
  },
  {
    canonicalTerm: 'Cough',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'cough',
      'coughing',
      'dry cough',
      'productive cough',
      'wet cough',
      'khansi',
      'khaansi',
      'khasie',
      'khasi',
      'खांसी',
      'खाँसी',
      'कफ',
      'खासी',
    ],
  },
  {
    canonicalTerm: 'Headache',
    conceptCategory: 'SYMPTOM',
    defaultBodyLocation: 'Head',
    aliases: [
      'headache',
      'head ache',
      'head pain',
      'sir dard',
      'sar dard',
      'sir me dard',
      'sar me dard',
      'sir mein dard',
      'sar mein dard',
      'sir me pain',
      'sar me pain',
      'sir dard hona',
      'सिर दर्द',
      'सर दर्द',
      'सिरदर्द',
      'सरदर्द',
    ],
  },
  {
    canonicalTerm: 'Throat pain',
    conceptCategory: 'SYMPTOM',
    defaultBodyLocation: 'Throat',
    aliases: [
      'throat pain',
      'throat me pain',
      'throat mein pain',
      'throat me dard',
      'throat mein dard',
      'sore throat',
      'throat ache',
      'throat irritation',
      'gala dard',
      'gale me dard',
      'gale mein dard',
      'gale me pain',
      'gale mein pain',
      'gala kharab',
      'gale me kharash',
      'gale mein kharash',
      'गला दर्द',
      'गले में दर्द',
      'गला खराब',
      'खराश',
    ],
  },
  {
    canonicalTerm: 'Abdominal pain',
    conceptCategory: 'SYMPTOM',
    defaultBodyLocation: 'Abdomen',
    aliases: [
      'abdominal pain',
      'stomach pain',
      'stomach ache',
      'belly pain',
      'tummy ache',
      'tummy pain',
      'stomach cramps',
      'abdominal cramps',
      'pet dard',
      'pet me dard',
      'pet mein dard',
      'pet me pain',
      'pet mein pain',
      'stomach me dard',
      'stomach mein dard',
      'pet kharab',
      'pet me marod',
      'pet mein marod',
      'पेट दर्द',
      'पेट में दर्द',
      'पेट खराब',
    ],
  },
  {
    canonicalTerm: 'Vomiting',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'vomiting',
      'vomit',
      'emesis',
      'throwing up',
      'puking',
      'ulti',
      'ultiyan',
      'ultiya',
      'ulti aana',
      'ulti aati hai',
      'उल्टी',
      'उल्टियां',
      'उलटी',
      'वमन',
    ],
  },
  {
    canonicalTerm: 'Nausea',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'nausea',
      'nauseous',
      'nauseated',
      'feeling sick',
      'ji michlana',
      'jee michlana',
      'ji ghabrana',
      'mann kharab',
      'matli',
      'ulti jaisa lagna',
      'जी मिचलाना',
      'मतली',
      'जी घबराना',
    ],
  },
  {
    canonicalTerm: 'Breathlessness',
    conceptCategory: 'SYMPTOM',
    defaultBodyLocation: 'Chest',
    aliases: [
      'breathlessness',
      'shortness of breath',
      'difficulty breathing',
      'dyspnea',
      'labored breathing',
      'saans lene mein dikkat',
      'saans lene me dikkat',
      'saans phoolna',
      'saans ki takleef',
      'dam phoolna',
      'सांस लेने में दिक्कत',
      'सांस फूलना',
      'साँस फूलना',
    ],
  },
  {
    canonicalTerm: 'Dizziness',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'dizziness',
      'dizzy',
      'vertigo',
      'lightheadedness',
      'light-headed',
      'unsteadiness',
      'chakkar',
      'chakkar aana',
      'sir ghumna',
      'sar ghumna',
      'चक्कर',
      'चक्कर आना',
      'सिर घूमना',
    ],
  },
  {
    canonicalTerm: 'Weakness',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'weakness',
      'fatigue',
      'lethargy',
      'tiredness',
      'exhaustion',
      'malaise',
      'kamzori',
      'kamjori',
      'thakan',
      'thawat',
      'sustee',
      'susti',
      'कमजोरी',
      'कमज़ोरी',
      'थकान',
      'सुस्ती',
    ],
  },
  {
    canonicalTerm: 'Diarrhea',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'diarrhea',
      'diarrhoea',
      'loose motion',
      'loose motions',
      'loose stools',
      'watery stools',
      'dast',
      'patla dast',
      'दस्त',
      'पतले दस्त',
      'लूज मोशन',
    ],
  },
  {
    canonicalTerm: 'Burning sensation',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'burning sensation',
      'burning',
      'heartburn',
      'jalan',
      'pet me jalan',
      'pet mein jalan',
      'chhati me jalan',
      'chhati mein jalan',
      'seene me jalan',
      'seene mein jalan',
      'gale me jalan',
      'जलन',
      'सीने में जलन',
      'पेट में जलन',
    ],
  },
  {
    canonicalTerm: 'Chest pain',
    conceptCategory: 'SYMPTOM',
    defaultBodyLocation: 'Chest',
    aliases: [
      'chest pain',
      'chest mein pain',
      'chest me pain',
      'chest me dard',
      'chest mein dard',
      'chest tightness',
      'chest pressure',
      'chhati me dard',
      'chhati mein dard',
      'seene me dard',
      'seene mein dard',
      'chhati dard',
      'seena dard',
      'छाती में दर्द',
      'सीने में दर्द',
    ],
  },
  {
    canonicalTerm: 'Body ache',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'body ache',
      'body pain',
      'generalized ache',
      'myalgia',
      'badan dard',
      'shareer me dard',
      'shareer mein dard',
      'बदन दर्द',
      'शरीर में दर्द',
    ],
  },
  {
    canonicalTerm: 'Joint pain',
    conceptCategory: 'SYMPTOM',
    defaultBodyLocation: 'Joints',
    aliases: [
      'joint pain',
      'arthralgia',
      'knee pain',
      'joints hurting',
      'jodon me dard',
      'jodon mein dard',
      'ghutne me dard',
      'ghutno me dard',
      'जोड़ों में दर्द',
      'घुटनों में दर्द',
    ],
  },
  {
    canonicalTerm: 'Runny nose',
    conceptCategory: 'SYMPTOM',
    aliases: [
      'runny nose',
      'coryza',
      'rhinorrhea',
      'nasal congestion',
      'nasal discharge',
      'zukham',
      'jukham',
      'naak behna',
      'sardi zukham',
      'sardi',
      'जुकाम',
      'ज़ुकाम',
      'नाक बहना',
      'सर्दी',
    ],
  },
];

/**
 * Curated anatomical body locations.
 */
export const CURATED_BODY_LOCATIONS: Record<string, string[]> = {
  Head: ['head', 'forehead', 'sir', 'sar', 'maatha', 'माथा', 'सिर', 'सर'],
  Throat: ['throat', 'gala', 'gale', 'गला', 'गले'],
  Chest: ['chest', 'chhati', 'seena', 'seene', 'छाती', 'सीने', 'सीना'],
  Abdomen: [
    'abdomen',
    'stomach',
    'belly',
    'tummy',
    'pet',
    'pait',
    'पेट',
    'उदर',
  ],
  Back: ['back', 'spine', 'peeth', 'kamar', 'पीठ', 'कमर'],
  Joints: [
    'joint',
    'joints',
    'knee',
    'knees',
    'ghutna',
    'ghutne',
    'jod',
    'jodon',
    'जोड़ों',
    'घुटने',
  ],
  Eyes: ['eye', 'eyes', 'aankh', 'aankhon', 'आंख', 'आंखें'],
  Ears: ['ear', 'ears', 'kaan', 'कान'],
  Skin: ['skin', 'chamdi', 'tvacha', 'त्वचा'],
};

/**
 * Explicitly audited disallowed / related clinical expressions.
 * These terms are strictly excluded from symptom mapping to preserve clinical concept separation.
 * They are preserved in `relatedClinicalExpressions` and `unmappedExpressions` to ensure
 * no clinician wording is lost.
 */
export interface ExcludedClinicalTerm {
  term: string;
  category: ClinicalConceptCategory;
  clinicalExplanation: string;
}

export const EXCLUDED_CLINICAL_TERMS: ExcludedClinicalTerm[] = [
  {
    term: 'migraine',
    category: 'DIAGNOSIS_OR_CONDITION',
    clinicalExplanation:
      'Diagnosed primary headache disorder / neurological condition; must not be normalized to generic Headache symptom.',
  },
  {
    term: 'pharyngitis',
    category: 'DIAGNOSIS_OR_CONDITION',
    clinicalExplanation:
      'Inflammatory or infectious diagnosis of the pharynx; must not be normalized to Throat pain symptom.',
  },
  {
    term: 'wheezing',
    category: 'CLINICAL_SIGN',
    clinicalExplanation:
      'Objective adventitious breath sound / auscultatory physical sign; must not be normalized to subjective Breathlessness.',
  },
  {
    term: 'chills',
    category: 'CLINICAL_SIGN',
    clinicalExplanation:
      'Neurovascular shivering / sensation of cold; distinct from elevated body temperature / Fever.',
  },
  {
    term: 'angina',
    category: 'DIAGNOSIS_OR_CONDITION',
    clinicalExplanation:
      'Coronary ischemic clinical syndrome / diagnosed condition; must not be normalized to generic Chest pain.',
  },
  {
    term: 'acid reflux',
    category: 'DIAGNOSIS_OR_CONDITION',
    clinicalExplanation:
      'Gastroesophageal reflux disease / physiological process; must not be normalized to generic Burning sensation.',
  },
  {
    term: 'acute',
    category: 'TEMPORAL_DESCRIPTOR',
    clinicalExplanation:
      'Temporal course descriptor (rapid onset / brief duration); must not be normalized to SEVERE rating.',
  },
  {
    term: 'cold',
    category: 'DIAGNOSIS_OR_CONDITION',
    clinicalExplanation:
      'General upper respiratory viral syndrome or thermal sensation; must not be normalized to Runny nose.',
  },
];

/**
 * Negation lexical markers.
 */
export const NEGATION_MARKERS = [
  'no',
  'not',
  'denies',
  'denied',
  'absent',
  'without',
  'negative for',
  'does not have',
  "doesn't have",
  'never',
  'nahi hai',
  'nahi tha',
  'nahi thi',
  'nahi',
  'nahin',
  'naahin',
  'koi nahi',
  'bilkul nahi',
  'kuch nahi',
  'na ho',
  'नहीं है',
  'नहीं',
  'ना',
  'नदारद',
];

/**
 * Uncertainty lexical markers.
 */
export const UNCERTAINTY_MARKERS = [
  'shayad',
  'lagta hai',
  'lag raha hai',
  'lagti hai',
  'ho sakta hai',
  'aisa lagta hai',
  'doubt hai',
  'possibly',
  'possible',
  'maybe',
  'suspected by patient',
  'suspected',
  'probable',
  'might be',
  'could be',
  'doubtful',
  'feels like',
  'uncertain',
  'शायद',
  'लगता है',
  'लग रहा है',
  'हो सकता है',
];

/**
 * Severity lexical markers.
 * Note: 'acute' has been audited and removed because it denotes temporal onset, NOT severity.
 */
export const SEVERITY_RULES: Array<{
  level: SymptomSeverity;
  markers: string[];
}> = [
  {
    level: SymptomSeverity.MILD,
    markers: [
      'mild',
      'slight',
      'slightly',
      'low grade',
      'low-grade',
      'halka',
      'halki',
      'halke',
      'kam',
      'thoda',
      'thodi',
      'हल्का',
      'हल्की',
      'हल्के',
      'कम',
      'थोड़ा',
    ],
  },
  {
    level: SymptomSeverity.MODERATE,
    markers: [
      'moderate',
      'moderately',
      'medium',
      'theek thaak',
      'madhyam',
      'मध्यम',
    ],
  },
  {
    level: SymptomSeverity.SEVERE,
    markers: [
      'severe',
      'severely',
      'intense',
      'high',
      'extreme',
      'unbearable',
      'bahut zyada',
      'bohot zyada',
      'bahut tej',
      'bohot tez',
      'tez',
      'bahut',
      'bohot',
      'अत्यधिक',
      'बहुत ज्यादा',
      'तेज़',
      'तीव्र',
      'असहनीय',
    ],
  },
];

/**
 * Frequency lexical markers.
 */
export const FREQUENCY_RULES: Array<{
  level: SymptomFrequency;
  markers: string[];
}> = [
  {
    level: SymptomFrequency.OCCASIONAL,
    markers: [
      'occasionally',
      'occasional',
      'kabhi kabhi',
      'kabhi-kabhi',
      'once in a while',
      'कभी कभी',
      'कभी-कभी',
    ],
  },
  {
    level: SymptomFrequency.INTERMITTENT,
    markers: [
      'intermittent',
      'intermittently',
      'sometimes',
      'ruk ruk kar',
      'beech beech mein',
      'रुक रुक कर',
    ],
  },
  {
    level: SymptomFrequency.FREQUENT,
    markers: [
      'frequently',
      'frequent',
      'often',
      'repeatedly',
      'baar baar',
      'bar bar',
      'har thodi der me',
      'बार बार',
      'बार-बार',
    ],
  },
  {
    level: SymptomFrequency.CONTINUOUS,
    markers: [
      'continuously',
      'continuous',
      'constant',
      'constantly',
      'persistent',
      'all the time',
      'lagatar',
      'lagaatar',
      'लगातार',
    ],
  },
];

/**
 * Numeric words to numbers mapping (Hinglish, English, Hindi, Devanagari).
 */
export const NUMBER_WORD_MAP: Record<string, number> = {
  // English words
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  // Roman Hindi words
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  che: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  gyarah: 11,
  barah: 12,
  pandrah: 15,
  bees: 20,
  pachees: 25,
  tees: 30,
  chalees: 40,
  pachaas: 50,
  // Devanagari words
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  // Devanagari numerals
  '०': 0,
  '१': 1,
  '२': 2,
  '३': 3,
  '४': 4,
  '५': 5,
  '६': 6,
  '७': 7,
  '८': 8,
  '९': 9,
};

/**
 * Duration unit keywords.
 */
export const DURATION_UNIT_MAP: Record<string, DurationUnit> = {
  // Hours
  hour: DurationUnit.HOURS,
  hours: DurationUnit.HOURS,
  hr: DurationUnit.HOURS,
  hrs: DurationUnit.HOURS,
  ghanta: DurationUnit.HOURS,
  ghante: DurationUnit.HOURS,
  ghanton: DurationUnit.HOURS,
  घंटा: DurationUnit.HOURS,
  घंटे: DurationUnit.HOURS,

  // Days
  day: DurationUnit.DAYS,
  days: DurationUnit.DAYS,
  d: DurationUnit.DAYS,
  din: DurationUnit.DAYS,
  dino: DurationUnit.DAYS,
  dinon: DurationUnit.DAYS,
  दिन: DurationUnit.DAYS,
  दिनों: DurationUnit.DAYS,

  // Weeks
  week: DurationUnit.WEEKS,
  weeks: DurationUnit.WEEKS,
  wk: DurationUnit.WEEKS,
  wks: DurationUnit.WEEKS,
  hafta: DurationUnit.WEEKS,
  hafte: DurationUnit.WEEKS,
  hafton: DurationUnit.WEEKS,
  saptaah: DurationUnit.WEEKS,
  हफ्ता: DurationUnit.WEEKS,
  हफ्ते: DurationUnit.WEEKS,
  सप्ताह: DurationUnit.WEEKS,

  // Months
  month: DurationUnit.MONTHS,
  months: DurationUnit.MONTHS,
  mo: DurationUnit.MONTHS,
  mos: DurationUnit.MONTHS,
  mahina: DurationUnit.MONTHS,
  mahine: DurationUnit.MONTHS,
  maheene: DurationUnit.MONTHS,
  महीना: DurationUnit.MONTHS,
  महीने: DurationUnit.MONTHS,

  // Years
  year: DurationUnit.YEARS,
  years: DurationUnit.YEARS,
  yr: DurationUnit.YEARS,
  yrs: DurationUnit.YEARS,
  saal: DurationUnit.YEARS,
  varsh: DurationUnit.YEARS,
  साल: DurationUnit.YEARS,
  वर्ष: DurationUnit.YEARS,
};

/**
 * Common Hinglish grammar and vocabulary markers for language identification.
 */
export const HINGLISH_GRAMMATICAL_MARKERS = [
  'ko',
  'se',
  'hai',
  'hain',
  'mein',
  'me',
  'nahi',
  'nahin',
  'aur',
  'ka',
  'ki',
  'ke',
  'tha',
  'thi',
  'the',
  'raha',
  'rahi',
  'rahe',
  'mareez',
  'halka',
  'halki',
  'bahut',
  'bohot',
  'shayad',
  'kal',
  'subah',
  'parso',
  'lekin',
  'par',
  'kuch',
  'koi',
  'dard',
  'bukhar',
  'khansi',
  'pet',
  'sir',
  'sar',
  'gala',
  'chhati',
  'aana',
  'aati',
  'aata',
  'hota',
  'hoti',
  'hote',
];
