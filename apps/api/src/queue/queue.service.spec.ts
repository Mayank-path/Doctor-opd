import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  ClinicRole,
  MembershipStatus,
  QueueStatus,
} from '@prisma/client';
import { QueueService, QUEUE_ENTRY_INCLUDE } from './queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';
import { ListQueueQueryDto } from './dto/list-queue-query.dto';
import { UpdateQueueStatusDto } from './dto/update-queue-status.dto';

describe('QueueService', () => {
  let service: QueueService;

  const mockClinicId = 'clinic-uuid-1';
  const mockDoctorUserId = 'doctor-user-uuid-1';
  const mockOtherDoctorUserId = 'other-doctor-uuid-2';
  const mockPatientId = 'patient-uuid-1';
  const mockAppointmentId = 'appointment-uuid-1';
  const mockQueueEntryId = 'queue-uuid-1';

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
    status: AppointmentStatus.SCHEDULED,
    queueEntry: null,
  };

  const mockQueueEntry = {
    id: mockQueueEntryId,
    clinicId: mockClinicId,
    patientId: mockPatientId,
    doctorId: mockDoctorUserId,
    appointmentId: mockAppointmentId,
    idempotencyKey: null,
    serviceDate: new Date('2026-10-30T00:00:00.000Z'),
    tokenNumber: 1,
    status: QueueStatus.WAITING,
    priority: 0,
    checkInTime: new Date(),
    calledAt: null,
    consultationStartTime: null,
    consultationEndTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    patient: {
      findFirst: jest.fn(),
    },
    clinicMembership: {
      findUnique: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    opdQueueEntry: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('checkIn', () => {
    it('checks in a scheduled appointment and allocates token atomically', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );

      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([{ lastTokenNumber: 1 }]),
        opdQueueEntry: {
          create: jest.fn().mockResolvedValue(mockQueueEntry),
        },
        appointment: {
          update: jest.fn().mockResolvedValue({
            ...mockAppointment,
            status: AppointmentStatus.CHECKED_IN,
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const dto: CheckInDto = { appointmentId: mockAppointmentId };
      const result = await service.checkIn(mockClinicId, dto);

      expect(mockPrismaService.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: mockAppointmentId, clinicId: mockClinicId },
        include: { queueEntry: true },
      });
      expect(mockTx.opdQueueEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: mockClinicId,
          patientId: mockPatientId,
          doctorId: mockDoctorUserId,
          appointmentId: mockAppointmentId,
          tokenNumber: 1,
          status: QueueStatus.WAITING,
        }),
        include: QUEUE_ENTRY_INCLUDE,
      });
      expect(mockTx.appointment.update).toHaveBeenCalledWith({
        where: { id: mockAppointmentId },
        data: { status: AppointmentStatus.CHECKED_IN },
      });
      expect(result).toBe(mockQueueEntry);
    });

    it('checks in a walk-in patient with patientId and doctorId', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );

      const mockWalkInEntry = {
        ...mockQueueEntry,
        appointmentId: null,
        tokenNumber: 2,
      };

      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([{ lastTokenNumber: 2 }]),
        opdQueueEntry: {
          create: jest.fn().mockResolvedValue(mockWalkInEntry),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const dto: CheckInDto = {
        patientId: mockPatientId,
        doctorId: mockDoctorUserId,
        serviceDate: '2026-10-30',
      };

      const result = await service.checkIn(mockClinicId, dto);

      expect(mockTx.opdQueueEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: mockClinicId,
          patientId: mockPatientId,
          doctorId: mockDoctorUserId,
          appointmentId: null,
          tokenNumber: 2,
        }),
        include: QUEUE_ENTRY_INCLUDE,
      });
      expect(result.tokenNumber).toBe(2);
    });

    it('throws BadRequestException if neither appointmentId nor (patientId and doctorId) provided', async () => {
      await expect(service.checkIn(mockClinicId, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if appointment does not exist in active clinic', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.checkIn(mockClinicId, { appointmentId: mockAppointmentId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if appointment is already checked in', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CHECKED_IN,
      });

      await expect(
        service.checkIn(mockClinicId, { appointmentId: mockAppointmentId }),
      ).rejects.toThrow(ConflictException);
    });

    it('returns existing entry if idempotencyKey matches logical request', async () => {
      const existingEntry = {
        ...mockQueueEntry,
        idempotencyKey: 'key-abc',
      };
      mockPrismaService.appointment.findFirst.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.opdQueueEntry.findUnique.mockResolvedValue(
        existingEntry,
      );

      const result = await service.checkIn(mockClinicId, {
        appointmentId: mockAppointmentId,
        idempotencyKey: 'key-abc',
      });

      expect(result).toBe(existingEntry);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException if idempotencyKey is reused with conflicting parameters', async () => {
      const existingEntry = {
        ...mockQueueEntry,
        patientId: 'different-patient-uuid',
        idempotencyKey: 'key-abc',
      };
      mockPrismaService.appointment.findFirst.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.opdQueueEntry.findUnique.mockResolvedValue(
        existingEntry,
      );

      await expect(
        service.checkIn(mockClinicId, {
          appointmentId: mockAppointmentId,
          idempotencyKey: 'key-abc',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns queue entries sorted by priority desc, tokenNumber asc', async () => {
      mockPrismaService.opdQueueEntry.findMany.mockResolvedValue([
        mockQueueEntry,
      ]);

      const query: ListQueueQueryDto = { serviceDate: '2026-10-30' };
      const result = await service.findAll(mockClinicId, query);

      expect(mockPrismaService.opdQueueEntry.findMany).toHaveBeenCalledWith({
        where: {
          clinicId: mockClinicId,
          serviceDate: new Date('2026-10-30T00:00:00.000Z'),
        },
        orderBy: [{ priority: 'desc' }, { tokenNumber: 'asc' }],
        include: QUEUE_ENTRY_INCLUDE,
      });
      expect(result.data).toEqual([mockQueueEntry]);
      expect(result.total).toBe(1);
    });
  });

  describe('updateStatus', () => {
    it('receptionist successfully transitions WAITING to CALLED and stamps calledAt', async () => {
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(
        mockQueueEntry,
      );

      const mockTx = {
        opdQueueEntry: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...mockQueueEntry,
            status: QueueStatus.CALLED,
            calledAt: new Date(),
          }),
        },
        appointment: {
          updateMany: jest.fn(),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const result = await service.updateStatus(
        mockClinicId,
        mockQueueEntryId,
        'receptionist-user-1',
        ClinicRole.RECEPTIONIST,
        { status: QueueStatus.CALLED },
      );

      expect(mockTx.opdQueueEntry.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockQueueEntryId,
          clinicId: mockClinicId,
          status: QueueStatus.WAITING,
        },
        data: expect.objectContaining({
          status: QueueStatus.CALLED,
          calledAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe(QueueStatus.CALLED);
    });

    it('assigned doctor transitions CALLED to IN_CONSULTATION and updates linked appointment', async () => {
      const calledEntry = {
        ...mockQueueEntry,
        status: QueueStatus.CALLED,
      };
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(calledEntry);

      const mockTx = {
        opdQueueEntry: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...calledEntry,
            status: QueueStatus.IN_CONSULTATION,
            consultationStartTime: new Date(),
          }),
        },
        appointment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const result = await service.updateStatus(
        mockClinicId,
        mockQueueEntryId,
        mockDoctorUserId,
        ClinicRole.DOCTOR,
        { status: QueueStatus.IN_CONSULTATION },
      );

      expect(mockTx.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: mockAppointmentId, clinicId: mockClinicId },
        data: { status: AppointmentStatus.IN_CONSULTATION },
      });
      expect(result.status).toBe(QueueStatus.IN_CONSULTATION);
    });

    it('rejects IN_CONSULTATION if attempted by non-assigned doctor (Forbidden)', async () => {
      const calledEntry = {
        ...mockQueueEntry,
        status: QueueStatus.CALLED,
      };
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(calledEntry);

      await expect(
        service.updateStatus(
          mockClinicId,
          mockQueueEntryId,
          mockOtherDoctorUserId,
          ClinicRole.DOCTOR,
          { status: QueueStatus.IN_CONSULTATION },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects IN_CONSULTATION if attempted by receptionist (Forbidden)', async () => {
      const calledEntry = {
        ...mockQueueEntry,
        status: QueueStatus.CALLED,
      };
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(calledEntry);

      await expect(
        service.updateStatus(
          mockClinicId,
          mockQueueEntryId,
          'receptionist-id',
          ClinicRole.RECEPTIONIST,
          { status: QueueStatus.IN_CONSULTATION },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects invalid state transition from WAITING directly to COMPLETED (Conflict)', async () => {
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(
        mockQueueEntry,
      );

      await expect(
        service.updateStatus(
          mockClinicId,
          mockQueueEntryId,
          mockDoctorUserId,
          ClinicRole.DOCTOR,
          { status: QueueStatus.COMPLETED },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects transition if queue entry is already in terminal state COMPLETED (Conflict)', async () => {
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue({
        ...mockQueueEntry,
        status: QueueStatus.COMPLETED,
      });

      await expect(
        service.updateStatus(
          mockClinicId,
          mockQueueEntryId,
          mockDoctorUserId,
          ClinicRole.DOCTOR,
          { status: QueueStatus.CALLED },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('idempotently returns completed queue entry when requested status is also COMPLETED', async () => {
      const completedEntry = {
        ...mockQueueEntry,
        status: QueueStatus.COMPLETED,
        consultationEndTime: new Date(),
      };
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(
        completedEntry,
      );
      mockPrismaService.opdQueueEntry.findUniqueOrThrow.mockResolvedValue(
        completedEntry,
      );

      const result = await service.updateStatus(
        mockClinicId,
        mockQueueEntryId,
        mockDoctorUserId,
        ClinicRole.DOCTOR,
        { status: QueueStatus.COMPLETED },
      );

      expect(result).toBe(completedEntry);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('preserves initial calledAt timestamp on repeated CALLED transitions', async () => {
      const initialCalledAt = new Date('2026-10-30T10:00:00.000Z');
      const calledEntry = {
        ...mockQueueEntry,
        status: QueueStatus.CALLED,
        calledAt: initialCalledAt,
      };
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(calledEntry);

      const mockTx = {
        opdQueueEntry: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(calledEntry),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const result = await service.updateStatus(
        mockClinicId,
        mockQueueEntryId,
        'receptionist-id',
        ClinicRole.RECEPTIONIST,
        { status: QueueStatus.CALLED },
      );

      expect(mockTx.opdQueueEntry.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockQueueEntryId,
          clinicId: mockClinicId,
          status: QueueStatus.CALLED,
        },
        data: {
          status: QueueStatus.CALLED,
        },
      });
      expect(result.calledAt).toEqual(initialCalledAt);
    });

    it('cancelling a linked queue entry transitions linked appointment to CANCELLED', async () => {
      mockPrismaService.opdQueueEntry.findFirst.mockResolvedValue(
        mockQueueEntry,
      );

      const mockTx = {
        opdQueueEntry: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...mockQueueEntry,
            status: QueueStatus.CANCELLED,
          }),
        },
        appointment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );

      const result = await service.updateStatus(
        mockClinicId,
        mockQueueEntryId,
        'receptionist-id',
        ClinicRole.RECEPTIONIST,
        { status: QueueStatus.CANCELLED },
      );

      expect(mockTx.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockAppointmentId,
          clinicId: mockClinicId,
          status: {
            in: [
              AppointmentStatus.CHECKED_IN,
              AppointmentStatus.IN_CONSULTATION,
            ],
          },
        },
        data: expect.objectContaining({
          status: AppointmentStatus.CANCELLED,
          cancellationReason: 'Queue entry cancelled',
          cancelledAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe(QueueStatus.CANCELLED);
    });
  });
});
