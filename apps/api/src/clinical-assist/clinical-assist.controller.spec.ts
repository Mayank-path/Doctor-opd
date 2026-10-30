/* eslint-disable @typescript-eslint/unbound-method */
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ClinicRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicalAssistController } from './clinical-assist.controller';
import { ClinicalAssistService } from './clinical-assist.service';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import { SttThrottlerGuard } from './guards/stt-throttler.guard';
import { UploadedAudioFile } from './interfaces/speech-to-text-provider.interface';

describe('ClinicalAssistController', () => {
  let controller: ClinicalAssistController;
  let service: {
    transcribeAudio: jest.Mock;
  };
  let reflector: Reflector;

  const mockFile: UploadedAudioFile = {
    fieldname: 'audio',
    originalname: 'recording.wav',
    encoding: '7bit',
    mimetype: 'audio/wav',
    size: 16,
    buffer: Buffer.from('RIFF....WAVEfmt '),
  };

  const mockDto: TranscribeAudioDto = {
    patientId: '123e4567-e89b-12d3-a456-426614174000',
    patientConsentVerified: true,
    languageHint: 'hi-IN',
  };

  beforeEach(() => {
    service = {
      transcribeAudio: jest.fn().mockResolvedValue({
        transcript: 'Symptom audio text',
        languageHint: 'hi-IN',
        detectedLanguage: 'hi',
        durationSeconds: 2.5,
        provider: 'openai',
        model: 'gpt-4o-transcribe',
      }),
    };
    reflector = new Reflector();
    controller = new ClinicalAssistController(
      service as unknown as ClinicalAssistService,
    );
  });

  describe('Guard Configuration', () => {
    it('is protected by JwtAuthGuard, ClinicAuthGuard, and SttThrottlerGuard at class level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        ClinicalAssistController,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(ClinicAuthGuard);
      expect(guards).toContain(SttThrottlerGuard);
    });
  });

  describe('Role-Based Access Control', () => {
    it('transcribe endpoint restricts access strictly to DOCTOR role', () => {
      const roles = reflector.get<ClinicRole[]>(
        ROLES_KEY,
        controller.transcribe,
      );
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });
  });

  describe('transcribe', () => {
    it('delegates transcription call with correct parameters and metadata', async () => {
      const mockRequest = {
        ip: '192.168.1.50',
        headers: {
          'user-agent': 'DoctorOPD-Mobile/1.0.0',
        },
      } as unknown as Request;

      const result = await controller.transcribe(
        'clinic-uuid',
        'doctor-uuid',
        mockFile,
        mockDto,
        mockRequest,
      );

      expect(service.transcribeAudio).toHaveBeenCalledWith(
        'clinic-uuid',
        'doctor-uuid',
        mockFile,
        mockDto,
        {
          ipAddress: '192.168.1.50',
          userAgent: 'DoctorOPD-Mobile/1.0.0',
        },
      );

      expect(result.transcript).toBe('Symptom audio text');
      expect(result.provider).toBe('openai');
    });
  });
});
