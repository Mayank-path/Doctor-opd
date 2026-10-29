import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DosageForm, MedicationRoute, MedicationTiming } from '@prisma/client';

export class CreatePrescriptionItemDto {
  @IsString({ message: 'medicationName must be a string' })
  @IsNotEmpty({ message: 'medicationName is required' })
  @MaxLength(200, {
    message: 'medicationName exceeds maximum length of 200 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  medicationName!: string;

  @IsOptional()
  @IsString({ message: 'brandName must be a string' })
  @MaxLength(200, {
    message: 'brandName exceeds maximum length of 200 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  brandName?: string;

  @IsOptional()
  @IsEnum(DosageForm, {
    message: `dosageForm must be one of: ${Object.values(DosageForm).join(', ')}`,
  })
  dosageForm?: DosageForm = DosageForm.TABLET;

  @IsString({ message: 'strength must be a string' })
  @IsNotEmpty({ message: 'strength is required (e.g., 500 mg, 5 ml)' })
  @MaxLength(100, {
    message: 'strength exceeds maximum length of 100 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  strength!: string;

  @IsOptional()
  @IsEnum(MedicationRoute, {
    message: `route must be one of: ${Object.values(MedicationRoute).join(', ')}`,
  })
  route?: MedicationRoute = MedicationRoute.ORAL;

  @IsString({ message: 'frequency must be a string' })
  @IsNotEmpty({ message: 'frequency is required (e.g., 1-0-1, OD, TDS)' })
  @MaxLength(50, {
    message: 'frequency exceeds maximum length of 50 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  frequency!: string;

  @Type(() => Number)
  @IsInt({ message: 'durationValue must be an integer' })
  @Min(1, { message: 'durationValue must be at least 1' })
  @Max(365, { message: 'durationValue cannot exceed 365' })
  durationValue!: number;

  @IsString({ message: 'durationUnit must be a string' })
  @IsNotEmpty({
    message: 'durationUnit is required (e.g., DAYS, WEEKS, MONTHS)',
  })
  @MaxLength(20, {
    message: 'durationUnit exceeds maximum length of 20 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  durationUnit!: string;

  @IsOptional()
  @IsEnum(MedicationTiming, {
    message: `timing must be one of: ${Object.values(MedicationTiming).join(', ')}`,
  })
  timing?: MedicationTiming = MedicationTiming.AFTER_MEALS;

  @IsOptional()
  @IsString({ message: 'specialInstructions must be a string' })
  @MaxLength(500, {
    message: 'specialInstructions exceeds maximum length of 500 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  specialInstructions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sortOrder must be an integer' })
  sortOrder?: number = 0;
}
