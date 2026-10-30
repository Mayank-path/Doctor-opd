import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditRecordParams {
  clinicId: string;
  userId: string;
  patientId: string;
  action:
    | 'STT_TRANSCRIPTION_REQUESTED'
    | 'STT_TRANSCRIPTION_SUCCESS'
    | 'STT_TRANSCRIPTION_FAILED';
  provider: string;
  model: string;
  audioSizeBytes: number;
  audioFormat: string;
  executionDurationMs: number;
  status: 'SUCCESS' | 'FAILED';
  languageHint?: string | null;
  detectedLanguage?: string | null;
  durationSeconds?: number | null;
  errorCode?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class TranscriptionAuditService {
  private readonly logger = new Logger(TranscriptionAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: AuditRecordParams): Promise<void> {
    try {
      const metadata: Prisma.InputJsonValue = {
        provider: params.provider,
        model: params.model,
        audioSizeBytes: params.audioSizeBytes,
        audioFormat: params.audioFormat,
        executionDurationMs: params.executionDurationMs,
        status: params.status,
        languageHint: params.languageHint ?? null,
        detectedLanguage: params.detectedLanguage ?? null,
        durationSeconds: params.durationSeconds ?? null,
        ...(params.errorCode ? { errorCode: params.errorCode } : {}),
      };

      await this.prisma.clinicalAuditEvent.create({
        data: {
          clinicId: params.clinicId,
          userId: params.userId,
          action: params.action,
          entityType: 'Patient',
          entityId: params.patientId,
          metadata,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (err) {
      // Do not allow audit logging failure to crash clinical response, but log sanitized error
      const message =
        err instanceof Error ? err.message : 'Unknown database error';
      this.logger.error(`Failed to record clinical audit event: ${message}`);
    }
  }
}
