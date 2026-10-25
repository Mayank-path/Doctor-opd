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
import { ClinicRole, Patient } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import {
  PatientSearchQueryDto,
  PaginatedPatientResponse,
} from './dto/patient-search-query.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.RECEPTIONIST)
  async create(
    @ActiveClinic('clinicId') clinicId: string,
    @Body() dto: CreatePatientDto,
  ): Promise<Patient> {
    return this.patientsService.create(clinicId, dto);
  }

  @Get()
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.RECEPTIONIST, ClinicRole.DOCTOR)
  async findAll(
    @ActiveClinic('clinicId') clinicId: string,
    @Query() query: PatientSearchQueryDto,
  ): Promise<PaginatedPatientResponse<Patient>> {
    return this.patientsService.findAll(clinicId, query);
  }

  @Get(':id')
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.RECEPTIONIST, ClinicRole.DOCTOR)
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
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.RECEPTIONIST)
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
