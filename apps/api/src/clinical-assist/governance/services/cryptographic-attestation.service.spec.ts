import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  GovernanceAuditAction,
  PublicKeyStatus,
} from '../constants/governance.constants';
import {
  AttestationPayload,
  ReviewerPublicKeyEntity,
  SignedAttestationEnvelope,
  serializeAttestationPayload,
} from '../interfaces/attestation.interface';
import { IReviewerKeyRepository } from '../interfaces/reviewer-key-repository.interface';
import { CryptographicAttestationService } from './cryptographic-attestation.service';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { ReviewerKeyManagementService } from './reviewer-key-management.service';

describe('CryptographicAttestationService — Ed25519 Real Cryptographic Verification', () => {
  let attestationService: CryptographicAttestationService;
  let keyManagementService: ReviewerKeyManagementService;
  let mockKeyRepository: jest.Mocked<IReviewerKeyRepository>;
  let mockAuditService: jest.Mocked<KnowledgePackGovernanceAuditService>;

  let keyPairA: { publicKeyPem: string; privateKeyPem: string };
  let keyPairB: { publicKeyPem: string; privateKeyPem: string };
  let keyFingerprintA: string;
  let keyFingerprintB: string;

  const sampleVersionId = '11111111-2222-3333-4444-555555555555';
  const sampleChecksum =
    'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
  const reviewerUserId = 'user-reviewer-123';
  const credentialId = 'cred-senior-1';
  const medicalRegistration = 'DMC-2009-11111';

  beforeAll(() => {
    // Generate real Ed25519 keypairs using Node.js native crypto
    const ed25519Gen = () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return { publicKeyPem: publicKey, privateKeyPem: privateKey };
    };

    keyPairA = ed25519Gen();
    keyPairB = ed25519Gen();

    keyFingerprintA =
      'SHA256:' +
      crypto
        .createHash('sha256')
        .update(
          crypto
            .createPublicKey(keyPairA.publicKeyPem)
            .export({ type: 'spki', format: 'der' }),
        )
        .digest('hex');

    keyFingerprintB =
      'SHA256:' +
      crypto
        .createHash('sha256')
        .update(
          crypto
            .createPublicKey(keyPairB.publicKeyPem)
            .export({ type: 'spki', format: 'der' }),
        )
        .digest('hex');
  });

  beforeEach(() => {
    const keysMap = new Map<string, ReviewerPublicKeyEntity>();

    mockKeyRepository = {
      save: jest.fn().mockImplementation((key: ReviewerPublicKeyEntity) => {
        keysMap.set(key.id, { ...key });
        return Promise.resolve(key);
      }),
      findActiveByUserId: jest
        .fn()
        .mockImplementation((userId: string) => {
          for (const k of keysMap.values()) {
            if (k.reviewerUserId === userId && k.status === PublicKeyStatus.ACTIVE) {
              return Promise.resolve(k);
            }
          }
          return Promise.resolve(null);
        }),
      findByFingerprint: jest
        .fn()
        .mockImplementation((fingerprint: string) => {
          for (const k of keysMap.values()) {
            if (k.keyFingerprint === fingerprint) return Promise.resolve(k);
          }
          return Promise.resolve(null);
        }),
      findById: jest.fn().mockImplementation((id: string) => {
        return Promise.resolve(keysMap.get(id) || null);
      }),
      findAllByUserId: jest
        .fn()
        .mockImplementation((userId: string) => {
          const list: ReviewerPublicKeyEntity[] = [];
          for (const k of keysMap.values()) {
            if (k.reviewerUserId === userId) list.push(k);
          }
          return Promise.resolve(list);
        }),
      update: jest
        .fn()
        .mockImplementation(
          (id: string, updates: Partial<ReviewerPublicKeyEntity>) => {
            const existing = keysMap.get(id);
            if (!existing) return Promise.resolve(null as any);
            const updated = { ...existing, ...updates, updatedAt: new Date() };
            keysMap.set(id, updated);
            return Promise.resolve(updated);
          },
        ),
      deactivateOtherKeysForUser: jest
        .fn()
        .mockImplementation((userId: string, exceptKeyId: string) => {
          for (const [id, k] of keysMap.entries()) {
            if (k.reviewerUserId === userId && id !== exceptKeyId && k.status === PublicKeyStatus.ACTIVE) {
              k.status = PublicKeyStatus.ROTATED;
              k.updatedAt = new Date();
            }
          }
          return Promise.resolve();
        }),
      clear: jest.fn().mockImplementation(() => {
        keysMap.clear();
        return Promise.resolve();
      }),
    };

    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    keyManagementService = new ReviewerKeyManagementService(
      mockKeyRepository,
    );

    attestationService = new CryptographicAttestationService(
      keyManagementService,
      mockAuditService,
    );
  });

  describe('Keypair Generation & Deterministic Serialization', () => {
    it('generates a valid Ed25519 keypair in PEM format', () => {
      const generated = attestationService.generateKeyPair();
      expect(generated.publicKeyPem).toContain('BEGIN PUBLIC KEY');
      expect(generated.privateKeyPem).toContain('BEGIN PRIVATE KEY');

      const pubKey = crypto.createPublicKey(generated.publicKeyPem);
      expect(pubKey.asymmetricKeyType).toBe('ed25519');
    });

    it('canonically serializes payload deterministically regardless of field ordering', () => {
      const nonce = crypto.randomUUID();
      const signedAt = '2026-10-31T06:00:00.000Z';

      const payload1: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum.toUpperCase(), // Test case normalization
        reviewerUserId,
        credentialId,
        medicalRegistration: 'dmc-2009-11111', // Test uppercase normalization
        approvalVerdict: 'APPROVED',
        signedAt,
        nonce,
      };

      const payload2: AttestationPayload = {
        nonce,
        signedAt,
        approvalVerdict: 'APPROVED',
        medicalRegistration: 'DMC-2009-11111',
        credentialId,
        reviewerUserId,
        checksumSha256: sampleChecksum.toLowerCase(),
        versionId: sampleVersionId,
      };

      const serialized1 = serializeAttestationPayload(payload1);
      const serialized2 = serializeAttestationPayload(payload2);

      expect(serialized1).toBe(serialized2);

      const parsedKeys = Object.keys(JSON.parse(serialized1));
      const sortedKeys = [...parsedKeys].sort();
      expect(parsedKeys).toEqual(sortedKeys);
    });
  });

  describe('Real Ed25519 Signing & Verification (Cryptographic Correctness)', () => {
    it('successfully signs payload and verifies with the matching registered public key', async () => {
      // Register Key A for reviewer
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      expect(envelope.algorithm).toBe('ed25519');
      expect(envelope.keyFingerprint).toBe(keyFingerprintA);
      expect(envelope.signature).toBeDefined();
      expect(typeof envelope.signature).toBe('string');
      expect(envelope.signature.length).toBeGreaterThan(40);

      const verified = await attestationService.verifyAttestationEnvelope(
        envelope,
        { id: sampleVersionId, checksumSha256: sampleChecksum },
        reviewerUserId,
      );

      expect(verified).toBe(true);
    });

    it('rejects an envelope if the signature bytes are corrupted', async () => {
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      // Corrupt signature
      const corruptedSig = envelope.signature.slice(0, -4) + 'AAAA';
      const tamperedEnvelope: SignedAttestationEnvelope = {
        ...envelope,
        signature: corruptedSig,
      };

      await expect(
        attestationService.verifyAttestationEnvelope(
          tamperedEnvelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          reviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.SIGNATURE_VERIFICATION_FAILED,
        }),
      );
    });

    it('rejects an envelope if the payload was tampered after signing', async () => {
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      // Tamper with verdict inside payload
      const tamperedEnvelope: SignedAttestationEnvelope = {
        ...envelope,
        payload: {
          ...envelope.payload,
          approvalVerdict: 'REJECTED',
        },
      };

      await expect(
        attestationService.verifyAttestationEnvelope(
          tamperedEnvelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          reviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an envelope signed with Key B when reviewer has registered Key A', async () => {
      // Reviewer registered Key A
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      // Signed with Key B
      const envelope = attestationService.signPayload(
        payload,
        keyPairB.privateKeyPem,
        keyPairB.publicKeyPem,
      );

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          reviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects verification if the target versionId does not match payload versionId', async () => {
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          {
            id: '99999999-9999-9999-9999-999999999999',
            checksumSha256: sampleChecksum,
          },
          reviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects verification if target checksum does not match payload checksum', async () => {
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          {
            id: sampleVersionId,
            checksumSha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          },
          reviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects verification if expected reviewerUserId differs from payload', async () => {
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          'different-reviewer-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Key Lifecycle & Status Enforcement', () => {
    it('throws ForbiddenException when reviewer has no registered public key', async () => {
      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId: 'unregistered-reviewer-uuid',
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          'unregistered-reviewer-uuid',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when key is REVOKED', async () => {
      const key = await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      await keyManagementService.revokePublicKey(
        key.id,
        'Compromised laptop',
        'admin-user',
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          reviewerUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when key is EXPIRED', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
        yesterday,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          reviewerUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Anti-Replay Nonce Enforcement', () => {
    it('rejects an envelope if the nonce has already been consumed (Replay Attack)', async () => {
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        keyPairA.privateKeyPem,
        keyPairA.publicKeyPem,
      );

      // First verification succeeds
      const firstResult = await attestationService.verifyAttestationEnvelope(
        envelope,
        { id: sampleVersionId, checksumSha256: sampleChecksum },
        reviewerUserId,
      );
      expect(firstResult).toBe(true);

      // Replaying the exact same envelope must throw ConflictException
      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          reviewerUserId,
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.SIGNATURE_REPLAY_DETECTED,
        }),
      );
    });

    it('rejects an envelope missing a nonce', async () => {
      await keyManagementService.registerPublicKey(
        reviewerUserId,
        keyPairA.publicKeyPem,
      );

      const payload: any = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId,
        credentialId,
        medicalRegistration,
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        // missing nonce
      };

      const envelope: SignedAttestationEnvelope = {
        algorithm: 'ed25519',
        signature: 'dummySig==',
        keyFingerprint: keyFingerprintA,
        payload,
      };

      await expect(
        attestationService.verifyAttestationEnvelope(
          envelope,
          { id: sampleVersionId, checksumSha256: sampleChecksum },
          reviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
