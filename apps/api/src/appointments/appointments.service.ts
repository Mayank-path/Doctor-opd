import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  ClinicRole,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  ListAppointmentsQueryDto,
  PaginatedAppointmentResponse,
} from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';

export const APPOINTMENT_INCLUDE = {
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
  queueEntry: {
    select: {
      id: true,
      tokenNumber: true,
      status: true,
      priority: true,
      checkInTime: true,
      calledAt: true,
    },
  },
} as const;

export const CLINIC_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns the YYYY-MM-DD calendar date in the specified timezone (defaults to Asia/Kolkata).
 */
export function getClinicLocalDate(
  date: Date,
  timeZone = CLINIC_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new scheduled or walk-in appointment.
   *
   * Security & Invariants:
   * 1. clinicId is strictly derived from active verified clinic context.
   * 2. Confirms patient belongs to active clinic, is not soft-deleted, and is active.
   * 3. Confirms assigned doctor holds an ACTIVE DOCTOR membership in the active clinic.
   * 4. Validates start and end time ordering and ensures timestamps match the clinic-local serviceDate in Asia/Kolkata.
   * 5. Sets initial status to SCHEDULED.
   * 6. Does not permit client setting of protected lifecycle fields.
   */
  async create(
    clinicId: string,
    dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const parsedStartTime = new Date(dto.startTime);
    if (isNaN(parsedStartTime.getTime())) {
      throw new BadRequestException(
        'startTime must be a valid ISO 8601 datetime string',
      );
    }

    const parsedEndTime = dto.endTime ? new Date(dto.endTime) : null;
    if (parsedEndTime && isNaN(parsedEndTime.getTime())) {
      throw new BadRequestException(
        'endTime must be a valid ISO 8601 datetime string',
      );
    }

    const startDateStr = getClinicLocalDate(parsedStartTime);
    if (startDateStr !== dto.serviceDate) {
      throw new BadRequestException(
        `startTime date (${startDateStr}) does not match serviceDate (${dto.serviceDate})`,
      );
    }

    if (parsedEndTime) {
      if (parsedEndTime <= parsedStartTime) {
        throw new BadRequestException('endTime must be after startTime');
      }
      const endDateStr = getClinicLocalDate(parsedEndTime);
      if (endDateStr !== dto.serviceDate) {
        throw new BadRequestException(
          `endTime date (${endDateStr}) does not match serviceDate (${dto.serviceDate})`,
        );
      }
    }

    // 1. Verify patient belongs to active clinic and is not soft-deleted
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: dto.patientId,
        clinicId,
        deletedAt: null,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found in active clinic');
    }

    // 2. Verify doctor has an ACTIVE DOCTOR membership in the active clinic
    const doctorMembership = await this.prisma.clinicMembership.findUnique({
      where: {
        userId_clinicId: {
          userId: dto.doctorId,
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

    const parsedServiceDate = new Date(`${dto.serviceDate}T00:00:00.000Z`);

    return this.prisma.appointment.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        serviceDate: parsedServiceDate,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        type: dto.type ?? AppointmentType.SCHEDULED,
        status: AppointmentStatus.SCHEDULED,
        chiefComplaint: dto.chiefComplaint ?? null,
        notes: dto.notes ?? null,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  /**
   * Lists appointments for the active clinic on a required serviceDate with pagination
   * and optional status and doctorId filters.
   *
   * Invariants:
   * 1. Scoped strictly to active clinic.
   * 2. Ordered deterministically by startTime asc, then id asc.
   * 3. Safe patient and doctor summaries only (no clinical narrative).
   */
  async findAll(
    clinicId: string,
    query: ListAppointmentsQueryDto,
  ): Promise<PaginatedAppointmentResponse<Appointment>> {
    const parsedServiceDate = new Date(`${query.serviceDate}T00:00:00.000Z`);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {
      clinicId,
      serviceDate: parsedServiceDate,
    };

    if (query.doctorId) {
      where.doctorId = query.doctorId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, data] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
        include: APPOINTMENT_INCLUDE,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      items: data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single appointment by ID within the active clinic.
   *
   * Invariants:
   * 1. Scoped strictly to active clinic (returns 404 for missing or cross-clinic).
   * 2. Returns safe summaries (patient, doctor, queueEntry).
   * 3. Never leaks clinical narrative or consultation records.
   */
  async findOne(clinicId: string, id: string): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
      include: APPOINTMENT_INCLUDE,
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  /**
   * Reschedules an appointment in a single atomic transaction.
   *
   * Invariants:
   * 1. Scoped to active clinic (404 if missing or cross-clinic).
   * 2. Rejects checked-in appointments (409 Conflict).
   * 3. Only SCHEDULED and CONFIRMED appointments can be rescheduled (409 Conflict).
   * 4. Supports idempotent retry if already RESCHEDULED with identical parameters.
   * 5. Rejects rescheduling if the patient is soft-deleted (409 Conflict).
   * 6. Uses atomic CAS to mark source as RESCHEDULED.
   * 7. Creates replacement appointment pointing back via rescheduledFromId.
   */
  async reschedule(
    clinicId: string,
    id: string,
    dto: RescheduleAppointmentDto,
  ): Promise<Appointment> {
    const parsedStartTime = new Date(dto.startTime);
    if (isNaN(parsedStartTime.getTime())) {
      throw new BadRequestException(
        'startTime must be a valid ISO 8601 datetime string',
      );
    }

    const parsedEndTime = dto.endTime ? new Date(dto.endTime) : null;
    if (parsedEndTime && isNaN(parsedEndTime.getTime())) {
      throw new BadRequestException(
        'endTime must be a valid ISO 8601 datetime string',
      );
    }

    const startDateStr = getClinicLocalDate(parsedStartTime);
    if (startDateStr !== dto.serviceDate) {
      throw new BadRequestException(
        `startTime date (${startDateStr}) does not match serviceDate (${dto.serviceDate})`,
      );
    }

    if (parsedEndTime) {
      if (parsedEndTime <= parsedStartTime) {
        throw new BadRequestException('endTime must be after startTime');
      }
      const endDateStr = getClinicLocalDate(parsedEndTime);
      if (endDateStr !== dto.serviceDate) {
        throw new BadRequestException(
          `endTime date (${endDateStr}) does not match serviceDate (${dto.serviceDate})`,
        );
      }
    }

    const parsedServiceDate = new Date(`${dto.serviceDate}T00:00:00.000Z`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify existence in active clinic
      const source = await tx.appointment.findFirst({
        where: { id, clinicId },
        include: { queueEntry: true },
      });

      if (!source) {
        throw new NotFoundException('Appointment not found');
      }

      // 2. Support idempotent retry if already RESCHEDULED
      if (source.status === AppointmentStatus.RESCHEDULED) {
        const existingReplacement = await tx.appointment.findFirst({
          where: { rescheduledFromId: id, clinicId },
          include: APPOINTMENT_INCLUDE,
        });

        if (existingReplacement) {
          const matchesServiceDate =
            existingReplacement.serviceDate.toISOString().slice(0, 10) ===
            dto.serviceDate;
          const matchesStartTime =
            existingReplacement.startTime.getTime() ===
            parsedStartTime.getTime();
          const matchesEndTime =
            (existingReplacement.endTime?.getTime() ?? null) ===
            (parsedEndTime?.getTime() ?? null);
          const expectedNotes = dto.notes ?? source.notes;
          const matchesNotes = existingReplacement.notes === expectedNotes;

          if (
            matchesServiceDate &&
            matchesStartTime &&
            matchesEndTime &&
            matchesNotes
          ) {
            return existingReplacement;
          }

          throw new ConflictException(
            'Appointment is already rescheduled with conflicting parameters',
          );
        }

        throw new ConflictException(
          `Appointment cannot be rescheduled from current status: ${source.status}`,
        );
      }

      // 3. Reject checked-in appointments
      if (
        source.status === AppointmentStatus.CHECKED_IN ||
        source.queueEntry !== null
      ) {
        throw new ConflictException(
          'Cannot reschedule a checked-in appointment; queue coordination is not supported in this phase',
        );
      }

      // 4. Verify reschedulable state
      if (
        source.status !== AppointmentStatus.SCHEDULED &&
        source.status !== AppointmentStatus.CONFIRMED
      ) {
        throw new ConflictException(
          `Appointment cannot be rescheduled from current status: ${source.status}`,
        );
      }

      // 5. Verify patient is not soft-deleted
      const patient = await tx.patient.findFirst({
        where: { id: source.patientId, clinicId, deletedAt: null },
      });

      if (!patient) {
        throw new ConflictException(
          'Cannot reschedule appointment for a soft-deleted patient',
        );
      }

      // 6. Atomic CAS update on source
      const casResult = await tx.appointment.updateMany({
        where: {
          id,
          clinicId,
          status: source.status,
        },
        data: {
          status: AppointmentStatus.RESCHEDULED,
        },
      });

      if (casResult.count === 0) {
        const existingReplacement = await tx.appointment.findFirst({
          where: { rescheduledFromId: id, clinicId },
          include: APPOINTMENT_INCLUDE,
        });

        if (existingReplacement) {
          const matchesServiceDate =
            existingReplacement.serviceDate.toISOString().slice(0, 10) ===
            dto.serviceDate;
          const matchesStartTime =
            existingReplacement.startTime.getTime() ===
            parsedStartTime.getTime();
          const matchesEndTime =
            (existingReplacement.endTime?.getTime() ?? null) ===
            (parsedEndTime?.getTime() ?? null);
          const expectedNotes = dto.notes ?? source.notes;
          const matchesNotes = existingReplacement.notes === expectedNotes;

          if (
            matchesServiceDate &&
            matchesStartTime &&
            matchesEndTime &&
            matchesNotes
          ) {
            return existingReplacement;
          }
        }

        throw new ConflictException(
          'Appointment was concurrently modified or already rescheduled',
        );
      }

      // 7. Create replacement appointment
      return tx.appointment.create({
        data: {
          clinicId,
          patientId: source.patientId,
          doctorId: source.doctorId,
          serviceDate: parsedServiceDate,
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          type: source.type,
          status: AppointmentStatus.SCHEDULED,
          chiefComplaint: source.chiefComplaint,
          notes: dto.notes ?? source.notes,
          rescheduledFromId: source.id,
        },
        include: APPOINTMENT_INCLUDE,
      });
    });
  }

  /**
   * Cancels an appointment conditionally and sets cancellation details.
   *
   * Invariants:
   * 1. Scoped to active clinic (404 if missing or cross-clinic).
   * 2. Rejects checked-in appointments (409 Conflict).
   * 3. Rejects already cancelled or terminal states (409 Conflict).
   * 4. Uses atomic CAS to transition to CANCELLED.
   */
  async cancel(
    clinicId: string,
    id: string,
    dto: CancelAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
      include: { queueEntry: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new ConflictException('Appointment is already cancelled');
    }

    if (
      appointment.status === AppointmentStatus.CHECKED_IN ||
      appointment.queueEntry !== null
    ) {
      throw new ConflictException(
        'Cannot cancel a checked-in appointment; coordinated queue cancellation belongs to Phase 3',
      );
    }

    if (
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.IN_CONSULTATION ||
      appointment.status === AppointmentStatus.RESCHEDULED
    ) {
      throw new ConflictException(
        `Appointment cannot be cancelled from current status: ${appointment.status}`,
      );
    }

    const now = new Date();
    const casResult = await this.prisma.appointment.updateMany({
      where: {
        id,
        clinicId,
        status: appointment.status,
      },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: dto.cancellationReason.trim(),
        cancelledAt: now,
      },
    });

    if (casResult.count === 0) {
      throw new ConflictException('Appointment was concurrently modified');
    }

    return this.findOne(clinicId, id);
  }
}
