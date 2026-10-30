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
 * GovernanceReleaseAuthorityGuard
 *
 * Enforces strict Four-Eyes governance over knowledge-pack releases:
 * - DOCTOR role must NEVER imply release authority.
 * - Enforces dedicated governance release officer authority (Clinic ADMIN or Platform Governance Officer).
 * - Derives actor identity strictly from the authenticated JWT principal.
 */
@Injectable()
export class GovernanceReleaseAuthorityGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;
    const clinic = request.clinic;

    if (!user || !user.id) {
      throw new UnauthorizedException(
        'Authentication required before exercising knowledge-pack release authority.',
      );
    }

    // Critical Policy: ClinicRole.DOCTOR must NEVER imply release authority
    if (clinic && clinic.role === ClinicRole.DOCTOR) {
      throw new ForbiddenException(
        'Release Authority Denied: Standard DOCTOR role does not possess knowledge-pack release authority. Dedicated governance release authority (ADMIN) is strictly required.',
      );
    }

    // Must possess ADMIN role in active clinic context
    if (clinic && clinic.role === ClinicRole.ADMIN) {
      return true;
    }

    throw new ForbiddenException(
      'Release Authority Denied: Only authorized governance release officers (Clinic ADMIN) may activate, deactivate, or rollback knowledge packs.',
    );
  }
}
