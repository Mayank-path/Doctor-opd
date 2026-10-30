import { DifferentialRuleSeed } from '../knowledge-pack.types';

export const GENERAL_MEDICINE_DIFFERENTIAL_RULES: DifferentialRuleSeed[] = [
  // 1. Common Cold
  {
    ruleCode: 'RULE-GM-URI-001',
    conditionCode: 'COND-GM-URI-001',
    ruleTitle: 'Acute Viral Rhinopharyngitis (Common Cold) Outpatient Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 5, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Runny nose', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Breathlessness', expectedStatus: 'PRESENT' },
          { type: 'NUMERIC_PARAM', parameter: 'VITAL_SPO2', operator: 'LESS_THAN', value: 92 },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
      { examination: 'EXAM-CHEST-AUSCULTATION', prompt: 'Chest auscultation not performed.' },
    ],
    investigations: ['No routine investigations indicated for uncomplicated viral rhinitis.'],
    isComplete: true,
  },

  // 2. Strep Pharyngitis
  {
    ruleCode: 'RULE-GM-STREP-001',
    conditionCode: 'COND-GM-STREP-002',
    ruleTitle: 'Acute Streptococcal Pharyngitis / Tonsillitis Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 3, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Throat pain',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.0 },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'ABSENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Runny nose', expectedStatus: 'PRESENT' },
        ],
      },
    ],
    missingDataRules: [
      { examination: 'EXAM-THROAT-INSPECTION', prompt: 'Oropharyngeal inspection for tonsillar exudates not recorded.' },
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Throat Swab for Rapid Antigen Detection Test (RADT)', 'Throat Culture and Sensitivity'],
    isComplete: true,
  },

  // 3. Acute Bronchitis
  {
    ruleCode: 'RULE-GM-BRONCH-001',
    conditionCode: 'COND-GM-BRONCH-003',
    ruleTitle: 'Acute Bronchitis Primary Clinical Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 16, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Cough',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Breathlessness', expectedStatus: 'PRESENT' },
          { type: 'NUMERIC_PARAM', parameter: 'VITAL_RESPIRATORY_RATE', operator: 'GREATER_THAN', value: 28 },
          { type: 'NUMERIC_PARAM', parameter: 'VITAL_SPO2', operator: 'LESS_THAN', value: 92 },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_RESPIRATORY_RATE', prompt: 'Respiratory rate not recorded.' },
      { examination: 'EXAM-CHEST-AUSCULTATION', prompt: 'Chest auscultation for crackles or wheeze not recorded.' },
    ],
    investigations: ['Chest X-Ray PA View (only if focal chest signs or abnormal vitals)'],
    isComplete: true,
  },

  // 4. CAP
  {
    ruleCode: 'RULE-GM-CAP-001',
    conditionCode: 'COND-GM-CAP-004',
    ruleTitle: 'Community-Acquired Pneumonia Primary Diagnostic Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Cough',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Breathlessness', expectedStatus: 'PRESENT' },
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.0 },
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_RESPIRATORY_RATE', operator: 'GREATER_THAN_OR_EQUAL', value: 22 },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'ABSENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'ABSENT' },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_SPO2', prompt: 'SpO2 not recorded. Essential for respiratory assessment.' },
      { parameter: 'VITAL_RESPIRATORY_RATE', prompt: 'Respiratory rate not recorded.' },
      { examination: 'EXAM-CHEST-AUSCULTATION', prompt: 'Chest auscultation for bronchial breathing / crackles not recorded.' },
    ],
    investigations: ['Chest X-Ray Posteroanterior (PA) View', 'Complete Blood Count (CBC) with Differential', 'Sputum Gram Stain and Culture'],
    isComplete: true,
  },

  // 5. Influenza / ILI
  {
    ruleCode: 'RULE-GM-ILI-001',
    conditionCode: 'COND-GM-ILI-005',
    ruleTitle: 'Influenza-Like Illness Outpatient Case Definition',
    minMajorCount: 1,
    applicability: { minAgeYears: 5, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
        { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.0 },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'ABSENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'ABSENT' },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Nasopharyngeal Swab for Influenza RT-PCR (outbreak surveillance)'],
    isComplete: true,
  },

  // 6. Acute Viral Gastroenteritis
  {
    ruleCode: 'RULE-GM-GASTRO-001',
    conditionCode: 'COND-GM-GASTRO-VIRAL-006',
    ruleTitle: 'Acute Viral Gastroenteritis Clinical Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 2, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Diarrhea',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        type: 'CONCEPT_STATUS',
        canonicalTerm: 'Diarrhea',
        expectedStatus: 'ABSENT',
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded to assess volume depletion.' },
      { parameter: 'VITAL_PULSE', prompt: 'Pulse rate not recorded for tachycardia.' },
    ],
    investigations: ['Stool Routine & Microscopy (if persistent >48h or signs of dehydration)'],
    isComplete: true,
  },

  // 7. Bacterial Enteritis
  {
    ruleCode: 'RULE-GM-ENTERITIS-001',
    conditionCode: 'COND-GM-ENTERITIS-BACT-007',
    ruleTitle: 'Bacterial Enteritis / Foodborne Illness Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 5, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Diarrhea',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Diarrhea', expectedStatus: 'ABSENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'ABSENT' },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded.' },
    ],
    investigations: ['Stool Routine and Microscopy (for fecal leukocytes/RBCs)', 'Stool Culture & Sensitivity'],
    isComplete: true,
  },

  // 8. Amoebic Dysentery
  {
    ruleCode: 'RULE-GM-DYSENTERY-001',
    conditionCode: 'COND-GM-DYSENTERY-AMOE-008',
    ruleTitle: 'Amoebic Dysentery Clinical Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 5, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ALL',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Diarrhea', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Diarrhea', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { examination: 'EXAM-ABDOMEN-PALPATION', prompt: 'Abdominal palpation for colonic tenderness not recorded.' },
    ],
    investigations: ['Fresh Stool Examination for Entamoeba histolytica trophozoites containing ingested RBCs'],
    isComplete: true,
  },

  // 9. GERD
  {
    ruleCode: 'RULE-GM-GERD-001',
    conditionCode: 'COND-GM-GERD-009',
    ruleTitle: 'Gastroesophageal Reflux Disease Diagnostic Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 16, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Burning sensation', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Breathlessness', expectedStatus: 'PRESENT' },
          { type: 'NUMERIC_PARAM', parameter: 'VITAL_BP_SYSTOLIC', operator: 'LESS_THAN', value: 90 },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded.' },
      { parameter: 'VITAL_PULSE', prompt: 'Pulse rate not recorded.' },
    ],
    investigations: ['Upper GI Endoscopy (if alarm symptoms: dysphagia, weight loss, or age >55)'],
    isComplete: true,
  },

  // 10. Peptic Ulcer Disease
  {
    ruleCode: 'RULE-GM-PUD-001',
    conditionCode: 'COND-GM-PUD-DYSPEPSIA-010',
    ruleTitle: 'Peptic Ulcer Disease / Dyspepsia Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Abdominal pain',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Burning sensation', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { examination: 'EXAM-ABDOMEN-PALPATION', prompt: 'Epigastric palpation not recorded.' },
    ],
    investigations: ['H. pylori Stool Antigen Test or Urea Breath Test', 'Upper Gastrointestinal Endoscopy'],
    isComplete: false,
  },

  // 11. Uncomplicated UTI
  {
    ruleCode: 'RULE-GM-UTI-001',
    conditionCode: 'COND-GM-UTI-CYSTITIS-011',
    ruleTitle: 'Uncomplicated Acute Cystitis Diagnostic Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 14, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Burning sensation',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.5 },
          { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Urine Routine and Microscopy (pyuria, bacteriuria)', 'Urine Culture and Sensitivity'],
    isComplete: true,
  },

  // 12. Acute Pyelonephritis
  {
    ruleCode: 'RULE-GM-PYELO-001',
    conditionCode: 'COND-GM-PYELONEPHRITIS-012',
    ruleTitle: 'Acute Pyelonephritis Outpatient Recognition Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 14, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ALL',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Burning sensation', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.0 },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { examination: 'EXAM-RENAL-ANGLE-TENDERNESS', prompt: 'Costovertebral angle / renal angle tenderness not recorded.' },
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Urine Routine and Microscopy', 'Urine Culture and Sensitivity', 'Complete Blood Count (CBC)', 'Ultrasonography KUB'],
    isComplete: true,
  },

  // 13. Malaria
  {
    ruleCode: 'RULE-GM-MALARIA-001',
    conditionCode: 'COND-GM-MALARIA-UNCOMP-013',
    ruleTitle: 'Uncomplicated Malaria Clinical Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 2, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Fever',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.5 },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
      { examination: 'EXAM-SPLEEN-PALPATION', prompt: 'Splenic palpation not recorded.' },
    ],
    investigations: ['Rapid Diagnostic Test for Malaria (Pf/Pv RDT)', 'Peripheral Blood Smear for Malarial Parasite (thick and thin smear)'],
    isComplete: true,
  },

  // 14. Dengue Fever
  {
    ruleCode: 'RULE-GM-DENGUE-001',
    conditionCode: 'COND-GM-DENGUE-NONSEV-014',
    ruleTitle: 'Non-Severe Dengue Outpatient Clinical Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 2, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Fever',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Joint pain', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded to monitor pulse pressure.' },
      { parameter: 'VITAL_PULSE', prompt: 'Pulse rate not recorded.' },
    ],
    investigations: ['Dengue NS1 Antigen (Day 1-5 of fever)', 'Complete Blood Count (Platelet count & Hematocrit)', 'Dengue IgM Antibody (>Day 5)'],
    isComplete: true,
  },

  // 15. Enteric Fever
  {
    ruleCode: 'RULE-GM-TYPHOID-001',
    conditionCode: 'COND-GM-ENTERIC-FEVER-015',
    ruleTitle: 'Enteric Fever (Typhoid / Paratyphoid) Clinical Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 3, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Fever',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Diarrhea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
      { examination: 'EXAM-ABDOMEN-PALPATION', prompt: 'Hepatosplenomegaly examination not recorded.' },
    ],
    investigations: ['Blood Culture (Gold standard in 1st week)', 'Typhidot IgM', 'Widal Test (paired sera)'],
    isComplete: true,
  },

  // 16. Acute Viral Hepatitis
  {
    ruleCode: 'RULE-GM-HEPATITIS-001',
    conditionCode: 'COND-GM-HEPATITIS-ACUTE-016',
    ruleTitle: 'Acute Viral Hepatitis Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 3, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-SCLERA-ICTERUS', prompt: 'Scleral examination for jaundice not recorded.' },
      { examination: 'EXAM-LIVER-PALPATION', prompt: 'Right hypochondrium / liver palpation not recorded.' },
    ],
    investigations: ['Liver Function Tests (Total/Direct Bilirubin, AST, ALT, ALP)', 'Anti-HAV IgM & Anti-HEV IgM Serology'],
    isComplete: false,
  },

  // 17. Essential Hypertension
  {
    ruleCode: 'RULE-GM-HTN-001',
    conditionCode: 'COND-GM-HYPERTENSION-017',
    ruleTitle: 'Essential Hypertension Outpatient Diagnostic Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'NUMERIC_PARAM', parameter: 'VITAL_BP_SYSTOLIC', operator: 'GREATER_THAN_OR_EQUAL', value: 140 },
        { type: 'NUMERIC_PARAM', parameter: 'VITAL_BP_DIASTOLIC', operator: 'GREATER_THAN_OR_EQUAL', value: 90 },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Dizziness', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      {
        operator: 'ALL',
        predicates: [
          { type: 'NUMERIC_PARAM', parameter: 'VITAL_BP_SYSTOLIC', operator: 'LESS_THAN', value: 120 },
          { type: 'NUMERIC_PARAM', parameter: 'VITAL_BP_DIASTOLIC', operator: 'LESS_THAN', value: 80 },
        ],
      },
    ],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Systolic blood pressure not recorded.' },
      { parameter: 'VITAL_BP_DIASTOLIC', prompt: 'Diastolic blood pressure not recorded.' },
    ],
    investigations: ['Serum Creatinine & Electrolytes', 'Fasting Blood Glucose', 'Lipid Profile', 'ECG (12-lead)', 'Urinalysis for Microalbuminuria'],
    isComplete: true,
  },

  // 18. Type 2 Diabetes
  {
    ruleCode: 'RULE-GM-T2DM-001',
    conditionCode: 'COND-GM-T2DM-NEW-018',
    ruleTitle: 'Type 2 Diabetes Mellitus Symptomatic Screening Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Weakness',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Burning sensation', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Dizziness', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded.' },
    ],
    investigations: ['Fasting Plasma Glucose (FPG)', '2-hour Postprandial Blood Glucose (PPBG)', 'Glycated Hemoglobin (HbA1c)', 'Urine Albumin-to-Creatinine Ratio'],
    isComplete: true,
  },

  // 19. Tension-Type Headache
  {
    ruleCode: 'RULE-GM-TTH-001',
    conditionCode: 'COND-GM-HEADACHE-TENSION-019',
    ruleTitle: 'Tension-Type Headache Clinical Diagnostic Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 12, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Headache',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'ABSENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'ABSENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'ABSENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded to rule out hypertensive urgency.' },
    ],
    investigations: ['None routinely indicated for typical tension-type headache meeting ICHD-3 criteria'],
    isComplete: true,
  },

  // 20. Migraine
  {
    ruleCode: 'RULE-GM-MIGRAINE-001',
    conditionCode: 'COND-GM-MIGRAINE-NOAURA-020',
    ruleTitle: 'Migraine without Aura Primary Diagnostic Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 12, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Headache',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Dizziness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'ABSENT' },
    ],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded.' },
    ],
    investigations: ['MRI/CT Brain only if red flags (SNOOP criteria: sudden onset, focal neurological signs, age >50)'],
    isComplete: true,
  },

  // 21. Allergic Rhinitis
  {
    ruleCode: 'RULE-GM-ALLERG-001',
    conditionCode: 'COND-GM-ALLERG-RHIN-021',
    ruleTitle: 'Allergic Rhinitis Clinical Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 2, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Runny nose',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN', value: 38.5 },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Complete Blood Count with Absolute Eosinophil Count (AEC)'],
    isComplete: false,
  },

  // 22. Acute Bacterial Rhinosinusitis
  {
    ruleCode: 'RULE-GM-RHINOSIN-001',
    conditionCode: 'COND-GM-RHINOSINUS-022',
    ruleTitle: 'Acute Bacterial Rhinosinusitis Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 6, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ALL',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Runny nose', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-FACIAL-SINUS-TENDERNESS', prompt: 'Maxillary and frontal sinus tenderness not recorded.' },
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Waters View Paranasal Sinus Radiograph (if recurrent or refractory)'],
    isComplete: false,
  },

  // 23. Iron Deficiency Anemia
  {
    ruleCode: 'RULE-GM-ANEMIA-001',
    conditionCode: 'COND-GM-ANEMIA-IDA-023',
    ruleTitle: 'Iron Deficiency Anemia Clinical Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 12, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Weakness',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Dizziness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Breathlessness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-CONJUNCTIVAL-PALLOR', prompt: 'Conjunctival / mucosal pallor examination not recorded.' },
      { parameter: 'VITAL_PULSE', prompt: 'Pulse rate not recorded for resting tachycardia.' },
    ],
    investigations: ['Complete Blood Count (Hb, RBC indices, MCV < 80 fL)', 'Serum Ferritin & Iron Profile', 'Peripheral Blood Smear'],
    isComplete: false,
  },

  // 24. Vitamin D / B12 Deficiency Myalgia
  {
    ruleCode: 'RULE-GM-VITDEF-001',
    conditionCode: 'COND-GM-DEFIC-VIT-MYALGIA-024',
    ruleTitle: 'Nutritional Deficiency Myalgia Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Joint pain', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Burning sensation', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Dizziness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN', value: 38.5 },
    ],
    missingDataRules: [
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Serum 25-Hydroxy Vitamin D', 'Serum Vitamin B12', 'Serum Calcium & Alkaline Phosphatase'],
    isComplete: false,
  },

  // 25. Asthma Exacerbation
  {
    ruleCode: 'RULE-GM-ASTHMA-001',
    conditionCode: 'COND-GM-ASTHMA-EXAC-025',
    ruleTitle: 'Asthma Mild-to-Moderate Exacerbation Diagnostic Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 5, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Breathlessness',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { parameter: 'VITAL_SPO2', prompt: 'SpO2 not recorded.' },
      { parameter: 'VITAL_RESPIRATORY_RATE', prompt: 'Respiratory rate not recorded.' },
      { examination: 'EXAM-CHEST-AUSCULTATION', prompt: 'Chest auscultation for wheezing not recorded.' },
    ],
    investigations: ['Peak Expiratory Flow Rate (PEFR)', 'Spirometry with Pre- and Post-Bronchodilator Reversibility (when stable)'],
    isComplete: true,
  },

  // 26. COPD Exacerbation
  {
    ruleCode: 'RULE-GM-COPD-001',
    conditionCode: 'COND-GM-COPD-EXAC-026',
    ruleTitle: 'COPD Acute Exacerbation Outpatient Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 40, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ALL',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Breathlessness', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_RESPIRATORY_RATE', operator: 'GREATER_THAN_OR_EQUAL', value: 20 },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { parameter: 'VITAL_SPO2', prompt: 'SpO2 not recorded.' },
      { parameter: 'VITAL_RESPIRATORY_RATE', prompt: 'Respiratory rate not recorded.' },
      { examination: 'EXAM-CHEST-AUSCULTATION', prompt: 'Chest auscultation for rhonchi/crackles not recorded.' },
    ],
    investigations: ['Chest Radiograph PA View', 'Arterial Blood Gas Analysis (if SpO2 < 92%)', 'Complete Blood Count (CBC)'],
    isComplete: true,
  },

  // 27. Acute Otitis Media
  {
    ruleCode: 'RULE-GM-AOM-001',
    conditionCode: 'COND-GM-OTITIS-MEDIA-027',
    ruleTitle: 'Acute Otitis Media Diagnostic Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 1, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Throat pain',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Runny nose', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Cough', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-OTOSCOPY-TYMPANIC-MEMBRANE', prompt: 'Otoscopic examination of the tympanic membrane not recorded.' },
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Otoscopic Examination (bulging, erythema of tympanic membrane)'],
    isComplete: false,
  },

  // 28. Acute Peripheral Vertigo
  {
    ruleCode: 'RULE-GM-VERTIGO-001',
    conditionCode: 'COND-GM-VERTIGO-PERIPH-028',
    ruleTitle: 'Acute Peripheral Vertigo Diagnostic Heuristic',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Dizziness',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Nausea', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Vomiting', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-NYSTAGMUS-EVALUATION', prompt: 'Nystagmus evaluation not recorded.' },
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded.' },
    ],
    investigations: ['Dix-Hallpike Maneuver', 'Pure Tone Audiometry (if hearing loss present)'],
    isComplete: false,
  },

  // 29. Mechanical Low Back Pain
  {
    ruleCode: 'RULE-GM-LBP-001',
    conditionCode: 'COND-GM-LBP-MECHANICAL-029',
    ruleTitle: 'Mechanical Low Back Pain Clinical Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Body ache',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Joint pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [],
    contradictions: [
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.5 },
    ],
    missingDataRules: [
      { examination: 'EXAM-STRAIGHT-LEG-RAISE', prompt: 'Straight Leg Raise (SLR) test not recorded.' },
      { examination: 'EXAM-SPINAL-TENDERNESS', prompt: 'Spinal palpation for localized bony tenderness not recorded.' },
    ],
    investigations: ['Lumbosacral Spine Radiograph (only if red flags: trauma, fever, steroid use, age >50)'],
    isComplete: false,
  },

  // 30. Knee Osteoarthritis
  {
    ruleCode: 'RULE-GM-OA-001',
    conditionCode: 'COND-GM-OA-KNEE-030',
    ruleTitle: 'Symptomatic Knee Osteoarthritis Clinical Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 45, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Joint pain',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [],
    contradictions: [
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.5 },
    ],
    missingDataRules: [
      { examination: 'EXAM-KNEE-CREPITUS', prompt: 'Knee joint active motion crepitus and effusion examination not recorded.' },
    ],
    investigations: ['Weight-Bearing Bilateral Knee X-Ray (Anteroposterior & Lateral Views)'],
    isComplete: false,
  },

  // 31. Cellulitis
  {
    ruleCode: 'RULE-GM-CELLULITIS-001',
    conditionCode: 'COND-GM-CELLULITIS-031',
    ruleTitle: 'Uncomplicated Cellulitis Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 5, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Burning sensation', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 37.8 },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-SKIN-ERYTHEMA-WARMTH', prompt: 'Skin inspection for localized spreading erythema, warmth, and edema not recorded.' },
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Complete Blood Count (CBC)', 'Fasting Blood Sugar', 'Wound Swab for Culture (if open exudate)'],
    isComplete: false,
  },

  // 32. Chickenpox
  {
    ruleCode: 'RULE-GM-CHICKENPOX-001',
    conditionCode: 'COND-GM-CHICKENPOX-032',
    ruleTitle: 'Chickenpox (Varicella) Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 1, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ALL',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Fever', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Throat pain', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-SKIN-VESICULAR-RASH', prompt: 'Skin inspection for pleomorphic vesicular lesions in crops not recorded.' },
      { parameter: 'VITAL_TEMPERATURE_C', prompt: 'Body temperature not recorded.' },
    ],
    investigations: ['Clinical diagnosis; Tzanck smear or VZV PCR only if diagnostic dilemma'],
    isComplete: false,
  },

  // 33. Herpes Zoster
  {
    ruleCode: 'RULE-GM-SHINGLES-001',
    conditionCode: 'COND-GM-SHINGLES-033',
    ruleTitle: 'Herpes Zoster (Shingles) Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Burning sensation',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
    ],
    contradictions: [],
    missingDataRules: [
      { examination: 'EXAM-SKIN-DERMATOMAL-VESICLES', prompt: 'Skin inspection for unilateral dermatomal vesicles not recorded.' },
    ],
    investigations: ['Clinical diagnosis; Tzanck smear if atypical presentation'],
    isComplete: false,
  },

  // 34. Hypothyroidism
  {
    ruleCode: 'RULE-GM-HYPOTHYROID-001',
    conditionCode: 'COND-GM-HYPOTHYROID-034',
    ruleTitle: 'Hypothyroidism Symptomatic Adult Screening Criteria',
    minMajorCount: 1,
    applicability: { minAgeYears: 18, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      type: 'CONCEPT_STATUS',
      canonicalTerm: 'Weakness',
      expectedStatus: 'PRESENT',
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Dizziness', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Joint pain', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_PULSE', operator: 'GREATER_THAN', value: 110 },
    ],
    missingDataRules: [
      { parameter: 'VITAL_PULSE', prompt: 'Pulse rate not recorded for resting bradycardia.' },
      { examination: 'EXAM-THYROID-PALPATION', prompt: 'Anterior neck examination for thyroid enlargement not recorded.' },
    ],
    investigations: ['Serum Thyroid Stimulating Hormone (TSH)', 'Free Thyroxine (FT4)', 'Anti-Thyroid Peroxidase (Anti-TPO) Antibodies'],
    isComplete: false,
  },

  // 35. Generalized Anxiety Disorder
  {
    ruleCode: 'RULE-GM-GAD-001',
    conditionCode: 'COND-GM-GAD-SOMATIC-035',
    ruleTitle: 'Generalized Anxiety Disorder / Somatization Presentation',
    minMajorCount: 1,
    applicability: { minAgeYears: 16, maxAgeYears: 120, gender: 'ALL', encounterType: 'OPD_OUTPATIENT' },
    mandatoryAst: {
      operator: 'ANY',
      predicates: [
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Weakness', expectedStatus: 'PRESENT' },
        { type: 'CONCEPT_STATUS', canonicalTerm: 'Dizziness', expectedStatus: 'PRESENT' },
      ],
    },
    majorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Headache', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Chest pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Breathlessness', expectedStatus: 'PRESENT' },
    ],
    minorSupporting: [
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Abdominal pain', expectedStatus: 'PRESENT' },
      { type: 'CONCEPT_STATUS', canonicalTerm: 'Body ache', expectedStatus: 'PRESENT' },
    ],
    contradictions: [
      { type: 'NUMERIC_PARAM', parameter: 'VITAL_TEMPERATURE_C', operator: 'GREATER_THAN_OR_EQUAL', value: 38.0 },
    ],
    missingDataRules: [
      { parameter: 'VITAL_BP_SYSTOLIC', prompt: 'Blood pressure not recorded.' },
      { parameter: 'VITAL_PULSE', prompt: 'Pulse rate not recorded.' },
    ],
    investigations: ['GAD-7 Questionnaire Scoring', 'Thyroid Function Test (TSH)', '12-lead ECG (to exclude organic cardiac arrhythmia)'],
    isComplete: false,
  },
];

