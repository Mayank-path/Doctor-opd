import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { PROHIBITED_CONTROL_CHARS_REGEX } from '../clinical-extraction.constants';

/**
 * Custom validator ensuring no prohibited Unicode control characters (C0 controls or BiDi overrides)
 * are present in the clinical text, rejecting with HTTP 400 rather than silently mutating the input.
 */
export function IsValidClinicalText(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidClinicalText',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (value.trim().length === 0) return false;
          // Check for prohibited control characters
          return !PROHIBITED_CONTROL_CHARS_REGEX.test(value);
        },
        defaultMessage(): string {
          return 'text contains prohibited non-printable or bidirectional control characters, or is empty';
        },
      },
    });
  };
}

export class ExtractStructuredClinicalDto {
  @IsString({ message: 'text must be a string' })
  @IsNotEmpty({ message: 'text is required and cannot be empty' })
  @MaxLength(5000, { message: 'text cannot exceed 5000 characters' })
  @IsValidClinicalText({
    message:
      'text contains prohibited non-printable or bidirectional control characters',
  })
  text!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, {
    message: 'encounterDate must be a valid ISO 8601 date string',
  })
  encounterDate?: string;
}
