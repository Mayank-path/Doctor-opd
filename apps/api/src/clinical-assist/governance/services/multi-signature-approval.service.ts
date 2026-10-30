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
import { PrismaService } from '../../../prisma/prisma.service';
import {
  APPROVAL_VALIDITY_MONTHS,
  DOMAIN_QUORUM_RULES,
  GovernanceAuditAction,
  PublicKeyStatus,
  ReviewerVerificationStatus,
} from '../constants/governance.constants';
import {
  QuorumApprovalSummary,
  QuorumStatusResponseDto,
} from '../dto/quorum-status-response.dto';
import { SubmitApprovalDto } from '../dto/submit-approval.dto';
import {
  serializeAttestationPayload,
  SignedAttestationEnvelope,
} from '../interfaces/attestation.interface';
import { ClinicalGovernanceAuthorizationService } from './clinical-governance-authorization.service';
import { CryptographicAttestationService } from './cryptographic-attestation.service';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { ReviewerCredentialingService } from './reviewer-credentialing.service';
import { ReviewerKeyManagementService } from './reviewer-key-management.service';

@Injectable()
export class MultiSignatureApprovalService {
  private readonly logger = new Logger(MultiSignatureApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialingService: ReviewerCredentialingService,
    private readonly authService: ClinicalGovernanceAuthorizationService,
    private readonly auditService: KnowledgePackGovernanceAuditService,
    private readonly attestationService: CryptographicAttestationService,
    private readonly keyManagementService: ReviewerKeyManagementService,
  ) {}

