import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '@prisma/client';

export class PaymentQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'consultationId must be a valid UUID' })
  consultationId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: 'status must be one of: COMPLETED, PENDING, FAILED, REFUNDED',
  })
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

