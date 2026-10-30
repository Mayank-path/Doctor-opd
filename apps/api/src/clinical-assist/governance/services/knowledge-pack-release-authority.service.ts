import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
  DOMAIN_QUORUM_RULES,
  GovernanceAuditAction,
  PublicKeyStatus,
  ReviewerVerificationStatus,
} from '../constants/governance.constants';
import { ActivateReleaseDto } from '../dto/activate-release.dto';
import { EmergencyDeactivateReleaseDto } from '../dto/emergency-deactivate-release.dto';
import { RollbackReleaseDto } from '../dto/rollback-release.dto';
import {
  AttestationPayload,
  serializeAttestationPayload,
  SignedAttestationEnvelope,
} from '../interfaces/attestation.interface';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { MultiSignatureApprovalService } from './multi-signature-approval.service';
import { ReviewerCredentialingService } from './reviewer-credentialing.service';
import { ReviewerKeyManagementService } from './reviewer-key-management.service';

export interface PreReleaseVerificationResult {
  eligible: boolean;
  versionId: string;
  domain: KnowledgePackDomain;
  checksumSha256: string;
  approvedCount: number;
  seniorReviewerCount: number;
  missingRequirements: string[];
}

@Injectable()
export class KnowledgePackReleaseAuthorityService {
  private readonly logger = new Logger(
    KnowledgePackReleaseAuthorityService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly multiSigService: MultiSignatureApprovalService,
    private readonly credentialingService: ReviewerCredentialingService,
    private readonly keyManagementService: ReviewerKeyManagementService,
    private readonly auditService: KnowledgePackGovernanceAuditService,
    private readonly resolverService: KnowledgePackResolverService,
  ) {}

