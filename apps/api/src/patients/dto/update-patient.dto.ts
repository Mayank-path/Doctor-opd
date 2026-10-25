import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsEmail,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '@prisma/client';
import { IsPastOrTodayDate, PHONE_REGEX } from './create-patient.dto';

export class UpdatePatientDto {
  @IsOptional()
  @IsString({ message: 'fullName must be a string' })
  @IsNotEmpty({ message: 'fullName cannot be empty' })
  @MaxLength(128, {
    message: 'fullName exceeds maximum length of 128 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName?: string;

  @IsOptional()
  @IsEnum(Gender, {
    message: 'gender must be one of MALE, FEMALE, OTHER',
  })
  gender?: Gender;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsPastOrTodayDate()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsString({ message: 'phone must be a string' })
  @IsNotEmpty({ message: 'phone cannot be empty' })
  @MaxLength(20, { message: 'phone exceeds maximum length of 20 characters' })
  @Matches(PHONE_REGEX, {
    message:
      'phone must be a valid phone number representation between 7 and 20 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phone?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'alternatePhone must be a string' })
  @MaxLength(20, {
    message: 'alternatePhone exceeds maximum length of 20 characters',
  })
  @Matches(PHONE_REGEX, {
    message:
      'alternatePhone must be a valid phone number representation between 7 and 20 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  alternatePhone?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254, { message: 'email exceeds maximum length of 254 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'address must be a string' })
  @MaxLength(500, {
    message: 'address exceeds maximum length of 500 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  address?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'city must be a string' })
  @MaxLength(100, { message: 'city exceeds maximum length of 100 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  city?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'pincode must be a string' })
  @MaxLength(20, { message: 'pincode exceeds maximum length of 20 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  pincode?: string | null;
}
