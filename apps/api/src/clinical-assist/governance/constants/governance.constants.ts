import { KnowledgePackDomain } from '@prisma/client';

export enum ReviewerVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum PublicKeyStatus {
  ACTIVE = 'ACTIVE',
  ROTATED = 'ROTATED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum GovernanceAuditAction {
  REVIEWER_CREDENTIAL_SUBMITTED = 'REVIEWER_CREDENTIAL_SUBMITTED',
  REVIEWER_CREDENTIAL_VERIFIED = 'REVIEWER_CREDENTIAL_VERIFIED',
  REVIEWER_CREDENTIAL_REJECTED = 'REVIEWER_CREDENTIAL_REJECTED',
  REVIEWER_CREDENTIAL_REVOKED = 'REVIEWER_CREDENTIAL_REVOKED',
  PUBLIC_KEY_REGISTERED = 'PUBLIC_KEY_REGISTERED',
  PUBLIC_KEY_ROTATED = 'PUBLIC_KEY_ROTATED',
  PUBLIC_KEY_REVOKED = 'PUBLIC_KEY_REVOKED',
  APPROVAL_SUBMITTED = 'APPROVAL_SUBMITTED',
  APPROVAL_RECORDED = 'APPROVAL_RECORDED',
  APPROVAL_ATTESTATION_SIGNED = 'APPROVAL_ATTESTATION_SIGNED',
  APPROVAL_REJECTED_COI = 'APPROVAL_REJECTED_COI',
  APPROVAL_REJECTED_UNAUTHORIZED = 'APPROVAL_REJECTED_UNAUTHORIZED',
  APPROVALS_INVALIDATED_CHECKSUM_CHANGED = 'APPROVALS_INVALIDATED_CHECKSUM_CHANGED',
  SIGNATURE_VERIFIED = 'SIGNATURE_VERIFIED',
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',
  SIGNATURE_REPLAY_DETECTED = 'SIGNATURE_REPLAY_DETECTED',
  QUORUM_EVALUATION_SUCCESS = 'QUORUM_EVALUATION_SUCCESS',
  QUORUM_EVALUATION_FAILED = 'QUORUM_EVALUATION_FAILED',
  VERSION_STATUS_TRANSITION = 'VERSION_STATUS_TRANSITION',
  RELEASE_ATTEMPT_REJECTED = 'RELEASE_ATTEMPT_REJECTED',
  RELEASE_ACTIVATED = 'RELEASE_ACTIVATED',
  RELEASE_DEACTIVATED = 'RELEASE_DEACTIVATED',
  EMERGENCY_DEACTIVATION = 'EMERGENCY_DEACTIVATION',
  RELEASE_ROLLED_BACK = 'RELEASE_ROLLED_BACK',
  RELEASE_VERIFICATION_FAILED = 'RELEASE_VERIFICATION_FAILED',
}

export interface DomainQuorumRule {
  domain: KnowledgePackDomain;
  minIndependentApprovals: number;
  minSeniorReviewers: number;
  seniorExperienceYears: number;
  acceptedSpecialties: string[];
}

/**
 * Domain-specific multi-signature approval quorum requirements
 * strictly following the Phase 5C.1 Clinical Governance Specification.
 */
export const DOMAIN_QUORUM_RULES: Record<KnowledgePackDomain, DomainQuorumRule> = {
  [KnowledgePackDomain.GENERAL_MEDICINE]: {
    domain: KnowledgePackDomain.GENERAL_MEDICINE,
    minIndependentApprovals: 2,
    minSeniorReviewers: 1,
    seniorExperienceYears: 10,
    acceptedSpecialties: [
      'GENERAL_MEDICINE',
      'INTERNAL_MEDICINE',
      'FAMILY_MEDICINE',
      'MD (GENERAL MEDICINE)',
      'DNB (GENERAL MEDICINE)',
      'MD (INTERNAL MEDICINE)',
    ],
  },
  [KnowledgePackDomain.RESPIRATORY]: {
    domain: KnowledgePackDomain.RESPIRATORY,
    minIndependentApprovals: 2,
    minSeniorReviewers: 1,
    seniorExperienceYears: 7,
    acceptedSpecialties: [
      'RESPIRATORY',
      'PULMONARY_MEDICINE',
      'CHEST_MEDICINE',
      'MD (PULMONARY MEDICINE)',
      'MD (RESPIRATORY MEDICINE)',
      'DNB (RESPIRATORY MEDICINE)',
    ],
  },
  [KnowledgePackDomain.CARDIOLOGY]: {
    domain: KnowledgePackDomain.CARDIOLOGY,
    minIndependentApprovals: 3,
    minSeniorReviewers: 1,
    seniorExperienceYears: 10,
    acceptedSpecialties: [
      'CARDIOLOGY',
      'DM (CARDIOLOGY)',
      'DNB (CARDIOLOGY)',
      'GENERAL_MEDICINE',
      'MD (GENERAL MEDICINE)',
    ],
  },
  [KnowledgePackDomain.GASTROENTEROLOGY]: {
    domain: KnowledgePackDomain.GASTROENTEROLOGY,
    minIndependentApprovals: 2,
    minSeniorReviewers: 1,
    seniorExperienceYears: 7,
    acceptedSpecialties: [
      'GASTROENTEROLOGY',
      'DM (GASTROENTEROLOGY)',
      'DNB (GASTROENTEROLOGY)',
      'GENERAL_MEDICINE',
      'MD (GENERAL MEDICINE)',
    ],
  },
  [KnowledgePackDomain.NEUROLOGY]: {
    domain: KnowledgePackDomain.NEUROLOGY,
    minIndependentApprovals: 2,
    minSeniorReviewers: 1,
    seniorExperienceYears: 7,
    acceptedSpecialties: [
      'NEUROLOGY',
      'DM (NEUROLOGY)',
      'DNB (NEUROLOGY)',
      'GENERAL_MEDICINE',
      'MD (GENERAL MEDICINE)',
    ],
  },
};

/**
 * Default credential and approval lifespans (Phase 5C.1: 24 months validity)
 */
export const CREDENTIAL_VALIDITY_MONTHS = 24;
export const APPROVAL_VALIDITY_MONTHS = 24;
export const SENIOR_REVIEWER_EXPERIENCE_THRESHOLD_YEARS = 10;
export const ATTESTATION_KEY_ALGORITHM = 'ed25519';
export const PUBLIC_KEY_DEFAULT_VALIDITY_MONTHS = 12;

