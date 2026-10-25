import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../auth.service';
import { RequestWithAuth } from '../interfaces/auth.interfaces';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let authService: {
    verifyToken: jest.Mock;
    validateUser: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      verifyToken: jest.fn(),
      validateUser: jest.fn(),
    };

    guard = new JwtAuthGuard(authService as unknown as AuthService);
  });

  function createMockContext(headers: Record<string, string>): {
    context: ExecutionContext;
    request: RequestWithAuth;
  } {
    const request: RequestWithAuth = {
      headers: { ...headers },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    const { context } = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing authorization bearer token'),
    );
  });

  it('should throw UnauthorizedException when scheme is not Bearer', async () => {
    const { context } = createMockContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Malformed authorization bearer token'),
    );
  });

  it('should throw UnauthorizedException when token string is empty', async () => {
    const { context } = createMockContext({
      authorization: 'Bearer    ',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Malformed authorization bearer token'),
    );
  });

  it('should verify token, validate user, and attach verified user to request', async () => {
    const { context, request } = createMockContext({
      authorization: 'Bearer valid.jwt.token',
    });

    authService.verifyToken.mockResolvedValue({
      sub: 'user-123',
      phone: '9876543210',
      iss: 'doctor-opd-api',
      aud: 'doctor-opd-client',
    });

    const mockUser = {
      id: 'user-123',
      phone: '9876543210',
      email: 'doc@example.com',
      fullName: 'Dr. Sharma',
      isActive: true,
    };
    authService.validateUser.mockResolvedValue(mockUser);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.user).toEqual(mockUser);
  });

  it('should ensure client-supplied identity headers cannot override verified user identity', async () => {
    const { context, request } = createMockContext({
      authorization: 'Bearer valid.jwt.token',
      'x-user-id': 'spoofed-hacker-id',
    });

    authService.verifyToken.mockResolvedValue({
      sub: 'legitimate-user-123',
      phone: '9876543210',
      iss: 'doctor-opd-api',
      aud: 'doctor-opd-client',
    });

    const legitimateUser = {
      id: 'legitimate-user-123',
      phone: '9876543210',
      email: 'doc@example.com',
      fullName: 'Dr. Sharma',
      isActive: true,
    };
    authService.validateUser.mockResolvedValue(legitimateUser);

    await guard.canActivate(context);
    expect(request.user?.id).toBe('legitimate-user-123');
    expect(request.user?.id).not.toBe('spoofed-hacker-id');
  });
});
