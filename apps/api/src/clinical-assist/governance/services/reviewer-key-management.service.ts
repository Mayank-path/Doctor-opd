import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import {
  ATTESTATION_KEY_ALGORITHM,
  PUBLIC_KEY_DEFAULT_VALIDITY_MONTHS,
  PublicKeyStatus,
} from '../constants/governance.constants';
import { ReviewerPublicKeyEntity } from '../interfaces/attestation.interface';
import { REVIEWER_KEY_REPOSITORY } from '../interfaces/reviewer-key-repository.interface';
import type { IReviewerKeyRepository } from '../interfaces/reviewer-key-repository.interface';

@Injectable()
export class ReviewerKeyManagementService {
  private readonly logger = new Logger(ReviewerKeyManagementService.name);

  constructor(
    @Inject(REVIEWER_KEY_REPOSITORY)
    private readonly keyRepository: IReviewerKeyRepository,
  ) {}

  /**
   * Computes a standardized SHA-256 fingerprint from an Ed25519 public key.
   */
  computeKeyFingerprint(publicKeyPem: string): string {
    const keyObject = this.parseAndValidateEd25519Key(publicKeyPem);
    const spkiDer = keyObject.export({ type: 'spki', format: 'der' });
    const hash = crypto.createHash('sha256').update(spkiDer).digest('hex');
    return `SHA256:${hash}`;
  }

  /**
   * Parses and validates that a PEM string represents a valid Ed25519 public key.
   */
  parseAndValidateEd25519Key(publicKeyPem: string): crypto.KeyObject {
    try {
      const keyObject = crypto.createPublicKey(publicKeyPem.trim());
      if (keyObject.asymmetricKeyType !== ATTESTATION_KEY_ALGORITHM) {
        throw new BadRequestException(
          `Invalid key algorithm: Expected '${ATTESTATION_KEY_ALGORITHM}', received '${keyObject.asymmetricKeyType}'.`,
        );
      }
      return keyObject;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Malformed or invalid Ed25519 public key PEM: ${err.message}`,
      );
    }
  }

  /**
   * Registers a new Ed25519 public key for an authenticated clinical reviewer.
   * Rotates any existing active key for this reviewer.
   */
  async registerPublicKey(
    reviewerUserId: string,
    publicKeyPem: string,
    customExpiresAt?: Date,
  ): Promise<ReviewerPublicKeyEntity> {
    const keyFingerprint = this.computeKeyFingerprint(publicKeyPem);

    // Check if fingerprint is already in use by another user
    const existingKeyWithFingerprint =
      await this.keyRepository.findByFingerprint(keyFingerprint);

    if (
      existingKeyWithFingerprint &&
      existingKeyWithFingerprint.reviewerUserId !== reviewerUserId
    ) {
      throw new ConflictException(
        `This Ed25519 public key (fingerprint: ${keyFingerprint}) is already registered to another reviewer.`,
      );
    }

    const now = new Date();
    const expiresAt =
      customExpiresAt ||
      new Date(
        now.getTime() +
          PUBLIC_KEY_DEFAULT_VALIDITY_MONTHS * 30.4375 * 24 * 60 * 60 * 1000,
      );

    const newKey: ReviewerPublicKeyEntity = {
      id: randomUUID(),
      reviewerUserId,
      publicKeyPem: publicKeyPem.trim(),
      keyAlgorithm: ATTESTATION_KEY_ALGORITHM,
      keyFingerprint,
      status: PublicKeyStatus.ACTIVE,
      expiresAt,
      revokedAt: null,
      revocationReason: null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.keyRepository.save(newKey);

    // Deactivate/Rotate any previous active keys for this reviewer
    await this.keyRepository.deactivateOtherKeysForUser(
      reviewerUserId,
      saved.id,
    );

    this.logger.log(
      `Ed25519 Public Key registered for reviewer ${reviewerUserId} (Fingerprint: ${keyFingerprint}, ID: ${saved.id})`,
    );

    return saved;
  }

  /**
   * Rotates the public key for a reviewer.
   */
  async rotatePublicKey(
    reviewerUserId: string,
    newPublicKeyPem: string,
  ): Promise<ReviewerPublicKeyEntity> {
    const activeKey = await this.keyRepository.findActiveByUserId(reviewerUserId);
    if (activeKey) {
      await this.keyRepository.update(activeKey.id, {
        status: PublicKeyStatus.ROTATED,
      });
    }

    return this.registerPublicKey(reviewerUserId, newPublicKeyPem);
  }

  /**
   * Revokes a compromised or deactivated public key.
   */
  async revokePublicKey(
    keyId: string,
    reason: string,
    actorUserId: string,
  ): Promise<ReviewerPublicKeyEntity> {
    const key = await this.keyRepository.findById(keyId);
    if (!key) {
      throw new NotFoundException(`Public key with ID ${keyId} not found.`);
    }

    const updated = await this.keyRepository.update(keyId, {
      status: PublicKeyStatus.REVOKED,
      revokedAt: new Date(),
      revocationReason: reason,
    });

    this.logger.warn(
      `Ed25519 Public Key ${keyId} REVOKED by ${actorUserId}. Reason: ${reason}`,
    );

    return updated;
  }

  /**
   * Retrieves the currently active, unexpired Ed25519 public key for a reviewer.
   */
  async getActivePublicKey(
    reviewerUserId: string,
  ): Promise<ReviewerPublicKeyEntity | null> {
    const key = await this.keyRepository.findActiveByUserId(reviewerUserId);
    if (!key) return null;

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      await this.keyRepository.update(key.id, {
        status: PublicKeyStatus.EXPIRED,
      });
      return null;
    }

    return key;
  }

  /**
   * Retrieves a public key by its fingerprint.
   */
  async getPublicKeyByFingerprint(
    fingerprint: string,
  ): Promise<ReviewerPublicKeyEntity | null> {
    return this.keyRepository.findByFingerprint(fingerprint);
  }

  /**
   * Retrieves all public keys associated with a reviewer (active, rotated, revoked).
   */
  async getAllKeysForReviewer(
    reviewerUserId: string,
  ): Promise<ReviewerPublicKeyEntity[]> {
    return this.keyRepository.findAllByUserId(reviewerUserId);
  }
}