  /**
   * Submit a formal clinical approval for an immutable knowledge-pack version
   * bound cryptographically to its exact canonical SHA-256 checksum.
   */
  async submitApproval(
    dto: SubmitApprovalDto,
    requestingUserId: string,
  ): Promise<{
    approvalId: string;
    verdict: string;
    checksumSha256: string;
    quorumStatus: QuorumStatusResponseDto;
  }> {
    // Identity Spoofing Protection: Never trust client-provided reviewerUserId
    if (dto.reviewerUserId && dto.reviewerUserId !== requestingUserId) {
      this.logger.warn(
        `Identity spoofing attempt: Principal ${requestingUserId} attempted to submit approval as reviewer ${dto.reviewerUserId}.`,
      );
      throw new ForbiddenException(
        'Identity Spoofing Violation: reviewerUserId cannot differ from authenticated principal.',
      );
    }
    const verifiedReviewerUserId = requestingUserId;

    // 1. Fetch the target version
    const version = await this.prisma.knowledgePackVersion.findUnique({
      where: { id: dto.versionId },
      include: {
        pack: true,
        approvals: true,
      },
    });

    if (!version) {
      throw new NotFoundException(
        `KnowledgePackVersion with ID ${dto.versionId} not found.`,
      );
    }

    const domain = version.pack.domain;
    const authorUserId = version.authorUserId;

    // 2. Legacy Record Authorship Invariant (Phase 5C.3.1):
    // Existing legacy versions without an author must NOT be silently assigned an arbitrary author.
    // Legacy records must fail closed for governance approval until their authorship is legitimately established.
    if (!authorUserId) {
      this.logger.warn(
        `Governance failure: Version ${version.id} does not have an established author identity (authorUserId is null). Failing closed.`,
      );
      throw new ForbiddenException(
        `Legacy KnowledgePackVersion ${version.id} lacks an established author identity (authorUserId is null). Governance approval is blocked until authorship is legitimately recorded.`,
      );
    }

    // 3. Four-Eyes Policy: Author cannot review or approve their own version
    this.authService.validateAuthorExclusion(authorUserId, verifiedReviewerUserId);

    // 4. Conflict-of-Interest Verification: Material COI requires immediate recusal
    try {
      this.authService.validateConflictOfInterest(
        dto.coiDeclared,
        dto.hasMaterialConflict,
        dto.coiDetails,
      );
    } catch (error) {
      if (dto.hasMaterialConflict) {
        await this.auditService.logEvent({
          versionId: version.id,
          action: GovernanceAuditAction.APPROVAL_REJECTED_COI,
          actorUserId: verifiedReviewerUserId,
          checksumSha256: version.checksumSha256,
          metadataJson: {
            reason: 'Material conflict of interest declared',
            coiDetails: dto.coiDetails,
          },
        });
      }
      throw error;
    }

    // 5. Assert Reviewer Eligibility (Active, Verified, Specialty Match, Not Expired)
    const credential = await this.authService.assertReviewerEligible(
      verifiedReviewerUserId,
      domain,
    );

    // 6. Exact Relational Checksum Binding: Must match version checksum exactly
    if (
      !dto.checksumSha256 ||
      dto.checksumSha256.toLowerCase() !== version.checksumSha256.toLowerCase()
    ) {
      this.logger.warn(
        `Approval rejected: Checksum mismatch for version ${version.id}. Version: ${version.checksumSha256}, Submitted: ${dto.checksumSha256}`,
      );
      await this.auditService.logEvent({
        versionId: version.id,
        action: GovernanceAuditAction.APPROVAL_REJECTED_UNAUTHORIZED,
        actorUserId: verifiedReviewerUserId,
        checksumSha256: version.checksumSha256,
        metadataJson: {
          reason: 'Checksum mismatch',
          submittedChecksum: dto.checksumSha256,
          expectedChecksum: version.checksumSha256,
        },
      });
      throw new BadRequestException(
        `Integrity Checksum Mismatch: Submitted checksumSha256 does not match canonical version checksum. (Version: ${version.checksumSha256}, Submitted: ${dto.checksumSha256})`,
      );
    }

    // 7. Duplicate Reviewer Check: Prevent duplicate approvals by same reviewer identity or registration
    const existingReviewerApproval = version.approvals.find(
      (a) =>
        a.reviewerUserId === verifiedReviewerUserId ||
        a.medicalRegistration?.trim().toUpperCase() ===
          credential.medicalRegistration.trim().toUpperCase(),
    );

    if (existingReviewerApproval) {
      throw new ConflictException(
        `Duplicate Approval: Reviewer ${credential.clinicianName} (${credential.medicalRegistration}) has already submitted a review approval for version ${version.id}.`,
      );
    }

    // 8. Cryptographic Attestation Verification (Phase 5C.4):
    if (dto.digitalSignature) {
      let envelope: SignedAttestationEnvelope;
      try {
        envelope = JSON.parse(dto.digitalSignature);
      } catch (parseErr: any) {
        throw new BadRequestException(
          'Malformed digitalSignature: Must be a valid JSON-encoded SignedAttestationEnvelope.',
        );
      }

      await this.attestationService.verifyAttestationEnvelope(
        envelope,
        version,
        verifiedReviewerUserId,
      );

      await this.auditService.logEvent({
        versionId: version.id,
        action: GovernanceAuditAction.APPROVAL_ATTESTATION_SIGNED,
        actorUserId: verifiedReviewerUserId,
        checksumSha256: version.checksumSha256,
        metadataJson: {
          keyFingerprint: envelope.keyFingerprint,
          algorithm: envelope.algorithm,
          nonce: envelope.payload.nonce,
        },
      });
    }

    // 9. Calculate Approval Expiration (Default: 24 months from signedAt)
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + APPROVAL_VALIDITY_MONTHS * 30.4375 * 24 * 60 * 60 * 1000,
    );

    // 10. Create Approval Record in Database
    const createdApproval = await this.prisma.clinicalReviewApproval.create({
      data: {
        versionId: version.id,
        reviewerUserId: credential.userId,
        clinicianName: credential.clinicianName,
        medicalRegistration: credential.medicalRegistration,
        stateMedicalCouncil: credential.stateMedicalCouncil,
        qualification:
          credential.specialtyQualification ||
          credential.primaryQualification,
        specialty: credential.specialty,
        checksumSha256: version.checksumSha256,
        approvalVerdict: dto.approvalVerdict,
        reviewNotes: dto.reviewNotes,
        coiDeclared: dto.coiDeclared,
        coiDetails: dto.coiDetails || null,
        digitalSignature: dto.digitalSignature || null,
        expiresAt,
        signedAt: now,
      },
    });

