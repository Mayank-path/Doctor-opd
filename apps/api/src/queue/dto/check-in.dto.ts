import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CheckInDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'appointmentId must be a valid UUID' })
  appointmentId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'doctorId must be a valid UUID' })
  doctorId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'serviceDate must be in YYYY-MM-DD calendar date format',
  })
  serviceDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priority must be an integer' })
  @Min(0, { message: 'priority cannot be negative' })
  @Max(10, { message: 'priority cannot exceed 10' })
  priority?: number = 0;

  @IsOptional()
  @IsString({ message: 'idempotencyKey must be a string' })
  @IsNotEmpty({ message: 'idempotencyKey cannot be empty when provided' })
  @MaxLength(100, { message: 'idempotencyKey cannot exceed 100 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  idempotencyKey?: string;
}
