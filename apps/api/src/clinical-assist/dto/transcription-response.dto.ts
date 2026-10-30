export class TranscriptionResponseDto {
  transcript: string;
  languageHint: string | null;
  detectedLanguage: string | null;
  durationSeconds: number | null;
  provider: string;
  model: string;
}
