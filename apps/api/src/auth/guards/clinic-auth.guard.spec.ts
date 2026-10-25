import {
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { ClinicAuthGuard } from './clinic-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedUser,
  RequestWithAuth,
} from '../interfaces/auth.interfaces';

describe('ClinicAuthGuard', () => {
  let guard: ClinicAuthGuard;
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let prisma: {
    clinicMembership: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    prisma = {
      clinicMembership: {
        findUnique: jest.fn(),
      },
    };

    guard = new ClinicAuthGuard(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
    );
  });

  function createMockContext(
    user?: AuthenticatedUser,
    params: Record<string, string> = {},
    headers: Record<string, string> = {},
    query: Record<string, string> = {},
  ): { context: ExecutionContext; request: RequestWithAuth } {
    const request: RequestWithAuth = {
      user,
      params,
      headers: { ...headers },
      query: { ...query },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  const mockValidUser: AuthenticatedUser = {
    id: 'user-1',
    phone: '9876543210',
    email: 'user@example.com',
    fullName: 'Test User',
    isActive: true,
  };

  it('should throw UnauthorizedException if user is not authenticated', async () => {
    const { context } = createMockContext(undefined, { clinicId: 'clinic-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw BadRequestException if clinic identifier is missing', async () => {
    const { context } = createMockContext(mockValidUser);
    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw ForbiddenException if user has no membership in the clinic', async () => {
    const { context } = createMockContext(mockValidUser, {
      clinicId: 'clinic-1',
    });
    prisma.clinicMembership.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Access denied: user is not a member of the requested clinic',
      ),
    );
  });

  it('should throw ForbiddenException if membership status is INVITED', async () => {
    const { context } = createMockContext(mockValidUser, {
      clinicId: 'clinic-1',
    });
    prisma.clinicMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      clinicId: 'clinic-1',
      role: ClinicRole.DOCTOR,
      status: MembershipStatus.INVITED,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Access denied: clinic membership status is INVITED',
      ),
    );
  });

  it('should throw ForbiddenException if membership status is SUSPENDED', async () => {
    const { context } = createMockContext(mockValidUser, {
      clinicId: 'clinic-1',
    });
    prisma.clinicMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      clinicId: 'clinic-1',
      role: ClinicRole.DOCTOR,
      status: MembershipStatus.SUSPENDED,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Access denied: clinic membership status is SUSPENDED',
      ),
    );
  });

  it('should throw ForbiddenException if user role is not authorized', async () => {
    const { context } = createMockContext(mockValidUser, {
      clinicId: 'clinic-1',
    });
    prisma.clinicMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      clinicId: 'clinic-1',
      role: ClinicRole.STAFF,
      status: MembershipStatus.ACTIVE,
    });

    // Route requires DOCTOR or ADMIN
    reflector.getAllAndOverride.mockReturnValue([
      ClinicRole.DOCTOR,
      ClinicRole.ADMIN,
    ]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Access denied: role STAFF is not authorized for this operation',
      ),
    );
  });

  it('should allow access and set request.clinic when active membership matches required role', async () => {
    const { context, request } = createMockContext(mockValidUser, {
      clinicId: 'clinic-1',
    });

    prisma.clinicMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      clinicId: 'clinic-1',
      role: ClinicRole.DOCTOR,
      status: MembershipStatus.ACTIVE,
    });

    reflector.getAllAndOverride.mockReturnValue([
      ClinicRole.DOCTOR,
      ClinicRole.ADMIN,
    ]);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.clinic).toEqual({
      clinicId: 'clinic-1',
      membershipId: 'membership-1',
      role: ClinicRole.DOCTOR,
      status: MembershipStatus.ACTIVE,
    });
  });

  it('should resolve clinic selector from header x-clinic-id when params are absent', async () => {
    const { context, request } = createMockContext(
      mockValidUser,
      {},
      { 'x-clinic-id': 'clinic-header-1' },
    );

    prisma.clinicMembership.findUnique.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-1',
      clinicId: 'clinic-header-1',
      role: ClinicRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });

    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.clinic?.clinicId).toBe('clinic-header-1');
  });
});
