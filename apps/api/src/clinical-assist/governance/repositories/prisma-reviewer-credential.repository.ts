import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReviewerVerificationStatus } from '../constants/governance.constants';
import { IReviewerCredentialRepository } from '../interfaces/reviewer-credential-repository.interface';
import { ReviewerCredential } from '../interfaces/reviewer-credential.interface';

@Injectable()
export class PrismaReviewerCredentialRepository
  implements IReviewerCredentialRepository
{
  private readonly logger = new Logger(PrismaReviewerCredentialRepository.name);
  // Pre-migration in-memory buffer to support zero-downtime execution prior to migration deployment
  private readonly fallbackBuffer = new Map<string, ReviewerCredential>();

  constructor(private readonly prisma: PrismaService) {}

  private normalizeRegistration(reg: string): string {
    return reg.trim().toUpperCase();
  }

  async findByUserId(userId: string): Promise<ReviewerCredential | null> {
    try {
      const record = await this.prisma.reviewerCredential.findUnique({
        where: { userId },
      });
      return record ? this.mapToDomain(record) : null;
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        const found = Array.from(this.fallbackBuffer.values()).find(
          (c) => c.userId === userId,
        );
        return found ? { ...found } : null;
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ReviewerCredential | null> {
    try {
      const record = await this.prisma.reviewerCredential.findUnique({
        where: { id },
      });
      return record ? this.mapToDomain(record) : null;
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        const found = this.fallbackBuffer.get(id);
        return found ? { ...found } : null;
      }
      throw error;
    }
  }

  async findByMedicalRegistration(
    reg: string,
  ): Promise<ReviewerCredential | null> {
    const normalized = this.normalizeRegistration(reg);
    try {
      const record = await this.prisma.reviewerCredential.findUnique({
        where: { medicalRegistration: normalized },
      });
      return record ? this.mapToDomain(record) : null;
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        const found = Array.from(this.fallbackBuffer.values()).find(
          (c) =>
            this.normalizeRegistration(c.medicalRegistration) === normalized,
        );
        return found ? { ...found } : null;
      }
      throw error;
    }
  }

  async save(credential: ReviewerCredential): Promise<ReviewerCredential> {
    const normalizedReg = this.normalizeRegistration(
      credential.medicalRegistration,
    );
    const domainEntity = {
      ...credential,
      medicalRegistration: normalizedReg,
    };

    try {
      const record = await this.prisma.reviewerCredential.create({
        data: {
          id: domainEntity.id,
          userId: domainEntity.userId,
          clinicianName: domainEntity.clinicianName,
          medicalRegistration: normalizedReg,
          stateMedicalCouncil: domainEntity.stateMedicalCouncil,
          registrationYear: domainEntity.registrationYear,
          primaryQualification: domainEntity.primaryQualification,
          specialtyQualification: domainEntity.specialtyQualification,
          specialty: domainEntity.specialty as any,
          yearsOfExperience: domainEntity.yearsOfExperience,
          isSeniorReviewer: domainEntity.isSeniorReviewer,
          verificationStatus: domainEntity.verificationStatus as any,
          verificationEvidence: domainEntity.verificationEvidence,
          verifiedByUserId: domainEntity.verifiedByUserId,
          verifiedAt: domainEntity.verifiedAt,
          rejectionReason: domainEntity.rejectionReason,
          credentialsExpiresAt: domainEntity.credentialsExpiresAt,
          isActive: domainEntity.isActive,
        },
      });

      // Record initial history event
      await this.recordHistory({
        credentialId: record.id,
        action: 'SUBMITTED',
        fromStatus: ReviewerVerificationStatus.PENDING,
        toStatus: ReviewerVerificationStatus.PENDING,
        actorUserId: domainEntity.userId,
        evidence: null,
        reason: null,
      });

      return this.mapToDomain(record);
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        this.fallbackBuffer.set(domainEntity.id, domainEntity);
        return { ...domainEntity };
      }
      throw error;
    }
  }

  async update(
    id: string,
    updates: Partial<ReviewerCredential>,
  ): Promise<ReviewerCredential> {
    const data: any = { ...updates };
    if (updates.medicalRegistration) {
      data.medicalRegistration = this.normalizeRegistration(
        updates.medicalRegistration,
      );
    }

    try {
      // Fetch prior state to record audit transition
      const prior = await this.prisma.reviewerCredential.findUnique({
        where: { id },
      });

      const updated = await this.prisma.reviewerCredential.update({
        where: { id },
        data,
      });

      if (prior && updates.verificationStatus && updates.verificationStatus !== prior.verificationStatus) {
        await this.recordHistory({
          credentialId: id,
          action: updates.verificationStatus,
          fromStatus: prior.verificationStatus as any,
          toStatus: updates.verificationStatus as any,
          actorUserId: updates.verifiedByUserId || prior.userId,
          evidence: updates.verificationEvidence || null,
          reason: updates.rejectionReason || null,
        });
      }

      return this.mapToDomain(updated);
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        const existing = this.fallbackBuffer.get(id);
        if (!existing) {
          throw new Error(`ReviewerCredential with ID ${id} not found in buffer.`);
        }
        const updated = { ...existing, ...data, updatedAt: new Date() };
        this.fallbackBuffer.set(id, updated);
        return { ...updated };
      }
      throw error;
    }
  }

  async findAll(): Promise<ReviewerCredential[]> {
    try {
      const records = await this.prisma.reviewerCredential.findMany();
      return records.map((r) => this.mapToDomain(r));
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        return Array.from(this.fallbackBuffer.values()).map((c) => ({ ...c }));
      }
      throw error;
    }
  }

  async findAllVerified(): Promise<ReviewerCredential[]> {
    try {
      const records = await this.prisma.reviewerCredential.findMany({
        where: {
          verificationStatus: ReviewerVerificationStatus.VERIFIED,
          isActive: true,
          OR: [
            { credentialsExpiresAt: null },
            { credentialsExpiresAt: { gt: new Date() } },
          ],
        },
      });
      return records.map((r) => this.mapToDomain(r));
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        return Array.from(this.fallbackBuffer.values())
          .filter(
            (c) =>
              c.verificationStatus === ReviewerVerificationStatus.VERIFIED &&
              c.isActive &&
              (!c.credentialsExpiresAt || c.credentialsExpiresAt > new Date()),
          )
          .map((c) => ({ ...c }));
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.prisma.reviewerVerificationHistory.deleteMany({});
      await this.prisma.reviewerCredential.deleteMany({});
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.fallbackBuffer.clear();
        return;
      }
      throw error;
    }
    this.fallbackBuffer.clear();
  }

  private async recordHistory(event: {
    credentialId: string;
    action: string;
    fromStatus: ReviewerVerificationStatus;
    toStatus: ReviewerVerificationStatus;
    actorUserId: string;
    evidence: string | null;
    reason: string | null;
  }): Promise<void> {
    try {
      await this.prisma.reviewerVerificationHistory.create({
        data: {
          credentialId: event.credentialId,
          action: event.action,
          fromStatus: event.fromStatus as any,
          toStatus: event.toStatus as any,
          actorUserId: event.actorUserId,
          evidence: event.evidence,
          reason: event.reason,
        },
      });
    } catch (error: any) {
      if (!this.isTableMissingError(error)) {
        this.logger.warn(`Could not persist reviewer verification history: ${error.message}`);
      }
    }
  }

  private mapToDomain(record: any): ReviewerCredential {
    return {
      id: record.id,
      userId: record.userId,
      clinicianName: record.clinicianName,
      medicalRegistration: record.medicalRegistration,
      stateMedicalCouncil: record.stateMedicalCouncil,
      registrationYear: record.registrationYear,
      primaryQualification: record.primaryQualification,
      specialtyQualification: record.specialtyQualification,
      specialty: record.specialty,
      yearsOfExperience: record.yearsOfExperience,
      isSeniorReviewer: record.isSeniorReviewer,
      verificationStatus: record.verificationStatus as ReviewerVerificationStatus,
      verificationEvidence: record.verificationEvidence,
      verifiedByUserId: record.verifiedByUserId,
      verifiedAt: record.verifiedAt,
      rejectionReason: record.rejectionReason,
      credentialsExpiresAt: record.credentialsExpiresAt,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private isTableMissingError(error: any): boolean {
    return (
      error.code === 'P2021' ||
      (error.message &&
        (error.message.includes('does not exist in the current database') ||
          error.message.includes('relation "reviewer_credentials" does not exist') ||
          error.message.includes('table "reviewer_credentials" does not exist')))
    );
  }

  private logTableMissingWarning(): void {
    this.logger.debug(
      'ReviewerCredential table pending migration in PostgreSQL. Operating via pre-migration buffer.',
    );
  }
}

