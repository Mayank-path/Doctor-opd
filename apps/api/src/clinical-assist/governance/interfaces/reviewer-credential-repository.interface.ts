import { ReviewerCredential } from './reviewer-credential.interface';

export const REVIEWER_CREDENTIAL_REPOSITORY = 'REVIEWER_CREDENTIAL_REPOSITORY';

export interface IReviewerCredentialRepository {
  findByUserId(userId: string): Promise<ReviewerCredential | null>;
  findById(id: string): Promise<ReviewerCredential | null>;
  findByMedicalRegistration(reg: string): Promise<ReviewerCredential | null>;
  save(credential: ReviewerCredential): Promise<ReviewerCredential>;
  update(id: string, updates: Partial<ReviewerCredential>): Promise<ReviewerCredential>;
  findAll(): Promise<ReviewerCredential[]>;
  findAllVerified(): Promise<ReviewerCredential[]>;
  clear(): Promise<void>; // Useful for testing isolation
}

