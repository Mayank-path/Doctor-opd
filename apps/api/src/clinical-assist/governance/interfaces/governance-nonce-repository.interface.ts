export const GOVERNANCE_NONCE_REPOSITORY = 'GOVERNANCE_NONCE_REPOSITORY';

export interface GovernanceNonceEntity {
  id: string;
  nonce: string;
  versionId: string;
  reviewerUserId: string;
  consumedAt: Date;
}

export interface IGovernanceNonceRepository {
  /**
   * Checks if a nonce has already been consumed.
   */
  isConsumed(nonce: string): Promise<boolean>;

  /**
   * Atomically records nonce consumption.
   * Throws ConflictException if nonce was already consumed (e.g. unique constraint violation).
   */
  consumeAtomic(
    nonce: string,
    versionId: string,
    reviewerUserId: string,
  ): Promise<GovernanceNonceEntity>;

  /**
   * Clears nonces (for testing isolation).
   */
  clear(): Promise<void>;
}
