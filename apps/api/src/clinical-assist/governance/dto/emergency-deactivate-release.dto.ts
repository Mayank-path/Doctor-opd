import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class EmergencyDeactivateReleaseDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10, {
    message: 'Emergency deactivation requires a clinical or security justification of at least 10 characters',
  })
  reason: string;

  /**
   * Optional actor identity submitted in body.
   * Server strictly enforces that this matches authenticated JWT principal.
   */
  @IsOptional()
  @IsUUID(4)
  deactivatedByUserId?: string;
}
