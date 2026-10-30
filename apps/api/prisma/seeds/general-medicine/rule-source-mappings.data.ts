import { RuleSourceMappingSeed } from '../knowledge-pack.types';

export const GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS: RuleSourceMappingSeed[] = [
  // Respiratory
  { ruleCode: 'RULE-GM-URI-001', sourceReferenceIdentifier: 'SRC-ICMR-RESP-URI-2019' },
  { ruleCode: 'RULE-GM-STREP-001', sourceReferenceIdentifier: 'SRC-CENTOR-MCPB-1981' },
  { ruleCode: 'RULE-GM-BRONCH-001', sourceReferenceIdentifier: 'SRC-NICE-NG120-2019' },
  { ruleCode: 'RULE-GM-CAP-001', sourceReferenceIdentifier: 'SRC-ICMR-CAP-2022' },
  { ruleCode: 'RULE-GM-ILI-001', sourceReferenceIdentifier: 'SRC-WHO-FLU-ILI-2021' },
  { ruleCode: 'RULE-GM-ALLERG-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },
  { ruleCode: 'RULE-GM-RHINOSIN-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },
  { ruleCode: 'RULE-GM-ASTHMA-001', sourceReferenceIdentifier: 'SRC-GINA-ASTHMA-2023' },
  { ruleCode: 'RULE-GM-COPD-001', sourceReferenceIdentifier: 'SRC-GOLD-COPD-2024' },
  { ruleCode: 'RULE-GM-AOM-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Gastroenterology
  { ruleCode: 'RULE-GM-GASTRO-001', sourceReferenceIdentifier: 'SRC-ICMR-GASTRO-DIARRHEA-2020' },
  { ruleCode: 'RULE-GM-ENTERITIS-001', sourceReferenceIdentifier: 'SRC-ICMR-GASTRO-DIARRHEA-2020' },
  { ruleCode: 'RULE-GM-DYSENTERY-001', sourceReferenceIdentifier: 'SRC-ICMR-GASTRO-DIARRHEA-2020' },
  { ruleCode: 'RULE-GM-GERD-001', sourceReferenceIdentifier: 'SRC-NICE-CG184-GERD-2019' },
  { ruleCode: 'RULE-GM-PUD-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Fevers / Infections
  { ruleCode: 'RULE-GM-UTI-001', sourceReferenceIdentifier: 'SRC-ICMR-AMR-UTI-2022' },
  { ruleCode: 'RULE-GM-PYELO-001', sourceReferenceIdentifier: 'SRC-ICMR-AMR-UTI-2022' },
  { ruleCode: 'RULE-GM-MALARIA-001', sourceReferenceIdentifier: 'SRC-NVBDCP-MALARIA-2020' },
  { ruleCode: 'RULE-GM-DENGUE-001', sourceReferenceIdentifier: 'SRC-NVBDCP-DENGUE-2020' },
  { ruleCode: 'RULE-GM-TYPHOID-001', sourceReferenceIdentifier: 'SRC-ICMR-TYPHOID-2022' },
  { ruleCode: 'RULE-GM-HEPATITIS-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Cardiovascular & Metabolic
  { ruleCode: 'RULE-GM-HTN-001', sourceReferenceIdentifier: 'SRC-IGH-IV-HYPERTENSION-2019' },
  { ruleCode: 'RULE-GM-T2DM-001', sourceReferenceIdentifier: 'SRC-ICMR-T2DM-2018' },
  { ruleCode: 'RULE-GM-HYPOTHYROID-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Neurology
  { ruleCode: 'RULE-GM-TTH-001', sourceReferenceIdentifier: 'SRC-ICHD3-HEADACHE-2018' },
  { ruleCode: 'RULE-GM-MIGRAINE-001', sourceReferenceIdentifier: 'SRC-ICHD3-HEADACHE-2018' },
  { ruleCode: 'RULE-GM-VERTIGO-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Hematology & Nutrition
  { ruleCode: 'RULE-GM-ANEMIA-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },
  { ruleCode: 'RULE-GM-VITDEF-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Musculoskeletal
  { ruleCode: 'RULE-GM-LBP-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },
  { ruleCode: 'RULE-GM-OA-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Dermatology
  { ruleCode: 'RULE-GM-CELLULITIS-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },
  { ruleCode: 'RULE-GM-CHICKENPOX-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },
  { ruleCode: 'RULE-GM-SHINGLES-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },

  // Psychiatric
  { ruleCode: 'RULE-GM-GAD-001', sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026' },
];

