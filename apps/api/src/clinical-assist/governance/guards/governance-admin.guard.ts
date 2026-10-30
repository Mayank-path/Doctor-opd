import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClinicRole } from '@prisma/client';
import type { RequestWithAuth } from '../../../auth/interfaces/auth.interfaces';

/**
 * GovernanceAdminGuard verifies that the authenticated user possesses
 * administrative authority over the clinical governance platform
 * (e.g., verifying credentials, revoking credentials, adjudicating appeals).
 */
@Injectable()
export class GovernanceAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;
    const clinic = request.clinic;

    if (!user || !user.id) {
      throw new UnauthorizedException(
        'Authentication required before governance administration.',
      );
    }

    // Must have ADMIN role in the active clinic context or be a designated platform admin
    if (clinic && clinic.role === ClinicRole.ADMIN) {
      return true;
    }

    throw new ForbiddenException(
      'Governance Administration Authority Required: Only authorized governance administrators can verify or adjudicate reviewer credentials.',
    );
  }
}
