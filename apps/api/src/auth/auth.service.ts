import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadAuthConfig, AuthConfig } from './auth.config';
import {
  AuthClinicContext,
  AuthenticatedUser,
  JwtPayload,
  LoginResponse,
  UserProfileResponse,
} from './interfaces/auth.interfaces';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly config: AuthConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.config = loadAuthConfig();
  }

  async signToken(userId: string, phone: string): Promise<string> {
    const payload = {
      sub: userId,
      phone,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.config.jwtSecret,
      algorithm: 'HS256',
      issuer: this.config.jwtIssuer,
      audience: this.config.jwtAudience,
      expiresIn: this.config.jwtExpiresIn,
    });
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtSecret,
        algorithms: ['HS256'],
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
      });

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new Error('Token payload missing subject');
      }

      return payload;
    } catch {
      // Do not log sensitive token content or stack traces
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }

  async validateUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Authentication failed');
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        isActive: true,
        passwordHash: true,
      },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.signToken(user.id, user.phone);
    const { clinic, clinics } = await this.resolveUserClinicContext(
      user.id,
      loginDto.clinicId,
    );

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: this.config.jwtExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      clinic,
      clinics,
    };
  }

  /**
   * Resolves clinic context for an authenticated user.
   *
   * Business & Determinism Rules:
   * - Queries active memberships where the clinic is also active.
   * - Ordered deterministically by createdAt ASC.
   * - If requestedClinicId is provided: matches against active memberships.
   *   If found, returns that clinic as selected. If not found, clinic is null.
   * - If requestedClinicId is omitted:
   *   - Exactly 1 active membership: returns that clinic as selected.
   *   - 0 active memberships: returns clinic null, clinics [].
   *   - >1 active memberships: returns clinic null, clinics [all], forcing client to choose.
   */
  async resolveUserClinicContext(
    userId: string,
    requestedClinicId?: string,
  ): Promise<{ clinic: AuthClinicContext | null; clinics: AuthClinicContext[] }> {
    const memberships = await this.prisma.clinicMembership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        clinic: {
          isActive: true,
        },
      },
      select: {
        clinicId: true,
        role: true,
        clinic: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const clinics: AuthClinicContext[] = memberships.map((m) => ({
      id: m.clinic.id,
      name: m.clinic.name,
      role: m.role,
    }));

    if (requestedClinicId) {
      const match = clinics.find((c) => c.id === requestedClinicId);
      return {
        clinic: match || null,
        clinics,
      };
    }

    if (clinics.length === 1) {
      return {
        clinic: clinics[0],
        clinics,
      };
    }

    return {
      clinic: null,
      clinics,
    };
  }

  /**
   * Retrieves profile and authoritative clinic context for the authenticated user.
   */
  async getProfile(
    userId: string,
    requestedClinicId?: string,
  ): Promise<UserProfileResponse> {
    const user = await this.validateUser(userId);
    const { clinic, clinics } = await this.resolveUserClinicContext(
      user.id,
      requestedClinicId,
    );

    return {
      user,
      clinic,
      clinics,
    };
  }

  /**
   * Registers a new clinic owner: creates a User, Clinic, and ADMIN ClinicMembership
   * inside a single atomic transaction.
   *
   * Security & Integrity Guarantees:
   * - Enforces password confirmation match.
   * - Normalizes email to lowercase.
   * - Enforces unique email check (ConflictException if already exists).
   * - Hashes password using Argon2id; never returns or logs password hashes.
   * - Hardcodes ClinicRole.ADMIN; never trusts client-supplied roles or clinic IDs.
   * - Executes in a single ACID transaction; rolls back completely on any failure.
   * - Preserves standard JWT authentication response contract.
   */
  async registerClinic(dto: RegisterClinicDto): Promise<LoginResponse> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Check unique email constraint
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // 2. Resolve phone (satisfies PostgreSQL NOT NULL constraint while supporting optional input)
    let resolvedPhone = dto.phone?.trim() || null;
    if (resolvedPhone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: resolvedPhone },
      });
      if (existingPhone) {
        throw new ConflictException(
          'An account with this phone number already exists',
        );
      }
    } else {
      const uidSuffix = randomUUID().replace(/-/g, '').slice(0, 10);
      resolvedPhone = `+reg-${uidSuffix}`;
    }

    // 3. Hash password with Argon2id
    const passwordHash = await this.hashPassword(dto.password);

    // 4. Atomic transaction: create User, Clinic, and ADMIN ClinicMembership
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email: normalizedEmail,
          phone: resolvedPhone,
          passwordHash,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
        },
      });

      const clinic = await tx.clinic.create({
        data: {
          name: dto.clinicName.trim(),
          address: dto.clinicAddress?.trim() || null,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      await tx.clinicMembership.create({
        data: {
          userId: user.id,
          clinicId: clinic.id,
          role: ClinicRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      return { user, clinic };
    });

    // 5. Sign token and assemble standard LoginResponse with newly created clinic
    const token = await this.signToken(result.user.id, result.user.phone);

    const clinicContext: AuthClinicContext = {
      id: result.clinic.id,
      name: result.clinic.name,
      role: ClinicRole.ADMIN,
    };

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: this.config.jwtExpiresIn,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
      },
      clinic: clinicContext,
      clinics: [clinicContext],
    };
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }
}
