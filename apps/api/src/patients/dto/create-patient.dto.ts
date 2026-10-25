import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsEmail,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '@prisma/client';

export function IsPastOrTodayDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPastOrTodayDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) return true;
          if (typeof value !== 'string') return false;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const [year, month, day] = value.split('-').map(Number);
          const date = new Date(Date.UTC(year, month - 1, day));
          if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
          ) {
            return false;
          }
          const today = new Date();
          const todayUtc = new Date(
            Date.UTC(
              today.getUTCFullYear(),
              today.getUTCMonth(),
              today.getUTCDate(),
            ),
          );
          return date <= todayUtc;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid calendar date in YYYY-MM-DD format and cannot be in the future`;
        },
      },
    });
  };
}

export const PHONE_REGEX = /^[+]?[0-9\s\-()]{7,20}$/;

export class CreatePatientDto {
  @IsString({ message: 'fullName must be a string' })
  @IsNotEmpty({ message: 'fullName is required' })
  @MaxLength(128, {
    message: 'fullName exceeds maximum length of 128 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName!: string;

  @IsEnum(Gender, {
    message: 'gender must be one of MALE, FEMALE, OTHER',
  })
  gender!: Gender;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsPastOrTodayDate()
  dateOfBirth?: string | null;

  @IsString({ message: 'phone must be a string' })
  @IsNotEmpty({ message: 'phone is required' })
  @MaxLength(20, { message: 'phone exceeds maximum length of 20 characters' })
  @Matches(PHONE_REGEX, {
    message:
      'phone must be a valid phone number representation between 7 and 20 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phone!: string;

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
