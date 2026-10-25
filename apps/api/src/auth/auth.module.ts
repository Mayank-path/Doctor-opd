import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { BootstrapService } from './bootstrap/bootstrap.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ClinicAuthGuard } from './guards/clinic-auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, BootstrapService, JwtAuthGuard, ClinicAuthGuard],
  exports: [AuthService, BootstrapService, JwtAuthGuard, ClinicAuthGuard],
})
export class AuthModule {}
