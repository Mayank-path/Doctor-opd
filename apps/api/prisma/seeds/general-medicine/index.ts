import { KnowledgePackSeed } from '../knowledge-pack.types';
import { GENERAL_MEDICINE_PACK_METADATA } from './knowledge-pack.data';
import { GENERAL_MEDICINE_CONDITIONS } from './conditions.data';
import { GENERAL_MEDICINE_RED_FLAGS } from './red-flag-rules.data';
import { GENERAL_MEDICINE_SOURCE_REFERENCES } from './source-references.data';

export const GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED: KnowledgePackSeed = {
  domain: GENERAL_MEDICINE_PACK_METADATA.domain,
  name: GENERAL_MEDICINE_PACK_METADATA.name,
  description: GENERAL_MEDICINE_PACK_METADATA.description,
  version: GENERAL_MEDICINE_PACK_METADATA.version,
  conditions: GENERAL_MEDICINE_CONDITIONS,
  rules: [],
  redFlags: GENERAL_MEDICINE_RED_FLAGS,
  sources: GENERAL_MEDICINE_SOURCE_REFERENCES,
  mappings: [],
};

export {
  GENERAL_MEDICINE_PACK_METADATA,
  GENERAL_MEDICINE_CONDITIONS,
  GENERAL_MEDICINE_RED_FLAGS,
  GENERAL_MEDICINE_SOURCE_REFERENCES,
};
