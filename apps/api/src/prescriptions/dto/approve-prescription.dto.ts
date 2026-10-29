import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ApprovePrescriptionDto {
  @IsBoolean({ message: 'confirmApproval must be a boolean' })
  @IsNotEmpty({ message: 'confirmApproval is required' })
  @Equals(true, {
    message:
      'confirmApproval must be explicitly true to approve and lock the prescription',
  })
  confirmApproval!: boolean;

  @IsOptional()
  @IsString({ message: 'doctorNotes must be a string' })
  @MaxLength(1000, {
    message: 'doctorNotes exceeds maximum length of 1000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  doctorNotes?: string;
}
