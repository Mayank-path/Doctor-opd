import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  GovernanceAuditAction,
  PublicKeyStatus,
  ReviewerVerificationStatus,
} from '../constants/governance.constants';
import {
  AttestationPayload,
  ReviewerPublicKeyEntity,
} from '../interfaces/attestation.interface';
import { IReviewerKeyRepository } from '../interfaces/reviewer-key-repository.interface';
import { InMemoryReviewerCredentialRepository } from '../repositories/in-memory-reviewer-credential.repository';
import { ClinicalGovernanceAuthorizationService } from './clinical-governance-authorization.service';
import { CryptographicAttestationService } from './cryptographic-attestation.service';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { MultiSignatureApprovalService } from './multi-signature-approval.service';
import { ReviewerCredentialingService } from './reviewer-credentialing.service';
import { ReviewerKeyManagementService } from './reviewer-key-management.service';

describe('MultiSignatureApprovalService — Multi-Signature Governance & Quorum', () => {
  let service: MultiSignatureApprovalService;
  let credentialingService: ReviewerCredentialingService;
  let authService: ClinicalGovernanceAuthorizationService;
  let repository: InMemoryReviewerCredentialRepository;
  let mockPrisma: any;
  let mockAuditService: any;

  const sampleVersionId = '11111111-2222-3333-4444-555555555555';
  const authorUserId = 'author-user-uuid';
  const sampleChecksum =
    'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
  const mismatchedChecksum =
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  const seniorReviewerUserId = 'senior-rev-uuid';
  const juniorReviewerUserId = 'junior-rev-uuid';
  const secondSeniorReviewerUserId = 'second-senior-rev-uuid';
  const unverifiedDoctorUserId = 'unverified-doctor-uuid';

  let mockVersion: any;

  beforeEach(async () => {
    repository = new InMemoryReviewerCredentialRepository();
    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockVersion = {
      id: sampleVersionId,
      packId: 'pack-gm-1',
      authorUserId,
      majorVersion: 1,
      minorVersion: 0,
      patchVersion: 0,
      releaseStatus: KnowledgePackReleaseStatus.IN_REVIEW,
      checksumSha256: sampleChecksum,
      pack: {
        domain: KnowledgePackDomain.GENERAL_MEDICINE,
        name: 'General Medicine Decision Support',
      },
      approvals: [],
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', isActive: true }),
      },
      knowledgePackVersion: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === sampleVersionId) {
            return Promise.resolve(mockVersion);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          mockVersion = { ...mockVersion, ...data };
          return Promise.resolve(mockVersion);
        }),
      },
      clinicalReviewApproval: {
        create: jest.fn().mockImplementation(({ data }) => {
          const created = {
            id: `approval-${Math.random().toString(36).substring(7)}`,
            ...data,
          };
          mockVersion.approvals.push(created);
          return Promise.resolve(created);
        }),
      },
    };

    credentialingService = new ReviewerCredentialingService(
      repository,
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as KnowledgePackGovernanceAuditService,
    );

    authService = new ClinicalGovernanceAuthorizationService(credentialingService);

    service = new MultiSignatureApprovalService(
      mockPrisma as unknown as PrismaService,
      credentialingService,
      authService,
      mockAuditService as unknown as KnowledgePackGovernanceAuditService,
    );

    // Register test reviewers in repository
    // 1. Senior Reviewer (15 years experience, MD General Medicine, VERIFIED)
    await repository.save({
      id: 'cred-senior-1',
      userId: seniorReviewerUserId,
      clinicianName: 'Dr. Senior Clinician',
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

    // 2. Junior Reviewer (5 years experience, MD General Medicine, VERIFIED)
    await repository.save({
      id: 'cred-junior-1',
      userId: juniorReviewerUserId,
      clinicianName: 'Dr. Junior Specialist',
      medicalRegistration: 'DMC-2019-22222',
      stateMedicalCouncil: 'Delhi Medical Council',
      registrationYear: 2019,
      primaryQualification: 'MBBS',
      specialtyQualification: 'MD (General Medicine)',
      specialty: 'GENERAL_MEDICINE',
      yearsOfExperience: 5,
      isSeniorReviewer: false,
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

    // 3. Second Senior Reviewer (12 years experience, MD Internal Medicine, VERIFIED)
    await repository.save({
      id: 'cred-senior-2',
      userId: secondSeniorReviewerUserId,
      clinicianName: 'Dr. Second Senior',
      medicalRegistration: 'MMC-2012-33333',
      stateMedicalCouncil: 'Maharashtra Medical Council',
      registrationYear: 2012,
      primaryQualification: 'MBBS',
      specialtyQualification: 'MD (Internal Medicine)',
      specialty: 'INTERNAL_MEDICINE',
      yearsOfExperience: 12,
      isSeniorReviewer: true,
      verificationStatus: ReviewerVerificationStatus.VERIFIED,
      verificationEvidence: 'MMC Register verified',
      verifiedByUserId: 'board-admin',
      verifiedAt: new Date(),
      rejectionReason: null,
      credentialsExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Unverified Doctor (PENDING)
    await repository.save({
      id: 'cred-unverified-1',
      userId: unverifiedDoctorUserId,
      clinicianName: 'Dr. Unverified',
      medicalRegistration: 'UPMC-2020-44444',
      stateMedicalCouncil: 'UP Medical Council',
      registrationYear: 2020,
      primaryQualification: 'MBBS',
      specialtyQualification: 'MD (General Medicine)',
      specialty: 'GENERAL_MEDICINE',
      yearsOfExperience: 4,
      isSeniorReviewer: false,
      verificationStatus: ReviewerVerificationStatus.PENDING,
      verificationEvidence: null,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      credentialsExpiresAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('submitApproval Validation & Checks', () => {
    it('should reject reviewer identity spoofing if DTO reviewerUserId differs from principal', async () => {
      await expect(
        service.submitApproval(
          {
            versionId: sampleVersionId,
            reviewerUserId: 'impersonated-reviewer-uuid',
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Spoofing attempt',
            coiDeclared: true,
          },
          seniorReviewerUserId, // Authenticated principal
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should fail closed if version has no authorUserId (Legacy Version Without Author)', async () => {
      mockVersion.authorUserId = null;

      await expect(
        service.submitApproval(
          {
            versionId: sampleVersionId,
            reviewerUserId: seniorReviewerUserId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Attempting to approve legacy version lacking author',
            coiDeclared: true,
          },
          seniorReviewerUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject approval if version does not exist', async () => {
      await expect(
        service.submitApproval(
          {
            versionId: '99999999-9999-4999-a999-999999999999',
            reviewerUserId: seniorReviewerUserId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Valid review',
            coiDeclared: true,
          },
          seniorReviewerUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject approval if submitted checksum does not match version checksum', async () => {
      await expect(
        service.submitApproval(
          {
            versionId: sampleVersionId,
            reviewerUserId: seniorReviewerUserId,
            checksumSha256: mismatchedChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Valid notes',
            coiDeclared: true,
          },
          seniorReviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.APPROVAL_REJECTED_UNAUTHORIZED,
        }),
      );
    });

    it('should reject unverified reviewer (status PENDING)', async () => {
      await expect(
        service.submitApproval(
          {
            versionId: sampleVersionId,
            reviewerUserId: unverifiedDoctorUserId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Attempted review by unverified doctor',
            coiDeclared: true,
          },
          unverifiedDoctorUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject self-approval when author attempts to review own pack (Four-Eyes Violation)', async () => {
      // Author user submits
      await repository.save({
        id: 'cred-author',
        userId: authorUserId,
        clinicianName: 'Dr. Author',
        medicalRegistration: 'DMC-2005-99999',
        stateMedicalCouncil: 'Delhi Medical Council',
        registrationYear: 2005,
        primaryQualification: 'MBBS',
        specialtyQualification: 'MD (General Medicine)',
        specialty: 'GENERAL_MEDICINE',
        yearsOfExperience: 18,
        isSeniorReviewer: true,
        verificationStatus: ReviewerVerificationStatus.VERIFIED,
        verificationEvidence: 'Verified',
        verifiedByUserId: 'admin',
        verifiedAt: new Date(),
        rejectionReason: null,
        credentialsExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.submitApproval(
          {
            versionId: sampleVersionId,
            reviewerUserId: authorUserId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Author self-review',
            coiDeclared: true,
          },
          authorUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject review when reviewer declares material conflict of interest', async () => {
      await expect(
        service.submitApproval(
          {
            versionId: sampleVersionId,
            reviewerUserId: seniorReviewerUserId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Clinical review',
            coiDeclared: true,
            hasMaterialConflict: true,
            coiDetails: 'Consultant for pharmaceutical sponsor of target drug',
          },
          seniorReviewerUserId,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.APPROVAL_REJECTED_COI,
        }),
      );
    });

    it('should reject duplicate approval by the same reviewer', async () => {
      await service.submitApproval(
        {
          versionId: sampleVersionId,
          reviewerUserId: seniorReviewerUserId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED',
          reviewNotes: 'First approval',
          coiDeclared: true,
        },
        seniorReviewerUserId,
      );

      // Attempt duplicate submission
      await expect(
        service.submitApproval(
          {
            versionId: sampleVersionId,
            reviewerUserId: seniorReviewerUserId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED',
            reviewNotes: 'Duplicate submission attempt',
            coiDeclared: true,
          },
          seniorReviewerUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Multi-Signature Quorum Evaluation', () => {
    it('should report quorum NOT met when only 1 approval is recorded (needs 2)', async () => {
      const result = await service.submitApproval(
        {
          versionId: sampleVersionId,
          reviewerUserId: seniorReviewerUserId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED',
          reviewNotes: 'First senior approval',
          coiDeclared: true,
        },
        seniorReviewerUserId,
      );

      expect(result.quorumStatus.isQuorumMet).toBe(false);
      expect(result.quorumStatus.approvedCount).toBe(1);
      expect(result.quorumStatus.requiredQuorum).toBe(2);
      expect(result.quorumStatus.missingRequirements).toContain(
        'Requires at least 2 independent specialist approvals (Current: 1).',
      );
      expect(mockVersion.releaseStatus).toBe(KnowledgePackReleaseStatus.IN_REVIEW);
    });

    it('should report quorum NOT met when 2 junior approvals exist without a senior reviewer', async () => {
      // Register a second junior reviewer
      const secondJuniorUserId = 'second-junior-rev-uuid';
      await repository.save({
        id: 'cred-junior-2',
        userId: secondJuniorUserId,
        clinicianName: 'Dr. Junior Two',
        medicalRegistration: 'DMC-2021-33333',
        stateMedicalCouncil: 'Delhi Medical Council',
        registrationYear: 2021,
        primaryQualification: 'MBBS',
        specialtyQualification: 'MD (General Medicine)',
        specialty: 'GENERAL_MEDICINE',
        yearsOfExperience: 3,
        isSeniorReviewer: false,
        verificationStatus: ReviewerVerificationStatus.VERIFIED,
        verificationEvidence: 'Verified',
        verifiedByUserId: 'admin',
        verifiedAt: new Date(),
        rejectionReason: null,
        credentialsExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Submit junior 1
      await service.submitApproval(
        {
          versionId: sampleVersionId,
          reviewerUserId: juniorReviewerUserId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED',
          reviewNotes: 'Junior 1 notes',
          coiDeclared: true,
        },
        juniorReviewerUserId,
      );

      // Submit junior 2
      const res = await service.submitApproval(
        {
          versionId: sampleVersionId,
          reviewerUserId: secondJuniorUserId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED',
          reviewNotes: 'Junior 2 notes',
          coiDeclared: true,
        },
        secondJuniorUserId,
      );

      expect(res.quorumStatus.approvedCount).toBe(2);
      expect(res.quorumStatus.seniorReviewerCount).toBe(0);
      expect(res.quorumStatus.isQuorumMet).toBe(false);
      expect(res.quorumStatus.missingRequirements[0]).toContain(
        'Requires at least 1 senior specialist reviewer with >= 10 years of experience',
      );
      expect(mockVersion.releaseStatus).toBe(KnowledgePackReleaseStatus.IN_REVIEW);
    });

    it('should satisfy quorum when 2 qualifying specialist approvals with at least 1 senior reviewer are submitted', async () => {
      // 1. Submit senior approval
      await service.submitApproval(
        {
          versionId: sampleVersionId,
          reviewerUserId: seniorReviewerUserId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED',
          reviewNotes: 'Senior MD General Medicine review complete. Heuristics verified against ICMR STWs.',
          coiDeclared: true,
        },
        seniorReviewerUserId,
      );

      // 2. Submit second senior approval (or qualifying junior)
      const res2 = await service.submitApproval(
        {
          versionId: sampleVersionId,
          reviewerUserId: juniorReviewerUserId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED',
          reviewNotes: 'Second independent specialist review complete.',
          coiDeclared: true,
        },
        juniorReviewerUserId,
      );

      expect(res2.quorumStatus.isQuorumMet).toBe(true);
      expect(res2.quorumStatus.approvedCount).toBe(2);
      expect(res2.quorumStatus.seniorReviewerCount).toBe(1);
      expect(res2.quorumStatus.missingRequirements).toHaveLength(0);

      // Verify that version transitioned to APPROVED
      expect(mockVersion.releaseStatus).toBe(KnowledgePackReleaseStatus.APPROVED);

      // Verify audit log recorded transition
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.VERSION_STATUS_TRANSITION,
          fromStatus: KnowledgePackReleaseStatus.IN_REVIEW,
          toStatus: KnowledgePackReleaseStatus.APPROVED,
        }),
      );
    });

    it('should exclude legacy approvals lacking explicit relational checksumSha256 from quorum', async () => {
      // Inject a legacy approval lacking checksumSha256 into mockVersion
      mockVersion.approvals.push({
        id: 'legacy-approval-1',
        reviewerUserId: secondSeniorReviewerUserId,
        clinicianName: 'Dr. Legacy Reviewer',
        medicalRegistration: 'DMC-2000-00000',
        specialty: 'GENERAL_MEDICINE',
        approvalVerdict: 'APPROVED',
        checksumSha256: null, // Legacy unbound row
        reviewNotes: 'Legacy review notes',
        signedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const quorum = await service.evaluateQuorum(sampleVersionId);
      expect(quorum.approvedCount).toBe(0);
      expect(quorum.isQuorumMet).toBe(false);
    });
  });

  describe('invalidateApprovalsOnContentChange', () => {
    it('should reset version status to DRAFT and log audit event when checksum changes', async () => {
      mockVersion.releaseStatus = KnowledgePackReleaseStatus.APPROVED;

      await service.invalidateApprovalsOnContentChange(
        sampleVersionId,
        '0000000000000000000000000000000000000000000000000000000000000001',
        authorUserId,
      );

      expect(mockVersion.releaseStatus).toBe(KnowledgePackReleaseStatus.DRAFT);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.APPROVALS_INVALIDATED_CHECKSUM_CHANGED,
          toStatus: KnowledgePackReleaseStatus.DRAFT,
        }),
      );
    });
  });

  describe('Phase 5C.4 — Cryptographic Attestation in Multi-Signature Workflow', () => {
    let cryptoService: MultiSignatureApprovalService;
    let keyMgmtService: ReviewerKeyManagementService;
    let attestationService: CryptographicAttestationService;
    let mockKeyRepo: jest.Mocked<IReviewerKeyRepository>;

    let seniorKeyPair: { publicKeyPem: string; privateKeyPem: string };
    let juniorKeyPair: { publicKeyPem: string; privateKeyPem: string };

    beforeAll(() => {
      const ed25519Gen = () => {
        const { publicKey, privateKey } = crypto.generateKeyPairSync(
          'ed25519',
          {
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
          },
        );
        return { publicKeyPem: publicKey, privateKeyPem: privateKey };
      };

      seniorKeyPair = ed25519Gen();
      juniorKeyPair = ed25519Gen();
    });

    beforeEach(async () => {
      const keysMap = new Map<string, ReviewerPublicKeyEntity>();

      mockKeyRepo = {
        save: jest.fn().mockImplementation((k: ReviewerPublicKeyEntity) => {
          keysMap.set(k.id, { ...k });
          return Promise.resolve(k);
        }),
        findActiveByUserId: jest.fn().mockImplementation((uid: string) => {
          for (const k of keysMap.values()) {
            if (k.reviewerUserId === uid && k.status === PublicKeyStatus.ACTIVE) {
              return Promise.resolve(k);
            }
          }
          return Promise.resolve(null);
        }),
        findByFingerprint: jest.fn().mockImplementation((fp: string) => {
          for (const k of keysMap.values()) {
            if (k.keyFingerprint === fp) return Promise.resolve(k);
          }
          return Promise.resolve(null);
        }),
        findById: jest.fn().mockImplementation((id: string) => {
          return Promise.resolve(keysMap.get(id) || null);
        }),
        findAllByUserId: jest.fn().mockImplementation((uid: string) => {
          const list: ReviewerPublicKeyEntity[] = [];
          for (const k of keysMap.values()) {
            if (k.reviewerUserId === uid) list.push(k);
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
          .mockImplementation((uid: string, exceptKeyId: string) => {
            for (const [id, k] of keysMap.entries()) {
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
          keysMap.clear();
          return Promise.resolve();
        }),
      };

      keyMgmtService = new ReviewerKeyManagementService(mockKeyRepo);

      attestationService = new CryptographicAttestationService(
        keyMgmtService,
        mockAuditService,
      );

      cryptoService = new MultiSignatureApprovalService(
        mockPrisma as unknown as PrismaService,
        credentialingService,
        authService,
        mockAuditService as unknown as KnowledgePackGovernanceAuditService,
        attestationService,
        keyMgmtService,
      );

      // Register public keys for test reviewers
      await keyMgmtService.registerPublicKey(
        seniorReviewerUserId,
        seniorKeyPair.publicKeyPem,
      );
      await keyMgmtService.registerPublicKey(
        juniorReviewerUserId,
        juniorKeyPair.publicKeyPem,
      );
    });

    it('successfully submits approval with valid Ed25519 cryptographic signature', async () => {
      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId: seniorReviewerUserId,
        credentialId: 'cred-senior-1',
        medicalRegistration: 'DMC-2009-11111',
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        seniorKeyPair.privateKeyPem,
        seniorKeyPair.publicKeyPem,
      );

      const result = await cryptoService.submitApproval(
        {
          versionId: sampleVersionId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED' as any,
          coiDeclared: true,
          coiDetails: 'No commercial or institutional COI',
          reviewNotes: 'Verified with genuine Ed25519 signature',
          digitalSignature: JSON.stringify(envelope),
        },
        seniorReviewerUserId,
      );

      expect(result.approvalId).toBeDefined();
      expect(result.quorumStatus.isQuorumMet).toBe(false); // First approval

      // Verify audit event was emitted
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GovernanceAuditAction.APPROVAL_ATTESTATION_SIGNED,
          actorUserId: seniorReviewerUserId,
        }),
      );
    });

    it('rejects approval submission when digitalSignature JSON is malformed', async () => {
      await expect(
        cryptoService.submitApproval(
          {
            versionId: sampleVersionId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED' as any,
            coiDeclared: true,
            coiDetails: 'No commercial COI',
            reviewNotes: 'Notes',
            digitalSignature: '{ not_valid_json',
          },
          seniorReviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects approval submission when digital signature bytes are tampered', async () => {
      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId: seniorReviewerUserId,
        credentialId: 'cred-senior-1',
        medicalRegistration: 'DMC-2009-11111',
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        seniorKeyPair.privateKeyPem,
        seniorKeyPair.publicKeyPem,
      );

      // Corrupt signature
      envelope.signature = envelope.signature.slice(0, -4) + 'ZZZZ';

      await expect(
        cryptoService.submitApproval(
          {
            versionId: sampleVersionId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED' as any,
            coiDeclared: true,
            coiDetails: 'No commercial COI',
            reviewNotes: 'Notes',
            digitalSignature: JSON.stringify(envelope),
          },
          seniorReviewerUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects approval submission with replayed digital signature (anti-replay)', async () => {
      const payload: AttestationPayload = {
        versionId: sampleVersionId,
        checksumSha256: sampleChecksum,
        reviewerUserId: seniorReviewerUserId,
        credentialId: 'cred-senior-1',
        medicalRegistration: 'DMC-2009-11111',
        approvalVerdict: 'APPROVED',
        signedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      };

      const envelope = attestationService.signPayload(
        payload,
        seniorKeyPair.privateKeyPem,
        seniorKeyPair.publicKeyPem,
      );

      // First submission succeeds
      await cryptoService.submitApproval(
        {
          versionId: sampleVersionId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED' as any,
          coiDeclared: true,
          coiDetails: 'No commercial COI',
          reviewNotes: 'First submission',
          digitalSignature: JSON.stringify(envelope),
        },
        seniorReviewerUserId,
      );

      // Second submission with exact same envelope by another reviewer (replay)
      await expect(
        cryptoService.submitApproval(
          {
            versionId: sampleVersionId,
            checksumSha256: sampleChecksum,
            approvalVerdict: 'APPROVED' as any,
            coiDeclared: true,
            coiDetails: 'No commercial COI',
            reviewNotes: 'Replayed submission',
            digitalSignature: JSON.stringify(envelope),
          },
          juniorReviewerUserId,
        ),
      ).rejects.toThrow(ForbiddenException); // payload.reviewerUserId mismatch
    });

    it('evaluates quorum correctly with cryptographically signed approvals and excludes tampered signatures', async () => {
      // 1. Submit Senior Reviewer approval with valid signature
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

      await cryptoService.submitApproval(
        {
          versionId: sampleVersionId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED' as any,
          coiDeclared: true,
          coiDetails: 'No commercial COI',
          reviewNotes: 'Senior reviewer signoff',
          digitalSignature: JSON.stringify(seniorEnvelope),
        },
        seniorReviewerUserId,
      );

      // 2. Submit Junior Reviewer approval with valid signature
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

      const res2 = await cryptoService.submitApproval(
        {
          versionId: sampleVersionId,
          checksumSha256: sampleChecksum,
          approvalVerdict: 'APPROVED' as any,
          coiDeclared: true,
          coiDetails: 'No commercial COI',
          reviewNotes: 'Junior reviewer signoff',
          digitalSignature: JSON.stringify(juniorEnvelope),
        },
        juniorReviewerUserId,
      );

      // Quorum is now met with 2 valid cryptographic signatures
      expect(res2.quorumStatus.isQuorumMet).toBe(true);
      expect(res2.quorumStatus.approvedCount).toBe(2);
      expect(res2.quorumStatus.seniorReviewerCount).toBe(1);

      // Now tamper with junior approval's stored digitalSignature in mockVersion
      const juniorApprovalRecord = mockVersion.approvals.find(
        (a: any) => a.reviewerUserId === juniorReviewerUserId,
      );
      expect(juniorApprovalRecord).toBeDefined();

      const parsedEnvelope = JSON.parse(juniorApprovalRecord.digitalSignature);
      parsedEnvelope.signature = parsedEnvelope.signature.slice(0, -4) + 'XXXX';
      juniorApprovalRecord.digitalSignature = JSON.stringify(parsedEnvelope);

      // Re-evaluate quorum: Junior approval must now be EXCLUDED due to tampered signature!
      const quorumAfterTamper = await cryptoService.evaluateQuorum(sampleVersionId);
      expect(quorumAfterTamper.approvedCount).toBe(1); // Only senior approval counts
      expect(quorumAfterTamper.isQuorumMet).toBe(false); // Quorum broken due to signature tampering!
    });
  });
});

