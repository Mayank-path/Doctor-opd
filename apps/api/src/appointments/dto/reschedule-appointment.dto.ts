import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RescheduleAppointmentDto {
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
  @IsString({ message: 'notes must be a string' })
  @MaxLength(2000, { message: 'notes cannot exceed 2000 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;
}
