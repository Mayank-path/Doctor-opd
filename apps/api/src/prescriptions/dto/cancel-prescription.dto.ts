import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CancelPrescriptionDto {
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required to cancel an approved prescription' })
  @MinLength(5, {
    message: 'reason must provide clear clinical justification (at least 5 characters)',
  })
  @MaxLength(1000, {
    message: 'reason exceeds maximum length of 1000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason!: string;
}

