import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicRole,
  MembershipStatus,
  Prescription,
  PrescriptionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { ApprovePrescriptionDto } from './dto/approve-prescription.dto';
import { AmendPrescriptionDto } from './dto/amend-prescription.dto';
import {
  ListPrescriptionsQueryDto,
  PaginatedPrescriptionResponse,
} from './dto/list-prescriptions-query.dto';
import {
  PdfGeneratorService,
  PrescriptionWithDetails,
} from './services/pdf-generator.service';

export const PRESCRIPTION_INCLUDE = {
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
      id: true,
      userId: true,
      role: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  consultation: {
    select: {
      id: true,
      encounterDate: true,
      chiefComplaint: true,
      diagnosis: true,
      bpSystolic: true,
      bpDiastolic: true,
      pulse: true,
      temperature: true,
      spo2: true,
      weightKg: true,
      heightCm: true,
    },
  },
  items: {
    orderBy: { sortOrder: 'asc' as const },
  },
};

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  /**
   * Creates a draft prescription for an existing patient.
   *
   * Security & Invariants:
   * 1. clinicId is strictly derived from verified active clinic context.
   * 2. doctorId is strictly derived from authenticated user identity.
   * 3. Confirms patient belongs to active clinic and is not soft-deleted.
   * 4. Confirms clinician holds an ACTIVE DOCTOR membership in active clinic.
   * 5. If consultationId provided, confirms consultation belongs to patient and clinic.
   * 6. Status is initialized to DRAFT; approvedAt is null.
   * 7. Prescription items are created with computed sortOrder.
   * 8. Records a clinical audit event for draft creation.
   */
  async createDraft(
    clinicId: string,
    doctorId: string,
    dto: CreatePrescriptionDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Prescription> {
    // 1. Verify patient belongs to clinic and is not deleted
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

    // 2. Verify doctor has active DOCTOR membership in clinic
    const membership = await this.prisma.clinicMembership.findUnique({
      where: {
        userId_clinicId: {
          userId: doctorId,
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

    // 3. Verify consultation if provided
    if (dto.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: {
          id: dto.consultationId,
          clinicId,
          patientId: dto.patientId,
        },
      });

      if (!consultation) {
        throw new NotFoundException(
          'Consultation not found for this patient in active clinic',
        );
      }
    }

    // 4. Create prescription and items in a single transaction
    return this.prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: {
          clinicId,
          patientId: dto.patientId,
          doctorId,
          consultationId: dto.consultationId ?? null,
          status: PrescriptionStatus.DRAFT,
          versionNumber: 1,
          notes: dto.notes ?? null,
          approvedAt: null,
          items: {
            create: dto.items.map((item, idx) => ({
              medicationName: item.medicationName,
              brandName: item.brandName ?? null,
              dosageForm: item.dosageForm,
              strength: item.strength,
              route: item.route,
              frequency: item.frequency,
              durationValue: item.durationValue,
              durationUnit: item.durationUnit,
              timing: item.timing,
              specialInstructions: item.specialInstructions ?? null,
              sortOrder: item.sortOrder ?? idx,
            })),
          },
        },
        include: PRESCRIPTION_INCLUDE,
      });

      // Audit Log
      await tx.clinicalAuditEvent.create({
        data: {
          clinicId,
          userId: doctorId,
          action: 'PRESCRIPTION_DRAFT_CREATED',
          entityType: 'Prescription',
          entityId: prescription.id,
          metadata: {
            patientId: dto.patientId,
            itemCount: dto.items.length,
            consultationId: dto.consultationId,
          },
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      return prescription;
    });
  }

  /**
   * Retrieves paginated prescriptions for the active clinic with optional filters.
   */
  async findAll(
    clinicId: string,
    query: ListPrescriptionsQueryDto,
  ): Promise<PaginatedPrescriptionResponse<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PrescriptionWhereInput = {
      clinicId,
    };

    if (query.patientId) {
      where.patientId = query.patientId;
    }

    if (query.consultationId) {
      where.consultationId = query.consultationId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, data] = await Promise.all([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: PRESCRIPTION_INCLUDE,
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
   * Retrieves prescription details by ID strictly scoped to active clinic.
   */
  async findOne(clinicId: string, id: string): Promise<any> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, clinicId },
      include: {
        ...PRESCRIPTION_INCLUDE,
        clinic: true,
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return prescription;
  }

  /**
   * Updates an existing prescription draft.
   *
   * Security & Invariants:
   * 1. Scoped strictly to active clinic.
   * 2. Cannot update an APPROVED or SUPERSEDED prescription (returns 409 Conflict).
   * 3. Only the prescribing doctor may update the draft.
   * 4. Atomic update of notes and medication items list.
   */
  async updateDraft(
    clinicId: string,
    id: string,
    doctorId: string,
    dto: UpdatePrescriptionDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Prescription> {
    const existing = await this.prisma.prescription.findFirst({
      where: { id, clinicId },
    });

    if (!existing) {
      throw new NotFoundException('Prescription not found');
    }

    if (existing.doctorId !== doctorId) {
      throw new ForbiddenException(
        'Only the prescribing doctor may update this prescription draft',
      );
    }

    if (existing.status !== PrescriptionStatus.DRAFT) {
      throw new ConflictException(
        `Cannot edit a prescription with status ${existing.status}. An approved prescription must be amended.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update notes if provided
      if (dto.notes !== undefined) {
        await tx.prescription.updateMany({
          where: {
            id,
            clinicId,
            status: PrescriptionStatus.DRAFT,
          },
          data: {
            notes: dto.notes,
          },
        });
      }

      // 2. Replace items if provided
      if (dto.items && dto.items.length > 0) {
        await tx.prescriptionItem.deleteMany({
          where: {
            prescriptionId: id,
            clinicId,
          },
        });

        await tx.prescriptionItem.createMany({
          data: dto.items.map((item, idx) => ({
            prescriptionId: id,
            clinicId,
            medicationName: item.medicationName,
            brandName: item.brandName ?? null,
            dosageForm: item.dosageForm,
            strength: item.strength,
            route: item.route,
            frequency: item.frequency,
            durationValue: item.durationValue,
            durationUnit: item.durationUnit,
            timing: item.timing,
            specialInstructions: item.specialInstructions ?? null,
            sortOrder: item.sortOrder ?? idx,
          })),
        });
      }

      // Audit log
      await tx.clinicalAuditEvent.create({
        data: {
          clinicId,
          userId: doctorId,
          action: 'PRESCRIPTION_DRAFT_UPDATED',
          entityType: 'Prescription',
          entityId: id,
          metadata: {
            updatedItems: dto.items ? dto.items.length : undefined,
            updatedNotes: dto.notes !== undefined,
          },
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      return tx.prescription.findUniqueOrThrow({
        where: { id },
        include: PRESCRIPTION_INCLUDE,
      });
    });
  }

  /**
   * Explicitly approves and locks a prescription draft.
   *
   * Security & Invariants:
   * 1. Requires explicit confirmation (confirmApproval: true).
   * 2. Scoped strictly to active clinic.
   * 3. Only the prescribing doctor may approve.
   * 4. Prescription must contain at least one medication item.
   * 5. Atomically transitions status to APPROVED and sets approvedAt timestamp.
   * 6. Records an immutable clinical audit event.
   */
  async approve(
    clinicId: string,
    id: string,
    doctorId: string,
    dto: ApprovePrescriptionDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Prescription> {
    if (!dto.confirmApproval) {
      throw new BadRequestException(
        'confirmApproval must be explicitly true to approve and lock the prescription',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.prescription.findFirst({
        where: { id, clinicId },
        include: { items: true },
      });

      if (!existing) {
        throw new NotFoundException('Prescription not found');
      }

      if (existing.doctorId !== doctorId) {
        throw new ForbiddenException(
          'Only the prescribing doctor may approve this prescription',
        );
      }

      if (existing.status === PrescriptionStatus.APPROVED) {
        throw new ConflictException('Prescription is already approved');
      }

      if (existing.status !== PrescriptionStatus.DRAFT) {
        throw new ConflictException(
          `Cannot approve a prescription with status ${existing.status}`,
        );
      }

      if (existing.items.length === 0) {
        throw new BadRequestException(
          'Prescription cannot be approved without medication items',
        );
      }

      const now = new Date();
      const updateResult = await tx.prescription.updateMany({
        where: {
          id,
          clinicId,
          doctorId,
          status: PrescriptionStatus.DRAFT,
        },
        data: {
          status: PrescriptionStatus.APPROVED,
          approvedAt: now,
          notes:
            dto.doctorNotes !== undefined ? dto.doctorNotes : existing.notes,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'Prescription was approved concurrently or is no longer in DRAFT status',
        );
      }

      // Record audit event
      await tx.clinicalAuditEvent.create({
        data: {
          clinicId,
          userId: doctorId,
          action: 'PRESCRIPTION_APPROVED',
          entityType: 'Prescription',
          entityId: id,
          metadata: {
            patientId: existing.patientId,
            itemCount: existing.items.length,
            versionNumber: existing.versionNumber,
            approvedAt: now.toISOString(),
          },
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      return tx.prescription.findUniqueOrThrow({
        where: { id },
        include: PRESCRIPTION_INCLUDE,
      });
    });
  }

  /**
   * Amends an approved prescription, creating version N+1 and linking to supersedesPrescriptionId.
   *
   * Security & Legal Invariants:
   * 1. Requires mandatory amendmentReason with clinical justification.
   * 2. Existing prescription must be APPROVED.
   * 3. Atomically sets existing prescription status to SUPERSEDED.
   * 4. Creates new prescription with versionNumber = previous + 1, status APPROVED, approvedAt = now.
   * 5. Preserves original prescription completely intact for medical-legal traceability.
   * 6. Records a PRESCRIPTION_AMENDED audit event.
   */
  async amend(
    clinicId: string,
    id: string,
    doctorId: string,
    dto: AmendPrescriptionDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Prescription> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.prescription.findFirst({
        where: { id, clinicId },
      });

      if (!existing) {
        throw new NotFoundException('Prescription not found');
      }

      if (existing.status !== PrescriptionStatus.APPROVED) {
        throw new ConflictException(
          'Only an approved prescription can be amended. Drafts should be updated directly.',
        );
      }

      // 1. Transition existing to SUPERSEDED
      await tx.prescription.update({
        where: { id },
        data: { status: PrescriptionStatus.SUPERSEDED },
      });

      // 2. Create amended prescription version N+1
      const now = new Date();
      const amended = await tx.prescription.create({
        data: {
          clinicId,
          patientId: existing.patientId,
          doctorId,
          consultationId: existing.consultationId,
          versionNumber: existing.versionNumber + 1,
          status: PrescriptionStatus.APPROVED,
          supersedesPrescriptionId: existing.id,
          amendmentReason: dto.amendmentReason,
          notes: dto.notes ?? existing.notes,
          approvedAt: now,
          items: {
            create: dto.items.map((item, idx) => ({
              medicationName: item.medicationName,
              brandName: item.brandName ?? null,
              dosageForm: item.dosageForm,
              strength: item.strength,
              route: item.route,
              frequency: item.frequency,
              durationValue: item.durationValue,
              durationUnit: item.durationUnit,
              timing: item.timing,
              specialInstructions: item.specialInstructions ?? null,
              sortOrder: item.sortOrder ?? idx,
            })),
          },
        },
        include: PRESCRIPTION_INCLUDE,
      });

      // Audit event
      await tx.clinicalAuditEvent.create({
        data: {
          clinicId,
          userId: doctorId,
          action: 'PRESCRIPTION_AMENDED',
          entityType: 'Prescription',
          entityId: amended.id,
          metadata: {
            previousPrescriptionId: id,
            previousVersion: existing.versionNumber,
            newVersion: amended.versionNumber,
            amendmentReason: dto.amendmentReason,
            itemCount: dto.items.length,
          },
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      return amended;
    });
  }

  /**
   * Generates a backend-verified prescription PDF buffer.
   *
   * Security & Privacy Invariants:
   * 1. Scoped strictly to active clinic.
   * 2. Clinic, doctor, patient and consultation details are pulled from verified DB models.
   * 3. Emits a PRESCRIPTION_PDF_VIEWED audit log event.
   */
  async generatePdf(
    clinicId: string,
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, clinicId },
      include: {
        clinic: true,
        patient: true,
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        consultation: true,
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const buffer =
      await this.pdfGenerator.generatePrescriptionPdf(prescription);

    // Record audit event
    await this.prisma.clinicalAuditEvent.create({
      data: {
        clinicId,
        userId,
        action: 'PRESCRIPTION_PDF_VIEWED',
        entityType: 'Prescription',
        entityId: id,
        metadata: {
          versionNumber: prescription.versionNumber,
          status: prescription.status,
        },
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    const sanitizedUhid = prescription.patient.uhid.replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );
    const filename = `Prescription-${sanitizedUhid}-v${prescription.versionNumber}.pdf`;

    return { buffer, filename };
  }
}