  /**
   * Activates a knowledge-pack release for a given scope (GLOBAL or CLINIC).
   * Enforces strict Four-Eyes Policy, multi-signature quorum, Ed25519 verification,
   * key lifecycle semantics, and atomic activation.
   */
  async activateRelease(
    dto: ActivateReleaseDto,
    actorUserId: string,
    activeClinicContext?: { clinicId?: string; isPlatformAdmin?: boolean },
  ): Promise<any> {
    // 1. Identify Release Officer & Prevent Spoofing
    if (dto.releasedByUserId && dto.releasedByUserId !== actorUserId) {
      this.logger.warn(
        `Identity spoofing attempt: Principal ${actorUserId} attempted to activate release as ${dto.releasedByUserId}`,
      );
      throw new ForbiddenException(
        'Release Authority Violation: releasedByUserId does not match authenticated principal identity.',
      );
    }

    // 2. Load target KnowledgePackVersion with full graph
    const version = await this.prisma.knowledgePackVersion.findUnique({
      where: { id: dto.versionId },
      include: {
        pack: true,
        conditions: {
          include: {
            rules: {
              include: {
                sourceReferences: {
                  include: {
                    source: true,
                  },
                },
              },
            },
          },
        },
        redFlagRules: true,
        sources: true,
        approvals: true,
      },
    });

    if (!version) {
      throw new NotFoundException(
        `Knowledge-pack version with ID ${dto.versionId} not found.`,
      );
    }

    // 3. Four-Eyes Policy: Release Authority != Author
    if (!version.authorUserId) {
      this.logger.warn(
        `Release rejected: Version ${version.id} has no authorUserId. Failing closed.`,
      );
      throw new BadRequestException(
        'Four-Eyes Governance Failure: Knowledge-pack version does not have an established author identity. Unattributed packs cannot be released.',
      );
    }

    if (version.authorUserId === actorUserId) {
      this.logger.warn(
        `Four-Eyes violation: Author ${actorUserId} attempted to release own version ${version.id}.`,
      );
      await this.auditService.logEvent({
        versionId: version.id,
        action: GovernanceAuditAction.RELEASE_ATTEMPT_REJECTED,
        actorUserId,
        checksumSha256: version.checksumSha256,
        metadataJson: {
          reason: 'Four-Eyes violation: Author attempted to act as release authority.',
        },
      });
      throw new ForbiddenException(
        'Four-Eyes Principle Violation: The author of a knowledge pack is strictly forbidden from acting as its release authority.',
      );
    }

    // 4. Four-Eyes Policy: Release Authority != Any Approving Reviewer
    const isApprovingReviewer = version.approvals.some(
      (a) => a.reviewerUserId === actorUserId,
    );
    if (isApprovingReviewer) {
      this.logger.warn(
        `Four-Eyes violation: Reviewer ${actorUserId} attempted to release version ${version.id} which they approved.`,
      );
      await this.auditService.logEvent({
        versionId: version.id,
        action: GovernanceAuditAction.RELEASE_ATTEMPT_REJECTED,
        actorUserId,
        checksumSha256: version.checksumSha256,
        metadataJson: {
          reason: 'Four-Eyes violation: Reviewer attempted to act as release authority.',
        },
      });
      throw new ForbiddenException(
        'Four-Eyes Principle Violation: A clinical reviewer who approved this version is strictly forbidden from acting as its release authority.',
      );
    }

    // 5. Version Lifecycle State Check: Must be APPROVED (or already RELEASED when deploying to a tenant scope)
    if (
      version.releaseStatus !== KnowledgePackReleaseStatus.APPROVED &&
      version.releaseStatus !== KnowledgePackReleaseStatus.RELEASED
    ) {
      this.logger.warn(
        `Release rejected: Version ${version.id} is in status ${version.releaseStatus}. Only APPROVED versions can be released.`,
      );
      throw new BadRequestException(
        `Lifecycle Safety Violation: Cannot release version in '${version.releaseStatus}' state. Version must be 'APPROVED' before release.`,
      );
    }

    // 6. Pre-Release Verification (Quorum, Signatures, Credentials, Checksum, Keys)
    await this.verifyPreReleaseIntegrity(version);

    // 7. Determine Scope & Tenant Boundaries
    let targetClinicId: string | null = null;
    if (dto.scope === 'GLOBAL') {
      targetClinicId = null;
    } else if (dto.scope === 'CLINIC') {
      targetClinicId = dto.clinicId || activeClinicContext?.clinicId || null;
      if (!targetClinicId) {
        throw new BadRequestException(
          'clinicId is required for CLINIC scoped releases.',
        );
      }

      // Cross-Tenant Boundary Enforcement
      if (
        activeClinicContext?.clinicId &&
        activeClinicContext.clinicId !== targetClinicId &&
        !activeClinicContext.isPlatformAdmin
      ) {
        throw new ForbiddenException(
          `Tenant Boundary Violation: Caller clinic (${activeClinicContext.clinicId}) cannot release packs for target clinic (${targetClinicId}).`,
        );
      }
    }

    const domain = version.pack.domain;

    // 8. Atomic Activation Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Deactivate any currently active release for this scope and domain
      await tx.knowledgePackRelease.updateMany({
        where: {
          clinicId: targetClinicId,
          domain,
          isActive: true,
        },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: `Superseded by release of version ${version.majorVersion}.${version.minorVersion}.${version.patchVersion}`,
        },
      });

      // Upsert new active release
      const existingRelease = await tx.knowledgePackRelease.findFirst({
        where: {
          clinicId: targetClinicId,
          versionId: version.id,
        },
      });

      let release: any;
      if (existingRelease) {
        release = await tx.knowledgePackRelease.update({
          where: { id: existingRelease.id },
          data: {
            isActive: true,
            releasedByUserId: actorUserId,
            releaseNotes: dto.releaseNotes || null,
            domain,
            activatedAt: now,
            deactivatedAt: null,
            deactivationReason: null,
          },
        });
      } else {
        release = await tx.knowledgePackRelease.create({
          data: {
            clinicId: targetClinicId,
            versionId: version.id,
            domain,
            isActive: true,
            releasedByUserId: actorUserId,
            releaseNotes: dto.releaseNotes || null,
            activatedAt: now,
          },
        });
      }

      // Transition Version Status to RELEASED
      await tx.knowledgePackVersion.update({
        where: { id: version.id },
        data: {
          releaseStatus: KnowledgePackReleaseStatus.RELEASED,
          publishedAt: now,
        },
      });

