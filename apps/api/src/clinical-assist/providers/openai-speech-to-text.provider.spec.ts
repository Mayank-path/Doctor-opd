/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OpenAiSpeechToTextProvider } from './openai-speech-to-text.provider';

describe('OpenAiSpeechToTextProvider', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.STT_API_KEY = 'test-mock-api-key';
    process.env.STT_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
    process.env.STT_MODEL_NAME = 'gpt-4o-transcribe';
    process.env.STT_PROVIDER = 'openai';
    process.env.STT_TIMEOUT_MS = '1000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const dummyAudio = Buffer.from('RIFF....WAVEfmt ');

  it('initializes with configured model and provider name', () => {
    const provider = new OpenAiSpeechToTextProvider();
    expect(provider.providerName).toBe('openai');
    expect(provider.getModelName()).toBe('gpt-4o-transcribe');
    expect(provider.isProviderConfigured()).toBe(true);
  });

  it('supports disabled provider configuration without crashing startup', () => {
    process.env.STT_PROVIDER = 'disabled';
    delete process.env.STT_API_KEY;

    const provider = new OpenAiSpeechToTextProvider();
    expect(provider.isProviderConfigured()).toBe(false);

    return expect(
      provider.transcribe(dummyAudio, 'test.wav', 'audio/wav', {
        patientConsentVerified: true,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects external non-TLS URL during initialization', () => {
    process.env.STT_API_URL =
      'http://insecure-api.openai.com/v1/audio/transcriptions';
    expect(() => new OpenAiSpeechToTextProvider()).toThrow('TLS');
  });

  it('sends correct multipart request and parses successful transcription', async () => {
    let capturedUrl: string | undefined;
    let capturedHeaders: any;
    let capturedBody: any;

    global.fetch = jest.fn().mockImplementation(async (url, init) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      capturedBody = init.body;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          text: 'Mareez ko teen din se bukhar hai.',
          language: 'hindi',
          duration: 3.8,
        }),
      } as Response;
    });

    const provider = new OpenAiSpeechToTextProvider();
    const result = await provider.transcribe(
      dummyAudio,
      'recording.wav',
      'audio/wav',
      {
        languageHint: 'hi-IN',
        patientConsentVerified: true,
      },
    );

    expect(capturedUrl).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(capturedHeaders.Authorization).toBe('Bearer test-mock-api-key');
    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get('model')).toBe('gpt-4o-transcribe');
    expect(capturedBody.get('language')).toBe('hi'); // Mapped from hi-IN to hi
    expect(capturedBody.get('response_format')).toBe('verbose_json');

    expect(result.transcript).toBe('Mareez ko teen din se bukhar hai.');
    expect(result.detectedLanguage).toBe('hindi');
    expect(result.durationSeconds).toBe(3.8);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-transcribe');
  });

  it('omits language field when languageHint is auto or undefined', async () => {
    let capturedBody: any;
    global.fetch = jest.fn().mockImplementation(async (_url, init) => {
      capturedBody = init.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: 'Patient has mild fever' }),
      } as Response;
    });

    const provider = new OpenAiSpeechToTextProvider();
    await provider.transcribe(dummyAudio, 'recording.wav', 'audio/wav', {
      languageHint: 'auto',
      patientConsentVerified: true,
    });

    expect(capturedBody.get('language')).toBeNull();
  });

  it('handles empty transcription text gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: '   ' }),
    });

    const provider = new OpenAiSpeechToTextProvider();
    const result = await provider.transcribe(
      dummyAudio,
      'silent.wav',
      'audio/wav',
      {
        patientConsentVerified: true,
      },
    );

    expect(result.transcript).toBe('');
    expect(result.detectedLanguage).toBeNull();
  });

  it('handles provider timeout with GatewayTimeoutException (504)', async () => {
    global.fetch = jest.fn().mockImplementation(async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    });

    const provider = new OpenAiSpeechToTextProvider();
    await expect(
      provider.transcribe(dummyAudio, 'test.wav', 'audio/wav', {
        patientConsentVerified: true,
      }),
    ).rejects.toThrow(GatewayTimeoutException);
  });

  it('handles provider 401 authentication failure without leaking credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          message: 'Incorrect API key provided: sk-test-***',
          type: 'invalid_request_error',
        },
      }),
    });

    const provider = new OpenAiSpeechToTextProvider();
    const promise = provider.transcribe(dummyAudio, 'test.wav', 'audio/wav', {
      patientConsentVerified: true,
    });

    await expect(promise).rejects.toThrow(BadGatewayException);
    await expect(promise).rejects.not.toThrow(/sk-test/);
  });

  it('handles provider 429 quota/rate limit error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: 'Rate limit reached', type: 'insufficient_quota' },
      }),
    });

    const provider = new OpenAiSpeechToTextProvider();
    await expect(
      provider.transcribe(dummyAudio, 'test.wav', 'audio/wav', {
        patientConsentVerified: true,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('handles provider 400 bad request error with UnprocessableEntityException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'Corrupt audio file', type: 'invalid_request_error' },
      }),
    });

    const provider = new OpenAiSpeechToTextProvider();
    await expect(
      provider.transcribe(dummyAudio, 'corrupt.wav', 'audio/wav', {
        patientConsentVerified: true,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('handles provider 500 internal server error with BadGatewayException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: { message: 'Internal error', type: 'server_error' },
      }),
    });

    const provider = new OpenAiSpeechToTextProvider();
    await expect(
      provider.transcribe(dummyAudio, 'test.wav', 'audio/wav', {
        patientConsentVerified: true,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('handles corrupted non-JSON provider response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token < in JSON');
      },
    });

    const provider = new OpenAiSpeechToTextProvider();
    await expect(
      provider.transcribe(dummyAudio, 'test.wav', 'audio/wav', {
        patientConsentVerified: true,
      }),
    ).rejects.toThrow(BadGatewayException);
  });
});
