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
import { LoginResponse } from './interfaces/auth.interfaces';

/**
 * Authentication Controller
 *
 * Exposes the secure login endpoint at POST /api/v1/auth/login.
 *
 * Rate Limiting Design & Limitations:
 * - Employs @nestjs/throttler with an in-memory storage provider.
 * - Enforces a maximum of 5 login attempts per 60 seconds per client IP address.
 * - Limitation: As an in-memory rate limiter, state is bound to a single Node.js process instance.
 *   Process restarts reset counters, and in multi-instance horizontally scaled deployments,
 *   rate-limit state is partitioned per node unless an external distributed store (e.g., Redis) is used.
 *   This is not claimed as distributed protection.
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
}
