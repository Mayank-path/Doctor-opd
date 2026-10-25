import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { loadAuthConfig, AuthConfig } from './auth.config';
import {
  AuthenticatedUser,
  JwtPayload,
  LoginResponse,
} from './interfaces/auth.interfaces';
import { LoginDto } from './dto/login.dto';

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

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: this.config.jwtExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }
}
