import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateConsultationDto } from './update-consultation.dto';

describe('UpdateConsultationDto Validation', () => {
  function createDto(payload: Record<string, unknown>): UpdateConsultationDto {
    return plainToInstance(UpdateConsultationDto, payload);
  }

  it('passes validation with a valid partial update', async () => {
    const dto = createDto({
      chiefComplaint: 'Updated complaint: severe migraine',
      bpSystolic: 130,
      bpDiastolic: 85,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes validation when clearing optional fields to null', async () => {
    const dto = createDto({
      symptoms: null,
      examination: null,
      diagnosis: null,
      treatmentPlan: null,
      followUpDate: null,
      bpSystolic: null,
      bpDiastolic: null,
      pulse: null,
      temperature: null,
      weightKg: null,
      heightCm: null,
      spo2: null,
      respiratoryRate: null,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when chiefComplaint is empty string or whitespace', async () => {
    const dto = createDto({
      chiefComplaint: '   ',
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'chiefComplaint')).toBe(true);
  });

  it('fails validation when vitals exceed numeric limits', async () => {
    const dto = createDto({
      bpSystolic: 400,
      bpDiastolic: 250,
      pulse: 10,
      temperature: 130.0,
      weightKg: 600.0,
      spo2: 120,
      respiratoryRate: 150,
    });

    const errors = await validate(dto);
    const failedFields = errors.map((e) => e.property);
    expect(failedFields).toContain('bpSystolic');
    expect(failedFields).toContain('bpDiastolic');
    expect(failedFields).toContain('pulse');
    expect(failedFields).toContain('temperature');
    expect(failedFields).toContain('weightKg');
    expect(failedFields).toContain('spo2');
    expect(failedFields).toContain('respiratoryRate');
  });

  it('fails validation when followUpDate is formatted improperly', async () => {
    const dto = createDto({
      followUpDate: '2026/10/30',
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'followUpDate')).toBe(true);
  });
});
