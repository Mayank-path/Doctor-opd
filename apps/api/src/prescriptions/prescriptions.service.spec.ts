import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicRole,
  MembershipStatus,
  PrescriptionStatus,
} from '@prisma/client';
import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGeneratorService } from './services/pdf-generator.service';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prisma: {
    patient: { findFirst: jest.Mock };
    clinicMembership: { findUnique: jest.Mock };
    consultation: { findFirst: jest.Mock };
    prescription: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    prescriptionItem: {
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    clinicalAuditEvent: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let pdfGenerator: {
    generatePrescriptionPdf: jest.Mock;
  };

  const mockClinicId = 'clinic-1';
  const mockDoctorId = 'doc-user-1';
  const mockPatientId = 'patient-1';
  const mockPrescriptionId = 'rx-1';

  beforeEach(() => {
    prisma = {
      patient: { findFirst: jest.fn() },
      clinicMembership: { findUnique: jest.fn() },
      consultation: { findFirst: jest.fn() },
      prescription: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      prescriptionItem: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      clinicalAuditEvent: {
        create: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => Promise<any>) =>
          cb(prisma),
        ),
    };

    pdfGenerator = {
      generatePrescriptionPdf: jest.fn(),
    };

    service = new PrescriptionsService(
      prisma as unknown as PrismaService,
      pdfGenerator as unknown as PdfGeneratorService,
    );
  });

  describe('createDraft', () => {
    const validDto = {
      patientId: mockPatientId,
      notes: 'Take with warm water',
      items: [
        {
          medicationName: 'Amoxicillin',
          strength: '500 mg',
          frequency: '1-0-1',
          durationValue: 5,
          durationUnit: 'DAYS',
        },
      ],
    };

    it('should successfully create a draft prescription and audit event', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: mockPatientId,
        clinicId: mockClinicId,
      });
      prisma.clinicMembership.findUnique.mockResolvedValue({
        userId: mockDoctorId,
        clinicId: mockClinicId,
        status: MembershipStatus.ACTIVE,
        role: ClinicRole.DOCTOR,
      });

      const mockCreated = {
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        patientId: mockPatientId,
        doctorId: mockDoctorId,
        status: PrescriptionStatus.DRAFT,
        versionNumber: 1,
      };
      prisma.prescription.create.mockResolvedValue(mockCreated);
      prisma.clinicalAuditEvent.create.mockResolvedValue({ id: 'audit-1' });

      const result = await service.createDraft(
        mockClinicId,
        mockDoctorId,
        validDto,
      );

      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: mockPatientId, clinicId: mockClinicId, deletedAt: null },
      });
      expect(prisma.prescription.create).toHaveBeenCalled();
      expect(prisma.clinicalAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PRESCRIPTION_DRAFT_CREATED',
            entityId: mockPrescriptionId,
          }),
        }),
      );
      expect(result).toBe(mockCreated);
    });

    it('should throw NotFoundException if patient does not exist in clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createDraft(mockClinicId, mockDoctorId, validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not an active DOCTOR in clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: mockPatientId,
        clinicId: mockClinicId,
      });
      prisma.clinicMembership.findUnique.mockResolvedValue({
        userId: mockDoctorId,
        clinicId: mockClinicId,
        status: MembershipStatus.ACTIVE,
        role: ClinicRole.STAFF, // Non-doctor
      });

      await expect(
        service.createDraft(mockClinicId, mockDoctorId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if consultationId does not match patient/clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: mockPatientId,
        clinicId: mockClinicId,
      });
      prisma.clinicMembership.findUnique.mockResolvedValue({
        userId: mockDoctorId,
        clinicId: mockClinicId,
        status: MembershipStatus.ACTIVE,
        role: ClinicRole.DOCTOR,
      });
      prisma.consultation.findFirst.mockResolvedValue(null);

      await expect(
        service.createDraft(mockClinicId, mockDoctorId, {
          ...validDto,
          consultationId: 'unrelated-consult-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDraft', () => {
    it('should update notes and items on draft prescription', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        doctorId: mockDoctorId,
        status: PrescriptionStatus.DRAFT,
      });
      prisma.prescription.updateMany.mockResolvedValue({ count: 1 });
      prisma.prescriptionItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.prescriptionItem.createMany.mockResolvedValue({ count: 1 });
      prisma.prescription.findUniqueOrThrow.mockResolvedValue({
        id: mockPrescriptionId,
        status: PrescriptionStatus.DRAFT,
        notes: 'Updated notes',
      });

      const result = await service.updateDraft(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorId,
        {
          notes: 'Updated notes',
          items: [
            {
              medicationName: 'Azithromycin',
              strength: '500 mg',
              frequency: '1-0-0',
              durationValue: 3,
              durationUnit: 'DAYS',
            },
          ],
        },
      );

      expect(prisma.prescriptionItem.deleteMany).toHaveBeenCalled();
      expect(prisma.prescriptionItem.createMany).toHaveBeenCalled();
      expect(result.id).toBe(mockPrescriptionId);
    });

    it('should throw ForbiddenException if user is not prescribing doctor', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        doctorId: 'other-doctor-id',
        status: PrescriptionStatus.DRAFT,
      });

      await expect(
        service.updateDraft(mockClinicId, mockPrescriptionId, mockDoctorId, {
          notes: 'test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if prescription is already APPROVED', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        doctorId: mockDoctorId,
        status: PrescriptionStatus.APPROVED,
      });

      await expect(
        service.updateDraft(mockClinicId, mockPrescriptionId, mockDoctorId, {
          notes: 'test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    it('should approve prescription, set approvedAt timestamp, and log audit event', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        doctorId: mockDoctorId,
        status: PrescriptionStatus.DRAFT,
        versionNumber: 1,
        items: [{ id: 'item-1' }],
      });
      prisma.prescription.updateMany.mockResolvedValue({ count: 1 });
      prisma.prescription.findUniqueOrThrow.mockResolvedValue({
        id: mockPrescriptionId,
        status: PrescriptionStatus.APPROVED,
      });

      const result = await service.approve(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorId,
        {
          confirmApproval: true,
        },
      );

      expect(prisma.prescription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: mockPrescriptionId,
            clinicId: mockClinicId,
            doctorId: mockDoctorId,
            status: PrescriptionStatus.DRAFT,
          },
          data: expect.objectContaining({
            status: PrescriptionStatus.APPROVED,
          }),
        }),
      );
      expect(prisma.clinicalAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PRESCRIPTION_APPROVED',
            entityId: mockPrescriptionId,
          }),
        }),
      );
      expect(result.status).toBe(PrescriptionStatus.APPROVED);
    });

    it('should reject approval if confirmApproval is false', async () => {
      await expect(
        service.approve(mockClinicId, mockPrescriptionId, mockDoctorId, {
          confirmApproval: false as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject approval if prescription has no items', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        doctorId: mockDoctorId,
        status: PrescriptionStatus.DRAFT,
        items: [], // Zero items
      });

      await expect(
        service.approve(mockClinicId, mockPrescriptionId, mockDoctorId, {
          confirmApproval: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if already approved', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        doctorId: mockDoctorId,
        status: PrescriptionStatus.APPROVED,
        items: [{ id: 'item-1' }],
      });

      await expect(
        service.approve(mockClinicId, mockPrescriptionId, mockDoctorId, {
          confirmApproval: true,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('amend', () => {
    it('should transition old prescription to SUPERSEDED and create version 2 with audit log', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        patientId: mockPatientId,
        consultationId: 'consult-1',
        status: PrescriptionStatus.APPROVED,
        versionNumber: 1,
        notes: 'Original note',
      });
      prisma.prescription.update.mockResolvedValue({
        id: mockPrescriptionId,
        status: PrescriptionStatus.SUPERSEDED,
      });
      prisma.prescription.create.mockResolvedValue({
        id: 'rx-2',
        clinicId: mockClinicId,
        patientId: mockPatientId,
        versionNumber: 2,
        status: PrescriptionStatus.APPROVED,
        supersedesPrescriptionId: mockPrescriptionId,
      });

      const result = await service.amend(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorId,
        {
          amendmentReason: 'Patient vomited tablet; switching to syrup',
          items: [
            {
              medicationName: 'Amoxicillin Syrup',
              strength: '125 mg / 5 ml',
              frequency: '1-1-1',
              durationValue: 5,
              durationUnit: 'DAYS',
            },
          ],
        },
      );

      expect(prisma.prescription.update).toHaveBeenCalledWith({
        where: { id: mockPrescriptionId },
        data: { status: PrescriptionStatus.SUPERSEDED },
      });
      expect(prisma.prescription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 2,
            supersedesPrescriptionId: mockPrescriptionId,
            amendmentReason: 'Patient vomited tablet; switching to syrup',
          }),
        }),
      );
      expect(prisma.clinicalAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PRESCRIPTION_AMENDED',
            entityId: 'rx-2',
          }),
        }),
      );
      expect(result.versionNumber).toBe(2);
    });

    it('should reject amendment if original prescription is not APPROVED', async () => {
      prisma.prescription.findFirst.mockResolvedValue({
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        status: PrescriptionStatus.DRAFT, // Not yet approved
      });

      await expect(
        service.amend(mockClinicId, mockPrescriptionId, mockDoctorId, {
          amendmentReason: 'Reason',
          items: [
            {
              medicationName: 'Med',
              strength: '10mg',
              frequency: 'OD',
              durationValue: 3,
              durationUnit: 'DAYS',
            },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('generatePdf', () => {
    it('should generate PDF buffer and record PRESCRIPTION_PDF_VIEWED audit event', async () => {
      const mockRxRecord = {
        id: mockPrescriptionId,
        clinicId: mockClinicId,
        versionNumber: 1,
        status: PrescriptionStatus.APPROVED,
        patient: { uhid: 'UHID-2026-0001' },
      };
      prisma.prescription.findFirst.mockResolvedValue(mockRxRecord);
      const mockPdfBuffer = Buffer.from('%PDF-1.4 test buffer');
      pdfGenerator.generatePrescriptionPdf.mockResolvedValue(mockPdfBuffer);

      const result = await service.generatePdf(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorId,
      );

      expect(pdfGenerator.generatePrescriptionPdf).toHaveBeenCalledWith(
        mockRxRecord,
      );
      expect(prisma.clinicalAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PRESCRIPTION_PDF_VIEWED',
            entityId: mockPrescriptionId,
          }),
        }),
      );
      expect(result.buffer).toBe(mockPdfBuffer);
      expect(result.filename).toBe('Prescription-UHID-2026-0001-v1.pdf');
    });

    it('should throw NotFoundException if prescription does not exist in clinic', async () => {
      prisma.prescription.findFirst.mockResolvedValue(null);

      await expect(
        service.generatePdf(mockClinicId, mockPrescriptionId, mockDoctorId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
