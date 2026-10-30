import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TranscribeAudioDto } from './transcribe-audio.dto';

describe('TranscribeAudioDto', () => {
  it('validates a correct payload with boolean true consent', async () => {
    const plain = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      patientConsentVerified: true,
      languageHint: 'hi-IN',
    };

    const instance = plainToInstance(TranscribeAudioDto, plain);
    const errors = await validate(instance);
    expect(errors.length).toBe(0);
  });

  it('transforms string "true" into boolean true and passes validation', async () => {
    const plain = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      patientConsentVerified: 'true',
      languageHint: 'en',
    };

    const instance = plainToInstance(TranscribeAudioDto, plain);
    const errors = await validate(instance);
    expect(errors.length).toBe(0);
    expect(instance.patientConsentVerified).toBe(true);
  });

  it('rejects string "false" or boolean false for patientConsentVerified', async () => {
    const plain = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      patientConsentVerified: 'false',
    };

    const instance = plainToInstance(TranscribeAudioDto, plain);
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('patientConsentVerified');
  });

  it('rejects invalid UUID for patientId', async () => {
    const plain = {
      patientId: 'not-a-uuid',
      patientConsentVerified: true,
    };

    const instance = plainToInstance(TranscribeAudioDto, plain);
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('patientId');
  });

  it('rejects unsupported languageHint', async () => {
    const plain = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      patientConsentVerified: true,
      languageHint: 'es-ES', // Spanish is not allowed
    };

    const instance = plainToInstance(TranscribeAudioDto, plain);
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('languageHint');
  });

  it('accepts optional languageHint when omitted', async () => {
    const plain = {
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      patientConsentVerified: true,
    };

    const instance = plainToInstance(TranscribeAudioDto, plain);
    const errors = await validate(instance);
    expect(errors.length).toBe(0);
  });
});
