import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @MinLength(1, { message: 'Password cannot be empty' })
  @MaxLength(128, { message: 'Password exceeds maximum permitted length' })
  password!: string;
}
