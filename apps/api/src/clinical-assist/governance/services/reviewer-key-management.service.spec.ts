import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  GovernanceAuditAction,
  PublicKeyStatus,
} from '../constants/governance.constants';
import { ReviewerPublicKeyEntity } from '../interfaces/attestation.interface';
import { IReviewerKeyRepository } from '../interfaces/reviewer-key-repository.interface';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { ReviewerKeyManagementService } from './reviewer-key-management.service';

describe('ReviewerKeyManagementService — Ed25519 Public Key Governance', () => {
  let service: ReviewerKeyManagementService;
  let mockRepository: jest.Mocked<IReviewerKeyRepository>;
  let mockAuditService: jest.Mocked<KnowledgePackGovernanceAuditService>;

  let validEd25519PubKeyPem: string;
  let validEd25519PubKeyPem2: string;
  let rsaPubKeyPem: string;
  const reviewerUserId = 'reviewer-user-uuid-1';
  const otherUserId = 'other-user-uuid-2';

  beforeAll(() => {
    // Generate real Ed25519 key
    const edKey = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    validEd25519PubKeyPem = edKey.publicKey;

    // Generate second real Ed25519 key for rotation
    const edKey2 = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    validEd25519PubKeyPem2 = edKey2.publicKey;

    // Generate RSA key to verify non-Ed25519 rejection
    const rsaKey = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    rsaPubKeyPem = rsaKey.publicKey;
  });

  beforeEach(() => {
    const keysMap = new Map<string, ReviewerPublicKeyEntity>();

    mockRepository = {
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

    service = new ReviewerKeyManagementService(mockRepository);
  });

  describe('Public Key Registration', () => {
    it('registers a valid Ed25519 public key and computes correct SHA-256 fingerprint', async () => {
      const result = await service.registerPublicKey(
        reviewerUserId,
        validEd25519PubKeyPem,
      );

      expect(result.id).toBeDefined();
      expect(result.reviewerUserId).toBe(reviewerUserId);
      expect(result.keyAlgorithm).toBe('ed25519');
      expect(result.status).toBe(PublicKeyStatus.ACTIVE);
      expect(result.keyFingerprint).toBeDefined();
      expect(result.keyFingerprint.startsWith('SHA256:')).toBe(true);
      expect(result.keyFingerprint.length).toBe(71); // 'SHA256:' + 64 hex characters
    });

    it('rejects a non-Ed25519 key (e.g., RSA) with BadRequestException', async () => {
      await expect(
        service.registerPublicKey(reviewerUserId, rsaPubKeyPem),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects malformed PEM data with BadRequestException', async () => {
      await expect(
        service.registerPublicKey(
          reviewerUserId,
          '-----BEGIN PUBLIC KEY-----\nNOT_VALID_BASE64\n-----END PUBLIC KEY-----',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects registration when the key is already registered to another reviewer (fingerprint collision/theft)', async () => {
      // User 1 registers Key A
      await service.registerPublicKey(reviewerUserId, validEd25519PubKeyPem);

      // User 2 attempts to register the same Key A
      await expect(
        service.registerPublicKey(otherUserId, validEd25519PubKeyPem),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Public Key Rotation', () => {
    it('rotates active key: marks previous key as ROTATED and activates new key', async () => {
      // Initial registration
      const initialKey = await service.registerPublicKey(
        reviewerUserId,
        validEd25519PubKeyPem,
      );

      expect(initialKey.status).toBe(PublicKeyStatus.ACTIVE);

      // Rotate to Key 2
      const rotatedKey = await service.rotatePublicKey(
        reviewerUserId,
        validEd25519PubKeyPem2,
      );

      expect(rotatedKey.id).not.toBe(initialKey.id);
      expect(rotatedKey.status).toBe(PublicKeyStatus.ACTIVE);

      // Verify old key is now ROTATED
      const previousKeyRecord = await mockRepository.findById(initialKey.id);
      expect(previousKeyRecord?.status).toBe(PublicKeyStatus.ROTATED);
    });
  });

  describe('Public Key Revocation', () => {
    it('revokes an active key with revocation reason and timestamp', async () => {
      const key = await service.registerPublicKey(
        reviewerUserId,
        validEd25519PubKeyPem,
      );

      const revoked = await service.revokePublicKey(
        key.id,
        'Clinician security token stolen',
        'governance-admin-uuid',
      );

      expect(revoked.status).toBe(PublicKeyStatus.REVOKED);
      expect(revoked.revokedAt).toBeDefined();
      expect(revoked.revocationReason).toBe('Clinician security token stolen');
    });

    it('throws NotFoundException when revoking non-existent key', async () => {
      await expect(
        service.revokePublicKey(
          'non-existent-id',
          'Reason',
          'governance-admin-uuid',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Active Key Retrieval & Expiry', () => {
    it('returns the active key for a reviewer', async () => {
      const created = await service.registerPublicKey(
        reviewerUserId,
        validEd25519PubKeyPem,
      );

      const active = await service.getActivePublicKey(reviewerUserId);
      expect(active).not.toBeNull();
      expect(active?.id).toBe(created.id);
    });

    it('automatically transitions expired key to EXPIRED status upon retrieval', async () => {
      // Register with past expiration
      const yesterday = new Date(Date.now() - 86400000);
      const created = await service.registerPublicKey(
        reviewerUserId,
        validEd25519PubKeyPem,
        yesterday,
      );

      const active = await service.getActivePublicKey(reviewerUserId);
      expect(active).toBeNull();

      // Check repository directly
      const record = await mockRepository.findById(created.id);
      expect(record?.status).toBe(PublicKeyStatus.EXPIRED);
    });
  });
});
