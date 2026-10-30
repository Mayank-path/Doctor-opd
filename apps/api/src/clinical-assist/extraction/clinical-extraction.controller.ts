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
import { ClinicalExtractionService } from './clinical-extraction.service';
import type { StructuredClinicalExtractionResult } from './clinical-extraction.types';
import { ExtractStructuredClinicalDto } from './dto/extract-structured-clinical.dto';

@Controller('clinical-assist')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class ClinicalExtractionController {
  constructor(private readonly extractionService: ClinicalExtractionService) {}

  @Post('extract-structured')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  extractStructured(
    @Body() dto: ExtractStructuredClinicalDto,
  ): StructuredClinicalExtractionResult {
    return this.extractionService.extract(dto);
  }
}
