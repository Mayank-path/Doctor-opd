import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;

  const mockClinicId = 'clinic-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockPatientId = 'patient-uuid-1';
  const mockConsultationId = 'consultation-uuid-1';

  beforeEach(async () => {
    prisma = {
      consultation: {
        findFirst: jest.fn(),
      },
      patient: {
        findFirst: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('createPayment', () => {
    it('successfully creates a payment linked to consultation and derives patientId', async () => {
      prisma.consultation.findFirst.mockResolvedValue({
        id: mockConsultationId,
        clinicId: mockClinicId,
        patientId: mockPatientId,
      });
      prisma.patient.findFirst.mockResolvedValue({
        id: mockPatientId,
        clinicId: mockClinicId,
        isActive: true,
      });
      prisma.payment.create.mockResolvedValue({
        id: 'payment-1',
        clinicId: mockClinicId,
        consultationId: mockConsultationId,
        patientId: mockPatientId,
        amount: new Prisma.Decimal(500),
        method: PaymentMethod.UPI,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });

      const result = await service.createPayment(mockClinicId, mockUserId, {
        consultationId: mockConsultationId,
        amount: 500,
        method: PaymentMethod.UPI,
      });

      expect(result.id).toBe('payment-1');
      expect(prisma.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: mockConsultationId, clinicId: mockClinicId },
      });
      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: mockPatientId, clinicId: mockClinicId, isActive: true },
      });
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('returns existing record if idempotency key matches (replay protection)', async () => {
      prisma.consultation.findFirst.mockResolvedValue({
        id: mockConsultationId,
        clinicId: mockClinicId,
        patientId: mockPatientId,
      });
      prisma.patient.findFirst.mockResolvedValue({
        id: mockPatientId,
        clinicId: mockClinicId,
        isActive: true,
      });
      const existingPayment = {
        id: 'existing-payment-id',
        clinicId: mockClinicId,
        idempotencyKey: 'key-123',
        amount: new Prisma.Decimal(500),
      };
      prisma.payment.findUnique.mockResolvedValue(existingPayment);

      const result = await service.createPayment(mockClinicId, mockUserId, {
        consultationId: mockConsultationId,
        amount: 500,
        method: PaymentMethod.CASH,
        idempotencyKey: 'key-123',
      });

      expect(result).toBe(existingPayment);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if consultation is not found in this clinic (tenant isolation)', async () => {
      prisma.consultation.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment(mockClinicId, mockUserId, {
          consultationId: 'foreign-consult-id',
          amount: 500,
          method: PaymentMethod.CASH,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if neither consultationId nor patientId is provided', async () => {
      await expect(
        service.createPayment(mockClinicId, mockUserId, {
          amount: 500,
          method: PaymentMethod.CASH,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listPayments', () => {
    it('returns paginated payments for clinic', async () => {
      prisma.payment.findMany.mockResolvedValue([{ id: 'p-1' }]);
      prisma.payment.count.mockResolvedValue(1);

      const result = await service.listPayments(mockClinicId, { limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});

