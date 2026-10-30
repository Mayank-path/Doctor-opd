/**
 * Types and Domain Enums for the Hinglish Clinical Normalization Engine.
 *
 * This module is strictly a documentation aid.
 * It is completely deterministic and explainable.
 * It never diagnoses diseases, never recommends treatments, and never alters patient records.
 */

export enum SymptomPolarity {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  UNKNOWN = 'UNKNOWN',
}

export enum SymptomCertainty {
  CONFIRMED = 'CONFIRMED',
  UNCERTAIN = 'UNCERTAIN',
  UNKNOWN = 'UNKNOWN',
}

export enum SymptomSeverity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}

export enum SymptomFrequency {
  OCCASIONAL = 'OCCASIONAL',
  INTERMITTENT = 'INTERMITTENT',
  FREQUENT = 'FREQUENT',
  CONTINUOUS = 'CONTINUOUS',
}

export enum DurationUnit {
  HOURS = 'HOURS',
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
  YEARS = 'YEARS',
}

export enum DetectedClinicalLanguage {
  HINDI = 'HINDI',
  HINGLISH = 'HINGLISH',
  ENGLISH = 'ENGLISH',
  MIXED = 'MIXED',
  UNKNOWN = 'UNKNOWN',
}

export type ClinicalConceptCategory =
  'DIAGNOSIS_OR_CONDITION' | 'CLINICAL_SIGN' | 'TEMPORAL_DESCRIPTOR';

export interface RelatedClinicalExpression {
  expression: string;
  category: ClinicalConceptCategory;
  note: string;
}

export interface SymptomDuration {
  raw: string;
  value: number | null;
  unit: DurationUnit | null;
  onset?: string | null;
}

export interface NormalizedSymptom {
  canonicalTerm: string;
  originalExpression: string;
  polarity: SymptomPolarity;
  certainty: SymptomCertainty;
  duration: SymptomDuration | null;
  severity: SymptomSeverity | null;
  frequency: SymptomFrequency | null;
  bodyLocation: string | null;
  evidence: string;
}

export interface NormalizedClinicalResult {
  originalText: string;
  language: DetectedClinicalLanguage;
  symptoms: NormalizedSymptom[];
  unmappedExpressions: string[];
  relatedClinicalExpressions?: RelatedClinicalExpression[];
  requiresDoctorReview: true;
}

export interface TerminologyEntry {
  canonicalTerm: string;
  conceptCategory?: 'SYMPTOM';
  aliases: string[];
  defaultBodyLocation?: string;
}

export interface RawClauseMatch {
  canonicalTerm: string;
  matchedAlias: string;
  startIndex: number;
  endIndex: number;
  clauseText: string;
  clauseStartIndex: number;
  clauseEndIndex: number;
  defaultBodyLocation?: string;
}
