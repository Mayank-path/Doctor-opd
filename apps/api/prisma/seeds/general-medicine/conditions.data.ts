import { ClinicalConditionSeed } from '../knowledge-pack.types';

export const GENERAL_MEDICINE_CONDITIONS: ClinicalConditionSeed[] = [
  // --- RESPIRATORY & ENT (Conditions 1-5, 21-22, 25-27) ---
  {
    conditionCode: 'COND-GM-URI-001',
    displayName: 'Acute Viral Upper Respiratory Infection (Common Cold)',
    description:
      'Self-limiting acute viral infection of the upper respiratory mucosal tract presenting with rhinorrhea, nasal congestion, and mild constitutional symptoms.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J00 (Acute nasopharyngitis)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-STREP-002',
    displayName: 'Acute Streptococcal Pharyngitis / Tonsillitis',
    description:
      'Acute Group A beta-hemolytic streptococcal infection of the pharyngeal tonsils presenting with severe odynophagia, tonsillar exudates, and fever without prominent cough.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J02.0 (Streptococcal pharyngitis)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-BRONCH-003',
    displayName: 'Acute Bronchitis',
    description:
      'Acute self-limiting inflammation of the large airways (trachea and bronchi) presenting with persistent cough, sputum production, and retrosternal chest discomfort without focal consolidation.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J20.9 (Acute bronchitis, unspecified)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-CAP-004',
    displayName: 'Community-Acquired Pneumonia (CAP)',
    description:
      'Acute infection of the pulmonary parenchymal tissue acquired outside healthcare facilities, presenting with cough, fever, dyspnea, and focal auscultatory crackles or consolidation.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J18.9 (Pneumonia, unspecified organism)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-ILI-005',
    displayName: 'Influenza / Influenza-Like Illness (ILI)',
    description:
      'Acute viral respiratory syndrome characterized by abrupt high fever, pronounced generalized myalgia, dry cough, severe fatigue, and headache.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J10.1 (Influenza with other respiratory manifestations)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-ALLERG-RHIN-021',
    displayName: 'Allergic Rhinitis',
    description:
      'IgE-mediated inflammatory condition of the nasal mucosa triggered by allergen exposure, manifesting as paroxysmal sneezing, watery rhinorrhea, nasal pruritus, and ocular congestion.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J30.1 (Allergic rhinitis due to pollen)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },
  {
    conditionCode: 'COND-GM-RHINOSINUS-022',
    displayName: 'Acute Bacterial Rhinosinusitis',
    description:
      'Secondary bacterial inflammation of paranasal sinuses manifesting with persistent purulent anterior/posterior nasal discharge, facial pain or pressure lasting >10 days or worsening after initial improvement.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J01.9 (Acute sinusitis, unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },
  {
    conditionCode: 'COND-GM-ASTHMA-EXAC-025',
    displayName: 'Bronchial Asthma (Mild-to-Moderate Exacerbation)',
    description:
      'Acute or subacute worsening of airflow obstruction and respiratory distress in an individual with hyperreactive airways, presenting with wheezing, chest tightness, and breathlessness.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J45.9 (Asthma, unspecified)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-COPD-EXAC-026',
    displayName: 'Chronic Obstructive Pulmonary Disease (Acute Exacerbation)',
    description:
      'Acute worsening of baseline respiratory symptoms (increased dyspnea, sputum volume, and sputum purulence) in a patient with progressive airflow limitation from tobacco or biomass smoke.',
    category: 'RESPIRATORY',
    icd10Guidance: 'J44.1 (COPD with acute exacerbation)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-OTITIS-MEDIA-027',
    displayName: 'Acute Otitis Media',
    description:
      'Rapid onset infection and inflammation of the middle ear space presenting with ear pain, erythema or bulging of the tympanic membrane, and hearing attenuation.',
    category: 'RESPIRATORY',
    icd10Guidance: 'H66.9 (Otitis media, unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- GASTROINTESTINAL (Conditions 6-10) ---
  {
    conditionCode: 'COND-GM-GASTRO-VIRAL-006',
    displayName: 'Acute Viral Gastroenteritis',
    description:
      'Acute self-limiting mucosal infection of the stomach and small intestine presenting with sudden onset watery non-bloody diarrhea, nausea, vomiting, and low-grade pyrexia.',
    category: 'GASTROINTESTINAL',
    icd10Guidance: 'A08.4 (Viral intestinal infection, unspecified)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-ENTERITIS-BACT-007',
    displayName: 'Bacterial Enteritis / Foodborne Illness',
    description:
      'Acute inflammatory bacterial infection of the gastrointestinal tract commonly acquired via contaminated food or water, manifesting with fever, crampy abdominal pain, and frequent diarrheal stools.',
    category: 'GASTROINTESTINAL',
    icd10Guidance: 'A04.9 (Bacterial intestinal infection, unspecified)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-DYSENTERY-AMOE-008',
    displayName: 'Amoebic Dysentery',
    description:
      'Invasive colonic infection caused by Entamoeba histolytica characterized by subacute or acute passage of loose stools containing frank blood and mucus, accompanied by tenesmus and lower abdominal colic.',
    category: 'GASTROINTESTINAL',
    icd10Guidance: 'A06.0 (Acute amoebic dysentery)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-GERD-009',
    displayName: 'Gastroesophageal Reflux Disease (GERD)',
    description:
      'Retrograde flow of gastric acidic contents into the esophagus causing troublesome retrosternal burning (heartburn) and acid regurgitation, characteristically provoked by meals or recumbency.',
    category: 'GASTROINTESTINAL',
    icd10Guidance: 'K21.9 (Gastro-esophageal reflux disease without esophagitis)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-PUD-DYSPEPSIA-010',
    displayName: 'Peptic Ulcer Disease / Non-Ulcer Dyspepsia',
    description:
      'Ulceration of gastric or duodenal mucosa or functional epigastric pain syndrome manifesting with localized burning epigastric discomfort, postprandial fullness, and nocturnal awakening.',
    category: 'GASTROINTESTINAL',
    icd10Guidance: 'K27.9 (Peptic ulcer, site unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- INFECTIOUS & TROPICAL FEVERS (Conditions 11-16) ---
  {
    conditionCode: 'COND-GM-UTI-CYSTITIS-011',
    displayName: 'Uncomplicated Urinary Tract Infection (Acute Cystitis)',
    description:
      'Infection localized to the lower urinary tract and bladder in non-pregnant individuals presenting with dysuria, frequency, urgency, and suprapubic aching without systemic toxicity or flank pain.',
    category: 'INFECTIOUS_DISEASE',
    icd10Guidance: 'N39.0 (Urinary tract infection, site not specified)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-PYELONEPHRITIS-012',
    displayName: 'Acute Pyelonephritis',
    description:
      'Ascending acute bacterial infection of the renal parenchyma and pelvis presenting with high fever, chills, rigors, unilateral or bilateral costovertebral flank tenderness, and lower tract dysuria.',
    category: 'INFECTIOUS_DISEASE',
    icd10Guidance: 'N10 (Acute tubulo-interstitial nephritis / pyelonephritis)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-MALARIA-UNCOMP-013',
    displayName: 'Malaria (Plasmodium vivax / falciparum uncomplicated)',
    description:
      'Protozoan infection transmitted by Anopheles mosquitoes manifesting with paroxysmal spikes of high fever accompanied by shaking chills (cold stage), fever (hot stage), and drenching diaphoresis (sweating stage).',
    category: 'INFECTIOUS_DISEASE',
    icd10Guidance: 'B54 (Unspecified malaria)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-DENGUE-NONSEV-014',
    displayName: 'Dengue Fever (Non-severe)',
    description:
      'Acute arboviral infection transmitted by Aedes mosquitoes characterized by abrupt high fever, severe retro-orbital pain, debilitating musculoskeletal aches ("breakbone fever"), and flushing.',
    category: 'INFECTIOUS_DISEASE',
    icd10Guidance: 'A90 (Dengue fever [classical dengue])',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-ENTERIC-FEVER-015',
    displayName: 'Enteric Fever (Typhoid / Paratyphoid)',
    description:
      'Systemic invasive bacterial infection caused by Salmonella enterica serovars Typhi or Paratyphi presenting with prolonged step-ladder fever, severe frontal headache, abdominal discomfort, and coated tongue.',
    category: 'INFECTIOUS_DISEASE',
    icd10Guidance: 'A01.0 (Typhoid fever)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-HEPATITIS-ACUTE-016',
    displayName: 'Acute Viral Hepatitis (Hepatitis A/E presentation)',
    description:
      'Acute enterically transmitted viral inflammation of the hepatic parenchyma characterized by prodromal anorexia, nausea, and tea-colored dark urine followed by scleral icterus and right upper quadrant heaviness.',
    category: 'INFECTIOUS_DISEASE',
    icd10Guidance: 'B15.9 (Hepatitis A without hepatic coma)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- CARDIOVASCULAR & METABOLIC (Conditions 17-18, 34) ---
  {
    conditionCode: 'COND-GM-HYPERTENSION-017',
    displayName: 'Essential Hypertension (Uncontrolled Outpatient)',
    description:
      'Persistent elevation of systemic arterial blood pressure (systolic >=140 mmHg and/or diastolic >=90 mmHg) documented on repeated clinical evaluation in the absence of acute end-organ compromise.',
    category: 'CARDIOVASCULAR',
    icd10Guidance: 'I10 (Essential [primary] hypertension)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-T2DM-NEW-018',
    displayName: 'Type 2 Diabetes Mellitus (New Onset / Symptomatic)',
    description:
      'Metabolic disorder characterized by chronic hyperglycemia due to relative insulin deficiency and insulin resistance, presenting with classical osmotic symptoms (polyuria, polydipsia, unprovoked weight loss).',
    category: 'ENDOCRINE_METABOLIC',
    icd10Guidance: 'E11.9 (Type 2 diabetes mellitus without complications)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-HYPOTHYROID-034',
    displayName: 'Hypothyroidism (Symptomatic Adult)',
    description:
      'Clinical syndrome resulting from subnormal circulating levels of thyroid hormones presenting with generalized fatigue, cold intolerance, unexpected weight gain, obstinate constipation, and dry coarse skin.',
    category: 'ENDOCRINE_METABOLIC',
    icd10Guidance: 'E03.9 (Hypothyroidism, unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- NEUROLOGY & PAIN (Conditions 19-20, 28) ---
  {
    conditionCode: 'COND-GM-HEADACHE-TENSION-019',
    displayName: 'Tension-Type Headache',
    description:
      'Most common benign primary headache disorder characterized by dull, non-pulsating, bilateral band-like compressive cephalalgia of mild to moderate intensity without aggravation by routine exertion.',
    category: 'NEUROLOGY',
    icd10Guidance: 'G44.2 (Tension-type headache)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-MIGRAINE-NOAURA-020',
    displayName: 'Migraine without Aura',
    description:
      'Recurrent neurovascular headache disorder manifesting as unilateral, throbbing or pulsating cephalalgia of moderate to severe intensity, aggravated by physical exertion and accompanied by nausea and sensory phobia.',
    category: 'NEUROLOGY',
    icd10Guidance: 'G43.0 (Migraine without aura)',
    evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
  },
  {
    conditionCode: 'COND-GM-VERTIGO-PERIPH-028',
    displayName: 'Acute Peripheral Vertigo (BPPV / Vestibular Neuritis)',
    description:
      'Illusion of true rotational environmental motion arising from peripheral labyrinthine or vestibular nerve disturbance, triggered by changes in head position and accompanied by nausea and horizontal nystagmus.',
    category: 'NEUROLOGY',
    icd10Guidance: 'H81.1 (Benign paroxysmal vertigo)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- HEMATOLOGY & NUTRITION (Conditions 23-24) ---
  {
    conditionCode: 'COND-GM-ANEMIA-IDA-023',
    displayName: 'Iron Deficiency Anemia',
    description:
      'Microcytic hypochromic anemia resulting from depleted iron stores, presenting with persistent fatigue, conjunctival/palmar pallor, exertional breathlessness, dizziness, and functional weakness.',
    category: 'HEMATOLOGY',
    icd10Guidance: 'D50.9 (Iron deficiency anemia, unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },
  {
    conditionCode: 'COND-GM-DEFIC-VIT-MYALGIA-024',
    displayName: 'Vitamin D / B12 Deficiency Nutritional Myalgia',
    description:
      'Nutritional deficiency syndrome presenting with generalized musculoskeletal aching, proximal lower limb heaviness, persistent fatigue, and distal extremity paresthesias in high-risk adult outpatients.',
    category: 'ENDOCRINE_METABOLIC',
    icd10Guidance: 'E56.9 (Vitamin deficiency, unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- MUSCULOSKELETAL (Conditions 29-30) ---
  {
    conditionCode: 'COND-GM-LBP-MECHANICAL-029',
    displayName: 'Mechanical Low Back Pain / Lumbar Strain',
    description:
      'Non-specific musculoskeletal pain and paravertebral muscle spasm localized between the lower costal margin and gluteal folds, aggravated by movement or spinal loading and relieved by recumbency.',
    category: 'MUSCULOSKELETAL',
    icd10Guidance: 'M54.5 (Low back pain)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },
  {
    conditionCode: 'COND-GM-OA-KNEE-030',
    displayName: 'Knee Osteoarthritis (Symptomatic)',
    description:
      'Chronic degenerative joint disorder of the knee presenting with activity-related joint aching, crepitus on active motion, and brief morning stiffness (<30 minutes) in adults over 45 years.',
    category: 'MUSCULOSKELETAL',
    icd10Guidance: 'M17.9 (Osteoarthritis of knee, unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- DERMATOLOGY & EXANTHEMS (Conditions 31-33) ---
  {
    conditionCode: 'COND-GM-CELLULITIS-031',
    displayName: 'Cellulitis / Erysipelas (Uncomplicated)',
    description:
      'Acute spreading bacterial infection of the deep dermis and subcutaneous tissues manifesting with localized erythema, warmth, non-fluctuant edema, and tenderness with indistinct margins.',
    category: 'DERMATOLOGY',
    icd10Guidance: 'L03.9 (Cellulitis, unspecified)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },
  {
    conditionCode: 'COND-GM-CHICKENPOX-032',
    displayName: 'Chickenpox (Varicella Zoster)',
    description:
      'Primary viral infection caused by Varicella Zoster Virus presenting with generalized pruritic pleomorphic exanthem demonstrating crops of papules, clear vesicles ("dew drops"), and crusted lesions with centripetal spread.',
    category: 'DERMATOLOGY',
    icd10Guidance: 'B01.9 (Varicella without complication)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },
  {
    conditionCode: 'COND-GM-SHINGLES-033',
    displayName: 'Herpes Zoster (Shingles)',
    description:
      'Reactivation of latent Varicella Zoster Virus in sensory dorsal root ganglia characterized by unilateral radicular dermatomal burning pain followed by grouped erythematous papules and vesicles strictly limited to the dermatome.',
    category: 'DERMATOLOGY',
    icd10Guidance: 'B02.9 (Zoster without complication)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },

  // --- PSYCHIATRIC / FUNCTIONAL (Condition 35) ---
  {
    conditionCode: 'COND-GM-GAD-SOMATIC-035',
    displayName: 'Generalized Anxiety Disorder / Somatization Presentation',
    description:
      'Psychological disorder presenting in outpatient general medicine clinics with chronic pervasive anxiety, autonomic hyperactivity, muscle tension, palpitations, and non-organic somatic distress.',
    category: 'PSYCHIATRIC',
    icd10Guidance: 'F41.1 (Generalized anxiety disorder)',
    evidenceStatus: 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
  },
];

