import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  DosageForm,
  MedicationRoute,
  MedicationTiming,
  PrescriptionStatus,
} from '@prisma/client';
import { CreatePrescriptionItemDto } from './create-prescription-item.dto';
import { CreatePrescriptionDto } from './create-prescription.dto';
import { UpdatePrescriptionDto } from './update-prescription.dto';
import { ApprovePrescriptionDto } from './approve-prescription.dto';
import { AmendPrescriptionDto } from './amend-prescription.dto';
import { ListPrescriptionsQueryDto } from './list-prescriptions-query.dto';

describe('Prescription DTO Validations', () => {
  describe('CreatePrescriptionItemDto', () => {
    it('should pass with all required valid fields and defaults', async () => {
      const dto = plainToInstance(CreatePrescriptionItemDto, {
        medicationName: 'Amoxicillin',
        strength: '500 mg',
        frequency: '1-0-1',
        durationValue: 5,
        durationUnit: 'DAYS',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.dosageForm).toBe(DosageForm.TABLET);
      expect(dto.route).toBe(MedicationRoute.ORAL);
      expect(dto.timing).toBe(MedicationTiming.AFTER_MEALS);
      expect(dto.durationUnit).toBe('DAYS');
    });

    it('should fail when medicationName is empty', async () => {
      const dto = plainToInstance(CreatePrescriptionItemDto, {
        medicationName: '   ',
        strength: '500 mg',
        frequency: '1-0-1',
        durationValue: 5,
        durationUnit: 'DAYS',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'medicationName')).toBe(true);
    });

    it('should fail when durationValue is 0 or negative', async () => {
      const dto = plainToInstance(CreatePrescriptionItemDto, {
        medicationName: 'Amoxicillin',
        strength: '500 mg',
        frequency: '1-0-1',
        durationValue: 0,
        durationUnit: 'DAYS',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'durationValue')).toBe(true);
    });
  });

  describe('CreatePrescriptionDto', () => {
    it('should pass with valid patientId and at least one item', async () => {
      const dto = plainToInstance(CreatePrescriptionDto, {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          {
            medicationName: 'Paracetamol',
            strength: '650 mg',
            frequency: '1-1-1',
            durationValue: 3,
            durationUnit: 'DAYS',
          },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when items array is empty', async () => {
      const dto = plainToInstance(CreatePrescriptionDto, {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        items: [],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'items')).toBe(true);
    });

    it('should fail when patientId is not a valid UUID', async () => {
      const dto = plainToInstance(CreatePrescriptionDto, {
        patientId: 'not-a-uuid',
        items: [
          {
            medicationName: 'Paracetamol',
            strength: '650 mg',
            frequency: '1-1-1',
            durationValue: 3,
            durationUnit: 'DAYS',
          },
        ],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'patientId')).toBe(true);
    });
  });

  describe('UpdatePrescriptionDto', () => {
    it('should pass with optional notes or items', async () => {
      const dto = plainToInstance(UpdatePrescriptionDto, {
        notes: 'Updated advice to take rest',
        items: [
          {
            medicationName: 'Cetirizine',
            strength: '10 mg',
            frequency: '0-0-1',
            durationValue: 5,
            durationUnit: 'DAYS',
          },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('ApprovePrescriptionDto', () => {
    it('should pass when confirmApproval is explicitly true', async () => {
      const dto = plainToInstance(ApprovePrescriptionDto, {
        confirmApproval: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when confirmApproval is false', async () => {
      const dto = plainToInstance(ApprovePrescriptionDto, {
        confirmApproval: false,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'confirmApproval')).toBe(true);
    });
  });

  describe('AmendPrescriptionDto', () => {
    it('should pass with clear amendmentReason and valid items', async () => {
      const dto = plainToInstance(AmendPrescriptionDto, {
        amendmentReason: 'Patient developed rash; switching antibiotic',
        items: [
          {
            medicationName: 'Cefixime',
            strength: '200 mg',
            frequency: '1-0-1',
            durationValue: 5,
            durationUnit: 'DAYS',
          },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when amendmentReason is shorter than 5 characters', async () => {
      const dto = plainToInstance(AmendPrescriptionDto, {
        amendmentReason: 'bad',
        items: [
          {
            medicationName: 'Cefixime',
            strength: '200 mg',
            frequency: '1-0-1',
            durationValue: 5,
            durationUnit: 'DAYS',
          },
        ],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amendmentReason')).toBe(true);
    });
  });

  describe('ListPrescriptionsQueryDto', () => {
    it('should transform and validate valid pagination and status query', async () => {
      const dto = plainToInstance(ListPrescriptionsQueryDto, {
        page: '2',
        limit: '15',
        status: PrescriptionStatus.APPROVED,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(15);
      expect(dto.status).toBe(PrescriptionStatus.APPROVED);
    });

    it('should reject limit greater than 100', async () => {
      const dto = plainToInstance(ListPrescriptionsQueryDto, {
        limit: '250',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });
});
