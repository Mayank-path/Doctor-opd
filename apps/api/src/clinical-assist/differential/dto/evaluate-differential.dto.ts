import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { KnowledgePackDomain } from '@prisma/client';
import {
  EvaluationFindingStatus,
  InfectionSuspicionState,
} from '../../evaluator/ast-evaluator.types';

/**
 * Structured clinical finding input DTO.
 */
export class ClinicalFindingInputDto {
  @IsString()
  @IsNotEmpty()
  canonicalTerm: string;

  @IsOptional()
  @IsString()
  conceptId?: string;

  @IsEnum(EvaluationFindingStatus, {
    message:
      'Finding status must be one of: PRESENT, ABSENT, UNCERTAIN, UNKNOWN, NOT_MENTIONED, NOT_ASSESSED',
  })
  status: EvaluationFindingStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(36500)
  durationDays?: number;

  @IsOptional()
  @IsIn(['MILD', 'MODERATE', 'SEVERE'])
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';

  @IsOptional()
  @IsString()
  bodyLocation?: string;
}

/**
 * Vital signs input DTO with optional clinical parameters.
 */
export class VitalSignsInputDto {
  @IsOptional()
  @IsNumber()
  temperatureC?: number;

  @IsOptional()
  @IsInt()
  systolicBp?: number;

  @IsOptional()
  @IsInt()
  diastolicBp?: number;

  @IsOptional()
  @IsInt()
  pulse?: number;

  @IsOptional()
  @IsInt()
  spO2?: number;

  @IsOptional()
  @IsInt()
  respiratoryRate?: number;
}

/**
 * Demographic override DTO.
 * Client age is never trusted if server patient record contains a valid date of birth.
 */
export class DemographicOverrideDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  ageYears?: number;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER', 'ALL'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'ALL';

  @IsOptional()
  @IsBoolean()
  isPregnant?: boolean;
}

/**
 * Physical examination or clinical assessment DTO.
 */
export class ClinicalAssessmentInputDto {
  @IsString()
  @IsNotEmpty()
  examination: string;

  @IsIn(['PERFORMED', 'NOT_ASSESSED', 'DEFERRED'])
  status: 'PERFORMED' | 'NOT_ASSESSED' | 'DEFERRED';

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Top-level request DTO for Differential Diagnosis AST evaluation.
 */
export class EvaluateDifferentialDto {
  @IsUUID('4', { message: 'patientId must be a valid UUIDv4' })
  @IsNotEmpty()
  patientId: string;

  @IsOptional()
  @IsUUID('4', { message: 'consultationId must be a valid UUIDv4' })
  consultationId?: string;

  @IsOptional()
  @IsEnum(KnowledgePackDomain, {
    message: 'domain must be a valid KnowledgePackDomain',
  })
  domain?: KnowledgePackDomain;

  @IsArray()
  @ArrayMaxSize(50, { message: 'findings count cannot exceed 50 items' })
  @ValidateNested({ each: true })
  @Type(() => ClinicalFindingInputDto)
  findings: ClinicalFindingInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsInputDto)
  vitals?: VitalSignsInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DemographicOverrideDto)
  demographics?: DemographicOverrideDto;

  @IsOptional()
  @IsEnum(InfectionSuspicionState, {
    message:
      'infectionSuspicion must be one of: SUSPECTED, NOT_SUSPECTED, UNKNOWN, NOT_ASSESSED',
  })
  infectionSuspicion?: InfectionSuspicionState;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClinicalAssessmentInputDto)
  assessments?: ClinicalAssessmentInputDto[];
}

