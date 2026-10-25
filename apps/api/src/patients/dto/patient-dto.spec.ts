import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { CreatePatientDto } from './create-patient.dto';
import { UpdatePatientDto } from './update-patient.dto';
import { PatientSearchQueryDto } from './patient-search-query.dto';

describe('Patient DTO Validation (Global ValidationPipe Rules)', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  describe('CreatePatientDto', () => {
    const validPayload = {
      fullName: 'Vikram Mehta',
      gender: Gender.MALE,
      dateOfBirth: '1985-11-20',
      phone: '+919876543210',
      alternatePhone: '022 2654 3210',
      email: 'VIKRAM.MEHTA@HOSPITAL.COM ',
      address: '42 Marine Drive',
      city: 'Mumbai',
      pincode: '400020',
    };

    it('should accept valid payload, normalize email to lowercase, and trim strings', async () => {
      const transformed = (await pipe.transform(validPayload, {
        type: 'body',
        metatype: CreatePatientDto,
      })) as CreatePatientDto;

      expect(transformed.fullName).toBe('Vikram Mehta');
      expect(transformed.email).toBe('vikram.mehta@hospital.com');
      expect(transformed.phone).toBe('+919876543210');
      expect(transformed.dateOfBirth).toBe('1985-11-20');
      expect(transformed.gender).toBe(Gender.MALE);
    });

    it('should reject when fullName is missing or empty', async () => {
      await expect(
        pipe.transform(
          { ...validPayload, fullName: '' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when gender is not a valid Gender enum value', async () => {
      await expect(
        pipe.transform(
          { ...validPayload, gender: 'INVALID_GENDER' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject future dates for dateOfBirth', async () => {
      const futureYear = new Date().getFullYear() + 2;
      await expect(
        pipe.transform(
          { ...validPayload, dateOfBirth: `${futureYear}-01-01` },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid calendar dates for dateOfBirth (e.g. Feb 30)', async () => {
      await expect(
        pipe.transform(
          { ...validPayload, dateOfBirth: '2023-02-30' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject malformed date format for dateOfBirth (e.g. DD/MM/YYYY)', async () => {
      await expect(
        pipe.transform(
          { ...validPayload, dateOfBirth: '20/11/1985' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid phone representations (e.g. letters or too short)', async () => {
      await expect(
        pipe.transform(
          { ...validPayload, phone: '123' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { ...validPayload, phone: 'phone-with-letters' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject client-supplied forbidden fields (clinicId, uhid, id, isActive, deletedAt)', async () => {
      await expect(
        pipe.transform(
          { ...validPayload, clinicId: 'injected-clinic-id' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { ...validPayload, uhid: 'UHID-999999' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { ...validPayload, id: 'client-chosen-uuid' },
          { type: 'body', metatype: CreatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('UpdatePatientDto', () => {
    it('should accept valid partial demographic updates', async () => {
      const updatePayload = {
        city: 'Bengaluru',
        alternatePhone: null,
      };

      const transformed = (await pipe.transform(updatePayload, {
        type: 'body',
        metatype: UpdatePatientDto,
      })) as UpdatePatientDto;

      expect(transformed.city).toBe('Bengaluru');
      expect(transformed.alternatePhone).toBeNull();
    });

    it('should reject attempts to update forbidden fields like clinicId or uhid', async () => {
      await expect(
        pipe.transform(
          { city: 'Bengaluru', uhid: 'UHID-000001' },
          { type: 'body', metatype: UpdatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject clearing required fields with empty string', async () => {
      await expect(
        pipe.transform(
          { fullName: '' },
          { type: 'body', metatype: UpdatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { phone: '' },
          { type: 'body', metatype: UpdatePatientDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('PatientSearchQueryDto', () => {
    it('should apply defaults when query parameters are omitted', async () => {
      const transformed = (await pipe.transform(
        {},
        { type: 'query', metatype: PatientSearchQueryDto },
      )) as PatientSearchQueryDto;

      expect(transformed.page).toBe(1);
      expect(transformed.limit).toBe(20);
      expect(transformed.q).toBeUndefined();
    });

    it('should reject search term q when length is less than 2 characters', async () => {
      await expect(
        pipe.transform(
          { q: 'a' },
          { type: 'query', metatype: PatientSearchQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject page numbers less than 1', async () => {
      await expect(
        pipe.transform(
          { page: 0 },
          { type: 'query', metatype: PatientSearchQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject limit greater than 50', async () => {
      await expect(
        pipe.transform(
          { limit: 51 },
          { type: 'query', metatype: PatientSearchQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject injected clinicId in query parameters (forbidNonWhitelisted)', async () => {
      await expect(
        pipe.transform(
          { clinicId: 'injected-clinic-id' },
          { type: 'query', metatype: PatientSearchQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
