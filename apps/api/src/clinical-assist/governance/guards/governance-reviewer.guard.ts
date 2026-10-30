import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithAuth } from '../../../auth/interfaces/auth.interfaces';
import { ReviewerCredentialingService } from '../services/reviewer-credentialing.service';
import { ReviewerVerificationStatus } from '../constants/governance.constants';

/**
 * GovernanceReviewerGuard ensures that only authenticated users with
 * INDEPENDENTLY VERIFIED, active clinical reviewer credentials can access
 * clinical governance endpoints.
 *
 * Invariant: A standard clinic DOCTOR role does NOT grant clinical governance authority.
 */
@Injectable()
export class GovernanceReviewerGuard implements CanActivate {
  constructor(
    private readonly credentialingService: ReviewerCredentialingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException(
        'Authentication required before clinical governance authorization.',
      );
    }

    const credential = await this.credentialingService.getCredentialByUserId(
      user.id,
    );

    if (!credential) {
      throw new ForbiddenException(
        'Clinical Governance Authority Required: User does not hold registered reviewer credentials.',
      );
    }

    if (credential.verificationStatus !== ReviewerVerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        `Clinical Governance Authority Required: Reviewer credential status is '${credential.verificationStatus}'. Only VERIFIED credentials grant governance review authority.`,
      );
    }

    if (!credential.isActive) {
      throw new ForbiddenException(
        'Clinical Governance Authority Required: Reviewer credential is marked inactive.',
      );
    }

    if (credential.isExpired) {
      throw new ForbiddenException(
        'Clinical Governance Authority Required: Reviewer credential has expired. Re-verification required.',
      );
    }

    return true;
  }
}
