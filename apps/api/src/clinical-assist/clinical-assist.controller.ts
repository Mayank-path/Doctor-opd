import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { ClinicRole } from '@prisma/client';
import { ActiveClinic } from '../auth/decorators/active-clinic.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicalAssistService } from './clinical-assist.service';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import { TranscriptionResponseDto } from './dto/transcription-response.dto';
import { MulterExceptionFilter } from './filters/multer-exception.filter';
import { SttThrottlerGuard } from './guards/stt-throttler.guard';
import { UploadedAudioFile } from './interfaces/speech-to-text-provider.interface';

const getMaxUploadSizeBytes = (): number => {
  const envSize = process.env.STT_MAX_AUDIO_SIZE_BYTES;
  if (envSize) {
    const parsed = parseInt(envSize, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 10 * 1024 * 1024; // 10MB default
};

@Controller('clinical-assist')
@UseGuards(JwtAuthGuard, ClinicAuthGuard, SttThrottlerGuard)
@UseFilters(MulterExceptionFilter)
export class ClinicalAssistController {
  constructor(private readonly clinicalAssistService: ClinicalAssistService) {}

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(ClinicRole.DOCTOR)
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: {
        fileSize: getMaxUploadSizeBytes(),
      },
    }),
  )
  async transcribe(
    @ActiveClinic('clinicId') clinicId: string,
    @CurrentUser('id') doctorId: string,
    @UploadedFile() file: UploadedAudioFile | undefined,
    @Body() dto: TranscribeAudioDto,
    @Req() req: Request,
  ): Promise<TranscriptionResponseDto> {
    const ipAddress = req.ip;
    const userAgent = (req.headers['user-agent'] as string) || undefined;

    return this.clinicalAssistService.transcribeAudio(
      clinicId,
      doctorId,
      file,
      dto,
      {
        ipAddress,
        userAgent,
      },
    );
  }
}
