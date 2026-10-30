import { ReviewerCredentialSummary } from '../interfaces/reviewer-credential.interface';

export class ReviewerCredentialResponseDto {
  success: boolean;
  message: string;
  data: ReviewerCredentialSummary;
}

