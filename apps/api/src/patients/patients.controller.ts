import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ClinicRole, Consultation, Patient } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { PatientsService } from './patients.service';
import { ConsultationsService } from '../consultations/consultations.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import {
  PatientSearchQueryDto,
  PaginatedPatientResponse,
} from './dto/patient-search-query.dto';
import { PaginatedConsultationResponse } from '../consultations/dto/consultation-query.dto';
import { PatientConsultationHistoryQueryDto } from '../consultations/dto/patient-consultation-history-query.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly consultationsService: ConsultationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async create(
    @ActiveClinic('clinicId') clinicId: string,
    @Body() dto: CreatePatientDto,
  ): Promise<Patient> {
    return this.patientsService.create(clinicId, dto);
  }

  @Get()
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async findAll(
    @ActiveClinic('clinicId') clinicId: string,
    @Query() query: PatientSearchQueryDto,
  ): Promise<PaginatedPatientResponse<Patient>> {
    return this.patientsService.findAll(clinicId, query);
  }

  @Get(':patientId/consultations')
  @RequireRoles(ClinicRole.DOCTOR)
  async findConsultationHistory(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'patientId',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    patientId: string,
    @Query() query: PatientConsultationHistoryQueryDto,
  ): Promise<PaginatedConsultationResponse<Consultation>> {
    return this.consultationsService.findPatientHistory(
      clinicId,
      patientId,
      query,
    );
  }

  @Get(':id')
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async findOne(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
  ): Promise<Patient> {
    return this.patientsService.findOne(clinicId, id);
  }

  @Patch(':id')
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async update(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: UpdatePatientDto,
  ): Promise<Patient> {
    return this.patientsService.update(clinicId, id, dto);
  }
}
