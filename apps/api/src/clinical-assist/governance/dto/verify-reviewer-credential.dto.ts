import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class VerifyReviewerCredentialDto {
  @IsNotEmpty()
  @IsString()
  verificationEvidence: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isSeniorReviewer?: boolean;
}

