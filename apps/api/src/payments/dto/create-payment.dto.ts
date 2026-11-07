import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
  @IsOptional()
  @IsUUID('all', { message: 'consultationId must be a valid UUID' })
  consultationId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a valid monetary number with up to 2 decimal places' })
  @Min(0.01, { message: 'amount must be greater than 0' })
  @Type(() => Number)
  @IsNotEmpty({ message: 'amount is required' })
  amount!: number;

  @IsEnum(PaymentMethod, {
    message: 'method must be one of: CASH, UPI, CARD, OTHER',
  })
  @IsNotEmpty({ message: 'method is required' })
  method!: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: 'status must be one of: COMPLETED, PENDING, FAILED, REFUNDED',
  })
  status?: PaymentStatus;

  @IsOptional()
  @IsString({ message: 'paidAt must be a valid ISO 8601 date string' })
  paidAt?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'idempotencyKey must be a string' })
  @MaxLength(100, { message: 'idempotencyKey must not exceed 100 characters' })
  idempotencyKey?: string;
}

