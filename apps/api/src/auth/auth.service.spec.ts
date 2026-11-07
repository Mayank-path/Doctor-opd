import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { loadAuthConfig } from './auth.config';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let prisma: PrismaService;

  const mockSecret = 'test-secret-at-least-32-characters-long-key';
  const mockIssuer = 'doctor-opd-api';
  const mockAudience = 'doctor-opd-client';

  beforeAll(() => {
    process.env.JWT_SECRET = mockSecret;
    process.env.JWT_ISSUER = mockIssuer;
    process.env.JWT_AUDIENCE = mockAudience;
    process.env.JWT_EXPIRES_IN = '1h';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            clinicMembership: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Configuration Fail-Closed', () => {
    it('should throw if JWT_SECRET is missing or too short', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'short';
      expect(() => loadAuthConfig()).toThrow(
        /JWT_SECRET must be configured and at least 32 characters long/,
      );
      delete process.env.JWT_SECRET;
      expect(() => loadAuthConfig()).toThrow(
        /JWT_SECRET must be configured and at least 32 characters long/,
      );
      process.env.JWT_SECRET = originalSecret;
    });

    it('should throw if JWT_ISSUER is missing', () => {
      const originalIssuer = process.env.JWT_ISSUER;
      delete process.env.JWT_ISSUER;
      expect(() => loadAuthConfig()).toThrow(/JWT_ISSUER must be configured/);
      process.env.JWT_ISSUER = originalIssuer;
    });

    it('should throw if JWT_AUDIENCE is missing', () => {
      const originalAudience = process.env.JWT_AUDIENCE;
      delete process.env.JWT_AUDIENCE;
      expect(() => loadAuthConfig()).toThrow(/JWT_AUDIENCE must be configured/);
      process.env.JWT_AUDIENCE = originalAudience;
    });
  });

  describe('Token Signing and Verification', () => {
    it('should sign and successfully verify a valid bearer token', async () => {
      const token = await authService.signToken('user-123', '9876543210');
      expect(typeof token).toBe('string');

      const payload = await authService.verifyToken(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.phone).toBe('9876543210');
      expect(payload.iss).toBe(mockIssuer);
      expect(payload.aud).toBe(mockAudience);
    });

    it('should reject a malformed token', async () => {
      await expect(authService.verifyToken('not.a.valid.jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a token with an invalid signature', async () => {
      const foreignToken = await jwtService.signAsync(
        { sub: 'user-123', phone: '9876543210' },
        {
          secret: 'another-untrusted-secret-key-32-chars-long',
          issuer: mockIssuer,
          audience: mockAudience,
        },
      );

      await expect(authService.verifyToken(foreignToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject an expired token', async () => {
      const expiredToken = await jwtService.signAsync(
        { sub: 'user-123', phone: '9876543210' },
        {
          secret: mockSecret,
          issuer: mockIssuer,
          audience: mockAudience,
          expiresIn: '-1s',
        },
      );

      await expect(authService.verifyToken(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a token with incorrect issuer', async () => {
      const invalidIssuerToken = await jwtService.signAsync(
        { sub: 'user-123', phone: '9876543210' },
        {
          secret: mockSecret,
          issuer: 'wrong-issuer',
          audience: mockAudience,
        },
      );

      await expect(authService.verifyToken(invalidIssuerToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a token with incorrect audience', async () => {
      const invalidAudienceToken = await jwtService.signAsync(
        { sub: 'user-123', phone: '9876543210' },
        {
          secret: mockSecret,
          issuer: mockIssuer,
          audience: 'wrong-audience',
        },
      );

      await expect(
        authService.verifyToken(invalidAudienceToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token using alg: none', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'user-123',
          phone: '9876543210',
          iss: mockIssuer,
          aud: mockAudience,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      await expect(authService.verifyToken(noneToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a token using an unexpected asymmetric algorithm (RS256)', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'user-123',
          phone: '9876543210',
          iss: mockIssuer,
          aud: mockAudience,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const fakeSignature =
        Buffer.from('fake-rsa-signature').toString('base64url');
      const rs256Token = `${header}.${payload}.${fakeSignature}`;

      await expect(authService.verifyToken(rs256Token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('User Validation', () => {
    it('should validate and return active user', async () => {
      const mockUser = {
        id: 'user-123',
        phone: '9876543210',
        email: 'doc@example.com',
        fullName: 'Dr. Sharma',
        isActive: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.validateUser('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should reject if user is not found in database', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.validateUser('unknown-user')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject if user isActive is false', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        isActive: false,
      });

      await expect(authService.validateUser('user-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Login Flow', () => {
    const validPassword = 'SecurePassword123!';
    let validPasswordHash: string;

    beforeAll(async () => {
      validPasswordHash = await authService.hashPassword(validPassword);
    });

    it('should successfully authenticate user with valid email and password', async () => {
      const mockUser = {
        id: 'user-doc-1',
        phone: '9876543210',
        email: 'doctor@clinic.com',
        fullName: 'Dr. Anita Roy',
        isActive: true,
        passwordHash: validPasswordHash,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.clinicMembership.findMany as jest.Mock).mockResolvedValue([
        {
          clinicId: 'clinic-1',
          role: ClinicRole.DOCTOR,
          clinic: { id: 'clinic-1', name: 'Metro Health' },
        },
      ]);

      const result = await authService.login({
        email: 'DOCTOR@CLINIC.COM ', // Tests normalization (trim and lowercase)
        password: validPassword,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe('1h');
      expect(result.user).toEqual({
        id: 'user-doc-1',
        email: 'doctor@clinic.com',
        fullName: 'Dr. Anita Roy',
      });
      expect(result.clinic).toEqual({
        id: 'clinic-1',
        name: 'Metro Health',
        role: ClinicRole.DOCTOR,
      });
      expect(result.clinics).toEqual([
        {
          id: 'clinic-1',
          name: 'Metro Health',
          role: ClinicRole.DOCTOR,
        },
      ]);

      // Verify token signature, subject, claims
      const verified = await authService.verifyToken(result.accessToken);
      expect(verified.sub).toBe('user-doc-1');
      expect(verified.phone).toBe('9876543210');
      expect(verified.iss).toBe(mockIssuer);
      expect(verified.aud).toBe(mockAudience);

      // Verify no password hash is leaked in response
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
      expect(
        (result.user as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
    });

    it('should reject when user email is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@clinic.com',
          password: validPassword,
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('should reject when password does not match hash', async () => {
      const mockUser = {
        id: 'user-doc-1',
        phone: '9876543210',
        email: 'doctor@clinic.com',
        fullName: 'Dr. Anita Roy',
        isActive: true,
        passwordHash: validPasswordHash,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'doctor@clinic.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('should reject when account isActive is false', async () => {
      const mockUser = {
        id: 'user-doc-1',
        phone: '9876543210',
        email: 'doctor@clinic.com',
        fullName: 'Dr. Anita Roy',
        isActive: false,
        passwordHash: validPasswordHash,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'doctor@clinic.com',
          password: validPassword,
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('should reject when user has no passwordHash (e.g. external provider account)', async () => {
      const mockUser = {
        id: 'user-doc-1',
        phone: '9876543210',
        email: 'doctor@clinic.com',
        fullName: 'Dr. Anita Roy',
        isActive: true,
        passwordHash: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'doctor@clinic.com',
          password: validPassword,
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('Clinic Context Resolution (resolveUserClinicContext)', () => {
    const singleMembership = [
      {
        clinicId: 'clinic-alpha-1',
        role: ClinicRole.DOCTOR,
        clinic: { id: 'clinic-alpha-1', name: 'Alpha Clinic' },
      },
    ];

    const multipleMemberships = [
      {
        clinicId: 'clinic-alpha-1',
        role: ClinicRole.ADMIN,
        clinic: { id: 'clinic-alpha-1', name: 'Alpha Clinic' },
      },
      {
        clinicId: 'clinic-beta-2',
        role: ClinicRole.DOCTOR,
        clinic: { id: 'clinic-beta-2', name: 'Beta Health' },
      },
    ];

    it('should auto-select clinic when user has exactly 1 active membership', async () => {
      (prisma.clinicMembership.findMany as jest.Mock).mockResolvedValue(
        singleMembership,
      );

      const result = await authService.resolveUserClinicContext('user-1');

      expect(result.clinic).toEqual({
        id: 'clinic-alpha-1',
        name: 'Alpha Clinic',
        role: ClinicRole.DOCTOR,
      });
      expect(result.clinics).toEqual([
        {
          id: 'clinic-alpha-1',
          name: 'Alpha Clinic',
          role: ClinicRole.DOCTOR,
        },
      ]);
      expect(prisma.clinicMembership.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: MembershipStatus.ACTIVE,
          clinic: { isActive: true },
        },
        select: {
          clinicId: true,
          role: true,
          clinic: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return clinic null and empty clinics list when user has 0 active memberships', async () => {
      (prisma.clinicMembership.findMany as jest.Mock).mockResolvedValue([]);

      const result = await authService.resolveUserClinicContext('user-no-clinic');

      expect(result.clinic).toBeNull();
      expect(result.clinics).toEqual([]);
    });

    it('should return clinic null and all clinics when user has multiple active memberships and no requested clinicId', async () => {
      (prisma.clinicMembership.findMany as jest.Mock).mockResolvedValue(
        multipleMemberships,
      );

      const result = await authService.resolveUserClinicContext('user-multi');

      expect(result.clinic).toBeNull();
      expect(result.clinics).toHaveLength(2);
      expect(result.clinics[0].id).toBe('clinic-alpha-1');
      expect(result.clinics[1].id).toBe('clinic-beta-2');
    });

    it('should resolve requested clinic when valid requestedClinicId is provided in multi-clinic context', async () => {
      (prisma.clinicMembership.findMany as jest.Mock).mockResolvedValue(
        multipleMemberships,
      );

      const result = await authService.resolveUserClinicContext(
        'user-multi',
        'clinic-beta-2',
      );

      expect(result.clinic).toEqual({
        id: 'clinic-beta-2',
        name: 'Beta Health',
        role: ClinicRole.DOCTOR,
      });
      expect(result.clinics).toHaveLength(2);
    });

    it('should return clinic null when requestedClinicId does not match any active memberships', async () => {
      (prisma.clinicMembership.findMany as jest.Mock).mockResolvedValue(
        multipleMemberships,
      );

      const result = await authService.resolveUserClinicContext(
        'user-multi',
        'clinic-unauthorized-99',
      );

      expect(result.clinic).toBeNull();
      expect(result.clinics).toHaveLength(2);
    });
  });

  describe('User Profile with Clinic Resolution (getProfile)', () => {
    it('should return user profile and resolved clinic context', async () => {
      const mockUser = {
        id: 'user-doc-1',
        phone: '9876543210',
        email: 'doc@example.com',
        fullName: 'Dr. Anita Roy',
        isActive: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.clinicMembership.findMany as jest.Mock).mockResolvedValue([
        {
          clinicId: 'clinic-alpha-1',
          role: ClinicRole.DOCTOR,
          clinic: { id: 'clinic-alpha-1', name: 'Alpha Clinic' },
        },
      ]);

      const profile = await authService.getProfile('user-doc-1');

      expect(profile.user).toEqual(mockUser);
      expect(profile.clinic).toEqual({
        id: 'clinic-alpha-1',
        name: 'Alpha Clinic',
        role: ClinicRole.DOCTOR,
      });
      expect(profile.clinics).toHaveLength(1);
    });
  });
});
