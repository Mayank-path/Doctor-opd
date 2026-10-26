import { Reflector } from '@nestjs/core';
import { ClinicRole, Gender, Patient } from '@prisma/client';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { ROLES_KEY } from '../auth/decorators/require-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

describe('PatientsController', () => {
  let controller: PatientsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let consultationsService: {
    findPatientHistory: jest.Mock;
  };
  let reflector: Reflector;

  const mockClinicId = 'clinic-alpha-456';

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    consultationsService = {
      findPatientHistory: jest.fn(),
    };
    reflector = new Reflector();
    controller = new PatientsController(
      service as unknown as PatientsService,
      consultationsService as unknown as any,
    );
  });

  describe('Guard Configuration', () => {
    it('should be protected by JwtAuthGuard and ClinicAuthGuard at class level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        PatientsController,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(ClinicAuthGuard);
    });
  });

  describe('Role-Based Access Control Metadata', () => {
    it('create should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.create;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([
        ClinicRole.ADMIN,
        ClinicRole.DOCTOR,
        ClinicRole.RECEPTIONIST,
      ]);
    });

    it('findAll should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.findAll;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([
        ClinicRole.ADMIN,
        ClinicRole.DOCTOR,
        ClinicRole.RECEPTIONIST,
      ]);
    });

    it('findOne should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.findOne;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([
        ClinicRole.ADMIN,
        ClinicRole.DOCTOR,
        ClinicRole.RECEPTIONIST,
      ]);
    });

    it('update should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.update;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([
        ClinicRole.ADMIN,
        ClinicRole.DOCTOR,
        ClinicRole.RECEPTIONIST,
      ]);
    });

    it('findConsultationHistory should strictly restrict access to DOCTOR role', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const targetHandler = controller.findConsultationHistory;
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, targetHandler);
      expect(roles).toEqual([ClinicRole.DOCTOR]);
    });
  });

  describe('Controller Execution Delegation', () => {
    it('create should pass active clinicId from guard context and DTO to service', async () => {
      const dto: CreatePatientDto = {
        fullName: 'Maya Patel',
        gender: Gender.FEMALE,
        phone: '+919123456789',
      };
      const mockPatient = {
        id: 'p-1',
        clinicId: mockClinicId,
        uhid: 'UHID-000001',
        ...dto,
      } as Patient;
      service.create.mockResolvedValue(mockPatient);

      const result = await controller.create(mockClinicId, dto);

      expect(service.create).toHaveBeenCalledWith(mockClinicId, dto);
      expect(result.id).toBe('p-1');
    });

    it('findAll should pass active clinicId and query parameters to service', async () => {
      const query = { q: 'Maya', page: 1, limit: 20 };
      service.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });

      await controller.findAll(mockClinicId, query);

      expect(service.findAll).toHaveBeenCalledWith(mockClinicId, query);
    });

    it('findOne should pass active clinicId and id to service', async () => {
      service.findOne.mockResolvedValue({ id: 'p-1' });

      await controller.findOne(
        mockClinicId,
        'e4b85c3e-2d93-4a11-b956-65c3b6f272a2',
      );

      expect(service.findOne).toHaveBeenCalledWith(
        mockClinicId,
        'e4b85c3e-2d93-4a11-b956-65c3b6f272a2',
      );
    });

    it('update should pass active clinicId, id, and update DTO to service', async () => {
      const dto: UpdatePatientDto = { city: 'Delhi' };
      service.update.mockResolvedValue({ id: 'p-1', city: 'Delhi' });

      await controller.update(
        mockClinicId,
        'e4b85c3e-2d93-4a11-b956-65c3b6f272a2',
        dto,
      );

      expect(service.update).toHaveBeenCalledWith(
        mockClinicId,
        'e4b85c3e-2d93-4a11-b956-65c3b6f272a2',
        dto,
      );
    });

    it('findConsultationHistory should pass active clinicId, patientId, and query to consultationsService', async () => {
      const patientId = 'e4b85c3e-2d93-4a11-b956-65c3b6f272a2';
      const query = { page: 1, limit: 10 };
      consultationsService.findPatientHistory.mockResolvedValue({
        data: [],
        items: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });

      await controller.findConsultationHistory(mockClinicId, patientId, query);

      expect(consultationsService.findPatientHistory).toHaveBeenCalledWith(
        mockClinicId,
        patientId,
        query,
      );
    });
  });
});
