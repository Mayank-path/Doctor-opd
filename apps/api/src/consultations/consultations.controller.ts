import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClinicRole, Consultation, Prescription } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { ConsultationsService } from './consultations.service';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import {
  ConsultationQueryDto,
  PaginatedConsultationResponse,
} from './dto/consultation-query.dto';
import { CreateConsultationPrescriptionDto } from '../prescriptions/dto/create-consultation-prescription.dto';
import { PaginatedPrescriptionResponse } from '../prescriptions/dto/list-prescriptions-query.dto';

@Controller('consultations')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class ConsultationsController {
  constructor(
    private readonly consultationsService: ConsultationsService,
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.DOCTOR)
  async createDraft(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') clinicianId: string,
    @Body() dto: CreateConsultationDto,
  ): Promise<Consultation> {
    return this.consultationsService.createDraft(clinicId, clinicianId, dto);
  }

  @Get()
  @RequireRoles(ClinicRole.DOCTOR)
  async findAll(
    @ActiveClinic('clinicId') clinicId: string,
    @Query() query: ConsultationQueryDto,
  ): Promise<PaginatedConsultationResponse<Consultation>> {
    return this.consultationsService.findAll(clinicId, query);
  }

  @Get(':id')
  @RequireRoles(ClinicRole.DOCTOR)
  async findOne(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
  ): Promise<Consultation> {
    return this.consultationsService.findOne(clinicId, id);
  }

  @Patch(':id')
  @RequireRoles(ClinicRole.DOCTOR)
  async updateDraft(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') clinicianId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: UpdateConsultationDto,
  ): Promise<Consultation> {
    return this.consultationsService.updateDraft(
      clinicId,
      id,
      clinicianId,
      dto,
    );
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  async finalize(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') clinicianId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
  ): Promise<Consultation> {
    return this.consultationsService.finalize(clinicId, id, clinicianId);
  }

  @Post(':id/prescriptions')
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.DOCTOR)
  async createPrescription(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') clinicianId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    consultationId: string,
    @Body() dto: CreateConsultationPrescriptionDto,
    @Req() req: Request,
  ): Promise<Prescription> {
    const consultation = await this.consultationsService.findOne(
      clinicId,
      consultationId,
    );
    return this.prescriptionsService.createDraft(
      clinicId,
      clinicianId,
      {
        patientId: consultation.patientId,
        consultationId,
        notes: dto.notes,
        items: dto.items,
      },
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get(':id/prescriptions')
  @RequireRoles(ClinicRole.DOCTOR)
  async findPrescriptions(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    consultationId: string,
  ): Promise<PaginatedPrescriptionResponse<any>> {
    return this.prescriptionsService.findAll(clinicId, { consultationId });
  }
}
