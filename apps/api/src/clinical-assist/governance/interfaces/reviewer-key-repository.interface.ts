import { ReviewerPublicKeyEntity } from './attestation.interface';

export const REVIEWER_KEY_REPOSITORY = 'REVIEWER_KEY_REPOSITORY';

export interface IReviewerKeyRepository {
  save(key: ReviewerPublicKeyEntity): Promise<ReviewerPublicKeyEntity>;
  findActiveByUserId(reviewerUserId: string): Promise<ReviewerPublicKeyEntity | null>;
  findByFingerprint(fingerprint: string): Promise<ReviewerPublicKeyEntity | null>;
  findById(id: string): Promise<ReviewerPublicKeyEntity | null>;
  update(id: string, updates: Partial<ReviewerPublicKeyEntity>): Promise<ReviewerPublicKeyEntity>;
  deactivateOtherKeysForUser(reviewerUserId: string, exceptKeyId: string): Promise<void>;
  findAllByUserId(reviewerUserId: string): Promise<ReviewerPublicKeyEntity[]>;
  clear(): Promise<void>;
}

