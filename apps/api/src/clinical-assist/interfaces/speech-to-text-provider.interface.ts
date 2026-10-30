export interface TranscriptionOptions {
  languageHint?: string;
  patientConsentVerified: boolean;
}

export interface TranscriptionResult {
  transcript: string;
  languageHint?: string | null;
  detectedLanguage?: string | null;
  durationSeconds?: number | null;
  provider: string;
  model: string;
}

export interface SpeechToTextProvider {
  readonly providerName: string;
  readonly defaultModel: string;
  transcribe(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    options: TranscriptionOptions,
  ): Promise<TranscriptionResult>;
}

export const SPEECH_TO_TEXT_PROVIDER = Symbol('SPEECH_TO_TEXT_PROVIDER');

export interface UploadedAudioFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}
