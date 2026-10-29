import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClinicRole, Prescription } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { ApprovePrescriptionDto } from './dto/approve-prescription.dto';
import { AmendPrescriptionDto } from './dto/amend-prescription.dto';
import {
  ListPrescriptionsQueryDto,
  PaginatedPrescriptionResponse,
} from './dto/list-prescriptions-query.dto';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.DOCTOR)
  async create(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') doctorId: string,
    @Body() dto: CreatePrescriptionDto,
    @Req() req: Request,
  ): Promise<Prescription> {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.prescriptionsService.createDraft(
      clinicId,
      doctorId,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Get()
  @RequireRoles(ClinicRole.DOCTOR, ClinicRole.ADMIN)
  async findAll(
    @ActiveClinic('clinicId') clinicId: string,
    @Query() query: ListPrescriptionsQueryDto,
  ): Promise<PaginatedPrescriptionResponse<any>> {
    return this.prescriptionsService.findAll(clinicId, query);
  }

  @Get(':id')
  @RequireRoles(ClinicRole.DOCTOR, ClinicRole.ADMIN)
  async findOne(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
  ): Promise<any> {
    return this.prescriptionsService.findOne(clinicId, id);
  }

  @Patch(':id')
  @RequireRoles(ClinicRole.DOCTOR)
  async updateDraft(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') doctorId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: UpdatePrescriptionDto,
    @Req() req: Request,
  ): Promise<Prescription> {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.prescriptionsService.updateDraft(
      clinicId,
      id,
      doctorId,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  async approve(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') doctorId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: ApprovePrescriptionDto,
    @Req() req: Request,
  ): Promise<Prescription> {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.prescriptionsService.approve(
      clinicId,
      id,
      doctorId,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Post(':id/amend')
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.DOCTOR)
  async amend(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') doctorId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: AmendPrescriptionDto,
    @Req() req: Request,
  ): Promise<Prescription> {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.prescriptionsService.amend(
      clinicId,
      id,
      doctorId,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Get(':id/pdf')
  @RequireRoles(ClinicRole.DOCTOR, ClinicRole.ADMIN)
  async getPdf(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') userId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const { buffer, filename } = await this.prescriptionsService.generatePdf(
      clinicId,
      id,
      userId,
      ipAddress,
      userAgent,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
