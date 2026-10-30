import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import {
  computeCanonicalChecksum,
} from '../../../../prisma/seeds/canonical-serializer';
import { PrismaService } from '../../../prisma/prisma.service';
import { KnowledgePackResolverService } from '../../differential/services/knowledge-pack-resolver.service';
import {
  GovernanceAuditAction,
  PublicKeyStatus,
  ReviewerVerificationStatus,
} from '../constants/governance.constants';
import {
  AttestationPayload,
  ReviewerPublicKeyEntity,
  SignedAttestationEnvelope,
} from '../interfaces/attestation.interface';
import { IGovernanceNonceRepository } from '../interfaces/governance-nonce-repository.interface';
import { IReviewerCredentialRepository } from '../interfaces/reviewer-credential-repository.interface';
import { IReviewerKeyRepository } from '../interfaces/reviewer-key-repository.interface';
import { InMemoryReviewerCredentialRepository } from '../repositories/in-memory-reviewer-credential.repository';
import { ClinicalGovernanceAuthorizationService } from './clinical-governance-authorization.service';
import { CryptographicAttestationService } from './cryptographic-attestation.service';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { KnowledgePackReleaseAuthorityService } from './knowledge-pack-release-authority.service';
import { MultiSignatureApprovalService } from './multi-signature-approval.service';
import { ReviewerCredentialingService } from './reviewer-credentialing.service';
import { ReviewerKeyManagementService } from './reviewer-key-management.service';

