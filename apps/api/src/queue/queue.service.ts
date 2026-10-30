import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  ClinicRole,
  MembershipStatus,
  OpdQueueEntry,
  Prisma,
  QueueStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';
import { ListQueueQueryDto } from './dto/list-queue-query.dto';
import { UpdateQueueStatusDto } from './dto/update-queue-status.dto';
import { getClinicLocalDate } from '../appointments/appointments.service';

export const QUEUE_ENTRY_INCLUDE = {
  patient: {
    select: {
      id: true,
      uhid: true,
      fullName: true,
      gender: true,
      dateOfBirth: true,
      phone: true,
    },
  },
  doctor: {
    select: {
      userId: true,
      role: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  },
  appointment: {
    select: {
      id: true,
      startTime: true,
      endTime: true,
      type: true,
      status: true,
      chiefComplaint: true,
    },
  },
} as const;

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks in a scheduled appointment or registers a walk-in patient,
   * issuing an atomic daily token from OpdDailyCounter.
   *
   * Security & Invariants:
   * 1. clinicId derived strictly from active clinic context.
   * 2. Atomic token allocation via PostgreSQL UPSERT on opd_daily_counters.
   * 3. Prevents duplicate check-ins for the same appointment.
   * 4. Idempotency key deduplication with conflict verification.
   * 5. Atomically coordinates queue entry creation and appointment CHECKED_IN transition.
   */
  async checkIn(clinicId: string, dto: CheckInDto): Promise<OpdQueueEntry> {
    if (!dto.appointmentId && (!dto.patientId || !dto.doctorId)) {
      throw new BadRequestException(
        'Either appointmentId or (patientId and doctorId) must be provided for check-in',
      );
    }

    let targetPatientId = dto.patientId;
    let targetDoctorId = dto.doctorId;
    let targetServiceDate: Date;

    // 1. Resolve appointment if provided
    let appointment: any = null;
    if (dto.appointmentId) {
      appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, clinicId },
        include: { queueEntry: true },
      });

      if (!appointment) {
        throw new NotFoundException('Appointment not found in active clinic');
      }

      if (
        appointment.status !== AppointmentStatus.SCHEDULED &&
        appointment.status !== AppointmentStatus.CONFIRMED &&
        appointment.status !== AppointmentStatus.CHECKED_IN
      ) {
        throw new ConflictException(
          `Cannot check in appointment with status: ${appointment.status}`,
        );
      }

      // If already checked in without an idempotency key, reject immediately
      if (
        (appointment.status === AppointmentStatus.CHECKED_IN ||
          appointment.queueEntry !== null) &&
        !dto.idempotencyKey
      ) {
        throw new ConflictException('Appointment is already checked in');
      }

      targetPatientId = appointment.patientId;
      targetDoctorId = appointment.doctorId;
      targetServiceDate = appointment.serviceDate;
    } else {
      targetServiceDate = dto.serviceDate
        ? new Date(`${dto.serviceDate}T00:00:00.000Z`)
        : new Date(getClinicLocalDate(new Date()) + 'T00:00:00.000Z');
    }

    // 2. Check Idempotency Key
    if (dto.idempotencyKey) {
      const existing = await this.prisma.opdQueueEntry.findUnique({
        where: {
          clinic_idempotency_unique: {
            clinicId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: QUEUE_ENTRY_INCLUDE,
      });

      if (existing) {
        // Verify logical request match
        const matchesPatient = existing.patientId === targetPatientId;
        const matchesDoctor = existing.doctorId === targetDoctorId;
        const matchesAppointment = dto.appointmentId
          ? existing.appointmentId === dto.appointmentId
          : !existing.appointmentId;

        if (matchesPatient && matchesDoctor && matchesAppointment) {
          return existing;
        }

        throw new ConflictException(
          'Idempotency key was already used with conflicting request parameters',
        );
      }

      // If appointment was already checked in but this idempotency key was not the one used
      if (
        appointment &&
        (appointment.status === AppointmentStatus.CHECKED_IN ||
          appointment.queueEntry !== null)
      ) {
        throw new ConflictException('Appointment is already checked in');
      }
    }

    // 3. Verify patient belongs to active clinic and is not soft-deleted
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: targetPatientId,
        clinicId,
        deletedAt: null,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found in active clinic');
    }

    // 4. Verify doctor holds active DOCTOR membership in active clinic
    const doctorMembership = await this.prisma.clinicMembership.findUnique({
      where: {
        userId_clinicId: {
          userId: targetDoctorId!,
          clinicId,
        },
      },
    });

    if (
      !doctorMembership ||
      doctorMembership.status !== MembershipStatus.ACTIVE ||
      doctorMembership.role !== ClinicRole.DOCTOR
    ) {
      throw new NotFoundException('Doctor not found in active clinic');
    }

    // 5. Execute atomic token allocation and queue insertion in a single transaction
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Atomic UPSERT on opd_daily_counters
        const counterId = crypto.randomUUID();
        const counterResult = await tx.$queryRaw<{ lastTokenNumber: number }[]>`
          INSERT INTO "opd_daily_counters" ("id", "clinicId", "doctorId", "serviceDate", "lastTokenNumber", "updatedAt")
          VALUES (${counterId}, ${clinicId}, ${targetDoctorId}, ${targetServiceDate}, 1, NOW())
          ON CONFLICT ("clinicId", "doctorId", "serviceDate")
          DO UPDATE SET
            "lastTokenNumber" = "opd_daily_counters"."lastTokenNumber" + 1,
            "updatedAt" = NOW()
          RETURNING "lastTokenNumber";
        `;

        if (!counterResult || counterResult.length === 0) {
          throw new ConflictException('Failed to allocate daily token counter');
        }

        const tokenNumber = counterResult[0].lastTokenNumber;

        // Create OpdQueueEntry
        const queueEntry = await tx.opdQueueEntry.create({
          data: {
            clinicId,
            patientId: targetPatientId!,
            doctorId: targetDoctorId!,
            appointmentId: dto.appointmentId ?? null,
            idempotencyKey: dto.idempotencyKey ?? null,
            serviceDate: targetServiceDate,
            tokenNumber,
            status: QueueStatus.WAITING,
            priority: dto.priority ?? 0,
            checkInTime: new Date(),
          },
          include: QUEUE_ENTRY_INCLUDE,
        });

        // Update appointment status if checking in an appointment
        if (dto.appointmentId) {
          await tx.appointment.update({
            where: { id: dto.appointmentId },
            data: { status: AppointmentStatus.CHECKED_IN },
          });
        }

        return queueEntry;
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          const target = (err.meta?.target as string[]) || [];
          if (
            target.includes('idempotencyKey') ||
            target.includes('clinic_idempotency_unique')
          ) {
            if (dto.idempotencyKey) {
              const existing = await this.prisma.opdQueueEntry.findUnique({
                where: {
                  clinic_idempotency_unique: {
                    clinicId,
                    idempotencyKey: dto.idempotencyKey,
                  },
                },
                include: QUEUE_ENTRY_INCLUDE,
              });
              if (existing) {
                const matchesPatient = existing.patientId === targetPatientId;
                const matchesDoctor = existing.doctorId === targetDoctorId;
                if (matchesPatient && matchesDoctor) {
                  return existing;
                }
              }
            }
            throw new ConflictException(
              'Idempotency key was already used with conflicting request parameters',
            );
          }
          if (
            target.includes('appointmentId') ||
            target.includes('opd_queue_entries_appointmentId_key')
          ) {
            throw new ConflictException('Appointment is already checked in');
          }
          if (
            target.includes('tokenNumber') ||
            target.includes('clinic_doctor_date_token_unique')
          ) {
            throw new ConflictException(
              'Token number collision; please retry check-in',
            );
          }
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves the daily queue for a serviceDate, ordered by priority desc, tokenNumber asc.
   *
   * Invariants:
   * 1. Scoped strictly to active clinic.
   * 2. Safe patient, doctor, and appointment summaries only.
   * 3. Never exposes consultation narratives.
   */
  async findAll(
    clinicId: string,
    query: ListQueueQueryDto,
  ): Promise<{ data: OpdQueueEntry[]; items: OpdQueueEntry[]; total: number }> {
    const parsedServiceDate = new Date(`${query.serviceDate}T00:00:00.000Z`);

    const where: Prisma.OpdQueueEntryWhereInput = {
      clinicId,
      serviceDate: parsedServiceDate,
    };

    if (query.doctorId) {
      where.doctorId = query.doctorId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const data = await this.prisma.opdQueueEntry.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { tokenNumber: 'asc' }],
      include: QUEUE_ENTRY_INCLUDE,
    });

    return {
      data,
      items: data,
      total: data.length,
    };
  }

  /**
   * Updates the status of an existing queue entry with state machine validations,
   * role authorization checks, and timestamp stamping.
   *
   * Invariants:
   * 1. Scoped to active clinic.
   * 2. Only the assigned doctor may transition to IN_CONSULTATION or COMPLETED.
   * 3. Sets calledAt, consultationStartTime, consultationEndTime on respective transitions.
   * 4. Prevents transitions out of terminal states (COMPLETED, CANCELLED).
   * 5. Atomically coordinates linked appointment status transitions.
   */
  async updateStatus(
    clinicId: string,
    id: string,
    currentUserId: string,
    currentUserRole: ClinicRole,
    dto: UpdateQueueStatusDto,
  ): Promise<OpdQueueEntry> {
    const entry = await this.prisma.opdQueueEntry.findFirst({
      where: { id, clinicId },
    });

    if (!entry) {
      throw new NotFoundException('Queue entry not found in active clinic');
    }

    // 1. Guard terminal states
    if (entry.status === QueueStatus.COMPLETED) {
      if (dto.status === QueueStatus.COMPLETED) {
        return this.prisma.opdQueueEntry.findUniqueOrThrow({
          where: { id },
          include: QUEUE_ENTRY_INCLUDE,
        });
      }
      throw new ConflictException('Completed queue entry cannot change status');
    }

    if (entry.status === QueueStatus.CANCELLED) {
      throw new ConflictException('Cancelled queue entry cannot change status');
    }

    // 2. Doctor ownership validation for clinical states
    if (
      dto.status === QueueStatus.IN_CONSULTATION ||
      dto.status === QueueStatus.COMPLETED
    ) {
      if (currentUserRole !== ClinicRole.DOCTOR) {
        throw new ForbiddenException(
          `Only the assigned doctor may transition this entry into ${dto.status}`,
        );
      }
      if (currentUserId !== entry.doctorId) {
        throw new ForbiddenException(
          `Only the assigned doctor may transition this entry into ${dto.status}`,
        );
      }
    } else {
      // Non-clinical states (CALLED, SKIPPED, CANCELLED, WAITING)
      if (currentUserRole === ClinicRole.STAFF) {
        throw new ForbiddenException(
          'Staff role is not authorized to transition queue status',
        );
      }
    }

    // 3. State transition validation
    const validTransitions: Record<QueueStatus, QueueStatus[]> = {
      [QueueStatus.WAITING]: [
        QueueStatus.CALLED,
        QueueStatus.SKIPPED,
        QueueStatus.CANCELLED,
      ],
      [QueueStatus.CALLED]: [
        QueueStatus.IN_CONSULTATION,
        QueueStatus.CALLED,
        QueueStatus.SKIPPED,
        QueueStatus.WAITING,
        QueueStatus.CANCELLED,
      ],
      [QueueStatus.SKIPPED]: [
        QueueStatus.CALLED,
        QueueStatus.WAITING,
        QueueStatus.CANCELLED,
      ],
      [QueueStatus.IN_CONSULTATION]: [
        QueueStatus.COMPLETED,
        QueueStatus.CANCELLED,
      ],
      [QueueStatus.COMPLETED]: [],
      [QueueStatus.CANCELLED]: [],
    };

    if (!validTransitions[entry.status].includes(dto.status)) {
      throw new ConflictException(
        `Invalid queue status transition from ${entry.status} to ${dto.status}`,
      );
    }

    // 4. Prepare data and timestamps
    const now = new Date();
    const updateData: Prisma.OpdQueueEntryUpdateInput = {
      status: dto.status,
    };

    if (dto.status === QueueStatus.CALLED) {
      if (!entry.calledAt) {
        updateData.calledAt = now;
      }
    } else if (dto.status === QueueStatus.IN_CONSULTATION) {
      updateData.consultationStartTime = now;
    } else if (dto.status === QueueStatus.COMPLETED) {
      updateData.consultationEndTime = now;
    }

    // 5. Execute in transaction to coordinate linked appointment
    return this.prisma.$transaction(async (tx) => {
      const casResult = await tx.opdQueueEntry.updateMany({
        where: {
          id,
          clinicId,
          status: entry.status,
        },
        data: updateData,
      });

      if (casResult.count === 0) {
        throw new ConflictException(
          'Queue entry was concurrently modified by another request',
        );
      }

      // Sync linked appointment if present
      if (entry.appointmentId) {
        if (dto.status === QueueStatus.IN_CONSULTATION) {
          await tx.appointment.updateMany({
            where: { id: entry.appointmentId, clinicId },
            data: { status: AppointmentStatus.IN_CONSULTATION },
          });
        } else if (dto.status === QueueStatus.COMPLETED) {
          await tx.appointment.updateMany({
            where: { id: entry.appointmentId, clinicId },
            data: { status: AppointmentStatus.COMPLETED },
          });
        } else if (dto.status === QueueStatus.CANCELLED) {
          const apptUpdate = await tx.appointment.updateMany({
            where: {
              id: entry.appointmentId,
              clinicId,
              status: {
                in: [
                  AppointmentStatus.CHECKED_IN,
                  AppointmentStatus.IN_CONSULTATION,
                ],
              },
            },
            data: {
              status: AppointmentStatus.CANCELLED,
              cancellationReason: 'Queue entry cancelled',
              cancelledAt: now,
            },
          });

          if (apptUpdate.count === 0) {
            throw new ConflictException(
              'Linked appointment could not be transitioned to CANCELLED from current status',
            );
          }
        }
      }

      return tx.opdQueueEntry.findUniqueOrThrow({
        where: { id },
        include: QUEUE_ENTRY_INCLUDE,
      });
    });
  }
}
