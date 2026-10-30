import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class RollbackReleaseDto {
  @IsNotEmpty()
  @IsUUID(4)
  targetVersionId: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10, {
    message: 'Release rollback requires a clinical justification of at least 10 characters',
  })
  reason: string;

  /**
   * Optional actor identity submitted in body.
   * Server strictly enforces that this matches authenticated JWT principal.
   */
  @IsOptional()
  @IsUUID(4)
  actorUserId?: string;
}
