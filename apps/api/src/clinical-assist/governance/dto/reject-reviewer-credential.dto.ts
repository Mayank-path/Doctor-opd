import { IsNotEmpty, IsString } from 'class-validator';

export class RejectReviewerCredentialDto {
  @IsNotEmpty()
  @IsString()
  rejectionReason: string;
}

