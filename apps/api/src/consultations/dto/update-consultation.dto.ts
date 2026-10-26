import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateConsultationDto {
  @IsOptional()
  @IsString({ message: 'chiefComplaint must be a string' })
  @IsNotEmpty({ message: 'chiefComplaint cannot be empty' })
  @MaxLength(500, {
    message: 'chiefComplaint exceeds maximum length of 500 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  chiefComplaint?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'symptoms must be a string' })
  @MaxLength(5000, {
    message: 'symptoms exceeds maximum length of 5000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  symptoms?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'examination must be a string' })
  @MaxLength(5000, {
    message: 'examination exceeds maximum length of 5000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  examination?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'diagnosis must be a string' })
  @MaxLength(5000, {
    message: 'diagnosis exceeds maximum length of 5000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  diagnosis?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'treatmentPlan must be a string' })
  @MaxLength(5000, {
    message: 'treatmentPlan exceeds maximum length of 5000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  treatmentPlan?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'followUpDate must be in YYYY-MM-DD calendar date format',
  })
  followUpDate?: string | null;

  // ---------------------------------------------------------------------------
  // Vital Signs
  // ---------------------------------------------------------------------------

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'bpSystolic must be an integer' })
  @Min(40, { message: 'bpSystolic must be at least 40 mmHg' })
  @Max(300, { message: 'bpSystolic must be at most 300 mmHg' })
  bpSystolic?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'bpDiastolic must be an integer' })
  @Min(20, { message: 'bpDiastolic must be at least 20 mmHg' })
  @Max(200, { message: 'bpDiastolic must be at most 200 mmHg' })
  bpDiastolic?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'pulse must be an integer' })
  @Min(30, { message: 'pulse must be at least 30 bpm' })
  @Max(300, { message: 'pulse must be at most 300 bpm' })
  pulse?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 1 },
    { message: 'temperature must be a number with at most 1 decimal place' },
  )
  @Min(70.0, { message: 'temperature must be at least 70.0 °F' })
  @Max(115.0, { message: 'temperature must be at most 115.0 °F' })
  temperature?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'weightKg must be a number with at most 2 decimal places' },
  )
  @Min(0.5, { message: 'weightKg must be at least 0.5 kg' })
  @Max(500.0, { message: 'weightKg must be at most 500.0 kg' })
  weightKg?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'heightCm must be a number with at most 2 decimal places' },
  )
  @Min(20.0, { message: 'heightCm must be at least 20.0 cm' })
  @Max(300.0, { message: 'heightCm must be at most 300.0 cm' })
  heightCm?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'spo2 must be an integer' })
  @Min(50, { message: 'spo2 must be at least 50%' })
  @Max(100, { message: 'spo2 must be at most 100%' })
  spo2?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'respiratoryRate must be an integer' })
  @Min(5, { message: 'respiratoryRate must be at least 5 breaths/min' })
  @Max(100, { message: 'respiratoryRate must be at most 100 breaths/min' })
  respiratoryRate?: number | null;
}
