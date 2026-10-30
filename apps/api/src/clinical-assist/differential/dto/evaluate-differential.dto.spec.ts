import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { KnowledgePackDomain } from '@prisma/client';
import {
  EvaluationFindingStatus,
  InfectionSuspicionState,
} from '../../evaluator/ast-evaluator.types';
import {
  ClinicalFindingInputDto,
  DemographicOverrideDto,
  EvaluateDifferentialDto,
  VitalSignsInputDto,
} from './evaluate-differential.dto';

describe('EvaluateDifferentialDto — Validation & Safety Constraints', () => {
  const validPatientId = 'c8b417e9-4e4c-47b2-850d-82b5e2a22538';
  const validConsultationId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  function createDto(partial: Partial<EvaluateDifferentialDto>): EvaluateDifferentialDto {
    return plainToInstance(EvaluateDifferentialDto, {
      patientId: validPatientId,
      findings: [
        {
          canonicalTerm: 'Cough',
          status: EvaluationFindingStatus.PRESENT,
        },
      ],
      ...partial,
    });
  }

  it('should accept valid minimal payload', async () => {
    const dto = createDto({});
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.length).toBe(0);
  });

  it('should accept valid full payload with all sub-objects', async () => {
    const dto = createDto({
      consultationId: validConsultationId,
      domain: KnowledgePackDomain.GENERAL_MEDICINE,
      findings: [
        {
          canonicalTerm: 'Fever',
          conceptId: 'fever',
          status: EvaluationFindingStatus.PRESENT,
          durationDays: 3,
          severity: 'MODERATE',
          bodyLocation: 'Systemic',
        },
        {
          canonicalTerm: 'Chest pain',
          status: EvaluationFindingStatus.ABSENT,
        },
      ],
      vitals: {
        temperatureC: 38.5,
        systolicBp: 120,
        diastolicBp: 80,
        pulse: 78,
        spO2: 98,
        respiratoryRate: 18,
      },
      demographics: {
        ageYears: 42,
        gender: 'FEMALE',
        isPregnant: false,
      },
      infectionSuspicion: InfectionSuspicionState.SUSPECTED,
      assessments: [
        {
          examination: 'Chest auscultation',
          status: 'PERFORMED',
          reason: 'Normal vesicular breath sounds',
        },
      ],
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.length).toBe(0);
  });

  it('should reject invalid patientId (non-UUID)', async () => {
    const dto = createDto({ patientId: 'invalid-uuid-123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'patientId')).toBe(true);
  });

  it('should reject invalid consultationId (non-UUID)', async () => {
    const dto = createDto({ consultationId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'consultationId')).toBe(true);
  });

  it('should reject findings exceeding MAX_INPUT_FINDINGS (50)', async () => {
    const findings: ClinicalFindingInputDto[] = Array.from({ length: 51 }, (_, i) => ({
      canonicalTerm: `Symptom ${i}`,
      status: EvaluationFindingStatus.PRESENT,
    }));

    const dto = createDto({ findings });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'findings')).toBe(true);
  });

  it('should reject invalid finding status enum', async () => {
    const dto = plainToInstance(EvaluateDifferentialDto, {
      patientId: validPatientId,
      findings: [
        {
          canonicalTerm: 'Headache',
          status: 'CONFIRMED' as any, // Not an allowed finding status
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject negative durationDays on clinical finding', async () => {
    const dto = plainToInstance(EvaluateDifferentialDto, {
      patientId: validPatientId,
      findings: [
        {
          canonicalTerm: 'Headache',
          status: EvaluationFindingStatus.PRESENT,
          durationDays: -5,
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid demographic age (< 0 or > 130)', async () => {
    const dtoNegative = createDto({
      demographics: { ageYears: -1 },
    });
    const errorsNegative = await validate(dtoNegative);
    expect(errorsNegative.length).toBeGreaterThan(0);

    const dtoTooOld = createDto({
      demographics: { ageYears: 135 },
    });
    const errorsTooOld = await validate(dtoTooOld);
    expect(errorsTooOld.length).toBeGreaterThan(0);
  });

  it('should reject invalid demographic gender', async () => {
    const dto = createDto({
      demographics: { gender: 'UNKNOWN_GENDER' as any },
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid infectionSuspicion enum value', async () => {
    const dto = createDto({
      infectionSuspicion: 'LIKELY' as any,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'infectionSuspicion')).toBe(true);
  });

  it('should reject unexpected non-whitelisted properties', async () => {
    const rawPayload: any = {
      patientId: validPatientId,
      findings: [
        {
          canonicalTerm: 'Cough',
          status: EvaluationFindingStatus.PRESENT,
        },
      ],
      maliciousField: 'exploit',
      clientClinicId: 'injected-clinic-id',
    };

    const dto = plainToInstance(EvaluateDifferentialDto, rawPayload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'maliciousField' || e.property === 'clientClinicId')).toBe(true);
  });
});
