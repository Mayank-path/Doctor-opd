import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Appointment, ClinicRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  ListAppointmentsQueryDto,
  PaginatedAppointmentResponse,
} from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async create(
    @ActiveClinic('clinicId') clinicId: string,
    @Body() dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.create(clinicId, dto);
  }

  @Get()
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async findAll(
    @ActiveClinic('clinicId') clinicId: string,
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<PaginatedAppointmentResponse<Appointment>> {
    return this.appointmentsService.findAll(clinicId, query);
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
  ): Promise<Appointment> {
    return this.appointmentsService.findOne(clinicId, id);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async reschedule(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.reschedule(clinicId, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async cancel(
    @ActiveClinic('clinicId') clinicId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: CancelAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.cancel(clinicId, id, dto);
  }
}
