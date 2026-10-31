import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterClinicDto {
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(100, { message: 'Full name cannot exceed 100 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName!: string;

  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  password!: string;

  @IsString({ message: 'Confirm password must be a string' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  confirmPassword!: string;

  @IsString({ message: 'Clinic name must be a string' })
  @IsNotEmpty({ message: 'Clinic name is required' })
  @MinLength(2, { message: 'Clinic name must be at least 2 characters' })
  @MaxLength(150, { message: 'Clinic name cannot exceed 150 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  clinicName!: string;

  @IsOptional()
  @IsString({ message: 'Clinic address must be a string' })
  @MaxLength(255, { message: 'Clinic address cannot exceed 255 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  clinicAddress?: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @MaxLength(25, { message: 'Phone number cannot exceed 25 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phone?: string;
}

