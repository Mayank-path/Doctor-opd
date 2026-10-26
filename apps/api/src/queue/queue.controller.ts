import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ClinicRole, OpdQueueEntry } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { QueueService } from './queue.service';
import { CheckInDto } from './dto/check-in.dto';
import { ListQueueQueryDto } from './dto/list-queue-query.dto';
import { UpdateQueueStatusDto } from './dto/update-queue-status.dto';

@Controller('queue')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async checkIn(
    @ActiveClinic('clinicId') clinicId: string,
    @Body() dto: CheckInDto,
  ): Promise<OpdQueueEntry> {
    return this.queueService.checkIn(clinicId, dto);
  }

  @Get()
  @RequireRoles(
    ClinicRole.ADMIN,
    ClinicRole.DOCTOR,
    ClinicRole.RECEPTIONIST,
    ClinicRole.STAFF,
  )
  async findAll(
    @ActiveClinic('clinicId') clinicId: string,
    @Query() query: ListQueueQueryDto,
  ): Promise<{ data: OpdQueueEntry[]; items: OpdQueueEntry[]; total: number }> {
    return this.queueService.findAll(clinicId, query);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  async updateStatus(
    @ActiveClinic('clinicId') clinicId: string,
    @ActiveClinic('role') role: ClinicRole,
    @CurrentUser('id') currentUserId: string,
    @Param(
      'id',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: string,
    @Body() dto: UpdateQueueStatusDto,
  ): Promise<OpdQueueEntry> {
    return this.queueService.updateStatus(
      clinicId,
      id,
      currentUserId,
      role,
      dto,
    );
  }
}
