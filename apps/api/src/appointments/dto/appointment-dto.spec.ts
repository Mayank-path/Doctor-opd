import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AppointmentStatus, AppointmentType } from '@prisma/client';
import { CreateAppointmentDto } from './create-appointment.dto';
import { ListAppointmentsQueryDto } from './list-appointments-query.dto';
import { RescheduleAppointmentDto } from './reschedule-appointment.dto';
import { CancelAppointmentDto } from './cancel-appointment.dto';

describe('CreateAppointmentDto', () => {
  const validPayload = {
    patientId: '11111111-1111-4111-8111-111111111111',
    doctorId: '22222222-2222-4222-8222-222222222222',
    serviceDate: '2026-10-30',
    startTime: '2026-10-30T09:00:00.000Z',
    endTime: '2026-10-30T09:30:00.000Z',
    type: AppointmentType.SCHEDULED,
    chiefComplaint: 'Mild chest tightness',
    notes: 'Patient requested morning slot',
  };

  it('validates successfully with full valid payload', async () => {
    const dto = plainToInstance(CreateAppointmentDto, validPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.patientId).toBe(validPayload.patientId);
    expect(dto.doctorId).toBe(validPayload.doctorId);
    expect(dto.serviceDate).toBe(validPayload.serviceDate);
  });

  it('validates successfully with minimal payload and defaults type to SCHEDULED', async () => {
    const minimal = {
      patientId: '11111111-1111-4111-8111-111111111111',
      doctorId: '22222222-2222-4222-8222-222222222222',
      serviceDate: '2026-10-30',
      startTime: '2026-10-30T09:00:00.000Z',
    };
    const dto = plainToInstance(CreateAppointmentDto, minimal);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.type).toBe(AppointmentType.SCHEDULED);
  });

  it('rejects invalid patientId non-UUID', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validPayload,
      patientId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'patientId')).toBeDefined();
  });

  it('rejects invalid doctorId non-UUID', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validPayload,
      doctorId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'doctorId')).toBeDefined();
  });

  it('rejects invalid serviceDate format', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validPayload,
      serviceDate: '30-10-2026',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'serviceDate')).toBeDefined();
  });

  it('rejects invalid startTime non-ISO format', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validPayload,
      startTime: 'tomorrow morning',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'startTime')).toBeDefined();
  });

  it('rejects invalid appointment type', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validPayload,
      type: 'TELEHEALTH',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'type')).toBeDefined();
  });

  it('rejects chiefComplaint exceeding 500 characters', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validPayload,
      chiefComplaint: 'A'.repeat(501),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'chiefComplaint')).toBeDefined();
  });
});

describe('ListAppointmentsQueryDto', () => {
  it('validates successfully with required serviceDate and applies pagination defaults', async () => {
    const dto = plainToInstance(ListAppointmentsQueryDto, {
      serviceDate: '2026-10-30',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.serviceDate).toBe('2026-10-30');
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('rejects missing serviceDate', async () => {
    const dto = plainToInstance(ListAppointmentsQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'serviceDate')).toBeDefined();
  });

  it('validates with optional doctorId and status filters', async () => {
    const dto = plainToInstance(ListAppointmentsQueryDto, {
      serviceDate: '2026-10-30',
      doctorId: '22222222-2222-4222-8222-222222222222',
      status: AppointmentStatus.SCHEDULED,
      page: '2',
      limit: '10',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
    expect(dto.status).toBe(AppointmentStatus.SCHEDULED);
  });

  it('rejects limit exceeding 50', async () => {
    const dto = plainToInstance(ListAppointmentsQueryDto, {
      serviceDate: '2026-10-30',
      limit: '51',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'limit')).toBeDefined();
  });

  it('rejects page less than 1', async () => {
    const dto = plainToInstance(ListAppointmentsQueryDto, {
      serviceDate: '2026-10-30',
      page: '0',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('RescheduleAppointmentDto', () => {
  it('validates successfully with required fields', async () => {
    const dto = plainToInstance(RescheduleAppointmentDto, {
      serviceDate: '2026-11-05',
      startTime: '2026-11-05T14:00:00.000Z',
      endTime: '2026-11-05T14:30:00.000Z',
      notes: 'Rescheduled upon patient request',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects missing serviceDate', async () => {
    const dto = plainToInstance(RescheduleAppointmentDto, {
      startTime: '2026-11-05T14:00:00.000Z',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'serviceDate')).toBeDefined();
  });

  it('rejects invalid startTime', async () => {
    const dto = plainToInstance(RescheduleAppointmentDto, {
      serviceDate: '2026-11-05',
      startTime: 'not-a-datetime',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'startTime')).toBeDefined();
  });
});

describe('CancelAppointmentDto', () => {
  it('validates successfully with reason', async () => {
    const dto = plainToInstance(CancelAppointmentDto, {
      cancellationReason: 'Patient called to cancel due to emergency',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects empty cancellation reason', async () => {
    const dto = plainToInstance(CancelAppointmentDto, {
      cancellationReason: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.find((e) => e.property === 'cancellationReason')).toBeDefined();
  });
});
