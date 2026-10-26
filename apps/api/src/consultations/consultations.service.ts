import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  ClinicRole,
  Consultation,
  ConsultationStatus,
  MembershipStatus,
  Prisma,
  QueueStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import {
  ConsultationQueryDto,
  PaginatedConsultationResponse,
} from './dto/consultation-query.dto';
import { PatientConsultationHistoryQueryDto } from './dto/patient-consultation-history-query.dto';

@Injectable()
export class ConsultationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a draft clinical consultation record for an existing patient
   * within the authenticated clinician's authorized practice.
   *
   * Security & Invariants:
   * 1. clinicId is strictly derived from the verified active clinic context.
   * 2. clinicianId is strictly derived from the authenticated user identity.
   * 3. Confirms patient belongs to the same clinic and is not soft-deleted.
   * 4. Confirms clinician holds an ACTIVE DOCTOR membership in the target clinic.
   * 5. Status is unconditionally initialized to DRAFT.
   * 6. finalizedAt is unconditionally null.
   */
  async createDraft(
    clinicId: string,
    clinicianId: string,
    dto: CreateConsultationDto,
  ): Promise<Consultation> {
    // 1. Verify patient belongs to the active clinic and is not soft-deleted
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

    // 2. Verify clinician has an ACTIVE DOCTOR membership in the active clinic
    const membership = await this.prisma.clinicMembership.findUnique({
      where: {
        userId_clinicId: {
          userId: clinicianId,
          clinicId,
        },
      },
    });

    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      membership.role !== ClinicRole.DOCTOR
    ) {
      throw new ForbiddenException(
        'Clinician is not an active doctor in this clinic',
      );
    }

    // 3. Parse date fields safely
    const parsedEncounterDate = dto.encounterDate
      ? new Date(dto.encounterDate)
      : new Date();

    const parsedFollowUpDate = dto.followUpDate
      ? new Date(`${dto.followUpDate}T00:00:00.000Z`)
      : null;

    // 4. Create consultation with status DRAFT
    return this.prisma.consultation.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        clinicianId,
        encounterDate: parsedEncounterDate,
        status: ConsultationStatus.DRAFT,
        finalizedAt: null,
        chiefComplaint: dto.chiefComplaint,
        symptoms: dto.symptoms ?? null,
        examination: dto.examination ?? null,
        diagnosis: dto.diagnosis ?? null,
        treatmentPlan: dto.treatmentPlan ?? null,
        followUpDate: parsedFollowUpDate,
        bpSystolic: dto.bpSystolic ?? null,
        bpDiastolic: dto.bpDiastolic ?? null,
        pulse: dto.pulse ?? null,
        temperature:
          dto.temperature !== undefined
            ? new Prisma.Decimal(dto.temperature)
            : null,
        weightKg:
          dto.weightKg !== undefined ? new Prisma.Decimal(dto.weightKg) : null,
        heightCm:
          dto.heightCm !== undefined ? new Prisma.Decimal(dto.heightCm) : null,
        spo2: dto.spo2 ?? null,
        respiratoryRate: dto.respiratoryRate ?? null,
      },
    });
  }

  /**
   * Updates clinical narrative and vital signs on an existing consultation draft.
   *
   * Security & Concurrency Invariants:
   * 1. Requires at least one valid update field.
   * 2. Scoped strictly to the active clinic (returns 404 if not found).
   * 3. Prevents modification of FINALIZED consultations (returns 409 Conflict).
   * 4. Uses an atomic compare-and-swap (updateMany where status = DRAFT)
   *    preventing race conditions if finalization occurs concurrently.
   */
  async updateDraft(
    clinicId: string,
    id: string,
    currentUserId: string,
    dto: UpdateConsultationDto,
  ): Promise<Consultation> {
    const hasUpdates = Object.keys(dto).some(
      (k) => dto[k as keyof UpdateConsultationDto] !== undefined,
    );

    if (!hasUpdates) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // 1. Verify existence in active clinic
    const existing = await this.prisma.consultation.findFirst({
      where: { id, clinicId },
    });

    if (!existing) {
      throw new NotFoundException('Consultation not found');
    }

    // 2. Enforce clinician ownership
    if (existing.clinicianId !== currentUserId) {
      throw new ForbiddenException(
        'Only the assigned clinician may update this consultation draft',
      );
    }

    // 3. Reject edits on already finalized records
    if (existing.status === ConsultationStatus.FINALIZED) {
      throw new ConflictException('Cannot edit a finalized consultation');
    }

    // 4. Assemble partial update payload
    const data: Prisma.ConsultationUpdateManyMutationInput = {};

    if (dto.chiefComplaint !== undefined) data.chiefComplaint = dto.chiefComplaint;
    if (dto.symptoms !== undefined) data.symptoms = dto.symptoms;
    if (dto.examination !== undefined) data.examination = dto.examination;
    if (dto.diagnosis !== undefined) data.diagnosis = dto.diagnosis;
    if (dto.treatmentPlan !== undefined) data.treatmentPlan = dto.treatmentPlan;

    if (dto.followUpDate !== undefined) {
      data.followUpDate = dto.followUpDate
        ? new Date(`${dto.followUpDate}T00:00:00.000Z`)
        : null;
    }

    if (dto.bpSystolic !== undefined) data.bpSystolic = dto.bpSystolic;
    if (dto.bpDiastolic !== undefined) data.bpDiastolic = dto.bpDiastolic;
    if (dto.pulse !== undefined) data.pulse = dto.pulse;

    if (dto.temperature !== undefined) {
      data.temperature =
        dto.temperature !== null ? new Prisma.Decimal(dto.temperature) : null;
    }

    if (dto.weightKg !== undefined) {
      data.weightKg =
        dto.weightKg !== null ? new Prisma.Decimal(dto.weightKg) : null;
    }

    if (dto.heightCm !== undefined) {
      data.heightCm =
        dto.heightCm !== null ? new Prisma.Decimal(dto.heightCm) : null;
    }

    if (dto.spo2 !== undefined) data.spo2 = dto.spo2;
    if (dto.respiratoryRate !== undefined)
      data.respiratoryRate = dto.respiratoryRate;

    // 5. Concurrency-safe atomic compare-and-swap update
    const updateResult = await this.prisma.consultation.updateMany({
      where: {
        id,
        clinicId,
        clinicianId: currentUserId,
        status: ConsultationStatus.DRAFT,
      },
      data,
    });

    if (updateResult.count === 0) {
      throw new ConflictException(
        'Consultation was finalized concurrently or is no longer in DRAFT status',
      );
    }

    return this.prisma.consultation.findUniqueOrThrow({
      where: { id },
    });
  }

  /**
   * Finalizes an active consultation draft, transitioning its status to FINALIZED
   * and setting finalizedAt timestamp to server time.
   * Also transactionally completes any associated walk-in queue entry in IN_CONSULTATION.
   *
   * Invariants:
   * 1. Scoped strictly to the active clinic (404 if not found).
   * 2. Only the assigned clinician can finalize (403 Forbidden).
   * 3. Cannot transition if already FINALIZED (409 Conflict).
   * 4. Uses atomic compare-and-swap (where status = DRAFT) to serialize concurrent finalization.
   * 5. Coordinates completion of walk-in queue entries in the same atomic transaction.
   */
  async finalize(
    clinicId: string,
    id: string,
    currentUserId: string,
  ): Promise<Consultation> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify existence in active clinic
      const existing = await tx.consultation.findFirst({
        where: { id, clinicId },
      });

      if (!existing) {
        throw new NotFoundException('Consultation not found');
      }

      // 2. Enforce clinician ownership
      if (existing.clinicianId !== currentUserId) {
        throw new ForbiddenException(
          'Only the assigned clinician may finalize this consultation',
        );
      }

      // 3. Reject repeated finalization
      if (existing.status === ConsultationStatus.FINALIZED) {
        throw new ConflictException('Consultation is already finalized');
      }

      // 4. Concurrency-safe atomic finalization
      const now = new Date();
      const updateResult = await tx.consultation.updateMany({
        where: {
          id,
          clinicId,
          clinicianId: currentUserId,
          status: ConsultationStatus.DRAFT,
        },
        data: {
          status: ConsultationStatus.FINALIZED,
          finalizedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'Consultation was already finalized concurrently',
        );
      }

      // 5. Transactionally complete any associated walk-in queue entry currently IN_CONSULTATION
      const walkInQueueEntry = await tx.opdQueueEntry.findFirst({
        where: {
          clinicId,
          patientId: existing.patientId,
          doctorId: currentUserId,
          appointmentId: null,
          status: QueueStatus.IN_CONSULTATION,
        },
      });

      if (walkInQueueEntry) {
        await tx.opdQueueEntry.updateMany({
          where: {
            id: walkInQueueEntry.id,
            clinicId,
            status: QueueStatus.IN_CONSULTATION,
          },
          data: {
            status: QueueStatus.COMPLETED,
            consultationEndTime: now,
          },
        });
      }

      return tx.consultation.findUniqueOrThrow({
        where: { id },
      });
    });
  }

  /**
   * Retrieves paginated consultations for the active clinic with optional filters.
   *
   * Security & Invariants:
   * 1. clinicId is strictly derived from active clinic context.
   * 2. Sorted by encounterDate desc, with secondary sort id desc.
   * 3. Paginated with page & limit boundaries.
   * 4. Includes patient summary (name, uhid, gender, dob) without unbounded relations.
   */
  async findAll(
    clinicId: string,
    query: ConsultationQueryDto,
  ): Promise<PaginatedConsultationResponse<Consultation>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ConsultationWhereInput = {
      clinicId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.patientId) {
      where.patientId = query.patientId;
    }

    const [total, data] = await Promise.all([
      this.prisma.consultation.count({ where }),
      this.prisma.consultation.findMany({
        where,
        orderBy: [{ encounterDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              uhid: true,
              fullName: true,
              gender: true,
              dateOfBirth: true,
            },
          },
        },
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
   * Retrieves consultation details by ID strictly scoped to the active clinic.
   *
   * Security & Invariants:
   * 1. Scoped strictly to active clinic (returns 404 if not found).
   * 2. Returns consultation record and necessary patient context.
   * 3. Never leaks cross-clinic records.
   */
  async findOne(clinicId: string, id: string): Promise<Consultation> {
    const consultation = await this.prisma.consultation.findFirst({
      where: { id, clinicId },
      include: {
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
      },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    return consultation;
  }

  /**
   * Retrieves consultation history for a specific patient within the active clinic.
   *
   * Invariants:
   * 1. Confirms patient belongs to active clinic and is not soft-deleted (404 if not).
   * 2. Returns only consultations belonging to that patient and clinic.
   * 3. Ordered by encounterDate desc, secondary id desc.
   * 4. Paginated response consistent with findAll.
   */
  async findPatientHistory(
    clinicId: string,
    patientId: string,
    query: PatientConsultationHistoryQueryDto,
  ): Promise<PaginatedConsultationResponse<Consultation>> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        clinicId,
        deletedAt: null,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ConsultationWhereInput = {
      clinicId,
      patientId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [total, data] = await Promise.all([
      this.prisma.consultation.count({ where }),
      this.prisma.consultation.findMany({
        where,
        orderBy: [{ encounterDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              uhid: true,
              fullName: true,
              gender: true,
              dateOfBirth: true,
            },
          },
        },
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
}
