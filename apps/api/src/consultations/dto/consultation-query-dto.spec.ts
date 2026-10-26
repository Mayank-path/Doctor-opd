import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConsultationStatus } from '@prisma/client';
import { ConsultationQueryDto } from './consultation-query.dto';
import { PatientConsultationHistoryQueryDto } from './patient-consultation-history-query.dto';

describe('ConsultationQueryDto', () => {
  it('applies default page and limit when empty object provided', async () => {
    const dto = plainToInstance(ConsultationQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.status).toBeUndefined();
    expect(dto.patientId).toBeUndefined();
  });

  it('transforms string page and limit to numbers and validates successfully', async () => {
    const dto = plainToInstance(ConsultationQueryDto, {
      page: '3',
      limit: '15',
      status: ConsultationStatus.FINALIZED,
      patientId: '11111111-1111-4111-8111-111111111111',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(15);
    expect(dto.status).toBe(ConsultationStatus.FINALIZED);
    expect(dto.patientId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejects page less than 1', async () => {
    const dto = plainToInstance(ConsultationQueryDto, { page: '0' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const pageError = errors.find((e) => e.property === 'page');
    expect(pageError).toBeDefined();
    expect(pageError?.constraints?.min).toBe('page must be at least 1');
  });

  it('rejects non-integer page', async () => {
    const dto = plainToInstance(ConsultationQueryDto, { page: 'invalid' });
    const errors = await validate(dto);
    const pageError = errors.find((e) => e.property === 'page');
    expect(pageError).toBeDefined();
  });

  it('rejects limit exceeding 50', async () => {
    const dto = plainToInstance(ConsultationQueryDto, { limit: '51' });
    const errors = await validate(dto);
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
    expect(limitError?.constraints?.max).toBe('limit cannot exceed 50');
  });

  it('rejects limit less than 1', async () => {
    const dto = plainToInstance(ConsultationQueryDto, { limit: '0' });
    const errors = await validate(dto);
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
    expect(limitError?.constraints?.min).toBe('limit must be at least 1');
  });

  it('rejects invalid ConsultationStatus', async () => {
    const dto = plainToInstance(ConsultationQueryDto, { status: 'PENDING' });
    const errors = await validate(dto);
    const statusError = errors.find((e) => e.property === 'status');
    expect(statusError).toBeDefined();
  });

  it('rejects invalid patientId non-UUID string', async () => {
    const dto = plainToInstance(ConsultationQueryDto, {
      patientId: 'invalid-not-uuid',
    });
    const errors = await validate(dto);
    const patientError = errors.find((e) => e.property === 'patientId');
    expect(patientError).toBeDefined();
    expect(patientError?.constraints?.isUuid).toBe(
      'patientId must be a valid UUID',
    );
  });
});

describe('PatientConsultationHistoryQueryDto', () => {
  it('applies default page and limit when empty', async () => {
    const dto = plainToInstance(PatientConsultationHistoryQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('validates with valid status filter', async () => {
    const dto = plainToInstance(PatientConsultationHistoryQueryDto, {
      status: ConsultationStatus.DRAFT,
      page: '2',
      limit: '10',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.status).toBe(ConsultationStatus.DRAFT);
  });

  it('rejects invalid status', async () => {
    const dto = plainToInstance(PatientConsultationHistoryQueryDto, {
      status: 'CANCELLED',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
