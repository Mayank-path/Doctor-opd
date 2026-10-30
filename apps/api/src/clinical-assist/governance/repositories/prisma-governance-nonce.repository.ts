import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  GovernanceNonceEntity,
  IGovernanceNonceRepository,
} from '../interfaces/governance-nonce-repository.interface';

@Injectable()
export class PrismaGovernanceNonceRepository
  implements IGovernanceNonceRepository
{
  private readonly logger = new Logger(PrismaGovernanceNonceRepository.name);
  // Pre-migration in-memory buffer if table has not yet been deployed to PostgreSQL
  private readonly preMigrationBuffer = new Map<string, GovernanceNonceEntity>();
  private isTablePendingMigration = false;

  constructor(private readonly prisma: PrismaService) {}

  async isConsumed(nonce: string): Promise<boolean> {
    const normalizedNonce = nonce.trim();

    if (this.isTablePendingMigration) {
      return this.preMigrationBuffer.has(normalizedNonce);
    }

    try {
      const existing = await (this.prisma as any).governanceAttestationNonce.findUnique({
        where: { nonce: normalizedNonce },
      });
      return !!existing;
    } catch (err: any) {
      if (err.code === 'P2021') {
        this.isTablePendingMigration = true;
        this.logger.debug(
          'GovernanceAttestationNonce table pending migration in PostgreSQL. Operating via pre-migration buffer.',
        );
        return this.preMigrationBuffer.has(normalizedNonce);
      }
      throw err;
    }
  }

  async consumeAtomic(
    nonce: string,
    versionId: string,
    reviewerUserId: string,
  ): Promise<GovernanceNonceEntity> {
    const normalizedNonce = nonce.trim();

    if (this.isTablePendingMigration) {
      return this.consumeInMemory(normalizedNonce, versionId, reviewerUserId);
    }

    try {
      const created = await (this.prisma as any).governanceAttestationNonce.create({
        data: {
          nonce: normalizedNonce,
          versionId,
          reviewerUserId,
        },
      });

      return {
        id: created.id,
        nonce: created.nonce,
        versionId: created.versionId,
        reviewerUserId: created.reviewerUserId,
        consumedAt: created.consumedAt,
      };
    } catch (err: any) {
      // P2002: Unique constraint failed on the fields: (`nonce`)
      if (err.code === 'P2002') {
        throw new ConflictException(
          `Signature Replay Violation: Nonce ${normalizedNonce} has already been consumed in a prior approval.`,
        );
      }

      // P2021: Table does not exist in target database (pre-migration safety)
      if (err.code === 'P2021') {
        this.isTablePendingMigration = true;
        this.logger.debug(
          'GovernanceAttestationNonce table pending migration in PostgreSQL. Operating via pre-migration buffer.',
        );
        return this.consumeInMemory(normalizedNonce, versionId, reviewerUserId);
      }

      throw err;
    }
  }

  private consumeInMemory(
    nonce: string,
    versionId: string,
    reviewerUserId: string,
  ): GovernanceNonceEntity {
    if (this.preMigrationBuffer.has(nonce)) {
      throw new ConflictException(
        `Signature Replay Violation: Nonce ${nonce} has already been consumed in a prior approval.`,
      );
    }

    const entity: GovernanceNonceEntity = {
      id: `nonce-${Math.random().toString(36).substring(7)}`,
      nonce,
      versionId,
      reviewerUserId,
      consumedAt: new Date(),
    };

    this.preMigrationBuffer.set(nonce, entity);
    return entity;
  }

  async clear(): Promise<void> {
    this.preMigrationBuffer.clear();
    if (!this.isTablePendingMigration) {
      try {
        await (this.prisma as any).governanceAttestationNonce.deleteMany();
      } catch (err: any) {
        if (err.code === 'P2021') {
          this.isTablePendingMigration = true;
        }
      }
    }
  }
}
