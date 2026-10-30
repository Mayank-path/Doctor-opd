import { Injectable } from '@nestjs/common';
import {
  IReviewerCredentialRepository,
} from '../interfaces/reviewer-credential-repository.interface';
import { ReviewerCredential } from '../interfaces/reviewer-credential.interface';
import { ReviewerVerificationStatus } from '../constants/governance.constants';

@Injectable()
export class InMemoryReviewerCredentialRepository
  implements IReviewerCredentialRepository
{
  private readonly credentialsById = new Map<string, ReviewerCredential>();
  private readonly credentialsByUserId = new Map<string, ReviewerCredential>();
  private readonly credentialsByReg = new Map<string, ReviewerCredential>();

  async findByUserId(userId: string): Promise<ReviewerCredential | null> {
    const cred = this.credentialsByUserId.get(userId);
    return cred ? { ...cred } : null;
  }

  async findById(id: string): Promise<ReviewerCredential | null> {
    const cred = this.credentialsById.get(id);
    return cred ? { ...cred } : null;
  }

  async findByMedicalRegistration(
    reg: string,
  ): Promise<ReviewerCredential | null> {
    const normalized = reg.trim().toLowerCase();
    const cred = this.credentialsByReg.get(normalized);
    return cred ? { ...cred } : null;
  }

  async save(credential: ReviewerCredential): Promise<ReviewerCredential> {
    const cloned = { ...credential };
    this.credentialsById.set(cloned.id, cloned);
    this.credentialsByUserId.set(cloned.userId, cloned);
    this.credentialsByReg.set(
      cloned.medicalRegistration.trim().toLowerCase(),
      cloned,
    );
    return { ...cloned };
  }

  async update(
    id: string,
    updates: Partial<ReviewerCredential>,
  ): Promise<ReviewerCredential> {
    const existing = this.credentialsById.get(id);
    if (!existing) {
      throw new Error(`ReviewerCredential with ID ${id} not found`);
    }

    const updated: ReviewerCredential = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.credentialsById.set(id, updated);
    this.credentialsByUserId.set(updated.userId, updated);
    this.credentialsByReg.set(
      updated.medicalRegistration.trim().toLowerCase(),
      updated,
    );
    return { ...updated };
  }

  async findAll(): Promise<ReviewerCredential[]> {
    return Array.from(this.credentialsById.values()).map((c) => ({ ...c }));
  }

  async findAllVerified(): Promise<ReviewerCredential[]> {
    return Array.from(this.credentialsById.values())
      .filter(
        (c) =>
          c.verificationStatus === ReviewerVerificationStatus.VERIFIED &&
          c.isActive &&
          (!c.credentialsExpiresAt || c.credentialsExpiresAt > new Date()),
      )
      .map((c) => ({ ...c }));
  }

  async clear(): Promise<void> {
    this.credentialsById.clear();
    this.credentialsByUserId.clear();
    this.credentialsByReg.clear();
  }
}

