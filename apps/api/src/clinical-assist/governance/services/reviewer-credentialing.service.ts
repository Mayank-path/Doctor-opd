import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KnowledgePackDomain } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CREDENTIAL_VALIDITY_MONTHS,
  DOMAIN_QUORUM_RULES,
  GovernanceAuditAction,
  ReviewerVerificationStatus,
  SENIOR_REVIEWER_EXPERIENCE_THRESHOLD_YEARS,
} from '../constants/governance.constants';
import { RejectReviewerCredentialDto } from '../dto/reject-reviewer-credential.dto';
import { SubmitReviewerCredentialDto } from '../dto/submit-reviewer-credential.dto';
import { VerifyReviewerCredentialDto } from '../dto/verify-reviewer-credential.dto';
import {
  REVIEWER_CREDENTIAL_REPOSITORY,
} from '../interfaces/reviewer-credential-repository.interface';
import type {
  IReviewerCredentialRepository,
} from '../interfaces/reviewer-credential-repository.interface';
import {
  ReviewerCredential,
  ReviewerCredentialSummary,
} from '../interfaces/reviewer-credential.interface';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';

@Injectable()
export class ReviewerCredentialingService {
  private readonly logger = new Logger(ReviewerCredentialingService.name);

  constructor(
    @Inject(REVIEWER_CREDENTIAL_REPOSITORY)
    private readonly repository: IReviewerCredentialRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: KnowledgePackGovernanceAuditService,
  ) {}

