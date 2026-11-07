import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import type {
  AuthenticatedUser,
  LoginResponse,
  UserProfileResponse,
} from './interfaces/auth.interfaces';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * Authentication Controller
 *
 * Exposes authentication endpoints:
 * - POST /api/v1/auth/login: Clinician and staff login
 * - POST /api/v1/auth/register-clinic: Clinic owner registration
 * - GET  /api/v1/auth/me: Current authenticated user profile and clinic resolution
 *
 * Rate Limiting Design & Limitations:
 * - Employs @nestjs/throttler with an in-memory storage provider.
 * - Enforces a maximum of 5 attempts per 60 seconds per client IP address.
 * - State is bound to a single Node.js process instance (in-memory).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }

  @Post('register-clinic')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async registerClinic(
    @Body() registerDto: RegisterClinicDto,
  ): Promise<LoginResponse> {
    return this.authService.registerClinic(registerDto);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-clinic-id') headerClinicId?: string,
    @Query('clinicId') queryClinicId?: string,
  ): Promise<UserProfileResponse> {
    const requestedClinicId = headerClinicId || queryClinicId;
    return this.authService.getProfile(user.id, requestedClinicId);
  }
}
