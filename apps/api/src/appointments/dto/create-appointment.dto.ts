import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AppointmentType } from '@prisma/client';

export class CreateAppointmentDto {
  @IsUUID(undefined, { message: 'patientId must be a valid UUID' })
  @IsNotEmpty({ message: 'patientId is required' })
  patientId: string;

  @IsUUID(undefined, { message: 'doctorId must be a valid UUID' })
  @IsNotEmpty({ message: 'doctorId is required' })
  doctorId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'serviceDate must be in YYYY-MM-DD calendar date format',
  })
  @IsNotEmpty({ message: 'serviceDate is required' })
  serviceDate: string;

  @IsDateString(
    {},
    { message: 'startTime must be a valid ISO 8601 datetime string' },
  )
  @IsNotEmpty({ message: 'startTime is required' })
  startTime: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'endTime must be a valid ISO 8601 datetime string' },
  )
  endTime?: string;

  @IsOptional()
  @IsEnum(AppointmentType, {
    message: `type must be a valid AppointmentType (${Object.values(AppointmentType).join(', ')})`,
  })
  type?: AppointmentType = AppointmentType.SCHEDULED;

  @IsOptional()
  @IsString({ message: 'chiefComplaint must be a string' })
  @MaxLength(500, {
    message: 'chiefComplaint cannot exceed 500 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  chiefComplaint?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(2000, { message: 'notes cannot exceed 2000 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;
}