  /**
   * Submit an initial reviewer credential application.
   * Self-reported details are strictly placed into PENDING status and
   * are NEVER treated as verified clinical credentials.
   */
  async submitCredentialApplication(
    dto: SubmitReviewerCredentialDto,
    requestingUserId: string,
  ): Promise<ReviewerCredentialSummary> {
    // Identity Spoofing Protection: Never trust client-provided userId
    if (dto.userId && dto.userId !== requestingUserId) {
      this.logger.warn(
        `Identity spoofing attempt: User ${requestingUserId} attempted to submit application for ${dto.userId}`,
      );
      throw new ForbiddenException(
        'Identity Spoofing Violation: Cannot apply for reviewer credentials on behalf of another user.',
      );
    }

    const boundUserId = requestingUserId;

    // Verify user exists and is active in database
    const user = await this.prisma.user.findUnique({
      where: { id: boundUserId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${boundUserId} not found.`);
    }
    if (!user.isActive) {
      throw new ForbiddenException(`User account is inactive.`);
    }

    // Check if user already has credentials registered
    const existingByUser = await this.repository.findByUserId(boundUserId);
    if (existingByUser && existingByUser.isActive) {
      throw new ConflictException(
        `User ${boundUserId} already has an active reviewer credential record (Status: ${existingByUser.verificationStatus}).`,
      );
    }

    const normalizedReg = dto.medicalRegistration.trim().toUpperCase();

    // Check if medical registration number is already in use by another user
    const existingByReg = await this.repository.findByMedicalRegistration(
      normalizedReg,
    );
    if (
      existingByReg &&
      existingByReg.userId !== boundUserId &&
      existingByReg.isActive
    ) {
      throw new ConflictException(
        `Medical registration number ${normalizedReg} is already associated with another active user.`,
      );
    }

    const now = new Date();
    const isSenior =
      dto.yearsOfExperience >= SENIOR_REVIEWER_EXPERIENCE_THRESHOLD_YEARS;

    const newCredential: ReviewerCredential = {
      id: randomUUID(),
      userId: boundUserId,
      clinicianName: dto.clinicianName.trim(),
      medicalRegistration: normalizedReg,
      stateMedicalCouncil: dto.stateMedicalCouncil.trim(),
      registrationYear: dto.registrationYear,
      primaryQualification: dto.primaryQualification.trim(),
      specialtyQualification: dto.specialtyQualification.trim(),
      specialty: dto.specialty,
      yearsOfExperience: dto.yearsOfExperience,
      isSeniorReviewer: isSenior,
      verificationStatus: ReviewerVerificationStatus.PENDING,
      verificationEvidence: null,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      credentialsExpiresAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repository.save(newCredential);

    this.logger.log(
      `Reviewer credential application submitted: ID ${saved.id} for User ${saved.userId} (Pending Verification)`,
    );

    return this.toSummary(saved);
  }

  /**
   * Verify a reviewer's credentials.
   * This action MUST be performed by an authorized Governance Board member.
   * Evidence of verification (e.g. state medical council gazette entry or formal check)
   * must be explicitly recorded.
   */
  async verifyCredential(
    credentialId: string,
    dto: VerifyReviewerCredentialDto,
    verifierUserId: string,
  ): Promise<ReviewerCredentialSummary> {
    const credential = await this.repository.findById(credentialId);
    if (!credential) {
      throw new NotFoundException(
        `Reviewer credential with ID ${credentialId} not found.`,
      );
    }

    // Verifier cannot verify themselves
    if (credential.userId === verifierUserId) {
      throw new ForbiddenException(
        'Separation of Duties Violation: Reviewers cannot verify or credential themselves.',
      );
    }

    const now = new Date();
    const expiresAt = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(
          now.getTime() +
            CREDENTIAL_VALIDITY_MONTHS * 30.4375 * 24 * 60 * 60 * 1000,
        );

    const isSenior =
      dto.isSeniorReviewer !== undefined
        ? dto.isSeniorReviewer
        : credential.yearsOfExperience >=
          SENIOR_REVIEWER_EXPERIENCE_THRESHOLD_YEARS;

    const updated = await this.repository.update(credentialId, {
      verificationStatus: ReviewerVerificationStatus.VERIFIED,
      verificationEvidence: dto.verificationEvidence,
      verifiedByUserId: verifierUserId,
      verifiedAt: now,
      credentialsExpiresAt: expiresAt,
      isSeniorReviewer: isSenior,
      rejectionReason: null,
    });

    this.logger.log(
      `Reviewer credential VERIFIED: ID ${updated.id} for User ${updated.userId} by Verifier ${verifierUserId}. Valid until: ${expiresAt.toISOString()}`,
    );

    return this.toSummary(updated);
  }

  /**
   * Reject a reviewer credential application with structured reason.
   */
  async rejectCredential(
    credentialId: string,
    dto: RejectReviewerCredentialDto,
    verifierUserId: string,
  ): Promise<ReviewerCredentialSummary> {
    const credential = await this.repository.findById(credentialId);
    if (!credential) {
      throw new NotFoundException(
        `Reviewer credential with ID ${credentialId} not found.`,
      );
    }

    if (credential.userId === verifierUserId) {
      throw new ForbiddenException(
        'Separation of Duties Violation: Users cannot adjudicate their own credentials.',
      );
    }

    const updated = await this.repository.update(credentialId, {
      verificationStatus: ReviewerVerificationStatus.REJECTED,
      rejectionReason: dto.rejectionReason,
      verifiedByUserId: verifierUserId,
      verifiedAt: new Date(),
    });

    this.logger.warn(
      `Reviewer credential REJECTED: ID ${updated.id} for User ${updated.userId} by Verifier ${verifierUserId}. Reason: ${dto.rejectionReason}`,
    );

    return this.toSummary(updated);
  }

  /**
   * Revoke an active credential (e.g. upon medical council disciplinary sanction or malpractice notice).
   */
  async revokeCredential(
    credentialId: string,
    reason: string,
    actorUserId: string,
  ): Promise<ReviewerCredentialSummary> {
    const credential = await this.repository.findById(credentialId);
    if (!credential) {
      throw new NotFoundException(
        `Reviewer credential with ID ${credentialId} not found.`,
      );
    }

    const updated = await this.repository.update(credentialId, {
      verificationStatus: ReviewerVerificationStatus.REVOKED,
      rejectionReason: reason,
      isActive: false,
    });

    this.logger.warn(
      `Reviewer credential REVOKED: ID ${updated.id} by Actor ${actorUserId}. Reason: ${reason}`,
    );

    return this.toSummary(updated);
  }

  /**
   * Retrieve reviewer credential status by User ID.
   */
  async getCredentialByUserId(
    userId: string,
  ): Promise<ReviewerCredentialSummary | null> {
    const credential = await this.repository.findByUserId(userId);
    if (!credential) {
      return null;
    }
    return this.toSummary(credential);
  }

  /**
   * Retrieve full reviewer credential entity by User ID.
   */
  async getCredentialEntityByUserId(
    userId: string,
  ): Promise<ReviewerCredential | null> {
    const credential = await this.repository.findByUserId(userId);
    if (!credential) {
      return null;
    }
    // Check if expired
    return this.checkAndApplyExpiration(credential);
  }

  /**
   * Validate reviewer eligibility to review a knowledge pack in a specific domain.
   * Enforces:
   * 1. User account is active.
   * 2. Reviewer holds an active credential.
   * 3. Verification status is strictly VERIFIED (not PENDING, REJECTED, or REVOKED).
   * 4. Credential has not expired.
   * 5. Specialty matches domain quorum requirements.
   */
  async validateReviewerEligibility(
    userId: string,
    targetDomain: KnowledgePackDomain,
  ): Promise<{
    eligible: boolean;
    reason?: string;
    credential?: ReviewerCredential;
  }> {
    const credential = await this.repository.findByUserId(userId);

    if (!credential) {
      return {
        eligible: false,
        reason: `User ${userId} does not have registered clinical reviewer credentials.`,
      };
    }

    if (!credential.isActive) {
      return {
        eligible: false,
        reason: `Reviewer credential record is marked inactive.`,
        credential,
      };
    }

    if (credential.verificationStatus === ReviewerVerificationStatus.PENDING) {
      return {
        eligible: false,
        reason: `Reviewer credential status is PENDING independent verification. Unverified credentials cannot approve clinical knowledge packs.`,
        credential,
      };
    }

    if (credential.verificationStatus === ReviewerVerificationStatus.REJECTED) {
      return {
        eligible: false,
        reason: `Reviewer credential was REJECTED: ${credential.rejectionReason || 'No reason provided.'}`,
        credential,
      };
    }

    if (credential.verificationStatus === ReviewerVerificationStatus.REVOKED) {
      return {
        eligible: false,
        reason: `Reviewer credential has been REVOKED.`,
        credential,
      };
    }

    // Expiration check
    if (
      credential.credentialsExpiresAt &&
      new Date(credential.credentialsExpiresAt) < new Date()
    ) {
      return {
        eligible: false,
        reason: `Reviewer credential expired on ${credential.credentialsExpiresAt.toISOString()}. Re-verification required.`,
        credential,
      };
    }

    // Specialty matching check
    const quorumRule = DOMAIN_QUORUM_RULES[targetDomain];
    if (!quorumRule) {
      return {
        eligible: false,
        reason: `No quorum rule defined for domain ${targetDomain}.`,
        credential,
      };
    }

    const candidateSpecialty = (
      credential.specialty || credential.specialtyQualification
    ).toUpperCase();

    const isSpecialtyMatch = quorumRule.acceptedSpecialties.some(
      (accepted) =>
        candidateSpecialty.includes(accepted.toUpperCase()) ||
        accepted.toUpperCase().includes(candidateSpecialty),
    );

    if (!isSpecialtyMatch) {
      return {
        eligible: false,
        reason: `Reviewer specialty '${credential.specialty}' (${credential.specialtyQualification}) does not satisfy required specialties for ${targetDomain}: [${quorumRule.acceptedSpecialties.join(', ')}].`,
        credential,
      };
    }

    return {
      eligible: true,
      credential,
    };
  }

  private checkAndApplyExpiration(
    credential: ReviewerCredential,
  ): ReviewerCredential {
    if (
      credential.verificationStatus === ReviewerVerificationStatus.VERIFIED &&
      credential.credentialsExpiresAt &&
      new Date(credential.credentialsExpiresAt) < new Date()
    ) {
      return {
        ...credential,
        verificationStatus: ReviewerVerificationStatus.EXPIRED,
      };
    }
    return credential;
  }

  private toSummary(credential: ReviewerCredential): ReviewerCredentialSummary {
    const isExpired =
      credential.credentialsExpiresAt !== null &&
      new Date(credential.credentialsExpiresAt) < new Date();

    const effectiveStatus =
      credential.verificationStatus === ReviewerVerificationStatus.VERIFIED &&
      isExpired
        ? ReviewerVerificationStatus.EXPIRED
        : credential.verificationStatus;

    return {
      id: credential.id,
      userId: credential.userId,
      clinicianName: credential.clinicianName,
      medicalRegistration: credential.medicalRegistration,
      stateMedicalCouncil: credential.stateMedicalCouncil,
      specialty: credential.specialty,
      yearsOfExperience: credential.yearsOfExperience,
      isSeniorReviewer: credential.isSeniorReviewer,
      verificationStatus: effectiveStatus,
      isExpired,
      isActive: credential.isActive,
      credentialsExpiresAt: credential.credentialsExpiresAt,
    };
  }
}
