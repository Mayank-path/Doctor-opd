import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Gender, Patient } from '@prisma/client';
import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPatientData {
  clinicId: string;
  uhid: string;
  fullName: string;
  gender: Gender;
  dateOfBirth?: Date | null;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  isActive: boolean;
}

describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: {
    $transaction: jest.Mock;
    patient: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const clinicId = 'clinic-alpha-123';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(
        (
          cb: (tx: {
            $queryRaw: jest.Mock;
            patient: { create: jest.Mock };
          }) => unknown,
        ) => {
          const tx = {
            $queryRaw: jest.fn().mockResolvedValue([{ lastUhid: 1 }]),
            patient: {
              create: jest
                .fn()
                .mockImplementation(({ data }: { data: MockPatientData }) =>
                  Promise.resolve({
                    id: 'patient-uuid-1',
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  } as Patient),
                ),
            },
          };
          return cb(tx);
        },
      ),
      patient: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  describe('create (Atomic UHID Allocation & Registration)', () => {
    const validDto = {
      fullName: 'Aarav Sharma',
      gender: Gender.MALE,
      dateOfBirth: '1990-05-15',
      phone: '+919876543210',
      alternatePhone: '+919876543211',
      email: 'aarav.sharma@example.com',
      address: '123 Health Ave',
      city: 'Mumbai',
      pincode: '400001',
    };

    it('should allocate first counter as UHID-000001 and create patient in a single transaction', async () => {
      let executedRawSql = false;
      let createdPatientData: MockPatientData | null = null;

      prisma.$transaction.mockImplementation(
        (
          cb: (tx: {
            $queryRaw: jest.Mock;
            patient: { create: jest.Mock };
          }) => unknown,
        ) => {
          const tx = {
            $queryRaw: jest.fn().mockImplementation(() => {
              executedRawSql = true;
              return Promise.resolve([{ lastUhid: 1 }]);
            }),
            patient: {
              create: jest
                .fn()
                .mockImplementation(({ data }: { data: MockPatientData }) => {
                  createdPatientData = data;
                  return Promise.resolve({
                    id: 'patient-uuid-1',
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  } as Patient);
                }),
            },
          };
          return cb(tx);
        },
      );

      const result = await service.create(clinicId, validDto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(executedRawSql).toBe(true);
      expect(result.uhid).toBe('UHID-000001');
      expect(createdPatientData).toBeDefined();
      expect(createdPatientData!.clinicId).toBe(clinicId);
      expect(createdPatientData!.uhid).toBe('UHID-000001');
      expect(createdPatientData!.fullName).toBe('Aarav Sharma');
      expect(createdPatientData!.gender).toBe(Gender.MALE);
      expect(createdPatientData!.dateOfBirth).toEqual(
        new Date('1990-05-15T00:00:00.000Z'),
      );
    });

    it('should format multi-digit counter sequences with zero-padding correctly (e.g. UHID-000042)', async () => {
      prisma.$transaction.mockImplementation(
        (
          cb: (tx: {
            $queryRaw: jest.Mock;
            patient: { create: jest.Mock };
          }) => unknown,
        ) => {
          const tx = {
            $queryRaw: jest.fn().mockResolvedValue([{ lastUhid: 42 }]),
            patient: {
              create: jest
                .fn()
                .mockImplementation(({ data }: { data: MockPatientData }) =>
                  Promise.resolve({
                    id: 'patient-uuid-42',
                    ...data,
                  } as Patient),
                ),
            },
          };
          return cb(tx);
        },
      );

      const result = await service.create(clinicId, validDto);
      expect(result.uhid).toBe('UHID-000042');
    });

    it('should fail and propagate error if UHID counter query returns empty', async () => {
      prisma.$transaction.mockImplementation(
        (
          cb: (tx: {
            $queryRaw: jest.Mock;
            patient: { create: jest.Mock };
          }) => unknown,
        ) => {
          const tx = {
            $queryRaw: jest.fn().mockResolvedValue([]),
            patient: {
              create: jest.fn(),
            },
          };
          return cb(tx);
        },
      );

      await expect(service.create(clinicId, validDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should propagate errors and rollback when patient creation fails inside transaction', async () => {
      prisma.$transaction.mockImplementation(
        (
          cb: (tx: {
            $queryRaw: jest.Mock;
            patient: { create: jest.Mock };
          }) => unknown,
        ) => {
          const tx = {
            $queryRaw: jest.fn().mockResolvedValue([{ lastUhid: 2 }]),
            patient: {
              create: jest
                .fn()
                .mockRejectedValue(new Error('Database constraint violation')),
            },
          };
          return cb(tx);
        },
      );

      await expect(service.create(clinicId, validDto)).rejects.toThrow(
        'Database constraint violation',
      );
    });
  });

  describe('findAll (Search & Pagination)', () => {
    it('should query strictly within active clinic and filter out soft-deleted records', async () => {
      prisma.patient.count.mockResolvedValue(1);
      prisma.patient.findMany.mockResolvedValue([
        {
          id: 'p-1',
          clinicId,
          uhid: 'UHID-000001',
          fullName: 'Test Patient',
          deletedAt: null,
        },
      ]);

      const result = await service.findAll(clinicId, { page: 1, limit: 20 });

      expect(prisma.patient.count).toHaveBeenCalledWith({
        where: { clinicId, deletedAt: null },
      });
      expect(prisma.patient.findMany).toHaveBeenCalledWith({
        where: { clinicId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply case-insensitive name or phone search when q is >= 2 characters', async () => {
      prisma.patient.count.mockResolvedValue(1);
      prisma.patient.findMany.mockResolvedValue([]);

      await service.findAll(clinicId, { q: 'Sharma', page: 2, limit: 10 });

      const expectedWhere = {
        clinicId,
        deletedAt: null,
        OR: [
          { fullName: { contains: 'Sharma', mode: 'insensitive' } },
          { phone: { contains: 'Sharma' } },
        ],
      };

      expect(prisma.patient.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(prisma.patient.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      });
    });
  });

  describe('findOne (Detail)', () => {
    it('should return patient when found in active clinic and not deleted', async () => {
      const mockPatient = {
        id: 'patient-1',
        clinicId,
        uhid: 'UHID-000001',
        fullName: 'Active Patient',
        deletedAt: null,
      };
      prisma.patient.findFirst.mockResolvedValue(mockPatient);

      const result = await service.findOne(clinicId, 'patient-1');
      expect(result).toEqual(mockPatient);
      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: 'patient-1', clinicId, deletedAt: null },
      });
    });

    it('should throw NotFoundException if patient does not exist or belongs to another clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('different-clinic', 'patient-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (Demographic updates)', () => {
    it('should throw BadRequestException if update DTO is empty', async () => {
      await expect(service.update(clinicId, 'patient-1', {})).rejects.toThrow(
        new BadRequestException(
          'At least one field must be provided for update',
        ),
      );
    });

    it('should throw NotFoundException if patient does not exist in active clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.update(clinicId, 'patient-1', { fullName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update provided fields and allow clearing nullable fields with null', async () => {
      prisma.patient.findFirst.mockResolvedValue({
        id: 'patient-1',
        clinicId,
        deletedAt: null,
      });
      prisma.patient.update.mockResolvedValue({
        id: 'patient-1',
        clinicId,
        address: null,
        city: 'Pune',
      });

      const result = await service.update(clinicId, 'patient-1', {
        address: null,
        city: 'Pune',
      });

      expect(prisma.patient.update).toHaveBeenCalledWith({
        where: { id: 'patient-1' },
        data: {
          address: null,
          city: 'Pune',
        },
      });
      expect(result.city).toBe('Pune');
    });
  });
});
