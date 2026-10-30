import { ValidationPipe } from '@nestjs/common';
import { ExtractStructuredClinicalDto } from './extract-structured-clinical.dto';

describe('ExtractStructuredClinicalDto Validation', () => {
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
      text: 'Mareez ko 3 din se bukhar hai, khansi nahi hai.',
    };

    const transformed = (await pipe.transform(payload, {
      type: 'body',
      metatype: ExtractStructuredClinicalDto,
    })) as ExtractStructuredClinicalDto;

    expect(transformed).toBeDefined();
    expect(transformed.text).toBe(
      'Mareez ko 3 din se bukhar hai, khansi nahi hai.',
    );
  });

  it('should preserve exact source text without trimming or mutating', async () => {
    const raw = '  Fever with cough  ';
    const payload = { text: raw };

    const transformed = (await pipe.transform(payload, {
      type: 'body',
      metatype: ExtractStructuredClinicalDto,
    })) as ExtractStructuredClinicalDto;

    expect(transformed.text).toBe(raw);
  });

  it('should accept valid Devanagari text with combining marks, ZWJ and ZWNJ', async () => {
    const devanagariText = 'मरीज़ को ३ दिन से तेज़ बुखार है। क्\u200Dय'; // Includes virama and ZWJ
    const payload = { text: devanagariText };

    const transformed = (await pipe.transform(payload, {
      type: 'body',
      metatype: ExtractStructuredClinicalDto,
    })) as ExtractStructuredClinicalDto;

    expect(transformed.text).toBe(devanagariText);
  });

  it('should accept standard whitespace like tabs and newlines', async () => {
    const textWithWhitespace = 'Fever\t2 days\nCough\r\nHeadache';
    const payload = { text: textWithWhitespace };

    const transformed = (await pipe.transform(payload, {
      type: 'body',
      metatype: ExtractStructuredClinicalDto,
    })) as ExtractStructuredClinicalDto;

    expect(transformed.text).toBe(textWithWhitespace);
  });

  it('should accept valid ISO 8601 encounterDate', async () => {
    const payload = {
      text: 'Patient has fever',
      encounterDate: '2026-10-30T10:00:00.000Z',
    };

    const transformed = (await pipe.transform(payload, {
      type: 'body',
      metatype: ExtractStructuredClinicalDto,
    })) as ExtractStructuredClinicalDto;

    expect(transformed.encounterDate).toBe('2026-10-30T10:00:00.000Z');
  });

  it('should reject invalid encounterDate', async () => {
    const payload = {
      text: 'Patient has fever',
      encounterDate: 'invalid-date',
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: ExtractStructuredClinicalDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject non-whitelisted properties (e.g. patientId or client findings)', async () => {
    const payload = {
      text: 'Patient has fever',
      patientId: '123e4567-e89b-12d3-a456-426614174000',
      findings: [{ term: 'Fever' }],
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: ExtractStructuredClinicalDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject missing text', async () => {
    const payload = {};
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: ExtractStructuredClinicalDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject empty or whitespace-only text', async () => {
    const payload = { text: '   \n\t  ' };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: ExtractStructuredClinicalDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject text exceeding 5000 characters', async () => {
    const payload = { text: 'a'.repeat(5001) };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: ExtractStructuredClinicalDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject prohibited C0 control characters (e.g. NULL byte)', async () => {
    const payload = { text: 'Fever\u0000tha' };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: ExtractStructuredClinicalDto,
      }),
    ).rejects.toThrow();
  });

  it('should reject prohibited BiDi override characters (e.g. U+202E RLO)', async () => {
    const payload = { text: 'Patient \u202Ereversed text' };
    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: ExtractStructuredClinicalDto,
      }),
    ).rejects.toThrow();
  });
});
