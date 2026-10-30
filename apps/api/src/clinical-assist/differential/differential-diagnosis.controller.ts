import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClinicRole } from '@prisma/client';
import { ActiveClinic } from '../../auth/decorators/active-clinic.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DifferentialEvaluationResponseDto } from './dto/differential-response.dto';
import { EvaluateDifferentialDto } from './dto/evaluate-differential.dto';
import { DifferentialDiagnosisService } from './services/differential-diagnosis.service';

/**
 * DifferentialDiagnosisController
 *
 * Exposes the authenticated, rate-limited, tenant-isolated Differential Diagnosis AST evaluation API.
 * Route: POST /api/v1/clinical-assist/differential-diagnosis/evaluate
 *
 * Security:
 * - Requires verified JWT bearer token (JwtAuthGuard).
 * - Requires active clinic membership (ClinicAuthGuard).
 * - Enforces rate limiting per client/IP/tenant (ThrottlerGuard).
 * - Requires DOCTOR role within the active clinic (@RequireRoles(ClinicRole.DOCTOR)).
 */
@Controller('clinical-assist/differential-diagnosis')
@UseGuards(JwtAuthGuard, ClinicAuthGuard, ThrottlerGuard)
export class DifferentialDiagnosisController {
  constructor(
    private readonly differentialService: DifferentialDiagnosisService,
  ) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  async evaluate(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') clinicianId: string,
    @Body() dto: EvaluateDifferentialDto,
  ): Promise<DifferentialEvaluationResponseDto> {
    return this.differentialService.evaluate(clinicId, clinicianId, dto);
  }
}
