import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Patient, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import {
  PatientSearchQueryDto,
  PaginatedPatientResponse,
} from './dto/patient-search-query.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers a new patient within the specified clinic.
   * Allocates an atomic sequence number using PostgreSQL atomic upsert
   * on `patient_uhid_counters`, format: `UHID-000001`.
   * Enclosed in an interactive transaction with rollback on failure.
   */
  async create(clinicId: string, dto: CreatePatientDto): Promise<Patient> {
    const parsedDob = dto.dateOfBirth
      ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
      : null;

    return this.prisma.$transaction(async (tx) => {
      // 1. Atomic initialization or increment of clinic's UHID counter
      const counterId = crypto.randomUUID();

      const counterResult = await tx.$queryRaw<{ lastUhid: number }[]>`
        INSERT INTO "patient_uhid_counters" ("id", "clinicId", "lastUhid", "updatedAt")
        VALUES (${counterId}, ${clinicId}, 1, NOW())
        ON CONFLICT ("clinicId")
        DO UPDATE SET
          "lastUhid" = "patient_uhid_counters"."lastUhid" + 1,
          "updatedAt" = NOW()
        RETURNING "lastUhid";
      `;

      if (!counterResult || counterResult.length === 0) {
        throw new InternalServerErrorException(
          'Failed to allocate UHID counter',
        );
      }

      const sequence = counterResult[0].lastUhid;
      const uhid = `UHID-${String(sequence).padStart(6, '0')}`;

      // 2. Create the patient in the same transaction
      const patient = await tx.patient.create({
        data: {
          clinicId,
          uhid,
          fullName: dto.fullName,
          gender: dto.gender,
          dateOfBirth: parsedDob,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          city: dto.city ?? null,
          pincode: dto.pincode ?? null,
          isActive: true,
        },
      });

      return patient;
    });
  }

  /**
   * Searches and lists active, non-deleted patients within the specified clinic.
   */
  async findAll(
    clinicId: string,
    query: PatientSearchQueryDto,
  ): Promise<PaginatedPatientResponse<Patient>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {
      clinicId,
      deletedAt: null,
    };

    if (query.q && query.q.trim().length >= 2) {
      const searchTerm = query.q.trim();
      where.OR = [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { uhid: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single patient by ID strictly scoped to the active clinic.
   * Returns 404 if not found, soft-deleted, or belonging to another clinic.
   */
  async findOne(clinicId: string, id: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        clinicId,
        deletedAt: null,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  /**
   * Updates demographic fields for a single patient within the active clinic.
   */
  async update(
    clinicId: string,
    id: string,
    dto: UpdatePatientDto,
  ): Promise<Patient> {
    const hasUpdates = Object.keys(dto).some(
      (key) => dto[key as keyof UpdatePatientDto] !== undefined,
    );

    if (!hasUpdates) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // Ensure patient exists in the active clinic and is not soft-deleted
    const existing = await this.prisma.patient.findFirst({
      where: {
        id,
        clinicId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Patient not found');
    }

    const data: Prisma.PatientUpdateInput = {};

    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.phone !== undefined) data.phone = dto.phone;

    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth
        ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
        : null;
    }

    if (dto.alternatePhone !== undefined)
      data.alternatePhone = dto.alternatePhone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.pincode !== undefined) data.pincode = dto.pincode;

    return this.prisma.patient.update({
      where: { id: existing.id },
      data,
    });
  }
}
