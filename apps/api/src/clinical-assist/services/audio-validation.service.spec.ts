import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AudioValidationService } from './audio-validation.service';
import { UploadedAudioFile } from '../interfaces/speech-to-text-provider.interface';

describe('AudioValidationService', () => {
  let service: AudioValidationService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STT_MAX_AUDIO_SIZE_BYTES;
    service = new AudioValidationService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const createWavBuffer = (): Buffer => {
    const buf = Buffer.alloc(44);
    buf.write('RIFF', 0, 'ascii');
    buf.writeUInt32LE(36, 4);
    buf.write('WAVE', 8, 'ascii');
    buf.write('fmt ', 12, 'ascii');
    return buf;
  };

  const createMp3Id3Buffer = (): Buffer => {
    const buf = Buffer.alloc(32);
    buf.write('ID3', 0, 'ascii');
    buf[3] = 0x03; // version
    return buf;
  };

  const createMp3SyncBuffer = (): Buffer => {
    const buf = Buffer.alloc(32);
    buf[0] = 0xff;
    buf[1] = 0xfb; // MPEG-1 Layer 3, no CRC
    return buf;
  };

  const createM4aFtypBuffer = (): Buffer => {
    const buf = Buffer.alloc(32);
    buf.writeUInt32BE(32, 0);
    buf.write('ftyp', 4, 'ascii');
    buf.write('M4A ', 8, 'ascii');
    return buf;
  };

  const createAacAdtsBuffer = (): Buffer => {
    const buf = Buffer.alloc(32);
    buf[0] = 0xff;
    buf[1] = 0xf1; // ADTS sync
    return buf;
  };

  const createOggBuffer = (): Buffer => {
    const buf = Buffer.alloc(32);
    buf.write('OggS', 0, 'ascii');
    return buf;
  };

  const createWebmBuffer = (): Buffer => {
    const buf = Buffer.alloc(32);
    buf[0] = 0x1a;
    buf[1] = 0x45;
    buf[2] = 0xdf;
    buf[3] = 0xa3;
    return buf;
  };

  const createFlacBuffer = (): Buffer => {
    const buf = Buffer.alloc(32);
    buf.write('fLaC', 0, 'ascii');
    return buf;
  };

  it('validates a proper WAV file', () => {
    const wav = createWavBuffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'recording.wav',
      encoding: '7bit',
      mimetype: 'audio/wav',
      size: wav.length,
      buffer: wav,
    };

    const result = service.validate(file);
    expect(result.format).toBe('wav');
    expect(result.mimeType).toBe('audio/wav');
    expect(result.sizeBytes).toBe(wav.length);
  });

  it('validates an MP3 file with ID3 tag', () => {
    const mp3 = createMp3Id3Buffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'voice.mp3',
      encoding: '7bit',
      mimetype: 'audio/mpeg',
      size: mp3.length,
      buffer: mp3,
    };

    const result = service.validate(file);
    expect(result.format).toBe('mp3');
    expect(result.mimeType).toBe('audio/mpeg');
  });

  it('validates an MP3 file with MPEG frame sync', () => {
    const mp3 = createMp3SyncBuffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'voice.mp3',
      encoding: '7bit',
      mimetype: 'audio/mpeg',
      size: mp3.length,
      buffer: mp3,
    };

    const result = service.validate(file);
    expect(result.format).toBe('mp3');
  });

  it('validates an M4A file with ftyp header', () => {
    const m4a = createM4aFtypBuffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'patient_symptoms.m4a',
      encoding: '7bit',
      mimetype: 'audio/m4a',
      size: m4a.length,
      buffer: m4a,
    };

    const result = service.validate(file);
    expect(result.format).toBe('m4a');
    expect(result.mimeType).toBe('audio/m4a');
  });

  it('validates raw AAC ADTS audio', () => {
    const aac = createAacAdtsBuffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'symptoms.aac',
      encoding: '7bit',
      mimetype: 'audio/aac',
      size: aac.length,
      buffer: aac,
    };

    const result = service.validate(file);
    expect(result.format).toBe('m4a');
  });

  it('validates OGG audio container', () => {
    const ogg = createOggBuffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'audio.ogg',
      encoding: '7bit',
      mimetype: 'audio/ogg',
      size: ogg.length,
      buffer: ogg,
    };

    const result = service.validate(file);
    expect(result.format).toBe('ogg');
  });

  it('validates WEBM audio container', () => {
    const webm = createWebmBuffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'audio.webm',
      encoding: '7bit',
      mimetype: 'audio/webm',
      size: webm.length,
      buffer: webm,
    };

    const result = service.validate(file);
    expect(result.format).toBe('webm');
  });

  it('validates FLAC audio container', () => {
    const flac = createFlacBuffer();
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'audio.flac',
      encoding: '7bit',
      mimetype: 'audio/flac',
      size: flac.length,
      buffer: flac,
    };

    const result = service.validate(file);
    expect(result.format).toBe('flac');
  });

  it('throws BadRequestException when file is missing', () => {
    expect(() => service.validate(undefined)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when file buffer is empty (0 bytes)', () => {
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'empty.wav',
      encoding: '7bit',
      mimetype: 'audio/wav',
      size: 0,
      buffer: Buffer.alloc(0),
    };

    expect(() => service.validate(file)).toThrow(BadRequestException);
  });

  it('throws UnsupportedMediaTypeException when file is smaller than 4 bytes', () => {
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'tiny.wav',
      encoding: '7bit',
      mimetype: 'audio/wav',
      size: 3,
      buffer: Buffer.from([0x01, 0x02, 0x03]),
    };

    expect(() => service.validate(file)).toThrow(UnsupportedMediaTypeException);
  });

  it('throws PayloadTooLargeException when file exceeds default 10MB limit', () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    largeBuffer.write('RIFF', 0, 'ascii');
    largeBuffer.write('WAVE', 8, 'ascii');

    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'huge.wav',
      encoding: '7bit',
      mimetype: 'audio/wav',
      size: largeBuffer.length,
      buffer: largeBuffer,
    };

    expect(() => service.validate(file)).toThrow(PayloadTooLargeException);
  });

  it('throws PayloadTooLargeException when file exceeds custom STT_MAX_AUDIO_SIZE_BYTES limit', () => {
    process.env.STT_MAX_AUDIO_SIZE_BYTES = '1024'; // 1KB limit
    const customService = new AudioValidationService();

    const buffer = Buffer.alloc(2048);
    buffer.write('RIFF', 0, 'ascii');
    buffer.write('WAVE', 8, 'ascii');

    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'recording.wav',
      encoding: '7bit',
      mimetype: 'audio/wav',
      size: buffer.length,
      buffer,
    };

    expect(() => customService.validate(file)).toThrow(
      PayloadTooLargeException,
    );
  });

  it('rejects non-audio file even if client claimed audio/wav MIME type', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 header text not an audio file');
    const file: UploadedAudioFile = {
      fieldname: 'audio',
      originalname: 'fakewav.wav',
      encoding: '7bit',
      mimetype: 'audio/wav', // Spoofed client MIME type
      size: pdfBuffer.length,
      buffer: pdfBuffer,
    };

    expect(() => service.validate(file)).toThrow(UnsupportedMediaTypeException);
  });
});
