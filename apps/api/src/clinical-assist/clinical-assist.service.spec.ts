/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalAssistService } from './clinical-assist.service';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import {
  SPEECH_TO_TEXT_PROVIDER,
  SpeechToTextProvider,
  UploadedAudioFile,
} from './interfaces/speech-to-text-provider.interface';
import { AudioValidationService } from './services/audio-validation.service';
import { TranscriptionAuditService } from './services/transcription-audit.service';

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('ClinicalAssistService', () => {
  let service: ClinicalAssistService;
  let prisma: PrismaService;
  let auditService: TranscriptionAuditService;
  let sttProvider: SpeechToTextProvider;

  const mockClinicId = 'clinic-1111-1111-1111-111111111111';
  const mockDoctorId = 'doctor-2222-2222-2222-222222222222';
  const mockPatientId = 'patient-3333-3333-3333-333333333333';

  const mockWavBuffer = Buffer.from('RIFF....WAVEfmt ');
  const mockFile: UploadedAudioFile = {
    fieldname: 'audio',
    originalname: 'audio.wav',
    encoding: '7bit',
    mimetype: 'audio/wav',
    size: mockWavBuffer.length,
    buffer: mockWavBuffer,
  };

  const mockDto: TranscribeAudioDto = {
    patientId: mockPatientId,
    patientConsentVerified: true,
    languageHint: 'hi-IN',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalAssistService,
        {
          provide: PrismaService,
          useValue: {
            clinicMembership: {
              findUnique: jest.fn(),
            },
            patient: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: AudioValidationService,
          useValue: {
            validate: jest.fn().mockReturnValue({
              buffer: mockWavBuffer,
              format: 'wav',
              mimeType: 'audio/wav',
              filename: 'audio.wav',
              sizeBytes: mockWavBuffer.length,
            }),
          },
        },
        {
          provide: TranscriptionAuditService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SPEECH_TO_TEXT_PROVIDER,
          useValue: {
            providerName: 'openai',
            defaultModel: 'gpt-4o-transcribe',
            transcribe: jest.fn().mockResolvedValue({
              transcript: 'Patient has had mild fever for two days.',
              languageHint: 'hi-IN',
              detectedLanguage: 'hi',
              durationSeconds: 4.2,
              provider: 'openai',
              model: 'gpt-4o-transcribe',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ClinicalAssistService>(ClinicalAssistService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<TranscriptionAuditService>(
      TranscriptionAuditService,
    );
    sttProvider = module.get<SpeechToTextProvider>(SPEECH_TO_TEXT_PROVIDER);
  });

  it('transcribes audio successfully and records audit event', async () => {
    // 1. Mock active doctor membership
    (prisma.clinicMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: mockDoctorId,
      clinicId: mockClinicId,
      status: MembershipStatus.ACTIVE,
      role: ClinicRole.DOCTOR,
    });

    // 2. Mock patient found in active clinic
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({
      id: mockPatientId,
      clinicId: mockClinicId,
      fullName: 'John Doe',
    });

    const result = await service.transcribeAudio(
      mockClinicId,
      mockDoctorId,
      mockFile,
      mockDto,
      { ipAddress: '127.0.0.1', userAgent: 'Jest/Test' },
    );

    expect(result.transcript).toBe('Patient has had mild fever for two days.');
    expect(result.detectedLanguage).toBe('hi');
    expect(result.durationSeconds).toBe(4.2);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-transcribe');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: mockClinicId,
        userId: mockDoctorId,
        patientId: mockPatientId,
        action: 'STT_TRANSCRIPTION_SUCCESS',
        status: 'SUCCESS',
        provider: 'openai',
      }),
    );
  });

  it('rejects with BadRequestException if patient consent is false or missing', async () => {
    const invalidDto = { ...mockDto, patientConsentVerified: false };

    await expect(
      service.transcribeAudio(mockClinicId, mockDoctorId, mockFile, invalidDto),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.clinicMembership.findUnique).not.toHaveBeenCalled();
  });

  it('rejects with ForbiddenException if user is not an active DOCTOR in the clinic', async () => {
    (prisma.clinicMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: mockDoctorId,
      clinicId: mockClinicId,
      status: MembershipStatus.ACTIVE,
      role: ClinicRole.ADMIN, // Admin is not DOCTOR
    });

    await expect(
      service.transcribeAudio(mockClinicId, mockDoctorId, mockFile, mockDto),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it('rejects with NotFoundException if patient does not belong to active clinic', async () => {
    (prisma.clinicMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: mockDoctorId,
      clinicId: mockClinicId,
      status: MembershipStatus.ACTIVE,
      role: ClinicRole.DOCTOR,
    });

    // Patient not found in active clinic
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.transcribeAudio(mockClinicId, mockDoctorId, mockFile, mockDto),
    ).rejects.toThrow(NotFoundException);

    expect(sttProvider.transcribe).not.toHaveBeenCalled();
  });

  it('records failure audit event and rethrows when provider fails', async () => {
    (prisma.clinicMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: mockDoctorId,
      clinicId: mockClinicId,
      status: MembershipStatus.ACTIVE,
      role: ClinicRole.DOCTOR,
    });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({
      id: mockPatientId,
      clinicId: mockClinicId,
    });

    const providerError = new Error('Provider network timeout');
    providerError.name = 'GatewayTimeoutException';
    (sttProvider.transcribe as jest.Mock).mockRejectedValue(providerError);

    await expect(
      service.transcribeAudio(mockClinicId, mockDoctorId, mockFile, mockDto),
    ).rejects.toThrow(providerError);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: mockClinicId,
        userId: mockDoctorId,
        patientId: mockPatientId,
        action: 'STT_TRANSCRIPTION_FAILED',
        status: 'FAILED',
        errorCode: 'GatewayTimeoutException',
      }),
    );
  });

  it('guarantees cleanup of temporary disk file on success', async () => {
    (prisma.clinicMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: mockDoctorId,
      clinicId: mockClinicId,
      status: MembershipStatus.ACTIVE,
      role: ClinicRole.DOCTOR,
    });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({
      id: mockPatientId,
      clinicId: mockClinicId,
    });

    const tempDiskFile: UploadedAudioFile = {
      ...mockFile,
      path: '/tmp/temp-audio-upload-1234.wav',
    };

    await service.transcribeAudio(
      mockClinicId,
      mockDoctorId,
      tempDiskFile,
      mockDto,
    );

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/temp-audio-upload-1234.wav');
  });

  it('guarantees cleanup of temporary disk file on error', async () => {
    (prisma.clinicMembership.findUnique as jest.Mock).mockResolvedValue({
      userId: mockDoctorId,
      clinicId: mockClinicId,
      status: MembershipStatus.ACTIVE,
      role: ClinicRole.DOCTOR,
    });
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({
      id: mockPatientId,
      clinicId: mockClinicId,
    });

    (sttProvider.transcribe as jest.Mock).mockRejectedValue(
      new Error('Failed'),
    );

    const tempDiskFile: UploadedAudioFile = {
      ...mockFile,
      path: '/tmp/temp-audio-upload-fail.wav',
    };

    await expect(
      service.transcribeAudio(
        mockClinicId,
        mockDoctorId,
        tempDiskFile,
        mockDto,
      ),
    ).rejects.toThrow();

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/temp-audio-upload-fail.wav');
  });
});
