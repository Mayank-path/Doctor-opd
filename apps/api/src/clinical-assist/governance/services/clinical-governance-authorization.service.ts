import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { KnowledgePackDomain } from '@prisma/client';
import { ReviewerCredentialingService } from './reviewer-credentialing.service';
import { ReviewerCredential } from '../interfaces/reviewer-credential.interface';

@Injectable()
export class ClinicalGovernanceAuthorizationService {
  private readonly logger = new Logger(
    ClinicalGovernanceAuthorizationService.name,
  );

  constructor(
    private readonly credentialingService: ReviewerCredentialingService,
  ) {}

  /**
   * Enforce Four-Eyes Principle: Author cannot be Reviewer.
   * Self-approval is strictly forbidden.
   */
  validateAuthorExclusion(
    authorUserId: string | null | undefined,
    reviewerUserId: string,
  ): void {
    if (!authorUserId) return;

    if (authorUserId === reviewerUserId) {
      this.logger.warn(
        `Four-Eyes violation: Author ${authorUserId} attempted to approve own authored version.`,
      );
      throw new ForbiddenException(
        'Four-Eyes Policy Violation: Knowledge-pack author cannot review or approve their own authored content.',
      );
    }
  }

  /**
   * Enforce Separation of Duties: Reviewer cannot be Release Authority.
   */
  validateReleaseAuthorityExclusion(
    approvingReviewerUserIds: string[],
    releaseOperatorUserId: string,
  ): void {
    if (approvingReviewerUserIds.includes(releaseOperatorUserId)) {
      this.logger.warn(
        `Separation of duties violation: Reviewer ${releaseOperatorUserId} attempted to release the knowledge pack they approved.`,
      );
      throw new ForbiddenException(
        'Separation of Duties Violation: A clinical reviewer cannot authorize or activate the release of the same knowledge-pack version.',
      );
    }
  }

  /**
   * Enforce Conflict of Interest Protocol.
   * Declaration is strictly mandatory; any material conflict requires automated recusal.
   */
  validateConflictOfInterest(
    coiDeclared: boolean,
    hasMaterialConflict?: boolean,
    coiDetails?: string,
  ): void {
    if (!coiDeclared) {
      throw new BadRequestException(
        'Conflict of Interest declaration is mandatory for all clinical approvals.',
      );
    }

    if (hasMaterialConflict) {
      this.logger.warn(
        `Reviewer declared material conflict of interest (${coiDetails || 'unspecified'}). Mandatory recusal enforced.`,
      );
      throw new ForbiddenException(
        `Conflict of Interest Recusal: Reviewer declared a material conflict of interest (${coiDetails || 'commercial/author conflict'}) and is disqualified from approving this knowledge pack.`,
      );
    }
  }

  /**
   * Check reviewer eligibility and return credential if valid.
   */
  async assertReviewerEligible(
    reviewerUserId: string,
    targetDomain: KnowledgePackDomain,
  ): Promise<ReviewerCredential> {
    const result =
      await this.credentialingService.validateReviewerEligibility(
        reviewerUserId,
        targetDomain,
      );

    if (!result.eligible || !result.credential) {
      throw new ForbiddenException(
        `Reviewer Eligibility Failure: ${result.reason || 'Reviewer is not eligible to approve this knowledge pack.'}`,
      );
    }

    return result.credential;
  }
}

