import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { QueueStatus } from '@prisma/client';
import { CheckInDto } from './check-in.dto';
import { ListQueueQueryDto } from './list-queue-query.dto';
import { UpdateQueueStatusDto } from './update-queue-status.dto';

describe('CheckInDto', () => {
  it('validates appointment check-in payload', async () => {
    const dto = plainToInstance(CheckInDto, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
      priority: 1,
      idempotencyKey: 'idemp-key-123',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.priority).toBe(1);
    expect(dto.idempotencyKey).toBe('idemp-key-123');
  });

  it('validates walk-in check-in payload', async () => {
    const dto = plainToInstance(CheckInDto, {
      patientId: '11111111-1111-4111-8111-111111111111',
      doctorId: '22222222-2222-4222-8222-222222222222',
      serviceDate: '2026-10-30',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects invalid appointmentId non-UUID', async () => {
    const dto = plainToInstance(CheckInDto, {
      appointmentId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'appointmentId')).toBeDefined();
  });

  it('rejects invalid serviceDate format', async () => {
    const dto = plainToInstance(CheckInDto, {
      patientId: '11111111-1111-4111-8111-111111111111',
      doctorId: '22222222-2222-4222-8222-222222222222',
      serviceDate: '30/10/2026',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'serviceDate')).toBeDefined();
  });

  it('rejects negative priority or priority exceeding 10', async () => {
    const dtoNegative = plainToInstance(CheckInDto, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
      priority: -1,
    });
    const errorsNegative = await validate(dtoNegative);
    expect(errorsNegative.length).toBeGreaterThan(0);

    const dtoHigh = plainToInstance(CheckInDto, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
      priority: 11,
    });
    const errorsHigh = await validate(dtoHigh);
    expect(errorsHigh.length).toBeGreaterThan(0);
  });
});

describe('ListQueueQueryDto', () => {
  it('validates with required serviceDate', async () => {
    const dto = plainToInstance(ListQueueQueryDto, {
      serviceDate: '2026-10-30',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects missing serviceDate', async () => {
    const dto = plainToInstance(ListQueueQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'serviceDate')).toBeDefined();
  });

  it('validates with optional doctorId and status', async () => {
    const dto = plainToInstance(ListQueueQueryDto, {
      serviceDate: '2026-10-30',
      doctorId: '22222222-2222-4222-8222-222222222222',
      status: QueueStatus.WAITING,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects invalid status', async () => {
    const dto = plainToInstance(ListQueueQueryDto, {
      serviceDate: '2026-10-30',
      status: 'INVALID_STATUS',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateQueueStatusDto', () => {
  it('validates valid status transition', async () => {
    const dto = plainToInstance(UpdateQueueStatusDto, {
      status: QueueStatus.CALLED,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.status).toBe(QueueStatus.CALLED);
  });

  it('rejects empty or invalid status', async () => {
    const dto = plainToInstance(UpdateQueueStatusDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);

    const dtoInvalid = plainToInstance(UpdateQueueStatusDto, {
      status: 'UNKNOWN',
    });
    const errorsInvalid = await validate(dtoInvalid);
    expect(errorsInvalid.length).toBeGreaterThan(0);
  });
});
