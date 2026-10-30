import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublicKeyStatus } from '../constants/governance.constants';
import { ReviewerPublicKeyEntity } from '../interfaces/attestation.interface';
import { IReviewerKeyRepository } from '../interfaces/reviewer-key-repository.interface';

@Injectable()
export class PrismaReviewerKeyRepository implements IReviewerKeyRepository {
  private readonly logger = new Logger(PrismaReviewerKeyRepository.name);
  private readonly fallbackBuffer = new Map<string, ReviewerPublicKeyEntity>();

  constructor(private readonly prisma: PrismaService) {}

  async save(key: ReviewerPublicKeyEntity): Promise<ReviewerPublicKeyEntity> {
    try {
      const record = await this.prisma.reviewerPublicKey.create({
        data: {
          id: key.id,
          reviewerUserId: key.reviewerUserId,
          publicKeyPem: key.publicKeyPem,
          keyAlgorithm: key.keyAlgorithm,
          keyFingerprint: key.keyFingerprint,
          status: key.status as any,
          expiresAt: key.expiresAt,
          revokedAt: key.revokedAt,
          revocationReason: key.revocationReason,
        },
      });
      return this.mapToDomain(record);
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        this.fallbackBuffer.set(key.id, { ...key });
        return { ...key };
      }
      throw error;
    }
  }

  async findActiveByUserId(
    reviewerUserId: string,
  ): Promise<ReviewerPublicKeyEntity | null> {
    try {
      const record = await this.prisma.reviewerPublicKey.findFirst({
        where: {
          reviewerUserId,
          status: PublicKeyStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      return record ? this.mapToDomain(record) : null;
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        const found = Array.from(this.fallbackBuffer.values())
          .filter(
            (k) =>
              k.reviewerUserId === reviewerUserId &&
              k.status === PublicKeyStatus.ACTIVE &&
              k.expiresAt > new Date(),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return found ? { ...found } : null;
      }
      throw error;
    }
  }

  async findByFingerprint(
    fingerprint: string,
  ): Promise<ReviewerPublicKeyEntity | null> {
    try {
      const record = await this.prisma.reviewerPublicKey.findUnique({
        where: { keyFingerprint: fingerprint },
      });
      return record ? this.mapToDomain(record) : null;
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        const found = Array.from(this.fallbackBuffer.values()).find(
          (k) => k.keyFingerprint === fingerprint,
        );
        return found ? { ...found } : null;
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ReviewerPublicKeyEntity | null> {
    try {
      const record = await this.prisma.reviewerPublicKey.findUnique({
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

  async update(
    id: string,
    updates: Partial<ReviewerPublicKeyEntity>,
  ): Promise<ReviewerPublicKeyEntity> {
    try {
      const updated = await this.prisma.reviewerPublicKey.update({
        where: { id },
        data: updates as any,
      });
      return this.mapToDomain(updated);
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        const existing = this.fallbackBuffer.get(id);
        if (!existing) {
          throw new Error(`ReviewerPublicKey with ID ${id} not found in buffer.`);
        }
        const updatedEntity = {
          ...existing,
          ...updates,
          updatedAt: new Date(),
        };
        this.fallbackBuffer.set(id, updatedEntity);
        return { ...updatedEntity };
      }
      throw error;
    }
  }

  async deactivateOtherKeysForUser(
    reviewerUserId: string,
    exceptKeyId: string,
  ): Promise<void> {
    try {
      await this.prisma.reviewerPublicKey.updateMany({
        where: {
          reviewerUserId,
          id: { not: exceptKeyId },
          status: PublicKeyStatus.ACTIVE,
        },
        data: {
          status: PublicKeyStatus.ROTATED as any,
        },
      });
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        for (const [id, key] of this.fallbackBuffer.entries()) {
          if (
            key.reviewerUserId === reviewerUserId &&
            id !== exceptKeyId &&
            key.status === PublicKeyStatus.ACTIVE
          ) {
            this.fallbackBuffer.set(id, {
              ...key,
              status: PublicKeyStatus.ROTATED,
              updatedAt: new Date(),
            });
          }
        }
        return;
      }
      throw error;
    }
  }

  async findAllByUserId(
    reviewerUserId: string,
  ): Promise<ReviewerPublicKeyEntity[]> {
    try {
      const records = await this.prisma.reviewerPublicKey.findMany({
        where: { reviewerUserId },
        orderBy: { createdAt: 'desc' },
      });
      return records.map((r) => this.mapToDomain(r));
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.logTableMissingWarning();
        return Array.from(this.fallbackBuffer.values())
          .filter((k) => k.reviewerUserId === reviewerUserId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((k) => ({ ...k }));
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.prisma.reviewerPublicKey.deleteMany({});
    } catch (error: any) {
      if (this.isTableMissingError(error)) {
        this.fallbackBuffer.clear();
        return;
      }
      throw error;
    }
    this.fallbackBuffer.clear();
  }

  private mapToDomain(record: any): ReviewerPublicKeyEntity {
    return {
      id: record.id,
      reviewerUserId: record.reviewerUserId,
      publicKeyPem: record.publicKeyPem,
      keyAlgorithm: record.keyAlgorithm,
      keyFingerprint: record.keyFingerprint,
      status: record.status as PublicKeyStatus,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      revocationReason: record.revocationReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private isTableMissingError(error: any): boolean {
    return (
      error.code === 'P2021' ||
      (error.message &&
        (error.message.includes('does not exist in the current database') ||
          error.message.includes('relation "reviewer_public_keys" does not exist') ||
          error.message.includes('table "reviewer_public_keys" does not exist')))
    );
  }

  private logTableMissingWarning(): void {
    this.logger.debug(
      'ReviewerPublicKey table pending migration in PostgreSQL. Operating via pre-migration buffer.',
    );
  }
}

