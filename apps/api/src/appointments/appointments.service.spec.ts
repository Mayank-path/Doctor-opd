import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  AppointmentType,
  ClinicRole,
  MembershipStatus,
} from '@prisma/client';
import {
  AppointmentsService,
  APPOINTMENT_INCLUDE,
} from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  const mockClinicId = 'clinic-uuid-1';
  const mockDoctorUserId = 'doctor-user-uuid-1';
  const mockPatientId = 'patient-uuid-1';
  const mockAppointmentId = 'appointment-uuid-1';

  const mockPatient = {
    id: mockPatientId,
    clinicId: mockClinicId,
    uhid: 'UHID-000001',
    fullName: 'Test Patient',
    deletedAt: null,
  };

  const mockDoctorMembership = {
    id: 'membership-uuid-1',
    userId: mockDoctorUserId,
    clinicId: mockClinicId,
    role: ClinicRole.DOCTOR,
    status: MembershipStatus.ACTIVE,
  };

  const mockAppointment = {
    id: mockAppointmentId,
    clinicId: mockClinicId,
    patientId: mockPatientId,
    doctorId: mockDoctorUserId,
    serviceDate: new Date('2026-10-30T00:00:00.000Z'),
    startTime: new Date('2026-10-30T09:00:00.000Z'),
    endTime: new Date('2026-10-30T09:30:00.000Z'),
    type: AppointmentType.SCHEDULED,
    status: AppointmentStatus.SCHEDULED,
    chiefComplaint: 'Knee discomfort',
    notes: 'Prior surgery follow-up',
    cancellationReason: null,
    cancelledAt: null,
    rescheduledFromId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    queueEntry: null,
  };

  const mockPrismaService = {
    patient: {
      findFirst: jest.fn(),
    },
    clinicMembership: {
      findUnique: jest.fn(),
    },
    appointment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('create', () => {
    const validDto: CreateAppointmentDto = {
      patientId: mockPatientId,
      doctorId: mockDoctorUserId,
      serviceDate: '2026-10-30',
      startTime: '2026-10-30T09:00:00.000Z',
      endTime: '2026-10-30T09:30:00.000Z',
      type: AppointmentType.SCHEDULED,
      chiefComplaint: 'Knee discomfort',
      notes: 'Prior surgery follow-up',
    };

    it('creates appointment when patient and doctor are valid', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.appointment.create.mockResolvedValue(mockAppointment);

      const result = await service.create(mockClinicId, validDto);

      expect(mockPrismaService.patient.findFirst).toHaveBeenCalledWith({
        where: { id: mockPatientId, clinicId: mockClinicId, deletedAt: null },
      });
      expect(
        mockPrismaService.clinicMembership.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          userId_clinicId: {
            userId: mockDoctorUserId,
            clinicId: mockClinicId,
          },
        },
      });
      expect(mockPrismaService.appointment.create).toHaveBeenCalledWith({
        data: {
          clinicId: mockClinicId,
          patientId: mockPatientId,
          doctorId: mockDoctorUserId,
          serviceDate: new Date('2026-10-30T00:00:00.000Z'),
          startTime: new Date('2026-10-30T09:00:00.000Z'),
          endTime: new Date('2026-10-30T09:30:00.000Z'),
          type: AppointmentType.SCHEDULED,
          status: AppointmentStatus.SCHEDULED,
          chiefComplaint: 'Knee discomfort',
          notes: 'Prior surgery follow-up',
        },
        include: APPOINTMENT_INCLUDE,
      });
      expect(result).toBe(mockAppointment);
    });

    it('throws BadRequestException if endTime is equal to or before startTime', async () => {
      const invalidDto: CreateAppointmentDto = {
        ...validDto,
        startTime: '2026-10-30T10:00:00.000Z',
        endTime: '2026-10-30T09:30:00.000Z',
      };

      await expect(service.create(mockClinicId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if startTime date does not match serviceDate', async () => {
      const invalidDto: CreateAppointmentDto = {
        ...validDto,
        serviceDate: '2026-10-30',
        startTime: '2026-11-01T09:00:00.000Z',
      };

      await expect(service.create(mockClinicId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts early-morning IST appointment where UTC date is previous calendar day', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.appointment.create.mockResolvedValue(mockAppointment);

      // 01:30 AM IST on 2026-10-30 is 2026-10-29T20:00:00.000Z in UTC
      const earlyMorningDto: CreateAppointmentDto = {
        ...validDto,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T01:30:00+05:30',
        endTime: '2026-10-30T02:00:00+05:30',
      };

      await expect(
        service.create(mockClinicId, earlyMorningDto),
      ).resolves.toBeDefined();
      expect(mockPrismaService.appointment.create).toHaveBeenCalled();
    });

    it('accepts midnight boundary IST appointment (18:30:00 UTC = 00:00:00 IST)', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.appointment.create.mockResolvedValue(mockAppointment);

      const midnightDto: CreateAppointmentDto = {
        ...validDto,
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T00:00:00+05:30',
        endTime: '2026-10-30T00:30:00+05:30',
      };

      await expect(
        service.create(mockClinicId, midnightDto),
      ).resolves.toBeDefined();
    });

    it('rejects invalid timestamp strings with BadRequestException', async () => {
      const invalidTimestampDto: CreateAppointmentDto = {
        ...validDto,
        startTime: 'invalid-iso-date',
      };

      await expect(
        service.create(mockClinicId, invalidTimestampDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if patient does not exist or is soft-deleted', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(null);

      await expect(service.create(mockClinicId, validDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.appointment.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if doctor does not have active DOCTOR role in clinic', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(null);

      await expect(service.create(mockClinicId, validDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.appointment.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated appointments with required serviceDate', async () => {
      mockPrismaService.appointment.count.mockResolvedValue(1);
      mockPrismaService.appointment.findMany.mockResolvedValue([
        mockAppointment,
      ]);

      const query: ListAppointmentsQueryDto = {
        serviceDate: '2026-10-30',
        page: 1,
        limit: 20,
      };

      const result = await service.findAll(mockClinicId, query);

      expect(mockPrismaService.appointment.count).toHaveBeenCalledWith({
        where: {
          clinicId: mockClinicId,
          serviceDate: new Date('2026-10-30T00:00:00.000Z'),
        },
      });
      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith({
        where: {
          clinicId: mockClinicId,
          serviceDate: new Date('2026-10-30T00:00:00.000Z'),
        },
        orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
        include: APPOINTMENT_INCLUDE,
      });
      expect(result.data).toEqual([mockAppointment]);
      expect(result.items).toEqual([mockAppointment]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('applies optional doctorId and status filters', async () => {
      mockPrismaService.appointment.count.mockResolvedValue(0);
      mockPrismaService.appointment.findMany.mockResolvedValue([]);

      const query: ListAppointmentsQueryDto = {
        serviceDate: '2026-10-30',
        doctorId: mockDoctorUserId,
        status: AppointmentStatus.SCHEDULED,
        page: 2,
        limit: 10,
      };

      await service.findAll(mockClinicId, query);

      expect(mockPrismaService.appointment.count).toHaveBeenCalledWith({
        where: {
          clinicId: mockClinicId,
          serviceDate: new Date('2026-10-30T00:00:00.000Z'),
          doctorId: mockDoctorUserId,
          status: AppointmentStatus.SCHEDULED,
        },
      });
    });
  });

  describe('findOne', () => {
    it('returns appointment when found in active clinic', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(
        mockAppointment,
      );

      const result = await service.findOne(mockClinicId, mockAppointmentId);

      expect(mockPrismaService.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: mockAppointmentId, clinicId: mockClinicId },
        include: APPOINTMENT_INCLUDE,
      });
      expect(result).toBe(mockAppointment);
    });

    it('throws NotFoundException when missing or cross-clinic', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockClinicId, mockAppointmentId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reschedule', () => {
    const rescheduleDto: RescheduleAppointmentDto = {
      serviceDate: '2026-11-02',
      startTime: '2026-11-02T10:00:00.000Z',
      endTime: '2026-11-02T10:30:00.000Z',
      notes: 'Moved to next week',
    };

    it('reschedules appointment in transaction and links replacement', async () => {
      const mockTx = {
        patient: {
          findFirst: jest.fn().mockResolvedValue(mockPatient),
        },
        appointment: {
          findFirst: jest.fn().mockResolvedValue(mockAppointment),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue({
            ...mockAppointment,
            id: 'new-replacement-uuid',
            serviceDate: new Date('2026-11-02T00:00:00.000Z'),
            startTime: new Date('2026-11-02T10:00:00.000Z'),
            rescheduledFromId: mockAppointmentId,
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const result = await service.reschedule(
        mockClinicId,
        mockAppointmentId,
        rescheduleDto,
      );

      expect(mockTx.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: mockAppointmentId, clinicId: mockClinicId },
        include: { queueEntry: true },
      });
      expect(mockTx.patient.findFirst).toHaveBeenCalledWith({
        where: { id: mockPatientId, clinicId: mockClinicId, deletedAt: null },
      });
      expect(mockTx.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockAppointmentId,
          clinicId: mockClinicId,
          status: AppointmentStatus.SCHEDULED,
        },
        data: {
          status: AppointmentStatus.RESCHEDULED,
        },
      });
      expect(mockTx.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: mockClinicId,
          patientId: mockPatientId,
          doctorId: mockDoctorUserId,
          rescheduledFromId: mockAppointmentId,
          status: AppointmentStatus.SCHEDULED,
        }),
        include: APPOINTMENT_INCLUDE,
      });
      expect(result.id).toBe('new-replacement-uuid');
    });

    it('rejects rescheduling if startTime date does not match serviceDate', async () => {
      await expect(
        service.reschedule(mockClinicId, mockAppointmentId, {
          serviceDate: '2026-11-02',
          startTime: '2026-11-05T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts rescheduling to early-morning IST timestamp', async () => {
      const mockTx = {
        appointment: {
          findFirst: jest.fn().mockResolvedValue(mockAppointment),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue({
            ...mockAppointment,
            id: 'early-morning-replacement',
            serviceDate: new Date('2026-11-02T00:00:00.000Z'),
            startTime: new Date('2026-11-01T20:30:00.000Z'), // 02:00 AM IST on 2026-11-02
          }),
        },
        patient: {
          findFirst: jest.fn().mockResolvedValue(mockPatient),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const result = await service.reschedule(mockClinicId, mockAppointmentId, {
        serviceDate: '2026-11-02',
        startTime: '2026-11-02T02:00:00+05:30',
        endTime: '2026-11-02T02:30:00+05:30',
      });

      expect(result.id).toBe('early-morning-replacement');
    });

    it('returns existing replacement appointment on idempotent retry', async () => {
      const existingReplacement = {
        ...mockAppointment,
        id: 'existing-replacement-uuid',
        serviceDate: new Date('2026-11-02T00:00:00.000Z'),
        startTime: new Date('2026-11-02T10:00:00.000Z'),
        endTime: new Date('2026-11-02T10:30:00.000Z'),
        notes: 'Moved to next week',
        rescheduledFromId: mockAppointmentId,
      };

      const mockTx = {
        appointment: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              ...mockAppointment,
              status: AppointmentStatus.RESCHEDULED,
            })
            .mockResolvedValueOnce(existingReplacement),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const result = await service.reschedule(
        mockClinicId,
        mockAppointmentId,
        rescheduleDto,
      );

      expect(result).toBe(existingReplacement);
    });

    it('rejects rescheduling if patient is soft-deleted', async () => {
      const mockTx = {
        patient: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        appointment: {
          findFirst: jest.fn().mockResolvedValue(mockAppointment),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      await expect(
        service.reschedule(mockClinicId, mockAppointmentId, rescheduleDto),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects rescheduling if appointment has been checked in', async () => {
      const checkedInMock = {
        ...mockAppointment,
        status: AppointmentStatus.CHECKED_IN,
      };

      const mockTx = {
        appointment: {
          findFirst: jest.fn().mockResolvedValue(checkedInMock),
        },
      };
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      await expect(
        service.reschedule(mockClinicId, mockAppointmentId, rescheduleDto),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects rescheduling if appointment is in terminal state', async () => {
      const cancelledMock = {
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      };

      const mockTx = {
        appointment: {
          findFirst: jest.fn().mockResolvedValue(cancelledMock),
        },
      };
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      await expect(
        service.reschedule(mockClinicId, mockAppointmentId, rescheduleDto),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if concurrent CAS update count is 0 and no matching replacement exists', async () => {
      const mockTx = {
        patient: {
          findFirst: jest.fn().mockResolvedValue(mockPatient),
        },
        appointment: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(mockAppointment)
            .mockResolvedValueOnce(null),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      await expect(
        service.reschedule(mockClinicId, mockAppointmentId, rescheduleDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    const cancelDto: CancelAppointmentDto = {
      cancellationReason: 'Patient unable to attend',
    };

    it('cancels appointment with CAS and sets cancellation details', async () => {
      mockPrismaService.appointment.findFirst
        .mockResolvedValueOnce(mockAppointment)
        .mockResolvedValueOnce({
          ...mockAppointment,
          status: AppointmentStatus.CANCELLED,
          cancellationReason: 'Patient unable to attend',
          cancelledAt: new Date(),
        });
      mockPrismaService.appointment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancel(
        mockClinicId,
        mockAppointmentId,
        cancelDto,
      );

      expect(mockPrismaService.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockAppointmentId,
          clinicId: mockClinicId,
          status: AppointmentStatus.SCHEDULED,
        },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: 'Patient unable to attend',
          cancelledAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('throws ConflictException if appointment is already cancelled', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      await expect(
        service.cancel(mockClinicId, mockAppointmentId, cancelDto),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.appointment.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException if appointment is checked in', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CHECKED_IN,
      });

      await expect(
        service.cancel(mockClinicId, mockAppointmentId, cancelDto),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if concurrent CAS update count is 0', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.appointment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancel(mockClinicId, mockAppointmentId, cancelDto),
      ).rejects.toThrow(ConflictException);
    });
  });
});
