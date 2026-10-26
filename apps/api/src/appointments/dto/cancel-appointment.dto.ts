import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CancelAppointmentDto {
  @IsString({ message: 'cancellationReason must be a string' })
  @IsNotEmpty({ message: 'cancellationReason is required' })
  @MaxLength(500, {
    message: 'cancellationReason cannot exceed 500 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  cancellationReason: string;
}
