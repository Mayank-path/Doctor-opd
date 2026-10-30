import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { UploadedAudioFile } from '../interfaces/speech-to-text-provider.interface';

export interface ValidatedAudio {
  buffer: Buffer;
  format: 'wav' | 'mp3' | 'm4a' | 'ogg' | 'webm' | 'flac';
  mimeType: string;
  filename: string;
  sizeBytes: number;
}

@Injectable()
export class AudioValidationService {
  private readonly defaultMaxSize = 10 * 1024 * 1024; // 10MB

  getMaxAudioSizeBytes(): number {
    const raw = process.env.STT_MAX_AUDIO_SIZE_BYTES;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return this.defaultMaxSize;
  }

  validate(file?: UploadedAudioFile): ValidatedAudio {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    const buffer = file.buffer;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException(
        'Audio file is empty or missing audio content',
      );
    }

    const maxSize = this.getMaxAudioSizeBytes();
    if (buffer.length > maxSize || (file.size && file.size > maxSize)) {
      throw new PayloadTooLargeException(
        `Audio file size (${buffer.length} bytes) exceeds maximum limit of ${maxSize} bytes`,
      );
    }

    // Minimum header inspection threshold: need at least 4 bytes for magic numbers
    if (buffer.length < 4) {
      throw new UnsupportedMediaTypeException(
        'Malformed audio: file is too small to contain valid audio headers',
      );
    }

    const format = this.detectAudioFormat(buffer);
    if (!format) {
      throw new UnsupportedMediaTypeException(
        'Unsupported audio format. Supported formats: M4A, AAC, WAV, MP3, OGG, WEBM, FLAC',
      );
    }

    const mimeType = this.resolveMimeType(format, file.mimetype);
    const originalName = file.originalname || `recording.${format}`;
    const filename = originalName.includes('.')
      ? originalName
      : `${originalName}.${format}`;

    return {
      buffer,
      format,
      mimeType,
      filename,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Inspects binary magic numbers/signatures to determine the audio container format.
   * Does not rely on client-supplied extensions or Content-Type headers.
   */
  private detectAudioFormat(
    buffer: Buffer,
  ): 'wav' | 'mp3' | 'm4a' | 'ogg' | 'webm' | 'flac' | null {
    // 1. WAV: 'RIFF' at 0..3 and 'WAVE' at 8..11
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    ) {
      return 'wav';
    }

    // 2. MP3: ID3v2 tag ('ID3' at 0..2)
    if (
      buffer.length >= 3 &&
      buffer.subarray(0, 3).toString('ascii') === 'ID3'
    ) {
      return 'mp3';
    }

    // 3. M4A / AAC in MP4 container: 'ftyp' at offset 4..7
    if (
      buffer.length >= 8 &&
      buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    ) {
      return 'm4a';
    }

    // 3b. Raw AAC ADTS sync: 12 bits 0xFFF followed by Layer 00 -> 0xFF followed by 0xF0..0xF1
    if (
      buffer.length >= 2 &&
      buffer[0] === 0xff &&
      (buffer[1] & 0xf6) === 0xf0
    ) {
      return 'm4a';
    }

    // 2b. MP3: MPEG Audio Layer III sync word (first 11 bits are 1s, bits 2..1 are 01 for Layer III)
    if (
      buffer.length >= 2 &&
      buffer[0] === 0xff &&
      (buffer[1] & 0xe0) === 0xe0 &&
      (buffer[1] & 0x06) === 0x02 &&
      (buffer[1] & 0x18) !== 0x08
    ) {
      return 'mp3';
    }

    // 4. OGG: 'OggS' at offset 0..3
    if (
      buffer.length >= 4 &&
      buffer.subarray(0, 4).toString('ascii') === 'OggS'
    ) {
      return 'ogg';
    }

    // 5. WEBM: EBML Header [0x1A, 0x45, 0xDF, 0xA3]
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    ) {
      return 'webm';
    }

    // 6. FLAC: 'fLaC' at offset 0..3
    if (
      buffer.length >= 4 &&
      buffer.subarray(0, 4).toString('ascii') === 'fLaC'
    ) {
      return 'flac';
    }

    return null;
  }

  private resolveMimeType(
    format: 'wav' | 'mp3' | 'm4a' | 'ogg' | 'webm' | 'flac',
    clientMimeType?: string,
  ): string {
    const canonicalMap: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/m4a',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
      flac: 'audio/flac',
    };

    const canonical = canonicalMap[format] || 'audio/wav';

    // If client provided a valid matching audio mime type for this container, we can honor it
    if (clientMimeType && clientMimeType.startsWith('audio/')) {
      if (
        format === 'mp3' &&
        (clientMimeType === 'audio/mpeg' || clientMimeType === 'audio/mp3')
      ) {
        return clientMimeType;
      }
      if (
        format === 'wav' &&
        (clientMimeType === 'audio/wav' || clientMimeType === 'audio/x-wav')
      ) {
        return clientMimeType;
      }
      if (
        format === 'm4a' &&
        (clientMimeType === 'audio/m4a' ||
          clientMimeType === 'audio/mp4' ||
          clientMimeType === 'audio/aac' ||
          clientMimeType === 'audio/x-m4a')
      ) {
        return clientMimeType;
      }
      if (
        format === 'ogg' &&
        (clientMimeType === 'audio/ogg' || clientMimeType === 'audio/opus')
      ) {
        return clientMimeType;
      }
      if (format === 'webm' && clientMimeType === 'audio/webm') {
        return clientMimeType;
      }
    }

    return canonical;
  }
}
