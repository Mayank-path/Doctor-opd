import { ValidationPipe } from '@nestjs/common';
import { NormalizeClinicalTextDto } from './normalize-clinical-text.dto';

describe('NormalizeClinicalTextDto Validation', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  it('should accept valid non-empty clinical text', async () => {
    const payload = {
      text: 'Mareez ko teen din se bukhar hai.',
    };

    const transformed = (await pipe.transform(payload, {
      type: 'body',
      metatype: NormalizeClinicalTextDto,
    })) as NormalizeClinicalTextDto;

    expect(transformed).toBeDefined();
    expect(transformed.text).toBe('Mareez ko teen din se bukhar hai.');
  });

  it('should reject missing text with validation error', async () => {
    const payload = {};
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: NormalizeClinicalTextDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject empty or whitespace text', async () => {
    const payload = { text: '   ' };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: NormalizeClinicalTextDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject text exceeding 5000 characters', async () => {
    const payload = { text: 'a'.repeat(5001) };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: NormalizeClinicalTextDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject unwhitelisted properties', async () => {
    const payload = {
      text: 'Patient has fever.',
      extraProp: 'forbidden',
    };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: NormalizeClinicalTextDto,
      }),
    ).rejects.toThrow();
  });
});
