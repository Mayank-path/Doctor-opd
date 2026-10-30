import { PublicKeyStatus } from '../constants/governance.constants';

export interface AttestationPayload {
  versionId: string;
  checksumSha256: string;
  reviewerUserId: string;
  credentialId: string;
  medicalRegistration: string;
  approvalVerdict: 'APPROVED' | 'REJECTED';
  signedAt: string; // ISO 8601 UTC format
  nonce: string; // UUIDv4 anti-replay nonce
}

export interface SignedAttestationEnvelope {
  algorithm: 'ed25519';
  signature: string; // Base64 encoded Ed25519 signature
  keyFingerprint: string; // SHA-256 fingerprint of the public key
  payload: AttestationPayload;
}

export interface ReviewerPublicKeyEntity {
  id: string;
  reviewerUserId: string;
  publicKeyPem: string;
  keyAlgorithm: string;
  keyFingerprint: string;
  status: PublicKeyStatus;
  expiresAt: Date;
  revokedAt: Date | null;
  revocationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Deterministically serializes an attestation payload into a canonical UTF-8 JSON string.
 * All keys are sorted alphabetically (ASCII ascending) to ensure cross-platform
 * signature reproducibility across Node.js, mobile clients, and HSMs.
 */
export function serializeAttestationPayload(payload: AttestationPayload): string {
  const sorted = {
    approvalVerdict: payload.approvalVerdict,
    checksumSha256: payload.checksumSha256.toLowerCase(),
    credentialId: payload.credentialId,
    medicalRegistration: payload.medicalRegistration.trim().toUpperCase(),
    nonce: payload.nonce,
    reviewerUserId: payload.reviewerUserId,
    signedAt: payload.signedAt,
    versionId: payload.versionId,
  };
  return JSON.stringify(sorted);
}