    // 10. Log Governance Audit Ledger Entry
    await this.auditService.logEvent({
      versionId: version.id,
      action: GovernanceAuditAction.APPROVAL_RECORDED,
      actorUserId: verifiedReviewerUserId,
      checksumSha256: version.checksumSha256,
      metadataJson: {
        approvalId: createdApproval.id,
        verdict: dto.approvalVerdict,
        clinicianName: credential.clinicianName,
        medicalRegistration: credential.medicalRegistration,
        specialty: credential.specialty,
        isSeniorReviewer: credential.isSeniorReviewer,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // 11. Re-evaluate Quorum and return status
    const quorumStatus = await this.evaluateQuorum(version.id);

    return {
      approvalId: createdApproval.id,
      verdict: createdApproval.approvalVerdict,
      checksumSha256: version.checksumSha256,
      quorumStatus,
    };
  }

  /**
   * Evaluate multi-signature quorum for a knowledge-pack version.
   * Checks domain rules, senior reviewer presence, credential validity, and exact checksum binding.
   */
  async evaluateQuorum(versionId: string): Promise<QuorumStatusResponseDto> {
    const version = await this.prisma.knowledgePackVersion.findUnique({
      where: { id: versionId },
      include: {
        pack: true,
        approvals: true,
      },
    });

    if (!version) {
      throw new NotFoundException(
        `KnowledgePackVersion with ID ${versionId} not found.`,
      );
    }

    const domain = version.pack.domain;
    const quorumRule = DOMAIN_QUORUM_RULES[domain] || {
      domain,
      minIndependentApprovals: 2,
      minSeniorReviewers: 1,
      seniorExperienceYears: 10,
      acceptedSpecialties: [],
    };

    const missingRequirements: string[] = [];
    const validApprovals: QuorumApprovalSummary[] = [];
    const seenReviewerUserIds = new Set<string>();
    const seenRegistrations = new Set<string>();
    let seniorReviewerCount = 0;

    for (const approval of version.approvals) {
      // 1. Must be verdict APPROVED
      if (approval.approvalVerdict !== 'APPROVED') {
        continue;
      }

      // 2. Strict Relational Checksum Binding Check (Phase 5C.2.1)
      if (
        !approval.checksumSha256 ||
        approval.checksumSha256.toLowerCase() !==
          version.checksumSha256.toLowerCase()
      ) {
        this.logger.warn(
          `Quorum audit: Approval ${approval.id} has invalid or mismatched checksum (${approval.checksumSha256}). Excluded from quorum.`,
        );
        continue;
      }

      // 3. Expiration Check
      if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
        this.logger.warn(
          `Quorum audit: Approval ${approval.id} expired on ${approval.expiresAt}. Excluded from quorum.`,
        );
        continue;
      }

      // 4. Reviewer Identity & Credential Check
      if (!approval.reviewerUserId) {
        this.logger.warn(
          `Quorum audit: Approval ${approval.id} has no linked reviewerUserId (legacy unverified record). Excluded from quorum.`,
        );
        continue;
      }

      // Prevent duplicate count of same reviewer
      if (seenReviewerUserIds.has(approval.reviewerUserId)) {
        continue;
      }
      const regKey = approval.medicalRegistration?.trim().toUpperCase();
      if (regKey && seenRegistrations.has(regKey)) {
        continue;
      }

      // Verify active, non-expired credentials from ReviewerCredentialingService
      const credential =
        await this.credentialingService.getCredentialEntityByUserId(
          approval.reviewerUserId,
        );

      if (
        !credential ||
        credential.verificationStatus !== ReviewerVerificationStatus.VERIFIED ||
        !credential.isActive ||
        (credential.credentialsExpiresAt &&
          new Date(credential.credentialsExpiresAt) < new Date())
      ) {
        this.logger.warn(
          `Quorum audit: Reviewer ${approval.reviewerUserId} does not hold active verified credentials. Excluded from quorum.`,
        );
        continue;
      }

      // Author exclusion check
      const authorUserId = (version as any).authorUserId;
      if (authorUserId && authorUserId === approval.reviewerUserId) {
        this.logger.warn(
          `Quorum audit: Reviewer ${approval.reviewerUserId} is the author. Excluded from quorum.`,
        );
        continue;
      }

      // Cryptographic signature check (Phase 5C.4):
      if (approval.digitalSignature) {
        try {
          const envelope: SignedAttestationEnvelope = JSON.parse(
            approval.digitalSignature,
          );
          let signingKey =
            await this.keyManagementService.getPublicKeyByFingerprint(
              envelope.keyFingerprint,
            );
          if (!signingKey) {
            signingKey = await this.keyManagementService.getActivePublicKey(
              approval.reviewerUserId,
            );
          }

          if (!signingKey) {
            this.logger.warn(
              `Quorum audit: Approval ${approval.id} signed with unrecorded key. Excluded from quorum.`,
            );
            continue;
          }

          if (signingKey.reviewerUserId !== approval.reviewerUserId) {
            this.logger.warn(
              `Quorum audit: Approval ${approval.id} key belongs to another reviewer. Excluded from quorum.`,
            );
            continue;
          }

          // Key Lifecycle Semantics:
          // A. REVOKED keys: strictly excluded from quorum
          if (signingKey.status === PublicKeyStatus.REVOKED) {
            this.logger.warn(
              `Quorum audit: Approval ${approval.id} key is REVOKED. Excluded from quorum.`,
            );
            continue;
          }

          // B. ROTATED keys: valid if signed before rotation
          if (signingKey.status === PublicKeyStatus.ROTATED) {
            const signedAt = new Date(envelope.payload.signedAt);
            if (signedAt > signingKey.updatedAt) {
              this.logger.warn(
                `Quorum audit: Approval ${approval.id} signed after key rotation. Excluded from quorum.`,
              );
              continue;
            }
          }

          // C. EXPIRED keys: valid if signed before expiration
          if (signingKey.status === PublicKeyStatus.EXPIRED) {
            const signedAt = new Date(envelope.payload.signedAt);
            if (signedAt > signingKey.expiresAt) {
              this.logger.warn(
                `Quorum audit: Approval ${approval.id} signed after key expiration. Excluded from quorum.`,
              );
              continue;
            }
          }

          const canonical = serializeAttestationPayload(envelope.payload);
          const pubKeyObj =
            this.keyManagementService.parseAndValidateEd25519Key(
              signingKey.publicKeyPem,
            );
          const isValid = crypto.verify(
            null,
            Buffer.from(canonical, 'utf8'),
            pubKeyObj,
            Buffer.from(envelope.signature, 'base64'),
          );
          if (!isValid) {
            this.logger.warn(
              `Quorum audit: Approval ${approval.id} failed Ed25519 verification. Excluded from quorum.`,
            );
            continue;
          }
        } catch (sigErr: any) {
          this.logger.warn(
            `Quorum audit: Malformed signature on approval ${approval.id}: ${sigErr.message}. Excluded from quorum.`,
          );
          continue;
        }
      }

      seenReviewerUserIds.add(approval.reviewerUserId);
      if (regKey) seenRegistrations.add(regKey);

      const isSenior =
        credential.isSeniorReviewer ||
        credential.yearsOfExperience >= quorumRule.seniorExperienceYears;
      if (isSenior) {
        seniorReviewerCount++;
      }

      validApprovals.push({
        approvalId: approval.id,
        reviewerUserId: approval.reviewerUserId,
        clinicianName: approval.clinicianName,
        medicalRegistration: approval.medicalRegistration,
        specialty: approval.specialty,
        qualification: approval.qualification,
        isSeniorReviewer: isSenior,
        yearsOfExperience: credential.yearsOfExperience,
        signedAt: approval.signedAt,
        expiresAt: approval.expiresAt,
        checksumSha256: approval.checksumSha256,
        approvalVerdict: approval.approvalVerdict,
      });
    }

    const approvedCount = validApprovals.length;

    if (approvedCount < quorumRule.minIndependentApprovals) {
      missingRequirements.push(
        `Requires at least ${quorumRule.minIndependentApprovals} independent specialist approvals (Current: ${approvedCount}).`,
      );
    }

    if (seniorReviewerCount < quorumRule.minSeniorReviewers) {
      missingRequirements.push(
        `Requires at least ${quorumRule.minSeniorReviewers} senior specialist reviewer with >= ${quorumRule.seniorExperienceYears} years of experience (Current: ${seniorReviewerCount}).`,
      );
    }

    const isQuorumMet = missingRequirements.length === 0;

    // If quorum is satisfied and version is in IN_REVIEW, transition to APPROVED
    if (
      isQuorumMet &&
      version.releaseStatus === KnowledgePackReleaseStatus.IN_REVIEW
    ) {
      await this.prisma.knowledgePackVersion.update({
        where: { id: version.id },
        data: {
          releaseStatus: KnowledgePackReleaseStatus.APPROVED,
        },
      });

      await this.auditService.logEvent({
        versionId: version.id,
        action: GovernanceAuditAction.VERSION_STATUS_TRANSITION,
        actorUserId: validApprovals[0]?.reviewerUserId || 'system',
        checksumSha256: version.checksumSha256,
        fromStatus: KnowledgePackReleaseStatus.IN_REVIEW,
        toStatus: KnowledgePackReleaseStatus.APPROVED,
        metadataJson: {
          reason: 'Multi-signature quorum satisfied',
          approvedCount,
          seniorReviewerCount,
        },
      });
    }

    const semver = `${version.majorVersion}.${version.minorVersion}.${version.patchVersion}`;

    return {
      versionId: version.id,
      domain,
      semver,
      releaseStatus: version.releaseStatus,
      currentChecksumSha256: version.checksumSha256,
      requiredQuorum: quorumRule.minIndependentApprovals,
      approvedCount,
      seniorReviewerCount,
      isQuorumMet,
      missingRequirements,
      approvals: validApprovals,
    };
  }

  /**
   * Invalidate previous approvals when content change is detected.
   * Resets version status back to DRAFT.
   */
  async invalidateApprovalsOnContentChange(
    versionId: string,
    newChecksum: string,
    actorUserId: string,
  ): Promise<void> {
    const version = await this.prisma.knowledgePackVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException(
        `KnowledgePackVersion with ID ${versionId} not found.`,
      );
    }

    if (version.checksumSha256.toLowerCase() === newChecksum.toLowerCase()) {
      return; // Checksum unchanged
    }

    const previousStatus = version.releaseStatus;

    await this.prisma.knowledgePackVersion.update({
      where: { id: versionId },
      data: {
        checksumSha256: newChecksum,
        releaseStatus: KnowledgePackReleaseStatus.DRAFT,
      },
    });

    await this.auditService.logEvent({
      versionId,
      action: GovernanceAuditAction.APPROVALS_INVALIDATED_CHECKSUM_CHANGED,
      actorUserId,
      checksumSha256: newChecksum,
      fromStatus: previousStatus,
      toStatus: KnowledgePackReleaseStatus.DRAFT,
      metadataJson: {
        reason: 'Content modified; canonical checksum changed. Prior approvals invalidated.',
        oldChecksum: version.checksumSha256,
        newChecksum,
      },
    });

    this.logger.warn(
      `Version ${versionId} content changed. Prior approvals invalidated; status reset to DRAFT.`,
    );
  }
}

