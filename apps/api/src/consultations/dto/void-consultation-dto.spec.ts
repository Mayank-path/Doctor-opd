import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VoidConsultationDto } from './void-consultation.dto';

describe('VoidConsultationDto Validation', () => {
  function createDto(payload: Record<string, unknown>): VoidConsultationDto {
    return plainToInstance(VoidConsultationDto, payload);
  }

  it('passes validation with a valid clinical reason', async () => {
    const dto = createDto({
      reason: 'Incorrect patient file selected during encounter entry',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when reason is missing or empty', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reason');
  });

  it('fails validation when reason is shorter than 5 characters', async () => {
    const dto = createDto({
      reason: 'void',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reason');
  });

  it('fails validation when reason exceeds 1000 characters', async () => {
    const dto = createDto({
      reason: 'a'.repeat(1001),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reason');
  });
});

