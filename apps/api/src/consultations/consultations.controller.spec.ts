import { Reflector } from '@nestjs/core';
import { ClinicRole, Consultation, ConsultationStatus } from '@prisma/client';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';
import { ROLES_KEY } from '../auth/decorators/require-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';

describe('ConsultationsController', () => {
  let controller: ConsultationsController;
  let service: {
    createDraft: jest.Mock;
    updateDraft: jest.Mock;
    finalize: jest.Mock;
  };
  let reflector: Reflector;

  const mockClinicId = 'clinic-alpha-456';
  const mockDoctorUserId = 'doctor-user-123';
  const mockConsultationId = 'consultation-uuid-789';

  beforeEach(() => {
    service = {
      createDraft: jest.fn(),
      updateDraft: jest.fn(),
      finalize: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };
    reflector = new Reflector();
    controller = new ConsultationsController(
      service as unknown as ConsultationsService,
    );
  });

  describe('Guard Configuration', () => {
    it('should be protected by JwtAuthGuard and ClinicAuthGuard at class level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        ConsultationsController,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(ClinicAuthGuard);
    });
  });

  describe('Role-Based Access Control Metadata', () => {
    it('createDraft should strictly restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.createDraft;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('findAll should strictly restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.findAll;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('findOne should strictly restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.findOne;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('updateDraft should strictly restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.updateDraft;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });

    it('finalize should strictly restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.finalize;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });
  });

  describe('createDraft Handler', () => {
    it('should delegate to service.createDraft with clinicId, clinicianId, and DTO', async () => {
      const dto: CreateConsultationDto = {
        patientId: 'patient-uuid-1',
        chiefComplaint: 'Headache',
      };

      const mockResponse: Partial<Consultation> = {
        id: mockConsultationId,
        clinicId: mockClinicId,
        patientId: 'patient-uuid-1',
        clinicianId: mockDoctorUserId,
        status: ConsultationStatus.DRAFT,
        chiefComplaint: 'Headache',
      };

      service.createDraft.mockResolvedValue(mockResponse as Consultation);

      const result = await controller.createDraft(
        mockClinicId,
        mockDoctorUserId,
        dto,
      );

      expect(service.createDraft).toHaveBeenCalledWith(
        mockClinicId,
        mockDoctorUserId,
        dto,
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('updateDraft Handler', () => {
    it('should delegate to service.updateDraft with clinicId, consultationId, and DTO', async () => {
      const dto: UpdateConsultationDto = {
        chiefComplaint: 'Updated headache notes',
        bpSystolic: 125,
      };

      const mockResponse: Partial<Consultation> = {
        id: mockConsultationId,
        clinicId: mockClinicId,
        status: ConsultationStatus.DRAFT,
        chiefComplaint: 'Updated headache notes',
        bpSystolic: 125,
      };

      service.updateDraft.mockResolvedValue(mockResponse as Consultation);

      const result = await controller.updateDraft(
        mockClinicId,
        mockDoctorUserId,
        mockConsultationId,
        dto,
      );

      expect(service.updateDraft).toHaveBeenCalledWith(
        mockClinicId,
        mockConsultationId,
        mockDoctorUserId,
        dto,
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('finalize Handler', () => {
    it('should delegate to service.finalize with clinicId, consultationId, and clinicianId', async () => {
      const mockResponse: Partial<Consultation> = {
        id: mockConsultationId,
        clinicId: mockClinicId,
        status: ConsultationStatus.FINALIZED,
        finalizedAt: new Date(),
      };

      service.finalize.mockResolvedValue(mockResponse as Consultation);

      const result = await controller.finalize(
        mockClinicId,
        mockDoctorUserId,
        mockConsultationId,
      );

      expect(service.finalize).toHaveBeenCalledWith(
        mockClinicId,
        mockConsultationId,
        mockDoctorUserId,
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('findAll Handler', () => {
    it('should delegate to service.findAll with clinicId and query', async () => {
      const query = { page: 1, limit: 10 };
      const mockResponse = {
        data: [],
        items: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      };

      service.findAll.mockResolvedValue(mockResponse as any);

      const result = await controller.findAll(mockClinicId, query);

      expect(service.findAll).toHaveBeenCalledWith(mockClinicId, query);
      expect(result).toBe(mockResponse);
    });
  });

  describe('findOne Handler', () => {
    it('should delegate to service.findOne with clinicId and consultationId', async () => {
      const mockResponse: Partial<Consultation> = {
        id: mockConsultationId,
        clinicId: mockClinicId,
      };

      service.findOne.mockResolvedValue(mockResponse as Consultation);

      const result = await controller.findOne(mockClinicId, mockConsultationId);

      expect(service.findOne).toHaveBeenCalledWith(
        mockClinicId,
        mockConsultationId,
      );
      expect(result).toBe(mockResponse);
    });
  });
});
