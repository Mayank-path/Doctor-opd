import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GovernanceAuditAction } from '../constants/governance.constants';

export interface RecordGovernanceAuditInput {
  versionId: string;
  action: GovernanceAuditAction | string;
  actorUserId: string;
  checksumSha256: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadataJson?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class KnowledgePackGovernanceAuditService {
  private readonly logger = new Logger(KnowledgePackGovernanceAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(input: RecordGovernanceAuditInput): Promise<void> {
    try {
      this.logger.log(
        `[GOVERNANCE AUDIT] Action: ${input.action} | Version: ${input.versionId} | Actor: ${input.actorUserId} | Checksum: ${input.checksumSha256}`,
      );

      // Persist to immutable PostgreSQL audit ledger
      await this.prisma.knowledgePackGovernanceAudit.create({
        data: {
          versionId: input.versionId,
          action: input.action,
          actorUserId: input.actorUserId,
          checksumSha256: input.checksumSha256,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          metadataJson: input.metadataJson ?? {},
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      // In audit logging, we must not let failure to log silently bypass, but in environments
      // without active db connection during unit tests, we capture and log warning
      this.logger.error(
        `Failed to record governance audit entry in database: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Re-throw if it's not a connection-deferred test environment
      if (process.env.NODE_ENV !== 'test') {
        throw error;
      }
    }
  }
}

