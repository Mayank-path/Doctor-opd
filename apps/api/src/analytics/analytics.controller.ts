import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClinicRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { DiseaseSearchQueryDto } from './dto/disease-search-query.dto';
import {
  PracticeOverviewResponse,
  PatientAnalyticsResponse,
  RevenueAnalyticsResponse,
  DiseaseSearchResponse,
  DiseaseSuggestionsResponse,
} from './interfaces/analytics.interfaces';

@Controller('analytics')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
@RequireRoles(ClinicRole.DOCTOR, ClinicRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(
    @ActiveClinic() clinic: { clinicId: string },
    @Query() query: AnalyticsQueryDto,
  ): Promise<PracticeOverviewResponse> {
    return this.analyticsService.getOverview(clinic.clinicId, query);
  }

  @Get('patients')
  async getPatientAnalytics(
    @ActiveClinic() clinic: { clinicId: string },
    @Query() query: AnalyticsQueryDto,
  ): Promise<PatientAnalyticsResponse> {
    return this.analyticsService.getPatientAnalytics(clinic.clinicId, query);
  }

  @Get('revenue')
  async getRevenueAnalytics(
    @ActiveClinic() clinic: { clinicId: string },
    @Query() query: AnalyticsQueryDto,
  ): Promise<RevenueAnalyticsResponse> {
    return this.analyticsService.getRevenueAnalytics(clinic.clinicId, query);
  }

  @Get('disease-search/suggestions')
  @RequireRoles(ClinicRole.DOCTOR)
  async getDiseaseSuggestions(
    @ActiveClinic() clinic: { clinicId: string },
    @Query('q') q?: string,
  ): Promise<DiseaseSuggestionsResponse> {
    return this.analyticsService.getDiseaseSuggestions(clinic.clinicId, q);
  }

  @Get('disease-search')
  @RequireRoles(ClinicRole.DOCTOR)
  async searchDiseases(
    @ActiveClinic() clinic: { clinicId: string },
    @Query() query: DiseaseSearchQueryDto,
  ): Promise<DiseaseSearchResponse> {
    return this.analyticsService.searchDiseases(clinic.clinicId, query);
  }
}


