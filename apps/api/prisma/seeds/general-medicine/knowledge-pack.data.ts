import { KnowledgePackDomain } from '../knowledge-pack.types';

export const GENERAL_MEDICINE_PACK_METADATA = {
  domain: KnowledgePackDomain.GENERAL_MEDICINE,
  name: 'General Medicine Primary Care Outpatient Clinical Knowledge Pack',
  description:
    'Authoritative, deterministic clinical decision support knowledge pack for high-prevalence outpatient presentations in Indian primary care and general practice OPDs. Synthesizes ICMR Standard Treatment Guidelines, WHO guidelines, and established clinical prediction rules.',
  version: {
    major: 1,
    minor: 0,
    patch: 0,
    changelog:
      'v1.0.0-draft: Initial bootstrap seed covering 35 high-prevalence outpatient conditions across respiratory, gastrointestinal, tropical fevers, cardiovascular, endocrine, neurology, musculoskeletal, and dermatology domains. Includes allowlisted AST differential rules, red-flag high acuity triggers, and evidence-grade source references.',
  },
};

