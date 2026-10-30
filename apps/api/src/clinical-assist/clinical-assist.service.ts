import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import { TranscriptionResponseDto } from './dto/transcription-response.dto';
import { SPEECH_TO_TEXT_PROVIDER } from './interfaces/speech-to-text-provider.interface';
import type {
  SpeechToTextProvider,
  UploadedAudioFile,
} from './interfaces/speech-to-text-provider.interface';
import { AudioValidationService } from './services/audio-validation.service';
import { TranscriptionAuditService } from './services/transcription-audit.service';

export interface RequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ClinicalAssistService {
  private readonly logger = new Logger(ClinicalAssistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audioValidationService: AudioValidationService,
    private readonly auditService: TranscriptionAuditService,
    @Inject(SPEECH_TO_TEXT_PROVIDER)
    private readonly sttProvider: SpeechToTextProvider,
  ) {}

  async transcribeAudio(
    clinicId: string,
    doctorId: string,
    file: UploadedAudioFile | undefined,
    dto: TranscribeAudioDto,
    reqMeta?: RequestMetadata,
  ): Promise<TranscriptionResponseDto> {
    const startTime = Date.now();

    // 1. Consent Attestation check
    if (dto.patientConsentVerified !== true) {
      throw new BadRequestException(
        'Patient consent for cloud audio processing must be explicitly verified and attested',
      );
    }

    // 2. Doctor Active Membership Verification
    const membership = await this.prisma.clinicMembership.findUnique({
      where: {
        userId_clinicId: {
          userId: doctorId,
          clinicId,
        },
      },
    });

    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      membership.role !== ClinicRole.DOCTOR
    ) {
      throw new ForbiddenException(
        'Clinician is not an active doctor in this clinic',
      );
    }

    // 3. Patient Belongs to Active Clinic Verification
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: dto.patientId,
        clinicId,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found in active clinic');
    }

    // 4. Audio Content & Format Validation
    let validatedAudio;
    try {
      validatedAudio = this.audioValidationService.validate(file);
    } catch (validationErr) {
      // Clean up temporary disk file if one was created
      if (file?.path) {
        await this.safelyRemoveTempFile(file.path);
      }
      throw validationErr;
    }

    let result;
    try {
      // 5. Invoke configured Speech-to-Text provider
      result = await this.sttProvider.transcribe(
        validatedAudio.buffer,
        validatedAudio.filename,
        validatedAudio.mimeType,
        {
          languageHint: dto.languageHint,
          patientConsentVerified: dto.patientConsentVerified,
        },
      );

      const executionDurationMs = Date.now() - startTime;

      // 6. Record success audit event (Zero PHI, zero audio bytes, zero transcript text stored)
      await this.auditService.record({
        clinicId,
        userId: doctorId,
        patientId: dto.patientId,
        action: 'STT_TRANSCRIPTION_SUCCESS',
        provider: result.provider,
        model: result.model,
        languageHint: result.languageHint,
        detectedLanguage: result.detectedLanguage,
        durationSeconds: result.durationSeconds,
        audioSizeBytes: validatedAudio.sizeBytes,
        audioFormat: validatedAudio.format,
        executionDurationMs,
        status: 'SUCCESS',
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      return {
        transcript: result.transcript,
        languageHint: result.languageHint ?? null,
        detectedLanguage: result.detectedLanguage ?? null,
        durationSeconds: result.durationSeconds ?? null,
        provider: result.provider,
        model: result.model,
      };
    } catch (providerError) {
      const executionDurationMs = Date.now() - startTime;
      const errorCode =
        providerError instanceof Error ? providerError.name : 'STT_ERROR';

      // Record failure audit event
      await this.auditService.record({
        clinicId,
        userId: doctorId,
        patientId: dto.patientId,
        action: 'STT_TRANSCRIPTION_FAILED',
        provider: this.sttProvider.providerName,
        model: this.sttProvider.defaultModel,
        audioSizeBytes: validatedAudio.sizeBytes,
        audioFormat: validatedAudio.format,
        executionDurationMs,
        status: 'FAILED',
        errorCode,
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      throw providerError;
    } finally {
      // Guaranteed cleanup if file was written to disk
      if (file?.path) {
        await this.safelyRemoveTempFile(file.path);
      }
    }
  }

  private async safelyRemoveTempFile(path: string): Promise<void> {
    try {
      await fs.unlink(path);
    } catch (unlinkErr) {
      const message =
        unlinkErr instanceof Error ? unlinkErr.message : 'Unknown unlink error';
      this.logger.warn(
        `Failed to cleanup temp audio file at ${path}: ${message}`,
      );
    }
  }
}
