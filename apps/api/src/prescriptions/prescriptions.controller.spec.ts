import { Reflector } from '@nestjs/core';
import { ClinicRole, PrescriptionStatus } from '@prisma/client';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { ROLES_KEY } from '../auth/decorators/require-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { ApprovePrescriptionDto } from './dto/approve-prescription.dto';
import { AmendPrescriptionDto } from './dto/amend-prescription.dto';

describe('PrescriptionsController', () => {
  let controller: PrescriptionsController;
  let service: {
    createDraft: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    updateDraft: jest.Mock;
    approve: jest.Mock;
    amend: jest.Mock;
    generatePdf: jest.Mock;
  };
  let reflector: Reflector;

  const mockClinicId = 'clinic-alpha-456';
  const mockDoctorUserId = 'doctor-user-123';
  const mockPrescriptionId = 'prescription-uuid-789';

  beforeEach(() => {
    service = {
      createDraft: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      updateDraft: jest.fn(),
      approve: jest.fn(),
      amend: jest.fn(),
      generatePdf: jest.fn(),
    };
    reflector = new Reflector();
    controller = new PrescriptionsController(
      service as unknown as PrescriptionsService,
    );
  });

  describe('Guard Configuration', () => {
    it('should be protected by JwtAuthGuard and ClinicAuthGuard at class level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        PrescriptionsController,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(ClinicAuthGuard);
    });
  });

  describe('Role-Based Access Control Metadata', () => {
    it('create should restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.create;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('findAll should allow DOCTOR and ADMIN roles', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.findAll;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR, ClinicRole.ADMIN]);
    });

    it('findOne should allow DOCTOR and ADMIN roles', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.findOne;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR, ClinicRole.ADMIN]);
    });

    it('updateDraft should restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.updateDraft;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('approve should restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.approve;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('amend should restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.amend;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('getPdf should allow DOCTOR and ADMIN roles', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.getPdf;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR, ClinicRole.ADMIN]);
    });
  });

  describe('create Handler', () => {
    it('should delegate to service.createDraft with caller IP and user-agent', async () => {
      const dto: CreatePrescriptionDto = {
        patientId: 'patient-uuid-1',
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

      const mockResponse = {
        id: mockPrescriptionId,
        status: PrescriptionStatus.DRAFT,
      };
      service.createDraft.mockResolvedValue(mockResponse as any);

      const mockReq = {
        ip: '10.0.0.1',
        headers: { 'user-agent': 'Chrome-Mobile' },
      } as any;

      const result = await controller.create(
        mockClinicId,
        mockDoctorUserId,
        dto,
        mockReq,
      );

      expect(service.createDraft).toHaveBeenCalledWith(
        mockClinicId,
        mockDoctorUserId,
        dto,
        '10.0.0.1',
        'Chrome-Mobile',
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('updateDraft Handler', () => {
    it('should delegate to service.updateDraft with caller IP and user-agent', async () => {
      const dto: UpdatePrescriptionDto = {
        notes: 'Rest for 3 days',
      };

      const mockResponse = { id: mockPrescriptionId, notes: 'Rest for 3 days' };
      service.updateDraft.mockResolvedValue(mockResponse as any);

      const mockReq = {
        ip: '10.0.0.1',
        headers: { 'user-agent': 'Chrome-Mobile' },
      } as any;

      const result = await controller.updateDraft(
        mockClinicId,
        mockDoctorUserId,
        mockPrescriptionId,
        dto,
        mockReq,
      );

      expect(service.updateDraft).toHaveBeenCalledWith(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorUserId,
        dto,
        '10.0.0.1',
        'Chrome-Mobile',
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('approve Handler', () => {
    it('should delegate to service.approve with caller context', async () => {
      const dto: ApprovePrescriptionDto = {
        confirmApproval: true,
        doctorNotes: 'Approved during OPD round',
      };

      const mockResponse = {
        id: mockPrescriptionId,
        status: PrescriptionStatus.APPROVED,
      };
      service.approve.mockResolvedValue(mockResponse as any);

      const mockReq = {
        ip: '10.0.0.1',
        headers: { 'user-agent': 'Chrome-Mobile' },
      } as any;

      const result = await controller.approve(
        mockClinicId,
        mockDoctorUserId,
        mockPrescriptionId,
        dto,
        mockReq,
      );

      expect(service.approve).toHaveBeenCalledWith(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorUserId,
        dto,
        '10.0.0.1',
        'Chrome-Mobile',
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('amend Handler', () => {
    it('should delegate to service.amend with amendmentReason', async () => {
      const dto: AmendPrescriptionDto = {
        amendmentReason: 'Drug sensitivity reaction',
        items: [
          {
            medicationName: 'Cefixime',
            strength: '200 mg',
            frequency: '1-0-1',
            durationValue: 5,
            durationUnit: 'DAYS',
          },
        ],
      };

      const mockResponse = { id: 'prescription-v2', versionNumber: 2 };
      service.amend.mockResolvedValue(mockResponse as any);

      const mockReq = {
        ip: '10.0.0.1',
        headers: { 'user-agent': 'Chrome-Mobile' },
      } as any;

      const result = await controller.amend(
        mockClinicId,
        mockDoctorUserId,
        mockPrescriptionId,
        dto,
        mockReq,
      );

      expect(service.amend).toHaveBeenCalledWith(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorUserId,
        dto,
        '10.0.0.1',
        'Chrome-Mobile',
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('getPdf Handler', () => {
    it('should set PDF headers and stream buffer to client response', async () => {
      const mockBuffer = Buffer.from('%PDF-1.4 test');
      service.generatePdf.mockResolvedValue({
        buffer: mockBuffer,
        filename: 'Prescription-UHID-001-v1.pdf',
      });

      const mockReq = {
        ip: '10.0.0.1',
        headers: { 'user-agent': 'Chrome-Mobile' },
      } as any;

      const mockRes = {
        set: jest.fn(),
        end: jest.fn(),
      } as any;

      await controller.getPdf(
        mockClinicId,
        mockDoctorUserId,
        mockPrescriptionId,
        mockReq,
        mockRes,
      );

      expect(service.generatePdf).toHaveBeenCalledWith(
        mockClinicId,
        mockPrescriptionId,
        mockDoctorUserId,
        '10.0.0.1',
        'Chrome-Mobile',
      );
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'inline; filename="Prescription-UHID-001-v1.pdf"',
        'Content-Length': mockBuffer.length,
      });
      expect(mockRes.end).toHaveBeenCalledWith(mockBuffer);
    });
  });
});
