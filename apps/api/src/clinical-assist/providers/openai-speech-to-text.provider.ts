import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  SpeechToTextProvider,
  TranscriptionOptions,
  TranscriptionResult,
} from '../interfaces/speech-to-text-provider.interface';

@Injectable()
export class OpenAiSpeechToTextProvider implements SpeechToTextProvider {
  readonly providerName = 'openai';
  readonly defaultModel = 'gpt-4o-transcribe';

  private readonly logger = new Logger(OpenAiSpeechToTextProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;
  private readonly modelName: string;
  private readonly timeoutMs: number;
  private readonly isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.STT_API_KEY;
    this.apiUrl =
      process.env.STT_API_URL ||
      'https://api.openai.com/v1/audio/transcriptions';
    this.modelName = process.env.STT_MODEL_NAME || this.defaultModel;

    const timeoutRaw = process.env.STT_TIMEOUT_MS;
    this.timeoutMs = timeoutRaw ? parseInt(timeoutRaw, 10) || 30000 : 30000;

    const providerSetting = process.env.STT_PROVIDER;
    const isExplicitlyDisabled =
      providerSetting === 'disabled' || providerSetting === 'off';

    if (isExplicitlyDisabled || !this.apiKey) {
      this.isConfigured = false;
      this.logger.warn(
        'Speech-to-text provider is disabled or missing STT_API_KEY. Cloud transcription calls will be unavailable.',
      );
    } else {
      this.isConfigured = true;
      this.logger.log(
        `Speech-to-text provider configured (provider: ${this.providerName}, model: ${this.modelName})`,
      );
    }

    // TLS verification: ensure non-local endpoints use HTTPS
    if (
      this.apiUrl &&
      !this.apiUrl.startsWith('https://') &&
      !this.apiUrl.includes('localhost') &&
      !this.apiUrl.includes('127.0.0.1')
    ) {
      throw new Error(
        'STT_API_URL must use TLS (https://) for external cloud providers.',
      );
    }
  }

  getModelName(): string {
    return this.modelName;
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  getTimeoutMs(): number {
    return this.timeoutMs;
  }

  isProviderConfigured(): boolean {
    return this.isConfigured;
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    options: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    if (!this.isConfigured || !this.apiKey) {
      throw new ServiceUnavailableException(
        'Speech-to-text service is currently disabled or not configured',
      );
    }

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], {
      type: mimeType,
    });
    formData.append('file', audioBlob, filename);
    formData.append('model', this.modelName);
    formData.append('response_format', 'verbose_json');

    const mappedLanguage = this.mapLanguageHint(options.languageHint);
    if (mappedLanguage) {
      formData.append('language', mappedLanguage);
    }

    const startTime = Date.now();

    let response: Response;
    try {
      response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;
      if (err instanceof Error) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          this.logger.warn(`STT provider timed out after ${elapsed}ms`);
          throw new GatewayTimeoutException(
            'Speech-to-text provider timed out',
          );
        }
      }
      this.logger.error(
        `Network error connecting to STT provider (${elapsed}ms)`,
      );
      throw new BadGatewayException(
        'Failed to connect to speech-to-text provider',
      );
    }

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      await this.handleProviderError(response, elapsed);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      this.logger.error(
        `STT provider returned invalid non-JSON payload (${response.status}) in ${elapsed}ms`,
      );
      throw new BadGatewayException(
        'Speech-to-text provider returned an invalid response',
      );
    }

    const rawTranscript = typeof payload.text === 'string' ? payload.text : '';
    const detectedLanguage =
      typeof payload.language === 'string' && payload.language.trim().length > 0
        ? payload.language.trim()
        : null;

    const durationSeconds =
      typeof payload.duration === 'number' && !isNaN(payload.duration)
        ? payload.duration
        : null;

    this.logger.log(
      `STT transcription successful (model: ${this.modelName}, elapsed: ${elapsed}ms)`,
    );

    return {
      transcript: rawTranscript.trim(),
      languageHint: options.languageHint ?? null,
      detectedLanguage,
      durationSeconds,
      provider: this.providerName,
      model: this.modelName,
    };
  }

  /**
   * Maps client language hints (e.g., 'hi-IN', 'en-IN') to ISO-639-1 two-letter codes.
   */
  private mapLanguageHint(hint?: string): string | null {
    if (!hint || hint === 'auto') {
      return null;
    }
    const normalized = hint.toLowerCase().trim();
    if (normalized.startsWith('hi')) {
      return 'hi';
    }
    if (normalized.startsWith('en')) {
      return 'en';
    }
    return normalized.split('-')[0];
  }

  /**
   * Normalizes upstream HTTP errors into application-level exceptions
   * without leaking provider request headers or credentials.
   */
  private async handleProviderError(
    response: Response,
    elapsed: number,
  ): Promise<never> {
    const status = response.status;
    this.logger.warn(
      `STT provider returned HTTP status ${status} after ${elapsed}ms`,
    );

    // Consume response body safely for diagnostic categorization (sanitized)
    let providerErrorType: string | undefined;
    try {
      const errorJson = (await response.json()) as {
        error?: { type?: string; code?: string };
      };
      if (errorJson && errorJson.error && typeof errorJson.error === 'object') {
        providerErrorType = errorJson.error.type || errorJson.error.code;
      }
    } catch {
      // Ignore body parse errors on error streams
    }

    if (status === 401 || status === 403) {
      throw new BadGatewayException(
        'Speech-to-text provider authentication failed. Check server configuration.',
      );
    }

    if (status === 429) {
      throw new BadGatewayException(
        'Speech-to-text provider quota or rate limit exceeded',
      );
    }

    if (status === 400 || status === 422) {
      throw new UnprocessableEntityException(
        'Speech-to-text provider could not process the audio format or payload',
      );
    }

    if (status >= 500) {
      throw new BadGatewayException(
        `Speech-to-text provider encountered a temporary error (${providerErrorType || status})`,
      );
    }

    throw new BadGatewayException(
      'Speech-to-text provider failed to complete transcription',
    );
  }
}
