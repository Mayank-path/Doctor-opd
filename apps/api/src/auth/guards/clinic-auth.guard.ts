import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/require-roles.decorator';
import {
  ActiveClinicContext,
  RequestWithAuth,
} from '../interfaces/auth.interfaces';

/**
 * ClinicAuthGuard enforces tenant-level authorization and role-based access control (RBAC).
 *
 * Pipeline & Prerequisite:
 * - Must execute AFTER JwtAuthGuard has verified identity and attached `request.user`.
 * - If `request.user` is missing, execution fails closed with 401 Unauthorized.
 *
 * Authorization Policy & @RequireRoles Semantics:
 * 1. When @RequireRoles is absent:
 *    Any authenticated user with an ACTIVE membership in the requested clinic
 *    (roles: ADMIN, DOCTOR, STAFF) is granted access. This default-permissive policy
 *    within the tenant is intended for general clinic-scoped resources (e.g., clinic profile,
 *    clinic directory, shared appointment counters).
 * 2. When @RequireRoles is present:
 *    Only active members whose role matches one of the declared roles are permitted.
 *    Endpoints requiring specific clinical or administrative privileges (e.g., clinical diagnoses,
 *    prescriptions, doctor queue actions, member administration) MUST explicitly annotate
 *    @RequireRoles(ClinicRole.DOCTOR) or @RequireRoles(ClinicRole.ADMIN).
 *
 * Selector vs Proof:
 * - The clinic identifier from route params, query, or headers is strictly a selector.
 * - Authorization is verified against PostgreSQL `clinic_memberships` using composite (userId, clinicId).
 */
@Injectable()
export class ClinicAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException(
        'Authentication required before clinic authorization',
      );
    }

    // Resolve requested clinic selector from route parameter, query, or header.
    // This is treated strictly as a selector, NEVER as proof of access.
    const clinicId =
      request.params?.clinicId ||
      (typeof request.query?.clinicId === 'string'
        ? request.query.clinicId
        : undefined) ||
      (typeof request.headers['x-clinic-id'] === 'string'
        ? request.headers['x-clinic-id']
        : undefined);

    if (
      !clinicId ||
      typeof clinicId !== 'string' ||
      clinicId.trim().length === 0
    ) {
      throw new BadRequestException('Target clinic identifier is required');
    }

    const normalizedClinicId = clinicId.trim();

    // Verify membership in database
    const membership = await this.prisma.clinicMembership.findUnique({
      where: {
        userId_clinicId: {
          userId: user.id,
          clinicId: normalizedClinicId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Access denied: user is not a member of the requested clinic',
      );
    }

    // Reject non-active memberships (INVITED, SUSPENDED)
    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        `Access denied: clinic membership status is ${membership.status}`,
      );
    }

    // Check RBAC roles if specified on route/handler
    const requiredRoles = this.reflector.getAllAndOverride<
      ClinicRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(membership.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied: role ${membership.role} is not authorized for this operation`,
        );
      }
    }

    // Attach validated tenant context to request
    const clinicContext: ActiveClinicContext = {
      clinicId: membership.clinicId,
      membershipId: membership.id,
      role: membership.role,
      status: membership.status,
    };

    request.clinic = clinicContext;

    return true;
  }
}