describe('KnowledgePackReleaseAuthorityService — Four-Eyes Release Authority & Rollout', () => {
  let releaseAuthorityService: KnowledgePackReleaseAuthorityService;
  let multiSigService: MultiSignatureApprovalService;
  let credentialingService: ReviewerCredentialingService;
  let keyMgmtService: ReviewerKeyManagementService;
  let attestationService: CryptographicAttestationService;
  let resolverService: KnowledgePackResolverService;
  let authService: ClinicalGovernanceAuthorizationService;

  let credentialRepo: InMemoryReviewerCredentialRepository;
  let mockKeyRepo: jest.Mocked<IReviewerKeyRepository>;
  let mockNonceRepo: jest.Mocked<IGovernanceNonceRepository>;
  let mockAuditService: jest.Mocked<KnowledgePackGovernanceAuditService>;
  let mockPrisma: any;

  // Keypairs for real Ed25519 signing
  let seniorKeyPair: { publicKeyPem: string; privateKeyPem: string };
  let juniorKeyPair: { publicKeyPem: string; privateKeyPem: string };
  let seniorKeyFingerprint: string;
  let juniorKeyFingerprint: string;

  const sampleVersionId = '11111111-2222-3333-4444-555555555555';
  const targetVersionId = '22222222-3333-4444-5555-666666666666';
  const authorUserId = 'author-user-uuid';
  const seniorReviewerUserId = 'senior-rev-uuid';
  const juniorReviewerUserId = 'junior-rev-uuid';
  const releaseAuthorityUserId = 'release-officer-uuid';
  const unauthorizedDoctorUserId = 'unauthorized-doctor-uuid';

  const clinicAlphaId = 'clinic-alpha-uuid';
  const clinicBetaId = 'clinic-beta-uuid';

  let mockVersion: any;
  let mockReleases: Map<string, any>;
  let mockVersions: Map<string, any>;
  let sampleChecksum: string;

  beforeAll(() => {
    const ed25519Gen = () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return { publicKeyPem: publicKey, privateKeyPem: privateKey };
    };

    seniorKeyPair = ed25519Gen();
    juniorKeyPair = ed25519Gen();

    seniorKeyFingerprint =
      'SHA256:' +
      crypto
        .createHash('sha256')
        .update(
          crypto
            .createPublicKey(seniorKeyPair.publicKeyPem)
            .export({ type: 'spki', format: 'der' }),
        )
        .digest('hex');

    juniorKeyFingerprint =
      'SHA256:' +
      crypto
        .createHash('sha256')
        .update(
          crypto
            .createPublicKey(juniorKeyPair.publicKeyPem)
            .export({ type: 'spki', format: 'der' }),
        )
        .digest('hex');
  });

  beforeEach(async () => {
    credentialRepo = new InMemoryReviewerCredentialRepository();
    mockReleases = new Map<string, any>();
    mockVersions = new Map<string, any>();

    // Mock Audit Service
    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock Key Repository
    const keyDb = new Map<string, ReviewerPublicKeyEntity>();
    mockKeyRepo = {
      save: jest.fn().mockImplementation((k: ReviewerPublicKeyEntity) => {
        keyDb.set(k.id, { ...k });
        return Promise.resolve(k);
      }),
      findActiveByUserId: jest.fn().mockImplementation((uid: string) => {
        for (const k of keyDb.values()) {
          if (k.reviewerUserId === uid && k.status === PublicKeyStatus.ACTIVE) {
            return Promise.resolve(k);
          }
        }
        return Promise.resolve(null);
      }),
      findByFingerprint: jest.fn().mockImplementation((fp: string) => {
        for (const k of keyDb.values()) {
          if (k.keyFingerprint === fp) return Promise.resolve(k);
        }
        return Promise.resolve(null);
      }),
      findById: jest.fn().mockImplementation((id: string) => {
        return Promise.resolve(keyDb.get(id) || null);
      }),
      findAllByUserId: jest.fn().mockImplementation((uid: string) => {
        const list: ReviewerPublicKeyEntity[] = [];
        for (const k of keyDb.values()) {
          if (k.reviewerUserId === uid) list.push(k);
        }
        return Promise.resolve(list);
      }),
      update: jest
        .fn()
        .mockImplementation(
          (id: string, updates: Partial<ReviewerPublicKeyEntity>) => {
            const existing = keyDb.get(id);
            if (!existing) return Promise.resolve(null as any);
            const updated = {
              ...existing,
              ...updates,
              updatedAt: updates.updatedAt || new Date(),
            };
            keyDb.set(id, updated);
            return Promise.resolve(updated);
          },
        ),
      deactivateOtherKeysForUser: jest
        .fn()
        .mockImplementation((uid: string, exceptKeyId: string) => {
          for (const [id, k] of keyDb.entries()) {
            if (
              k.reviewerUserId === uid &&
              id !== exceptKeyId &&
              k.status === PublicKeyStatus.ACTIVE
            ) {
              k.status = PublicKeyStatus.ROTATED;
              k.updatedAt = new Date();
            }
          }
          return Promise.resolve();
        }),
      clear: jest.fn().mockImplementation(() => {
        keyDb.clear();
        return Promise.resolve();
      }),
    };

    // Mock Nonce Repository
    const nonceDb = new Set<string>();
    mockNonceRepo = {
      isConsumed: jest.fn().mockImplementation((n: string) => {
        return Promise.resolve(nonceDb.has(n));
      }),
      consumeAtomic: jest
        .fn()
        .mockImplementation((n: string, vId: string, rId: string) => {
          if (nonceDb.has(n)) {
            return Promise.reject(
              new ConflictException(
                `Signature Replay Violation: Nonce ${n} has already been consumed.`,
              ),
            );
          }
          nonceDb.add(n);
          return Promise.resolve({
            id: `nonce-${Math.random()}`,
            nonce: n,
            versionId: vId,
            reviewerUserId: rId,
            consumedAt: new Date(),
          });
        }),
      clear: jest.fn().mockImplementation(() => {
        nonceDb.clear();
        return Promise.resolve();
      }),
    };

    keyMgmtService = new ReviewerKeyManagementService(mockKeyRepo);
    attestationService = new CryptographicAttestationService(
      keyMgmtService,
      mockAuditService,
      mockNonceRepo,
    );

    // Register active Ed25519 keys
    await keyMgmtService.registerPublicKey(
      seniorReviewerUserId,
      seniorKeyPair.publicKeyPem,
    );
    await keyMgmtService.registerPublicKey(
      juniorReviewerUserId,
      juniorKeyPair.publicKeyPem,
    );

    // Register verified credentials
    await credentialRepo.save({
      id: 'cred-senior-1',
      userId: seniorReviewerUserId,
      clinicianName: 'Dr. Senior Reviewer',
      medicalRegistration: 'DMC-2009-11111',
      stateMedicalCouncil: 'Delhi Medical Council',
      registrationYear: 2009,
      primaryQualification: 'MBBS',
      specialtyQualification: 'MD (General Medicine)',
      specialty: 'GENERAL_MEDICINE',
      yearsOfExperience: 15,
      isSeniorReviewer: true,
      verificationStatus: ReviewerVerificationStatus.VERIFIED,
      verificationEvidence: 'Gazette verified',
      verifiedByUserId: 'board-admin',
      verifiedAt: new Date(),
      rejectionReason: null,
      credentialsExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await credentialRepo.save({
      id: 'cred-junior-1',
      userId: juniorReviewerUserId,
      clinicianName: 'Dr. Junior Reviewer',
      medicalRegistration: 'KMC-2019-22222',
      stateMedicalCouncil: 'Karnataka Medical Council',
      registrationYear: 2019,
      primaryQualification: 'MBBS',
      specialtyQualification: 'MD (Internal Medicine)',
      specialty: 'GENERAL_MEDICINE',
      yearsOfExperience: 5,
      isSeniorReviewer: false,
      verificationStatus: ReviewerVerificationStatus.VERIFIED,
      verificationEvidence: 'KMC register verified',
      verifiedByUserId: 'board-admin',
      verifiedAt: new Date(),
      rejectionReason: null,
      credentialsExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a canonical mock KnowledgePackVersion
    mockVersion = {
      id: sampleVersionId,
      packId: 'pack-gm-1',
      authorUserId,
      majorVersion: 1,
      minorVersion: 0,
      patchVersion: 0,
      releaseStatus: KnowledgePackReleaseStatus.APPROVED,
      changelog: 'Initial approved release candidate',
      checksumSha256: '', // Populated below after canonical serialization
      pack: {
        id: 'pack-gm-1',
        domain: KnowledgePackDomain.GENERAL_MEDICINE,
        name: 'General Medicine Decision Support',
      },
      conditions: [
        {
          id: 'cond-1',
          versionId: sampleVersionId,
          conditionCode: 'COND-PNEUMONIA-CAP',
          displayName: 'Community-Acquired Pneumonia',
          category: 'RESPIRATORY',
          description: 'Acute infection of pulmonary parenchyma',
          icd10Guidance: 'J18.9',
          evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
          rules: [
            {
              id: 'rule-1',
              conditionId: 'cond-1',
              ruleCode: 'RULE-CAP-PRIMARY',
              ruleTitle: 'Primary Diagnostic Criteria for CAP',
              minMajorCount: 2,
              applicabilityJson: { ageMinYears: 18 },
              mandatoryAstJson: { field: 'fever', operator: 'EQUALS', value: true },
              majorSupportingJson: ['cough', 'dyspnea'],
              minorSupportingJson: ['pleuritic_chest_pain'],
              contradictionsJson: [],
              missingDataRulesJson: null,
              investigationsJson: null,
              isComplete: true,
              sourceReferences: [],
            },
          ],
        },
      ],
      redFlagRules: [
        {
          id: 'rf-1',
          versionId: sampleVersionId,
          flagCode: 'RF-STRIDOR',
          title: 'Upper Airway Stridor',
          urgencyLevel: 'CRITICAL',
          clinicalAction: 'Immediate airway stabilization',
          ruleAstJson: { field: 'stridor', operator: 'EQUALS', value: true },
        },
      ],
      sources: [
        {
          id: 'src-1',
          versionId: sampleVersionId,
          sourceCode: 'WHO-PNEUMONIA-2024',
          title: 'WHO Guidelines on Pneumonia Management',
          citationText: 'WHO Guidelines, 2024 Edition',
        },
      ],
      approvals: [],
    };

    // Instantiate mock resolver service to reconstruct canonical seed & checksum
    resolverService = new KnowledgePackResolverService(mockPrisma as any);
    const reconstructedSeed = resolverService.reconstructSeedFromVersion(mockVersion);
    sampleChecksum = computeCanonicalChecksum(reconstructedSeed);
    mockVersion.checksumSha256 = sampleChecksum;

    // Create 2 valid Ed25519 signed approvals (1 Senior, 1 Junior) satisfying quorum
    const seniorPayload: AttestationPayload = {
      versionId: sampleVersionId,
      checksumSha256: sampleChecksum,
      reviewerUserId: seniorReviewerUserId,
      credentialId: 'cred-senior-1',
      medicalRegistration: 'DMC-2009-11111',
      approvalVerdict: 'APPROVED',
      signedAt: new Date().toISOString(),
      nonce: crypto.randomUUID(),
    };
    const seniorEnvelope = attestationService.signPayload(
      seniorPayload,
      seniorKeyPair.privateKeyPem,
      seniorKeyPair.publicKeyPem,
    );

    const juniorPayload: AttestationPayload = {
      versionId: sampleVersionId,
      checksumSha256: sampleChecksum,
      reviewerUserId: juniorReviewerUserId,
      credentialId: 'cred-junior-1',
      medicalRegistration: 'KMC-2019-22222',
      approvalVerdict: 'APPROVED',
      signedAt: new Date().toISOString(),
      nonce: crypto.randomUUID(),
    };
    const juniorEnvelope = attestationService.signPayload(
      juniorPayload,
      juniorKeyPair.privateKeyPem,
      juniorKeyPair.publicKeyPem,
    );

    mockVersion.approvals = [
      {
        id: 'appr-senior-1',
        versionId: sampleVersionId,
        reviewerUserId: seniorReviewerUserId,
        clinicianName: 'Dr. Senior Reviewer',
        medicalRegistration: 'DMC-2009-11111',
        specialty: 'GENERAL_MEDICINE',
        approvalVerdict: 'APPROVED',
        checksumSha256: sampleChecksum,
        reviewNotes: 'Senior clinician signoff with genuine Ed25519 signature',
        coiDeclared: true,
        coiDetails: 'No commercial COI',
        digitalSignature: JSON.stringify(seniorEnvelope),
        signedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'appr-junior-1',
        versionId: sampleVersionId,
        reviewerUserId: juniorReviewerUserId,
        clinicianName: 'Dr. Junior Reviewer',
        medicalRegistration: 'KMC-2019-22222',
        specialty: 'GENERAL_MEDICINE',
        approvalVerdict: 'APPROVED',
        checksumSha256: sampleChecksum,
        reviewNotes: 'Junior clinician signoff with genuine Ed25519 signature',
        coiDeclared: true,
        coiDetails: 'No commercial COI',
        digitalSignature: JSON.stringify(juniorEnvelope),
        signedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    ];

    mockVersions.set(sampleVersionId, mockVersion);

    // Mock Prisma Implementation
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve({ id: where.id, isActive: true });
        }),
      },
      knowledgePackVersion: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(mockVersions.get(where.id) || null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const v = mockVersions.get(where.id);
          if (!v) return Promise.resolve(null);
          Object.assign(v, data);
          return Promise.resolve(v);
        }),
      },
      knowledgePackRelease: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          for (const r of mockReleases.values()) {
            if (
              (where.clinicId === undefined || r.clinicId === where.clinicId) &&
              (where.domain === undefined || r.domain === where.domain) &&
              (where.versionId === undefined || r.versionId === where.versionId) &&
              (where.isActive === undefined || r.isActive === where.isActive)
            ) {
              return Promise.resolve({ ...r, version: mockVersions.get(r.versionId) });
            }
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const r = mockReleases.get(where.id);
          if (!r) return Promise.resolve(null);
          return Promise.resolve({ ...r, version: mockVersions.get(r.versionId) });
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          let count = 0;
          for (const r of mockReleases.values()) {
            if (
              (where.clinicId === undefined || r.clinicId === where.clinicId) &&
              (where.domain === undefined || r.domain === where.domain) &&
              (where.isActive === undefined || r.isActive === where.isActive)
            ) {
              Object.assign(r, data);
              count++;
            }
          }
          return Promise.resolve({ count });
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = {
            id: `release-${Math.random().toString(36).substring(7)}`,
            ...data,
          };
          mockReleases.set(created.id, created);
          return Promise.resolve(created);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const r = mockReleases.get(where.id);
          if (!r) return Promise.resolve(null);
          Object.assign(r, data);
          return Promise.resolve(r);
        }),
      },
      knowledgePackGovernanceAudit: {
        create: jest.fn().mockImplementation(({ data }) => {
          return Promise.resolve({ id: `audit-${Math.random()}`, ...data });
        }),
      },
    };

    credentialingService = new ReviewerCredentialingService(
      credentialRepo,
      mockPrisma as unknown as PrismaService,
      mockAuditService,
    );

    authService = new ClinicalGovernanceAuthorizationService(credentialingService);

    multiSigService = new MultiSignatureApprovalService(
      mockPrisma as unknown as PrismaService,
      credentialingService,
      authService,
      mockAuditService,
      attestationService,
      keyMgmtService,
    );

    releaseAuthorityService = new KnowledgePackReleaseAuthorityService(
      mockPrisma as unknown as PrismaService,
      multiSigService,
      credentialingService,
      keyMgmtService,
      mockAuditService,
      resolverService,
    );
  });

  describe('Four-Eyes Release Authority Enforcement', () => {
    it('successfully activates global release when release officer is distinct and all integrity checks pass', async () => {
      const result = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'GLOBAL',
          releaseNotes: 'Global release of v1.0.0 General Medicine',
        },
        releaseAuthorityUserId,
      );

      expect(result.releaseId).toBeDefined();
      expect(result.scope).toBe('GLOBAL');
      expect(result.clinicId).toBeNull();
      expect(result.isActive).toBe(true);

      expect(mockVersion.releaseStatus).toBe(KnowledgePackReleaseStatus.RELEASED);

      // Verify audit log emitted
      expect(mockAuditService.logEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.RELEASE_ATTEMPT_REJECTED,
        }),
      );
    });

    it('rejects release if the author attempts to release their own authored version (Four-Eyes Violation)', async () => {
      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          authorUserId, // Author attempting to release
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.RELEASE_ATTEMPT_REJECTED,
          actorUserId: authorUserId,
        }),
      );
    });

    it('rejects release if an approving reviewer attempts to act as release authority (Four-Eyes Violation)', async () => {
      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          seniorReviewerUserId, // Senior reviewer attempting to release
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.RELEASE_ATTEMPT_REJECTED,
          actorUserId: seniorReviewerUserId,
        }),
      );
    });

    it('fails closed if the version has no author identity established (Legacy Pack Safety)', async () => {
      mockVersion.authorUserId = null;

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects release if releasedByUserId in body differs from authenticated principal (Spoofing)', async () => {
      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
            releasedByUserId: 'spoofed-admin-uuid',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects release if version lifecycle state is DRAFT or IN_REVIEW', async () => {
      mockVersion.releaseStatus = KnowledgePackReleaseStatus.DRAFT;

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Pre-Release Quorum & Integrity Verification', () => {
    it('rejects release when reviewer quorum is insufficient (< 2 approvals)', async () => {
      // Remove junior approval, leaving only 1 approval
      mockVersion.approvals = [mockVersion.approvals[0]];

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects release when no senior reviewer has approved', async () => {
      // Demote senior reviewer
      const seniorCred = await credentialRepo.findByUserId(seniorReviewerUserId);
      seniorCred!.isSeniorReviewer = false;
      seniorCred!.yearsOfExperience = 4;
      await credentialRepo.save(seniorCred!);

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects release when a reviewer credentials have expired', async () => {
      const juniorCred = await credentialRepo.findByUserId(juniorReviewerUserId);
      juniorCred!.credentialsExpiresAt = new Date(Date.now() - 3600000); // Expired 1 hour ago
      await credentialRepo.save(juniorCred!);

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects release when an approval record has expired', async () => {
      mockVersion.approvals[1].expiresAt = new Date(Date.now() - 3600000); // Expired 1 hr ago

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects release when canonical checksum drifts (tampered rule or condition content)', async () => {
      // Tamper with condition title
      mockVersion.conditions[0].displayName = 'Tampered Pneumonia';

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects release when an approval has a corrupted Ed25519 digital signature', async () => {
      const parsedEnvelope = JSON.parse(mockVersion.approvals[0].digitalSignature);
      parsedEnvelope.signature = parsedEnvelope.signature.slice(0, -4) + 'XXXX';
      mockVersion.approvals[0].digitalSignature = JSON.stringify(parsedEnvelope);

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Key Lifecycle Semantics & Historical Signatures', () => {
    it('rejects release if an approval was signed with a key that is now REVOKED', async () => {
      // Revoke senior reviewer's key
      const activeKey = await mockKeyRepo.findActiveByUserId(seniorReviewerUserId);
      await mockKeyRepo.update(activeKey!.id, {
        status: PublicKeyStatus.REVOKED,
        revokedAt: new Date(),
        revocationReason: 'Private key compromised',
      });

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts release if an approval was signed with a key that was subsequently ROTATED (historical signature policy)', async () => {
      // Senior reviewer signed 1 hour ago
      const activeKey = await mockKeyRepo.findActiveByUserId(seniorReviewerUserId);
      // Now rotate key (updatedAt is set to now)
      await mockKeyRepo.update(activeKey!.id, {
        status: PublicKeyStatus.ROTATED,
      });

      // Verification succeeds because signedAt <= key.updatedAt
      const result = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      expect(result.isActive).toBe(true);
    });

    it('rejects release if signature timestamp is AFTER key was ROTATED', async () => {
      const activeKey = await mockKeyRepo.findActiveByUserId(seniorReviewerUserId);
      // Key was rotated yesterday
      await mockKeyRepo.update(activeKey!.id, {
        status: PublicKeyStatus.ROTATED,
        updatedAt: new Date(Date.now() - 86400000),
      });

      // Approval claims to have been signed today (after rotation)
      const envelope = JSON.parse(mockVersion.approvals[0].digitalSignature);
      envelope.payload.signedAt = new Date().toISOString();

      // Resign with matching timestamp to produce valid math but invalid lifecycle
      const resigned = attestationService.signPayload(
        envelope.payload,
        seniorKeyPair.privateKeyPem,
        seniorKeyPair.publicKeyPem,
      );
      mockVersion.approvals[0].digitalSignature = JSON.stringify(resigned);

      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'GLOBAL',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Release Scope, Tenant Isolation & Atomic Superseding', () => {
    it('successfully activates clinic-specific release with matching clinic context', async () => {
      const result = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'CLINIC',
          clinicId: clinicAlphaId,
        },
        releaseAuthorityUserId,
        { clinicId: clinicAlphaId },
      );

      expect(result.scope).toBe('CLINIC');
      expect(result.clinicId).toBe(clinicAlphaId);
      expect(result.isActive).toBe(true);
    });

    it('rejects cross-tenant release attempt (Clinic A user attempting to release for Clinic B)', async () => {
      await expect(
        releaseAuthorityService.activateRelease(
          {
            versionId: sampleVersionId,
            scope: 'CLINIC',
            clinicId: clinicBetaId, // Target Clinic B
          },
          releaseAuthorityUserId,
          { clinicId: clinicAlphaId }, // Active context is Clinic A
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('atomically deactivates prior active release in same scope and domain when a new release is activated', async () => {
      // 1. Activate v1.0.0
      const rel1 = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      expect(rel1.isActive).toBe(true);

      // Verify release 1 is currently active in mockReleases
      const storedRel1 = mockReleases.get(rel1.releaseId);
      expect(storedRel1.isActive).toBe(true);

      // 2. Prepare mock target version v1.1.0
      const mockVersion2 = JSON.parse(JSON.stringify(mockVersion));
      mockVersion2.id = targetVersionId;
      mockVersion2.minorVersion = 1;
      const v2Checksum = computeCanonicalChecksum(
        resolverService.reconstructSeedFromVersion(mockVersion2),
      );
      mockVersion2.checksumSha256 = v2Checksum;
      mockVersions.set(targetVersionId, mockVersion2);

      // Re-sign approvals for target version
      const seniorPayload2: AttestationPayload = {
        versionId: targetVersionId,
        checksumSha256: v2Checksum,
        reviewerUserId: seniorReviewerUserId,
        credentialId: 'cred-senior-1',
        medicalRegistration: 'DMC-2009-11111',
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };
      const juniorPayload2: AttestationPayload = {
        versionId: targetVersionId,
        checksumSha256: v2Checksum,
        reviewerUserId: juniorReviewerUserId,
        credentialId: 'cred-junior-1',
        medicalRegistration: 'KMC-2019-22222',
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      mockVersion2.approvals[0].versionId = targetVersionId;
      mockVersion2.approvals[0].checksumSha256 = v2Checksum;
      mockVersion2.approvals[0].digitalSignature = JSON.stringify(
        attestationService.signPayload(
          seniorPayload2,
          seniorKeyPair.privateKeyPem,
          seniorKeyPair.publicKeyPem,
        ),
      );
      mockVersion2.approvals[1].versionId = targetVersionId;
      mockVersion2.approvals[1].checksumSha256 = v2Checksum;
      mockVersion2.approvals[1].digitalSignature = JSON.stringify(
        attestationService.signPayload(
          juniorPayload2,
          juniorKeyPair.privateKeyPem,
          juniorKeyPair.publicKeyPem,
        ),
      );

      // 3. Activate v1.1.0
      const rel2 = await releaseAuthorityService.activateRelease(
        {
          versionId: targetVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      expect(rel2.isActive).toBe(true);

      // Verify prior release 1 was atomically deactivated!
      expect(storedRel1.isActive).toBe(false);
      expect(storedRel1.deactivatedAt).toBeDefined();
      expect(storedRel1.deactivationReason).toContain('Superseded');
    });
  });

  describe('Emergency Deactivation Workflow', () => {
    it('executes emergency deactivation with mandatory reason and logs audit event', async () => {
      const rel = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      const deactResult = await releaseAuthorityService.emergencyDeactivate(
        rel.releaseId,
        {
          reason: 'Severe clinical diagnostic defect reported in external trial',
        },
        releaseAuthorityUserId,
      );

      expect(deactResult.isActive).toBe(false);
      expect(deactResult.deactivatedAt).toBeDefined();
      expect(deactResult.deactivationReason).toContain('Severe clinical diagnostic defect');

      // Verify resolver rejects deactivated release
      const storedRel = mockReleases.get(rel.releaseId);
      expect(resolverService.verifyReleaseIntegrity({ ...storedRel, version: mockVersion })).toBe(false);
    });

    it('rejects emergency deactivation if reason is missing or too short', async () => {
      const rel = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      await expect(
        releaseAuthorityService.emergencyDeactivate(
          rel.releaseId,
          { reason: 'Short' },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects emergency deactivation across tenant boundaries', async () => {
      const rel = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'CLINIC',
          clinicId: clinicBetaId,
        },
        releaseAuthorityUserId,
        { clinicId: clinicBetaId },
      );

      await expect(
        releaseAuthorityService.emergencyDeactivate(
          rel.releaseId,
          { reason: 'Unauthorized cross clinic deactivation' },
          releaseAuthorityUserId,
          { clinicId: clinicAlphaId }, // Clinic A caller attempting to deactivate Clinic B release
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Safe Rollback Workflow', () => {
    it('rolls back active release to a prior eligible version', async () => {
      // 1. Activate v1.0.0
      const rel1 = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      // 2. Prepare target version v1.1.0
      const mockVersion2 = JSON.parse(JSON.stringify(mockVersion));
      mockVersion2.id = targetVersionId;
      mockVersion2.minorVersion = 1;
      const v2Checksum = computeCanonicalChecksum(
        resolverService.reconstructSeedFromVersion(mockVersion2),
      );
      mockVersion2.checksumSha256 = v2Checksum;
      mockVersions.set(targetVersionId, mockVersion2);

      const seniorPayload2: AttestationPayload = {
        versionId: targetVersionId,
        checksumSha256: v2Checksum,
        reviewerUserId: seniorReviewerUserId,
        credentialId: 'cred-senior-1',
        medicalRegistration: 'DMC-2009-11111',
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };
      const juniorPayload2: AttestationPayload = {
        versionId: targetVersionId,
        checksumSha256: v2Checksum,
        reviewerUserId: juniorReviewerUserId,
        credentialId: 'cred-junior-1',
        medicalRegistration: 'KMC-2019-22222',
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      mockVersion2.approvals[0].versionId = targetVersionId;
      mockVersion2.approvals[0].checksumSha256 = v2Checksum;
      mockVersion2.approvals[0].digitalSignature = JSON.stringify(
        attestationService.signPayload(
          seniorPayload2,
          seniorKeyPair.privateKeyPem,
          seniorKeyPair.publicKeyPem,
        ),
      );
      mockVersion2.approvals[1].versionId = targetVersionId;
      mockVersion2.approvals[1].checksumSha256 = v2Checksum;
      mockVersion2.approvals[1].digitalSignature = JSON.stringify(
        attestationService.signPayload(
          juniorPayload2,
          juniorKeyPair.privateKeyPem,
          juniorKeyPair.publicKeyPem,
        ),
      );

      // Activate v1.1.0
      const rel2 = await releaseAuthorityService.activateRelease(
        {
          versionId: targetVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      expect(rel2.versionId).toBe(targetVersionId);

      // 3. Rollback from v1.1.0 back to v1.0.0
      const rollbackResult = await releaseAuthorityService.rollbackRelease(
        rel2.releaseId,
        {
          targetVersionId: sampleVersionId,
          reason: 'Clinical anomaly observed in v1.1.0; restoring proven baseline v1.0.0',
        },
        releaseAuthorityUserId,
      );

      expect(rollbackResult.versionId).toBe(sampleVersionId);
      expect(rollbackResult.isActive).toBe(true);

      // Version 2 should now be ROLLED_BACK
      expect(mockVersion2.releaseStatus).toBe(KnowledgePackReleaseStatus.ROLLED_BACK);
      // Target version 1 should be RELEASED
      expect(mockVersion.releaseStatus).toBe(KnowledgePackReleaseStatus.RELEASED);
    });

    it('rejects rollback if target version does not satisfy quorum/integrity requirements', async () => {
      const rel = await releaseAuthorityService.activateRelease(
        {
          versionId: sampleVersionId,
          scope: 'GLOBAL',
        },
        releaseAuthorityUserId,
      );

      // Create an invalid target version (no approvals)
      const invalidTarget = {
        ...mockVersion,
        id: targetVersionId,
        approvals: [],
      };
      mockVersions.set(targetVersionId, invalidTarget);

      await expect(
        releaseAuthorityService.rollbackRelease(
          rel.releaseId,
          {
            targetVersionId,
            reason: 'Attempting rollback to invalid version',
          },
          releaseAuthorityUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
