import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import { LoginResponse } from './interfaces/auth.interfaces';

/**
 * Authentication Controller
 *
 * Exposes authentication endpoints:
 * - POST /api/v1/auth/login: Clinician and staff login
 * - POST /api/v1/auth/register-clinic: Clinic owner registration
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
}
