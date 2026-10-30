import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ATTESTATION_KEY_ALGORITHM,
  GovernanceAuditAction,
  PublicKeyStatus,
} from '../constants/governance.constants';
import {
  AttestationPayload,
  serializeAttestationPayload,
  SignedAttestationEnvelope,
} from '../interfaces/attestation.interface';
import { GOVERNANCE_NONCE_REPOSITORY } from '../interfaces/governance-nonce-repository.interface';
import type { IGovernanceNonceRepository } from '../interfaces/governance-nonce-repository.interface';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { ReviewerKeyManagementService } from './reviewer-key-management.service';

@Injectable()
export class CryptographicAttestationService {
  private readonly logger = new Logger(CryptographicAttestationService.name);
  // In-memory fallback buffer if persistent repository is not injected
  private readonly consumedNonces = new Set<string>();

  constructor(
    private readonly keyManagementService: ReviewerKeyManagementService,
    private readonly auditService: KnowledgePackGovernanceAuditService,
    @Optional()
    @Inject(GOVERNANCE_NONCE_REPOSITORY)
    private readonly nonceRepository?: IGovernanceNonceRepository,
  ) {}

  /**
   * Generates a compliant Ed25519 keypair in SPKI and PKCS8 PEM formats.
   * Useful for client simulation, integration tests, and HSM attestation enrollment.
   */
  generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync(
      ATTESTATION_KEY_ALGORITHM as any,
      {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      },
    );
    return { publicKeyPem: publicKey, privateKeyPem: privateKey };
  }

  /**
   * Cryptographically signs an attestation payload using a private Ed25519 key.
   */
  signPayload(
    payload: AttestationPayload,
    privateKeyPem: string,
    publicKeyPem: string,
  ): SignedAttestationEnvelope {
    const canonicalString = serializeAttestationPayload(payload);
    const keyFingerprint =
      this.keyManagementService.computeKeyFingerprint(publicKeyPem);

    const privateKeyObject = crypto.createPrivateKey(privateKeyPem);
    const signatureBuffer = crypto.sign(
      null,
      Buffer.from(canonicalString, 'utf8'),
      privateKeyObject,
    );

    return {
      algorithm: 'ed25519',
      signature: signatureBuffer.toString('base64'),
      keyFingerprint,
      payload,
    };
  }

  /**
   * Server-side cryptographic verification of a signed attestation envelope.
   * Validates:
   * 1. Envelope structural schema and Ed25519 algorithm.
   * 2. Version ID, Checksum, and Reviewer User ID match expected context.
   * 3. Anti-Replay: Nonce has not been previously consumed.
   * 4. Active, non-expired, non-revoked public key registered to the reviewer.
   * 5. Exact mathematical Ed25519 signature validity over canonical UTF-8 payload.
   */
  async verifyAttestationEnvelope(
    envelope: SignedAttestationEnvelope,
    targetVersion: { id: string; checksumSha256: string },
    expectedReviewerUserId: string,
  ): Promise<boolean> {
    if (!envelope || typeof envelope !== 'object') {
      throw new BadRequestException('Signed attestation envelope is required.');
    }

    if (envelope.algorithm !== 'ed25519') {
      throw new BadRequestException(
        `Unsupported cryptographic algorithm: Expected 'ed25519', received '${envelope.algorithm}'.`,
      );
    }

    if (!envelope.signature || typeof envelope.signature !== 'string') {
      throw new BadRequestException(
        'Attestation envelope is missing digital signature bytes.',
      );
    }

    const { payload } = envelope;
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException(
        'Attestation envelope is missing embedded payload.',
      );
    }

    // 1. Context Matching
    if (payload.versionId !== targetVersion.id) {
      this.logger.warn(
        `Attestation verification failed: Payload versionId (${payload.versionId}) does not match target version (${targetVersion.id}).`,
      );
      throw new BadRequestException(
        'Attestation payload versionId does not match target version being evaluated.',
      );
    }

    if (
      payload.checksumSha256.toLowerCase() !==
      targetVersion.checksumSha256.toLowerCase()
    ) {
      this.logger.warn(
        `Attestation verification failed: Payload checksum (${payload.checksumSha256}) does not match version checksum (${targetVersion.checksumSha256}).`,
      );
      throw new BadRequestException(
        'Attestation payload checksumSha256 does not match canonical knowledge-pack checksum.',
      );
    }

    if (payload.reviewerUserId !== expectedReviewerUserId) {
      this.logger.warn(
        `Attestation verification failed: Payload reviewerUserId (${payload.reviewerUserId}) does not match authenticated principal (${expectedReviewerUserId}).`,
      );
      throw new ForbiddenException(
        'Attestation payload reviewerUserId does not match authenticated reviewer principal.',
      );
    }

    // 2. Anti-Replay Nonce Defense
    if (!payload.nonce || typeof payload.nonce !== 'string') {
      throw new BadRequestException(
        'Attestation payload must include an anti-replay nonce.',
      );
    }

    const isNonceConsumed = this.nonceRepository
      ? await this.nonceRepository.isConsumed(payload.nonce)
      : this.consumedNonces.has(payload.nonce);

    if (isNonceConsumed) {
      this.logger.warn(
        `Signature Replay Attack Detected: Nonce ${payload.nonce} has already been consumed.`,
      );
      await this.auditService.logEvent({
        versionId: targetVersion.id,
        action: GovernanceAuditAction.SIGNATURE_REPLAY_DETECTED,
        actorUserId: expectedReviewerUserId,
        checksumSha256: targetVersion.checksumSha256,
        metadataJson: {
          nonce: payload.nonce,
          keyFingerprint: envelope.keyFingerprint,
        },
      });
      throw new ConflictException(
        'Signature Replay Violation: This signature nonce has already been consumed in a prior approval.',
      );
    }

    // 3. Reviewer Public Key Lookup & Status Check
    const activeKey =
      await this.keyManagementService.getActivePublicKey(expectedReviewerUserId);

    if (!activeKey) {
      this.logger.warn(
        `Attestation verification failed: Reviewer ${expectedReviewerUserId} does not have an active registered Ed25519 public key.`,
      );
      throw new ForbiddenException(
        'Reviewer does not possess an active, registered Ed25519 public key in the governance registry.',
      );
    }

    if (activeKey.status !== PublicKeyStatus.ACTIVE) {
      throw new ForbiddenException(
        `Reviewer public key status is '${activeKey.status}'. Only ACTIVE keys may sign clinical approvals.`,
      );
    }

    if (activeKey.expiresAt && new Date(activeKey.expiresAt) < new Date()) {
      throw new ForbiddenException(
        `Reviewer public key expired on ${activeKey.expiresAt.toISOString()}. Key rotation required.`,
      );
    }

    // Fingerprint verification
    if (
      envelope.keyFingerprint &&
      envelope.keyFingerprint !== activeKey.keyFingerprint
    ) {
      this.logger.warn(
        `Key Fingerprint Mismatch: Envelope key (${envelope.keyFingerprint}) differs from reviewer active key (${activeKey.keyFingerprint}).`,
      );
      throw new BadRequestException(
        'Signature key fingerprint does not match the active registered public key for this reviewer.',
      );
    }

    // 4. Mathematical Ed25519 Signature Verification
    const canonicalPayloadString = serializeAttestationPayload(payload);
    const publicKeyObject = this.keyManagementService.parseAndValidateEd25519Key(
      activeKey.publicKeyPem,
    );

    let isSignatureValid = false;
    try {
      isSignatureValid = crypto.verify(
        null,
        Buffer.from(canonicalPayloadString, 'utf8'),
        publicKeyObject,
        Buffer.from(envelope.signature, 'base64'),
      );
    } catch (verifErr: any) {
      this.logger.error(
        `Ed25519 crypto.verify raised error: ${verifErr.message}`,
      );
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      this.logger.warn(
        `Cryptographic Signature Verification FAILED for reviewer ${expectedReviewerUserId} on version ${targetVersion.id}.`,
      );
      await this.auditService.logEvent({
        versionId: targetVersion.id,
        action: GovernanceAuditAction.SIGNATURE_VERIFICATION_FAILED,
        actorUserId: expectedReviewerUserId,
        checksumSha256: targetVersion.checksumSha256,
        metadataJson: {
          keyFingerprint: activeKey.keyFingerprint,
          reason: 'Mathematical signature mismatch; payload or signature tampered.',
        },
      });
      throw new BadRequestException(
        'Cryptographic Verification Failed: Ed25519 digital signature is invalid or payload has been tampered.',
      );
    }

    // 5. Success: Consume nonce persistently to prevent replay
    if (this.nonceRepository) {
      await this.nonceRepository.consumeAtomic(
        payload.nonce,
        targetVersion.id,
        expectedReviewerUserId,
      );
    } else {
      this.consumedNonces.add(payload.nonce);
    }

    this.logger.log(
      `Ed25519 Attestation Signature VERIFIED for reviewer ${expectedReviewerUserId} on version ${targetVersion.id} (Key: ${activeKey.keyFingerprint})`,
    );

    return true;
  }

  /**
   * Clear consumed nonces buffer (for testing isolation).
   */
  async clearNonces(): Promise<void> {
    this.consumedNonces.clear();
    if (this.nonceRepository) {
      await this.nonceRepository.clear();
    }
  }
}

