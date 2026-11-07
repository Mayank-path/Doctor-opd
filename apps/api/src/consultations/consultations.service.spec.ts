import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  ClinicRole,
  ConsultationStatus,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import { ConsultationsService } from './consultations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';

describe('ConsultationsService', () => {
  let service: ConsultationsService;

  const mockClinicId = 'clinic-uuid-1';
  const mockDoctorUserId = 'doctor-user-uuid-1';
  const mockClinicianId = mockDoctorUserId;
  const mockPatientId = 'patient-uuid-1';
  const mockConsultationId = 'consultation-uuid-1';

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

  const mockDraftConsultation = {
    id: mockConsultationId,
    clinicId: mockClinicId,
    patientId: mockPatientId,
    clinicianId: mockDoctorUserId,
    encounterDate: new Date('2026-10-26T10:00:00Z'),
    status: ConsultationStatus.DRAFT,
    finalizedAt: null,
    chiefComplaint: 'Chest tightness',
    symptoms: 'Mild pain on exertion',
    examination: 'Normal vesicular breath sounds',
    diagnosis: 'Musculoskeletal chest wall pain',
    treatmentPlan: 'Analgesics and rest',
    followUpDate: new Date('2026-11-02T00:00:00Z'),
    bpSystolic: 120,
    bpDiastolic: 80,
    pulse: 72,
    temperature: new Prisma.Decimal(98.4),
    weightKg: new Prisma.Decimal(70.0),
    heightCm: new Prisma.Decimal(172.5),
    spo2: 99,
    respiratoryRate: 16,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFinalizedConsultation = {
    ...mockDraftConsultation,
    status: ConsultationStatus.FINALIZED,
    finalizedAt: new Date('2026-10-26T11:00:00Z'),
  };

  const mockPrismaService = {
    patient: {
      findFirst: jest.fn(),
    },
    clinicMembership: {
      findUnique: jest.fn(),
    },
    consultation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    clinicalAuditEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(
      (cb: (tx: any) => Promise<any>) => cb(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ConsultationsService>(ConsultationsService);
  });

  describe('createDraft', () => {
    const validDto: CreateConsultationDto = {
      patientId: mockPatientId,
      chiefComplaint: 'Chest tightness',
      symptoms: 'Mild pain on exertion',
      examination: 'Normal vesicular breath sounds',
      diagnosis: 'Musculoskeletal chest wall pain',
      treatmentPlan: 'Analgesics and rest',
      followUpDate: '2026-11-02',
      bpSystolic: 120,
      bpDiastolic: 80,
      pulse: 72,
      temperature: 98.4,
      weightKg: 70.0,
      heightCm: 172.5,
      spo2: 99,
      respiratoryRate: 16,
    };

    it('successfully creates a consultation draft with valid patient and clinician', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.create.mockResolvedValue(
        mockDraftConsultation,
      );

      const result = await service.createDraft(
        mockClinicId,
        mockDoctorUserId,
        validDto,
      );

      expect(result).toEqual(mockDraftConsultation);
      expect(mockPrismaService.patient.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPatientId,
          clinicId: mockClinicId,
          deletedAt: null,
        },
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
      expect(mockPrismaService.consultation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: mockClinicId,
          patientId: mockPatientId,
          clinicianId: mockDoctorUserId,
          status: ConsultationStatus.DRAFT,
          finalizedAt: null,
          chiefComplaint: 'Chest tightness',
        }),
      });
    });

    it('throws NotFoundException if patient does not exist or is in another clinic', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createDraft(mockClinicId, mockDoctorUserId, validDto),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.consultation.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException if clinician is not an active doctor', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue({
        ...mockDoctorMembership,
        role: ClinicRole.STAFF,
      });

      await expect(
        service.createDraft(mockClinicId, mockDoctorUserId, validDto),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.consultation.create).not.toHaveBeenCalled();
    });
  });

  describe('updateDraft', () => {
    const updateDto: UpdateConsultationDto = {
      chiefComplaint: 'Severe migraine with aura',
      bpSystolic: 130,
      bpDiastolic: 85,
    };

    it('successfully updates a draft consultation with compare-and-swap CAS', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockDraftConsultation,
      );
      mockPrismaService.consultation.updateMany.mockResolvedValue({ count: 1 });
      const updatedMock = {
        ...mockDraftConsultation,
        chiefComplaint: 'Severe migraine with aura',
        bpSystolic: 130,
        bpDiastolic: 85,
      };
      mockPrismaService.consultation.findUniqueOrThrow.mockResolvedValue(
        updatedMock,
      );

      const result = await service.updateDraft(
        mockClinicId,
        mockConsultationId,
        mockClinicianId,
        updateDto,
      );

      expect(result).toEqual(updatedMock);
      expect(mockPrismaService.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: mockConsultationId, clinicId: mockClinicId },
      });
      expect(mockPrismaService.consultation.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockConsultationId,
          clinicId: mockClinicId,
          clinicianId: mockClinicianId,
          status: ConsultationStatus.DRAFT,
        },
        data: expect.objectContaining({
          chiefComplaint: 'Severe migraine with aura',
          bpSystolic: 130,
          bpDiastolic: 85,
        }),
      });
    });

    it('throws ForbiddenException if calling clinician does not match draft clinicianId', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockDraftConsultation,
      );

      await expect(
        service.updateDraft(
          mockClinicId,
          mockConsultationId,
          'different-doctor-id',
          updateDto,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.consultation.updateMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if no fields are provided for update', async () => {
      await expect(
        service.updateDraft(
          mockClinicId,
          mockConsultationId,
          mockClinicianId,
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if consultation does not exist in active clinic', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDraft(
          mockClinicId,
          mockConsultationId,
          mockClinicianId,
          updateDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if attempting to edit an already FINALIZED consultation', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockFinalizedConsultation,
      );

      await expect(
        service.updateDraft(
          mockClinicId,
          mockConsultationId,
          mockClinicianId,
          updateDto,
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.consultation.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException if concurrent finalization caused updateMany count to be 0', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockDraftConsultation,
      );
      mockPrismaService.consultation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateDraft(
          mockClinicId,
          mockConsultationId,
          mockClinicianId,
          updateDto,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('finalize', () => {
    it('successfully transitions DRAFT to FINALIZED and sets finalizedAt', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockDraftConsultation,
      );
      mockPrismaService.consultation.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.consultation.findUniqueOrThrow.mockResolvedValue(
        mockFinalizedConsultation,
      );

      const result = await service.finalize(
        mockClinicId,
        mockConsultationId,
        mockClinicianId,
      );

      expect(result).toEqual(mockFinalizedConsultation);
      expect(mockPrismaService.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: mockConsultationId, clinicId: mockClinicId },
      });
      expect(mockPrismaService.consultation.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockConsultationId,
          clinicId: mockClinicId,
          clinicianId: mockClinicianId,
          status: ConsultationStatus.DRAFT,
        },
        data: {
          status: ConsultationStatus.FINALIZED,
          finalizedAt: expect.any(Date),
        },
      });
    });

    it('throws ForbiddenException if calling clinician does not match draft clinicianId', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockDraftConsultation,
      );

      await expect(
        service.finalize(
          mockClinicId,
          mockConsultationId,
          'different-doctor-id',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.consultation.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if consultation does not exist in active clinic', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(null);

      await expect(
        service.finalize(mockClinicId, mockConsultationId, mockClinicianId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on repeated finalization of already FINALIZED consultation', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockFinalizedConsultation,
      );

      await expect(
        service.finalize(mockClinicId, mockConsultationId, mockClinicianId),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.consultation.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException if concurrent finalization raced and updateMany count is 0', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockDraftConsultation,
      );
      mockPrismaService.consultation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.finalize(mockClinicId, mockConsultationId, mockClinicianId),
      ).rejects.toThrow(ConflictException);
    });

  });

  describe('findAll', () => {
    it('returns paginated consultations with defaults', async () => {
      mockPrismaService.consultation.count.mockResolvedValue(1);
      mockPrismaService.consultation.findMany.mockResolvedValue([
        mockDraftConsultation,
      ]);

      const result = await service.findAll(mockClinicId, {
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.consultation.count).toHaveBeenCalledWith({
        where: { clinicId: mockClinicId },
      });
      expect(mockPrismaService.consultation.findMany).toHaveBeenCalledWith({
        where: { clinicId: mockClinicId },
        orderBy: [{ encounterDate: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
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
      });
      expect(result.data).toEqual([mockDraftConsultation]);
      expect(result.items).toEqual([mockDraftConsultation]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('applies status and patientId filters when provided', async () => {
      mockPrismaService.consultation.count.mockResolvedValue(0);
      mockPrismaService.consultation.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockClinicId, {
        page: 2,
        limit: 10,
        status: ConsultationStatus.FINALIZED,
        patientId: mockPatientId,
      });

      expect(mockPrismaService.consultation.count).toHaveBeenCalledWith({
        where: {
          clinicId: mockClinicId,
          status: ConsultationStatus.FINALIZED,
          patientId: mockPatientId,
        },
      });
      expect(mockPrismaService.consultation.findMany).toHaveBeenCalledWith({
        where: {
          clinicId: mockClinicId,
          status: ConsultationStatus.FINALIZED,
          patientId: mockPatientId,
        },
        orderBy: [{ encounterDate: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
        include: expect.any(Object),
      });
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns consultation with patient context when found in active clinic', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockDraftConsultation,
        patient: mockPatient,
      });

      const result = await service.findOne(mockClinicId, mockConsultationId);

      expect(mockPrismaService.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: mockConsultationId, clinicId: mockClinicId },
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
      expect(result.id).toBe(mockConsultationId);
    });

    it('throws NotFoundException when consultation does not exist or belongs to another clinic', async () => {
      mockPrismaService.consultation.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockClinicId, mockConsultationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPatientHistory', () => {
    it('returns patient consultations history when patient exists and is not deleted', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.consultation.count.mockResolvedValue(1);
      mockPrismaService.consultation.findMany.mockResolvedValue([
        mockDraftConsultation,
      ]);

      const result = await service.findPatientHistory(
        mockClinicId,
        mockPatientId,
        {
          page: 1,
          limit: 10,
        },
      );

      expect(mockPrismaService.patient.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPatientId,
          clinicId: mockClinicId,
          deletedAt: null,
        },
      });
      expect(mockPrismaService.consultation.count).toHaveBeenCalledWith({
        where: {
          clinicId: mockClinicId,
          patientId: mockPatientId,
        },
      });
      expect(result.items).toEqual([mockDraftConsultation]);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('throws NotFoundException if patient does not exist or is soft-deleted', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.findPatientHistory(mockClinicId, mockPatientId, {
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.consultation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteDraft', () => {
    it('successfully deletes a draft consultation and records an audit event', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockDraftConsultation,
        prescriptions: [],
      });
      mockPrismaService.consultation.delete.mockResolvedValue(mockDraftConsultation);
      mockPrismaService.clinicalAuditEvent.create.mockResolvedValue({});

      const result = await service.deleteDraft(
        mockClinicId,
        mockConsultationId,
        mockDoctorUserId,
      );

      expect(result).toEqual({
        success: true,
        message: 'Draft consultation deleted successfully',
      });
      expect(mockPrismaService.consultation.delete).toHaveBeenCalledWith({
        where: { id_clinicId: { id: mockConsultationId, clinicId: mockClinicId } },
      });
      expect(mockPrismaService.clinicalAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId: mockClinicId,
            userId: mockDoctorUserId,
            action: 'CONSULTATION_DRAFT_DELETED',
            entityType: 'Consultation',
            entityId: mockConsultationId,
          }),
        }),
      );
    });

    it('throws NotFoundException if consultation does not exist in clinic', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDraft(mockClinicId, mockConsultationId, mockDoctorUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if caller is not the assigned clinician', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockDraftConsultation,
        clinicianId: 'different-doctor-id',
        prescriptions: [],
      });

      await expect(
        service.deleteDraft(mockClinicId, mockConsultationId, mockDoctorUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if consultation is not in DRAFT status (e.g. FINALIZED)', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockFinalizedConsultation,
        prescriptions: [],
      });

      await expect(
        service.deleteDraft(mockClinicId, mockConsultationId, mockDoctorUserId),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if consultation has linked prescriptions', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockDraftConsultation,
        prescriptions: [{ id: 'prescription-uuid-1' }],
      });

      await expect(
        service.deleteDraft(mockClinicId, mockConsultationId, mockDoctorUserId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('void', () => {
    const validVoidDto = {
      reason: 'Patient consultation recorded under wrong clinic visit record',
    };

    it('successfully voids a finalized consultation and records audit event', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockFinalizedConsultation,
        patient: mockPatient,
      });
      const voidedConsultation = {
        ...mockFinalizedConsultation,
        status: ConsultationStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: validVoidDto.reason,
        patient: mockPatient,
      };
      mockPrismaService.consultation.update.mockResolvedValue(voidedConsultation);
      mockPrismaService.clinicalAuditEvent.create.mockResolvedValue({});

      const result = await service.void(
        mockClinicId,
        mockConsultationId,
        mockDoctorUserId,
        validVoidDto,
      );

      expect(result.status).toBe(ConsultationStatus.VOIDED);
      expect(result.voidReason).toBe(validVoidDto.reason);
      expect(mockPrismaService.consultation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_clinicId: { id: mockConsultationId, clinicId: mockClinicId } },
          data: expect.objectContaining({
            status: ConsultationStatus.VOIDED,
            voidReason: validVoidDto.reason,
          }),
        }),
      );
      expect(mockPrismaService.clinicalAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId: mockClinicId,
            userId: mockDoctorUserId,
            action: 'CONSULTATION_VOIDED',
            entityType: 'Consultation',
            entityId: mockConsultationId,
          }),
        }),
      );
    });

    it('throws NotFoundException if consultation does not exist', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue(null);

      await expect(
        service.void(
          mockClinicId,
          mockConsultationId,
          mockDoctorUserId,
          validVoidDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if caller is not the assigned clinician', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockFinalizedConsultation,
        clinicianId: 'different-doctor-id',
      });

      await expect(
        service.void(
          mockClinicId,
          mockConsultationId,
          mockDoctorUserId,
          validVoidDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if consultation is already VOIDED', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue({
        ...mockFinalizedConsultation,
        status: ConsultationStatus.VOIDED,
      });

      await expect(
        service.void(
          mockClinicId,
          mockConsultationId,
          mockDoctorUserId,
          validVoidDto,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if consultation is in DRAFT status', async () => {
      mockPrismaService.clinicMembership.findUnique.mockResolvedValue(
        mockDoctorMembership,
      );
      mockPrismaService.consultation.findFirst.mockResolvedValue(
        mockDraftConsultation,
      );

      await expect(
        service.void(
          mockClinicId,
          mockConsultationId,
          mockDoctorUserId,
          validVoidDto,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
