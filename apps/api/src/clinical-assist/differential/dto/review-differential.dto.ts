import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { DoctorCandidateAction } from '@prisma/client';

/**
 * Individual candidate decision made by the attending clinician.
 */
export class CandidateDecisionDto {
  @IsString()
  @IsNotEmpty()
  conditionCode: string;

  @IsEnum(DoctorCandidateAction, {
    message:
      'decision must be one of: ACCEPTED_AS_PRIMARY, ACCEPTED_AS_DIFFERENTIAL, REJECTED, DEFERRED_FOR_INVESTIGATION',
  })
  decision: DoctorCandidateAction;

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Request DTO for clinician review and recorded decision-support actions.
 * Updates or persists audit ledger of physician choices on candidate differential diagnoses.
 */
export class ReviewDifferentialDto {
  @IsOptional()
  @IsUUID('4', { message: 'patientId must be a valid UUIDv4' })
  patientId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'consultationId must be a valid UUIDv4' })
  consultationId?: string;

  @IsOptional()
  @IsString()
  knowledgePackVerId?: string;

  @IsOptional()
  @IsArray()
  matchedCandidates?: any[];

  @IsOptional()
  @IsArray()
  redFlagsTriggered?: any[];

  @IsArray()
  @ArrayMaxSize(50, { message: 'decisions count cannot exceed 50 items' })
  @ValidateNested({ each: true })
  @Type(() => CandidateDecisionDto)
  decisions: CandidateDecisionDto[];

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