      // Immutable Governance Audit Ledger Entry
      await tx.knowledgePackGovernanceAudit.create({
        data: {
          versionId: version.id,
          action: GovernanceAuditAction.RELEASE_ACTIVATED,
          actorUserId,
          checksumSha256: version.checksumSha256,
          fromStatus: version.releaseStatus,
          toStatus: KnowledgePackReleaseStatus.RELEASED,
          metadataJson: {
            releaseId: release.id,
            scope: dto.scope,
            clinicId: targetClinicId,
            domain,
            versionSemver: `${version.majorVersion}.${version.minorVersion}.${version.patchVersion}`,
            releaseNotes: dto.releaseNotes || null,
          },
        },
      });

      return release;
    });

    this.logger.log(
      `Knowledge Pack Release ACTIVATED: ID ${result.id} (Version: ${version.id}, Scope: ${dto.scope}, Clinic: ${targetClinicId}, Domain: ${domain}) by Release Officer ${actorUserId}`,
    );

    return {
      releaseId: result.id,
      versionId: version.id,
      domain,
      scope: dto.scope,
      clinicId: targetClinicId,
      isActive: true,
      activatedAt: result.activatedAt,
      versionSemver: `${version.majorVersion}.${version.minorVersion}.${version.patchVersion}`,
    };
  }

  /**
   * Emergency deactivates an active knowledge pack release.
   */
  async emergencyDeactivate(
    releaseId: string,
    dto: EmergencyDeactivateReleaseDto,
    actorUserId: string,
    activeClinicContext?: { clinicId?: string; isPlatformAdmin?: boolean },
  ): Promise<any> {
    if (dto.deactivatedByUserId && dto.deactivatedByUserId !== actorUserId) {
      throw new ForbiddenException(
        'Identity spoofing: deactivatedByUserId does not match authenticated principal.',
      );
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException(
        'Emergency deactivation requires a mandatory justification of at least 10 characters.',
      );
    }

    const release = await this.prisma.knowledgePackRelease.findUnique({
      where: { id: releaseId },
      include: { version: { include: { pack: true } } },
    });

    if (!release) {
      throw new NotFoundException(`Release with ID ${releaseId} not found.`);
    }

    // Tenant Isolation Check
    if (
      release.clinicId &&
      activeClinicContext?.clinicId &&
      release.clinicId !== activeClinicContext.clinicId &&
      !activeClinicContext.isPlatformAdmin
    ) {
      throw new ForbiddenException(
        'Tenant boundary violation: Cannot deactivate a release belonging to another clinic.',
      );
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const deact = await tx.knowledgePackRelease.update({
        where: { id: releaseId },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: `EMERGENCY_DEACTIVATION: ${dto.reason.trim()}`,
        },
      });

      await tx.knowledgePackGovernanceAudit.create({
        data: {
          versionId: release.versionId,
          action: GovernanceAuditAction.EMERGENCY_DEACTIVATION,
          actorUserId,
          checksumSha256: release.version.checksumSha256,
          metadataJson: {
            releaseId: release.id,
            reason: dto.reason.trim(),
            domain: release.domain,
            clinicId: release.clinicId,
          },
        },
      });

      return deact;
    });

    this.logger.warn(
      `EMERGENCY DEACTIVATION executed on release ${releaseId} by ${actorUserId}. Reason: ${dto.reason}`,
    );

    return {
      releaseId: updated.id,
      isActive: false,
      deactivatedAt: updated.deactivatedAt,
      deactivationReason: updated.deactivationReason,
    };
  }

  /**
   * Rolls back an active release to a specified prior eligible version.
   */
  async rollbackRelease(
    releaseId: string,
    dto: RollbackReleaseDto,
    actorUserId: string,
    activeClinicContext?: { clinicId?: string; isPlatformAdmin?: boolean },
  ): Promise<any> {
    if (dto.actorUserId && dto.actorUserId !== actorUserId) {
      throw new ForbiddenException(
        'Identity spoofing: actorUserId does not match authenticated principal.',
      );
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException(
        'Release rollback requires a mandatory clinical justification of at least 10 characters.',
      );
    }

    const currentRelease = await this.prisma.knowledgePackRelease.findUnique({
      where: { id: releaseId },
      include: { version: { include: { pack: true } } },
    });

    if (!currentRelease) {
      throw new NotFoundException(`Release with ID ${releaseId} not found.`);
    }

    // Tenant boundary check
    if (
      currentRelease.clinicId &&
      activeClinicContext?.clinicId &&
      currentRelease.clinicId !== activeClinicContext.clinicId &&
      !activeClinicContext.isPlatformAdmin
    ) {
      throw new ForbiddenException(
        'Tenant boundary violation: Cannot rollback a release belonging to another clinic.',
      );
    }

    // Load and verify target version eligibility
    const targetVersion = await this.prisma.knowledgePackVersion.findUnique({
      where: { id: dto.targetVersionId },
      include: {
        pack: true,
        conditions: {
          include: {
            rules: {
              include: {
                sourceReferences: {
                  include: {
                    source: true,
                  },
                },
              },
            },
          },
        },
        redFlagRules: true,
        sources: true,
        approvals: true,
      },
    });

    if (!targetVersion) {
      throw new NotFoundException(
        `Rollback target version with ID ${dto.targetVersionId} not found.`,
      );
    }

    // Target version must match the same domain
    if (targetVersion.pack.domain !== currentRelease.domain) {
      throw new BadRequestException(
        `Domain mismatch: Target version domain (${targetVersion.pack.domain}) does not match release domain (${currentRelease.domain}).`,
      );
    }

    // Target version must satisfy pre-release integrity (quorum, valid approvals, signatures, checksum)
    await this.verifyPreReleaseIntegrity(targetVersion);

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deactivate current release
      await tx.knowledgePackRelease.update({
        where: { id: currentRelease.id },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: `ROLLED_BACK: ${dto.reason.trim()}`,
        },
      });

      // 2. Mark current version as ROLLED_BACK
      await tx.knowledgePackVersion.update({
        where: { id: currentRelease.versionId },
        data: {
          releaseStatus: KnowledgePackReleaseStatus.ROLLED_BACK,
        },
      });

      // 3. Activate target version release
      const existingTargetRelease = await tx.knowledgePackRelease.findFirst({
        where: {
          clinicId: currentRelease.clinicId,
          versionId: targetVersion.id,
        },
      });

      let newRelease: any;
      if (existingTargetRelease) {
        newRelease = await tx.knowledgePackRelease.update({
          where: { id: existingTargetRelease.id },
          data: {
            isActive: true,
            releasedByUserId: actorUserId,
            releaseNotes: `Rollback activation: ${dto.reason.trim()}`,
            domain: targetVersion.pack.domain,
            activatedAt: now,
            deactivatedAt: null,
            deactivationReason: null,
          },
        });
      } else {
        newRelease = await tx.knowledgePackRelease.create({
          data: {
            clinicId: currentRelease.clinicId,
            versionId: targetVersion.id,
            domain: targetVersion.pack.domain,
            isActive: true,
            releasedByUserId: actorUserId,
            releaseNotes: `Rollback activation: ${dto.reason.trim()}`,
            activatedAt: now,
          },
        });
      }

      // 4. Ensure target version status is RELEASED
      await tx.knowledgePackVersion.update({
        where: { id: targetVersion.id },
        data: {
          releaseStatus: KnowledgePackReleaseStatus.RELEASED,
        },
      });

      // 5. Governance Audit Log
      await tx.knowledgePackGovernanceAudit.create({
        data: {
          versionId: targetVersion.id,
          action: GovernanceAuditAction.RELEASE_ROLLED_BACK,
          actorUserId,
          checksumSha256: targetVersion.checksumSha256,
          fromStatus: currentRelease.version.releaseStatus,
          toStatus: KnowledgePackReleaseStatus.RELEASED,
          metadataJson: {
            rolledBackReleaseId: currentRelease.id,
            rolledBackVersionId: currentRelease.versionId,
            newReleaseId: newRelease.id,
            reason: dto.reason.trim(),
            domain: targetVersion.pack.domain,
            clinicId: currentRelease.clinicId,
          },
        },
      });

      return newRelease;
    });

    this.logger.log(
      `Rollback executed: Release ${releaseId} rolled back to version ${targetVersion.id} by ${actorUserId}`,
    );

    return {
      releaseId: result.id,
      versionId: targetVersion.id,
      isActive: true,
      activatedAt: result.activatedAt,
      versionSemver: `${targetVersion.majorVersion}.${targetVersion.minorVersion}.${targetVersion.patchVersion}`,
    };
  }

  /**
   * Rigorous Pre-Release Verification of a knowledge-pack version before release is permitted:
   * 1. Multi-signature quorum satisfaction.
   * 2. Senior reviewer experience requirement.
   * 3. Reviewer credential validity and non-expiry.
   * 4. Relational checksum exact match (recomputed from complete canonical content).
   * 5. Ed25519 digital signature validation for every approval contributing to quorum.
   * 6. Key lifecycle semantics (ACTIVE, ROTATED, REVOKED, EXPIRED).
   * 7. Conflict of interest recusal checks.
   * 8. Four-Eyes author exclusion.
   */
  async verifyPreReleaseIntegrity(version: any): Promise<void> {
    const domain = version.pack.domain as KnowledgePackDomain;
    const quorumRules = DOMAIN_QUORUM_RULES[domain];

    // 1. Quorum Evaluation
    const quorum = await this.multiSigService.evaluateQuorum(version.id);
    if (!quorum.isQuorumMet) {
      throw new BadRequestException(
        `Pre-Release Verification Failed: Quorum not satisfied. Missing requirements: ${quorum.missingRequirements.join('; ')}`,
      );
    }

    if (quorum.approvedCount < quorumRules.minIndependentApprovals) {
      throw new BadRequestException(
        `Pre-Release Verification Failed: Approved review count (${quorum.approvedCount}) is below required minimum (${quorumRules.minIndependentApprovals}).`,
      );
    }

    if (quorum.seniorReviewerCount < quorumRules.minSeniorReviewers) {
      throw new BadRequestException(
        `Pre-Release Verification Failed: Senior reviewer count (${quorum.seniorReviewerCount}) is below required minimum (${quorumRules.minSeniorReviewers}).`,
      );
    }

    // 2. Recompute Content Checksum from Canonical Content
    const reconstructedSeed =
      this.resolverService.reconstructSeedFromVersion(version);
    const recomputedChecksum = computeCanonicalChecksum(reconstructedSeed);

    if (
      recomputedChecksum.toLowerCase() !== version.checksumSha256.toLowerCase()
    ) {
      throw new BadRequestException(
        `Pre-Release Verification Failed: Checksum drift detected. Recomputed content checksum (${recomputedChecksum}) does not match stored version checksum (${version.checksumSha256}).`,
      );
    }

    // 3. Verify each approval's credentials, checksum binding, and Ed25519 signature
    const validApprovals = version.approvals.filter(
      (a: any) => a.approvalVerdict === 'APPROVED',
    );

    for (const approval of validApprovals) {
      // Checksum binding check
      if (
        !approval.checksumSha256 ||
        approval.checksumSha256.toLowerCase() !==
          version.checksumSha256.toLowerCase()
      ) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Approval ${approval.id} is bound to a mismatched checksum.`,
        );
      }

      // Approval Expiration check
      if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Approval ${approval.id} expired on ${approval.expiresAt.toISOString()}.`,
        );
      }

      // Reviewer Credential Validity
      if (!approval.reviewerUserId) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Approval ${approval.id} lacks a verified reviewerUserId.`,
        );
      }

      // Four-Eyes: Reviewer must not be the author
      if (version.authorUserId === approval.reviewerUserId) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Reviewer ${approval.reviewerUserId} is the author of this pack (Four-Eyes Violation).`,
        );
      }

      const credential =
        await this.credentialingService.getCredentialEntityByUserId(
          approval.reviewerUserId,
        );

      if (
        !credential ||
        credential.verificationStatus !== ReviewerVerificationStatus.VERIFIED ||
        !credential.isActive
      ) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Reviewer ${approval.reviewerUserId} does not possess active, VERIFIED credentials.`,
        );
      }

      if (
        credential.credentialsExpiresAt &&
        new Date(credential.credentialsExpiresAt) < new Date()
      ) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Reviewer ${approval.reviewerUserId} credentials expired on ${credential.credentialsExpiresAt.toISOString()}.`,
        );
      }

      // Conflict of Interest check
      if (!approval.coiDeclared) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Reviewer ${approval.reviewerUserId} did not declare conflict of interest.`,
        );
      }

      if (approval.coiDetails?.toUpperCase().includes('MATERIAL_CONFLICT')) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Reviewer ${approval.reviewerUserId} declared a material conflict of interest.`,
        );
      }

      // 4. Ed25519 Cryptographic Signature Verification & Key Lifecycle Evaluation
      if (!approval.digitalSignature) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Approval ${approval.id} has no Ed25519 digital signature envelope.`,
        );
      }

      let envelope: SignedAttestationEnvelope;
      try {
        envelope = JSON.parse(approval.digitalSignature);
      } catch {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Approval ${approval.id} digital signature envelope is malformed JSON.`,
        );
      }

      if (envelope.algorithm !== 'ed25519') {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Approval ${approval.id} uses unsupported algorithm '${envelope.algorithm}'. Expected 'ed25519'.`,
        );
      }

      // Find signing key in key management service
      const signingKey =
        await this.keyManagementService.getPublicKeyByFingerprint(
          envelope.keyFingerprint,
        );

      if (!signingKey) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Signing key (${envelope.keyFingerprint}) for approval ${approval.id} is not registered in governance.`,
        );
      }

      if (signingKey.reviewerUserId !== approval.reviewerUserId) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Signing key registered to ${signingKey.reviewerUserId} does not match reviewer ${approval.reviewerUserId}.`,
        );
      }

      // KEY LIFECYCLE SEMANTICS:
      // A. REVOKED: Strictly rejected! Compromised key invalidates all approvals signed with it.
      if (signingKey.status === PublicKeyStatus.REVOKED) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Signing key (${signingKey.keyFingerprint}) was REVOKED. Approvals signed with compromised keys cannot be released.`,
        );
      }

      // B. ROTATED: Historical verification policy:
      // Valid if and only if signedAt occurred before the key was rotated (updatedAt).
      if (signingKey.status === PublicKeyStatus.ROTATED) {
        const signedAtDate = new Date(envelope.payload.signedAt);
        if (signedAtDate > signingKey.updatedAt) {
          throw new BadRequestException(
            `Pre-Release Verification Failed: Signature was created after the public key was ROTATED.`,
          );
        }
      }

      // C. EXPIRED: Historical verification policy:
      // Valid if and only if signedAt occurred before the key expired.
      if (signingKey.status === PublicKeyStatus.EXPIRED) {
        const signedAtDate = new Date(envelope.payload.signedAt);
        if (signedAtDate > signingKey.expiresAt) {
          throw new BadRequestException(
            `Pre-Release Verification Failed: Signature was created after the public key EXPIRED.`,
          );
        }
      }

      // D. Mathematical Signature Check
      const canonicalPayloadString = serializeAttestationPayload(
        envelope.payload,
      );
      const pubKeyObject =
        this.keyManagementService.parseAndValidateEd25519Key(
          signingKey.publicKeyPem,
        );

      let mathValid = false;
      try {
        mathValid = crypto.verify(
          null,
          Buffer.from(canonicalPayloadString, 'utf8'),
          pubKeyObject,
          Buffer.from(envelope.signature, 'base64'),
        );
      } catch {
        mathValid = false;
      }

      if (!mathValid) {
        throw new BadRequestException(
          `Pre-Release Verification Failed: Mathematical Ed25519 signature check failed for approval ${approval.id}. Payload or signature has been tampered.`,
        );
      }
    }
  }

  /**
   * Retrieves current active release for a given domain and optional clinic scope.
   */
  async getActiveRelease(
    domain: KnowledgePackDomain,
    clinicId?: string | null,
  ): Promise<any> {
    const release = await this.prisma.knowledgePackRelease.findFirst({
      where: {
        domain,
        clinicId: clinicId ?? null,
        isActive: true,
      },
      include: {
        version: {
          include: {
            pack: true,
          },
        },
      },
    });

    if (!release) return null;

    return {
      releaseId: release.id,
      versionId: release.versionId,
      domain: release.domain,
      clinicId: release.clinicId,
      isActive: release.isActive,
      activatedAt: release.activatedAt,
      versionSemver: `${release.version.majorVersion}.${release.version.minorVersion}.${release.version.patchVersion}`,
    };
  }

  /**
   * Retrieves a release by ID.
   */
  async getReleaseById(releaseId: string): Promise<any> {
    const release = await this.prisma.knowledgePackRelease.findUnique({
      where: { id: releaseId },
      include: {
        version: {
          include: {
            pack: true,
            approvals: true,
          },
        },
        releasedBy: true,
      },
    });

    if (!release) {
      throw new NotFoundException(`Release with ID ${releaseId} not found.`);
    }

    return release;
  }
}
