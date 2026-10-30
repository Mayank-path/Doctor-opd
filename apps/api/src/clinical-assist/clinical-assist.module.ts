import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { ClinicalAssistController } from './clinical-assist.controller';
import { ClinicalAssistService } from './clinical-assist.service';
import { SttThrottlerGuard } from './guards/stt-throttler.guard';
import { SPEECH_TO_TEXT_PROVIDER } from './interfaces/speech-to-text-provider.interface';
import { DifferentialDiagnosisModule } from './differential/differential-diagnosis.module';
import { ClinicalExtractionModule } from './extraction/clinical-extraction.module';
import { ClinicalNormalizationModule } from './normalization/clinical-normalization.module';
import { ClinicalGovernanceModule } from './governance/clinical-governance.module';
import { OpenAiSpeechToTextProvider } from './providers/openai-speech-to-text.provider';
import { AudioValidationService } from './services/audio-validation.service';
import { TranscriptionAuditService } from './services/transcription-audit.service';

const getRateLimitTtlMs = (): number => {
  const envTtl = process.env.STT_RATE_LIMIT_TTL;
  if (envTtl) {
    const parsed = parseInt(envTtl, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed * 1000;
  }
  return 60 * 1000; // 60 seconds
};

const getRateLimitMax = (): number => {
  const envMax = process.env.STT_RATE_LIMIT_MAX;
  if (envMax) {
    const parsed = parseInt(envMax, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 10; // 10 requests per TTL window
};

@Module({
  imports: [
    PrismaModule,
    ClinicalNormalizationModule,
    ClinicalExtractionModule,
    DifferentialDiagnosisModule,
    ClinicalGovernanceModule,
    ThrottlerModule.forRoot([
      {
        ttl: getRateLimitTtlMs(),
        limit: getRateLimitMax(),
      },
    ]),
  ],
  controllers: [ClinicalAssistController],
  providers: [
    ClinicalAssistService,
    AudioValidationService,
    TranscriptionAuditService,
    SttThrottlerGuard,
    {
      provide: SPEECH_TO_TEXT_PROVIDER,
      useClass: OpenAiSpeechToTextProvider,
    },
  ],
  exports: [
    ClinicalAssistService,
    SPEECH_TO_TEXT_PROVIDER,
    ClinicalNormalizationModule,
    ClinicalExtractionModule,
    DifferentialDiagnosisModule,
    ClinicalGovernanceModule,
  ],
})
export class ClinicalAssistModule {}
