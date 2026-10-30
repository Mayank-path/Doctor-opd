import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateConsultationDto } from './create-consultation.dto';

describe('CreateConsultationDto Validation', () => {
  const validUuid = '11111111-1111-4111-a111-111111111111';

  function createDto(payload: Record<string, unknown>): CreateConsultationDto {
    return plainToInstance(CreateConsultationDto, payload);
  }

  it('passes validation with minimal valid fields', async () => {
    const dto = createDto({
      patientId: validUuid,
      chiefComplaint: 'Severe headache and fever',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes validation with all narrative and vital-sign fields populated', async () => {
    const dto = createDto({
      patientId: validUuid,
      encounterDate: '2026-10-26T10:00:00Z',
      chiefComplaint: 'Cough and throat pain for 3 days',
      symptoms: 'Dry cough, sore throat, mild chills',
      examination: 'Pharynx congested, tonsils enlarged',
      diagnosis: 'Acute pharyngitis',
      treatmentPlan: 'Hydration, paracetamol, saline gargles',
      followUpDate: '2026-11-02',
      bpSystolic: 120,
      bpDiastolic: 80,
      pulse: 72,
      temperature: 98.6,
      weightKg: 68.5,
      heightCm: 175.25,
      spo2: 98,
      respiratoryRate: 16,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when patientId is missing or invalid UUID', async () => {
    const missingDto = createDto({
      chiefComplaint: 'Fever',
    });
    const missingErrors = await validate(missingDto);
    expect(missingErrors.some((e) => e.property === 'patientId')).toBe(true);

    const invalidUuidDto = createDto({
      patientId: 'not-a-valid-uuid',
      chiefComplaint: 'Fever',
    });
    const invalidErrors = await validate(invalidUuidDto);
    expect(invalidErrors.some((e) => e.property === 'patientId')).toBe(true);
  });

  it('fails validation when chiefComplaint is empty or whitespace only', async () => {
    const emptyDto = createDto({
      patientId: validUuid,
      chiefComplaint: '   ',
    });
    const errors = await validate(emptyDto);
    expect(errors.some((e) => e.property === 'chiefComplaint')).toBe(true);
  });

  it('fails validation when chiefComplaint exceeds 500 characters', async () => {
    const tooLongDto = createDto({
      patientId: validUuid,
      chiefComplaint: 'A'.repeat(501),
    });
    const errors = await validate(tooLongDto);
    expect(errors.some((e) => e.property === 'chiefComplaint')).toBe(true);
  });

  it('fails validation when vitals are outside acceptable clinical bounds', async () => {
    const invalidVitalsDto = createDto({
      patientId: validUuid,
      chiefComplaint: 'Routine checkup',
      bpSystolic: 350, // Max 300
      bpDiastolic: 10, // Min 20
      pulse: 20, // Min 30
      temperature: 65.0, // Min 70.0
      weightKg: 0.1, // Min 0.5
      heightCm: 350.0, // Max 300.0
      spo2: 45, // Min 50
      respiratoryRate: 120, // Max 100
    });

    const errors = await validate(invalidVitalsDto);
    const failedFields = errors.map((e) => e.property);
    expect(failedFields).toContain('bpSystolic');
    expect(failedFields).toContain('bpDiastolic');
    expect(failedFields).toContain('pulse');
    expect(failedFields).toContain('temperature');
    expect(failedFields).toContain('weightKg');
    expect(failedFields).toContain('heightCm');
    expect(failedFields).toContain('spo2');
    expect(failedFields).toContain('respiratoryRate');
  });

  it('fails validation when followUpDate does not match YYYY-MM-DD', async () => {
    const badDateDto = createDto({
      patientId: validUuid,
      chiefComplaint: 'Back pain',
      followUpDate: '26/10/2026',
    });
    const errors = await validate(badDateDto);
    expect(errors.some((e) => e.property === 'followUpDate')).toBe(true);
  });
});
