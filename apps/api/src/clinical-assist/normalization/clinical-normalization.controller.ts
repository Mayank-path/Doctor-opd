import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClinicRole } from '@prisma/client';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClinicalNormalizationService } from './clinical-normalization.service';
import type { NormalizedClinicalResult } from './clinical-normalization.types';
import { NormalizeClinicalTextDto } from './dto/normalize-clinical-text.dto';

@Controller('clinical-assist')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class ClinicalNormalizationController {
  constructor(
    private readonly normalizationService: ClinicalNormalizationService,
  ) {}

  @Post('normalize')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  normalize(@Body() dto: NormalizeClinicalTextDto): NormalizedClinicalResult {
    return this.normalizationService.normalize(dto.text);
  }
}
