import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class SubmitApprovalDto {
  @IsNotEmpty()
  @IsUUID(4)
  versionId: string;

  /**
   * Optional reviewerUserId.
   * Reviewer identity is strictly derived from the verified JWT principal.
   * If provided, the server verifies it matches the principal; any spoofing attempt is rejected.
   */
  @IsOptional()
  @IsUUID(4)
  reviewerUserId?: string;

  @IsNotEmpty()
  @Length(64, 64)
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'checksumSha256 must be a valid 64-character hexadecimal SHA-256 string',
  })
  checksumSha256: string;

  @IsNotEmpty()
  @IsIn(['APPROVED', 'REJECTED'])
  approvalVerdict: 'APPROVED' | 'REJECTED';

  @IsNotEmpty()
  @IsString()
  reviewNotes: string;

  @IsNotEmpty()
  @IsBoolean()
  coiDeclared: boolean;

  @IsOptional()
  @IsString()
  coiDetails?: string;

  /**
   * Explicit indicator of whether the declared conflict of interest is material
   * (e.g. financial commercial sponsorship, author of rule, patent interest).
   * Material conflicts trigger mandatory recusal.
   */
  @IsOptional()
  @IsBoolean()
  hasMaterialConflict?: boolean;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  stateMedicalCouncil?: string;

  @IsOptional()
  @IsString()
  medicalRegistration?: string;

  /**
   * Digital signature string or serialized SignedAttestationEnvelope JSON.
   * When provided, verified cryptographically using the reviewer's registered Ed25519 public key.
   */
  @IsOptional()
  @IsString()
  digitalSignature?: string;
}

