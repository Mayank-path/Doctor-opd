import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClinicRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, ClinicAuthGuard)
@RequireRoles(ClinicRole.DOCTOR, ClinicRole.ADMIN)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @ActiveClinic() clinic: { clinicId: string },
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(clinic.clinicId, user.id, dto);
  }

  @Get()
  async listPayments(
    @ActiveClinic() clinic: { clinicId: string },
    @Query() query: PaymentQueryDto,
  ) {
    return this.paymentsService.listPayments(clinic.clinicId, query);
  }
}

