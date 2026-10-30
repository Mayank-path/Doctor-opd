import { Reflector } from '@nestjs/core';
import { ClinicRole, OpdQueueEntry, QueueStatus } from '@prisma/client';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { ROLES_KEY } from '../auth/decorators/require-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';
import { CheckInDto } from './dto/check-in.dto';
import { ListQueueQueryDto } from './dto/list-queue-query.dto';
import { UpdateQueueStatusDto } from './dto/update-queue-status.dto';

describe('QueueController', () => {
  let controller: QueueController;
  let service: {
    checkIn: jest.Mock;
    findAll: jest.Mock;
    updateStatus: jest.Mock;
  };
  let reflector: Reflector;

  const mockClinicId = 'clinic-alpha-123';
  const mockDoctorUserId = 'doctor-user-456';
  const mockQueueEntryId = 'queue-uuid-789';

  beforeEach(() => {
    service = {
      checkIn: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
    };
    reflector = new Reflector();
    controller = new QueueController(service as unknown as QueueService);
  });

  describe('Guard Configuration', () => {
    it('should be protected by JwtAuthGuard and ClinicAuthGuard at class level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        QueueController,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(ClinicAuthGuard);
    });
  });

  describe('Role-Based Access Control Metadata', () => {
    it('checkIn allows ADMIN, DOCTOR, and RECEPTIONIST', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, controller.checkIn);
      expect(roles).toEqual([
        ClinicRole.ADMIN,
        ClinicRole.DOCTOR,
        ClinicRole.RECEPTIONIST,
      ]);
    });

    it('findAll allows ADMIN, DOCTOR, RECEPTIONIST, and STAFF', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const roles = reflector.get<ClinicRole[]>(ROLES_KEY, controller.findAll);
      expect(roles).toEqual([
        ClinicRole.ADMIN,
        ClinicRole.DOCTOR,
        ClinicRole.RECEPTIONIST,
        ClinicRole.STAFF,
      ]);
    });

    it('updateStatus allows ADMIN, DOCTOR, and RECEPTIONIST at route level', () => {
      const roles = reflector.get<ClinicRole[]>(
        ROLES_KEY,
        controller.updateStatus,
      );
      expect(roles).toEqual([
        ClinicRole.ADMIN,
        ClinicRole.DOCTOR,
        ClinicRole.RECEPTIONIST,
      ]);
    });
  });

  describe('Execution Delegation', () => {
    it('checkIn delegates to service.checkIn with clinicId and DTO', async () => {
      const dto: CheckInDto = { appointmentId: 'appt-1' };
      const mockResult = { id: mockQueueEntryId } as OpdQueueEntry;
      service.checkIn.mockResolvedValue(mockResult);

      const result = await controller.checkIn(mockClinicId, dto);
      expect(service.checkIn).toHaveBeenCalledWith(mockClinicId, dto);
      expect(result).toBe(mockResult);
    });

    it('findAll delegates to service.findAll with clinicId and query', async () => {
      const query: ListQueueQueryDto = { serviceDate: '2026-10-30' };
      const mockResult = { data: [], items: [], total: 0 };
      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockClinicId, query);
      expect(service.findAll).toHaveBeenCalledWith(mockClinicId, query);
      expect(result).toBe(mockResult);
    });

    it('updateStatus delegates to service.updateStatus with context, roles, and DTO', async () => {
      const dto: UpdateQueueStatusDto = { status: QueueStatus.CALLED };
      const mockResult = {
        id: mockQueueEntryId,
        status: QueueStatus.CALLED,
      } as OpdQueueEntry;
      service.updateStatus.mockResolvedValue(mockResult);

      const result = await controller.updateStatus(
        mockClinicId,
        ClinicRole.DOCTOR,
        mockDoctorUserId,
        mockQueueEntryId,
        dto,
      );

      expect(service.updateStatus).toHaveBeenCalledWith(
        mockClinicId,
        mockQueueEntryId,
        mockDoctorUserId,
        ClinicRole.DOCTOR,
        dto,
      );
      expect(result).toBe(mockResult);
    });
  });
});
