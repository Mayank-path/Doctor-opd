import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { KnowledgePackDomain } from '@prisma/client';

export class SubmitReviewerCredentialDto {
  /**
   * Optional client-provided userId.
   * If provided, the server verifies it matches the authenticated principal;
   * otherwise, applicant identity is strictly derived from the verified JWT principal.
   */
  @IsOptional()
  @IsUUID(4)
  userId?: string;

  @IsNotEmpty()
  @IsString()
  clinicianName: string;

  @IsNotEmpty()
  @IsString()
  medicalRegistration: string;

  @IsNotEmpty()
  @IsString()
  stateMedicalCouncil: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1950)
  @Max(2030)
  registrationYear: number;

  @IsNotEmpty()
  @IsString()
  primaryQualification: string; // e.g. "MBBS"

  @IsNotEmpty()
  @IsString()
  specialtyQualification: string; // e.g. "MD (General Medicine)"

  @IsNotEmpty()
  @IsEnum(KnowledgePackDomain)
  specialty: KnowledgePackDomain;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience: number;
}

