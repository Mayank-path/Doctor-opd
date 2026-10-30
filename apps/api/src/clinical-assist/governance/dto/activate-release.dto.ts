import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ActivateReleaseDto {
  @IsNotEmpty()
  @IsUUID(4)
  versionId: string;

  @IsNotEmpty()
  @IsIn(['GLOBAL', 'CLINIC'])
  scope: 'GLOBAL' | 'CLINIC';

  /**
   * Target clinic ID if scope is CLINIC.
   * Null for GLOBAL releases.
   */
  @IsOptional()
  @IsUUID(4)
  clinicId?: string;

  @IsOptional()
  @IsString()
  releaseNotes?: string;

  /**
   * Optional release officer identity submitted in body.
   * Server strictly enforces that this matches authenticated JWT principal.
   */
  @IsOptional()
  @IsUUID(4)
  releasedByUserId?: string;
}
