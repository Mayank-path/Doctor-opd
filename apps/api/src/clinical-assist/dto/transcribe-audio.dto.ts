import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export const ALLOWED_LANGUAGE_HINTS = [
  'hi',
  'en',
  'hi-IN',
  'en-IN',
  'auto',
] as const;
export type AllowedLanguageHint = (typeof ALLOWED_LANGUAGE_HINTS)[number];

export class TranscribeAudioDto {
  @IsUUID('all', { message: 'patientId must be a valid UUID' })
  @IsNotEmpty({ message: 'patientId is required' })
  patientId: string;

  @Transform(({ value }: { value: unknown }): boolean => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return typeof value === 'boolean' ? value : false;
  })
  @IsBoolean({ message: 'patientConsentVerified must be a boolean' })
  @Equals(true, {
    message:
      'patientConsentVerified must be explicitly verified and set to true',
  })
  patientConsentVerified: boolean;

  @IsOptional()
  @IsIn(ALLOWED_LANGUAGE_HINTS, {
    message: `languageHint must be one of: ${ALLOWED_LANGUAGE_HINTS.join(', ')}`,
  })
  languageHint?: AllowedLanguageHint;
}
