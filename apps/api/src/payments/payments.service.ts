import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, Payment, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a consultation-linked or patient-linked payment under tenant isolation.
   */
  async createPayment(
    clinicId: string,
    recordedById: string,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    let resolvedPatientId = dto.patientId;

    // 1. If consultationId provided, verify it belongs to this clinic
    if (dto.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: {
          id: dto.consultationId,
          clinicId,
        },
      });

      if (!consultation) {
        throw new NotFoundException(
          `Consultation with ID ${dto.consultationId} not found in this clinic`,
        );
      }

      if (resolvedPatientId && resolvedPatientId !== consultation.patientId) {
        throw new BadRequestException(
          'Provided patientId does not match the consultation patientId',
        );
      }

      resolvedPatientId = consultation.patientId;
    }

    if (!resolvedPatientId) {
      throw new BadRequestException(
        'Either consultationId or patientId must be provided',
      );
    }

    // 2. Verify patient belongs to this clinic
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: resolvedPatientId,
        clinicId,
        isActive: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Active patient with ID ${resolvedPatientId} not found in this clinic`,
      );
    }

    // 3. Replay / Idempotency protection
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: {
          clinicId_idempotencyKey: {
            clinicId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });

      if (existing) {
        this.logger.log(
          `Idempotent replay detected for key ${dto.idempotencyKey} (Payment ${existing.id})`,
        );
        return existing;
      }
    }

    // 4. Create payment record
    const paidAtDate = dto.paidAt ? new Date(dto.paidAt) : new Date();

    return this.prisma.payment.create({
      data: {
        clinicId,
        consultationId: dto.consultationId ?? null,
        patientId: resolvedPatientId,
        recordedById,
        amount: new Prisma.Decimal(dto.amount),
        method: dto.method,
        status: dto.status ?? PaymentStatus.COMPLETED,
        notes: dto.notes?.trim() || null,
        idempotencyKey: dto.idempotencyKey?.trim() || null,
        paidAt: paidAtDate,
      },
      include: {
        patient: {
          select: {
            id: true,
            uhid: true,
            fullName: true,
            gender: true,
            phone: true,
          },
        },
        consultation: {
          select: {
            id: true,
            encounterDate: true,
            status: true,
            diagnosis: true,
          },
        },
      },
    });
  }

  /**
   * List payments for the active clinic with optional filters.
   */
  async listPayments(clinicId: string, query: PaymentQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      clinicId,
    };

    if (query.consultationId) {
      where.consultationId = query.consultationId;
    }

    if (query.patientId) {
      where.patientId = query.patientId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.paidAt = {};
      if (query.startDate) {
        where.paidAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.paidAt.lte = new Date(query.endDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: query.offset ?? 0,
        take: query.limit ?? 50,
        include: {
          patient: {
            select: {
              id: true,
              uhid: true,
              fullName: true,
              gender: true,
              phone: true,
            },
          },
          consultation: {
            select: {
              id: true,
              encounterDate: true,
              status: true,
              diagnosis: true,
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: items,
      total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
  }

  /**
   * Get all payments recorded for a specific consultation.
   */
  async getPaymentsByConsultation(clinicId: string, consultationId: string) {
    return this.prisma.payment.findMany({
      where: {
        clinicId,
        consultationId,
      },
      orderBy: { paidAt: 'asc' },
    });
  }
}

