import { Reflector } from '@nestjs/core';
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  ClinicRole,
} from '@prisma/client';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ROLES_KEY } from '../auth/decorators/require-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    reschedule: jest.Mock;
    cancel: jest.Mock;
  };
  let reflector: Reflector;

  const mockClinicId = 'clinic-alpha-123';
  const mockAppointmentId = 'appointment-uuid-456';

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      reschedule: jest.fn(),
      cancel: jest.fn(),
    };
    reflector = new Reflector();
    controller = new AppointmentsController(
      service as unknown as AppointmentsService,
    );
  });

  describe('Guard Configuration', () => {
    it('should be protected by JwtAuthGuard and ClinicAuthGuard at class level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        AppointmentsController,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(ClinicAuthGuard);
    });
  });

  describe('Role-Based Access Control Metadata', () => {
    const expectedRoles = [
      ClinicRole.ADMIN,
      ClinicRole.DOCTOR,
      ClinicRole.RECEPTIONIST,
    ];

    it('create should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, controller.create);
      expect(roles).toEqual(expectedRoles);
    });

    it('findAll should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, controller.findAll);
      expect(roles).toEqual(expectedRoles);
    });

    it('findOne should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, controller.findOne);
      expect(roles).toEqual(expectedRoles);
    });

    it('reschedule should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      const roles = reflector.get<ClinicRole[]>(
        ROLES_KEY,
        controller.reschedule,
      );
      expect(roles).toEqual(expectedRoles);
    });

    it('cancel should allow ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, controller.cancel);
      expect(roles).toEqual(expectedRoles);
    });
  });

  describe('Execution Delegation', () => {
    it('create delegates to service.create with clinicId and DTO', async () => {
      const dto: CreateAppointmentDto = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        serviceDate: '2026-10-30',
        startTime: '2026-10-30T10:00:00Z',
      };
      const mockResult = { id: mockAppointmentId } as Appointment;
      service.create.mockResolvedValue(mockResult);

      const result = await controller.create(mockClinicId, dto);
      expect(service.create).toHaveBeenCalledWith(mockClinicId, dto);
      expect(result).toBe(mockResult);
    });

    it('findAll delegates to service.findAll with clinicId and query', async () => {
      const query: ListAppointmentsQueryDto = {
        serviceDate: '2026-10-30',
        page: 1,
        limit: 20,
      };
      const mockResult = {
        data: [],
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockClinicId, query);
      expect(service.findAll).toHaveBeenCalledWith(mockClinicId, query);
      expect(result).toBe(mockResult);
    });

    it('findOne delegates to service.findOne with clinicId and id', async () => {
      const mockResult = { id: mockAppointmentId } as Appointment;
      service.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne(mockClinicId, mockAppointmentId);
      expect(service.findOne).toHaveBeenCalledWith(
        mockClinicId,
        mockAppointmentId,
      );
      expect(result).toBe(mockResult);
    });

    it('reschedule delegates to service.reschedule with clinicId, id, and DTO', async () => {
      const dto: RescheduleAppointmentDto = {
        serviceDate: '2026-11-01',
        startTime: '2026-11-01T11:00:00Z',
      };
      const mockResult = { id: 'replacement-id' } as Appointment;
      service.reschedule.mockResolvedValue(mockResult);

      const result = await controller.reschedule(
        mockClinicId,
        mockAppointmentId,
        dto,
      );
      expect(service.reschedule).toHaveBeenCalledWith(
        mockClinicId,
        mockAppointmentId,
        dto,
      );
      expect(result).toBe(mockResult);
    });

    it('cancel delegates to service.cancel with clinicId, id, and DTO', async () => {
      const dto: CancelAppointmentDto = {
        cancellationReason: 'Doctor unavailable',
      };
      const mockResult = {
        id: mockAppointmentId,
        status: AppointmentStatus.CANCELLED,
      } as Appointment;
      service.cancel.mockResolvedValue(mockResult);

      const result = await controller.cancel(
        mockClinicId,
        mockAppointmentId,
        dto,
      );
      expect(service.cancel).toHaveBeenCalledWith(
        mockClinicId,
        mockAppointmentId,
        dto,
      );
      expect(result).toBe(mockResult);
    });
  });
});
