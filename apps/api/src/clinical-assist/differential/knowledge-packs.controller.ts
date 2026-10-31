import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClinicRole } from '@prisma/client';
import { ActiveClinic } from '../../auth/decorators/active-clinic.decorator';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DifferentialDiagnosisService } from './services/differential-diagnosis.service';

/**
 * KnowledgePacksController
 *
 * Exposes endpoints to inspect available clinical knowledge packs and active versions
 * for the active clinic tenant.
 *
 * Routes:
 * - GET /api/v1/clinical-assist/knowledge-packs
 * - GET /api/v1/clinical-assist/knowledge-packs/:id/version
 *
 * Security:
 * - Requires verified JWT bearer token (JwtAuthGuard).
 * - Requires active clinic membership (ClinicAuthGuard).
 * - Enforces rate limiting (ThrottlerGuard).
 * - Requires DOCTOR role within the active clinic (@RequireRoles(ClinicRole.DOCTOR)).
 */
@Controller('clinical-assist/knowledge-packs')
@UseGuards(JwtAuthGuard, ClinicAuthGuard, ThrottlerGuard)
export class KnowledgePacksController {
  constructor(
    private readonly differentialService: DifferentialDiagnosisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  async listKnowledgePacks(
    @ActiveClinic('clinicId') clinicId: string,
  ): Promise<any[]> {
    return this.differentialService.listKnowledgePacks(clinicId);
  }

  @Get(':id/version')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  async getKnowledgePackVersion(
    @ActiveClinic('clinicId') clinicId: string,
    @Param('id') id: string,
  ): Promise<any> {
    return this.differentialService.getKnowledgePackVersion(clinicId, id);
  }
}

