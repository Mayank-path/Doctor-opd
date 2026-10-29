import * as argon2 from 'argon2';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import {
  BootstrapService,
  BOOTSTRAP_ADVISORY_LOCK_KEY,
} from './bootstrap.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BootstrapService', () => {
  let service: BootstrapService;
  let executionOrder: string[];
  let prisma: {
    user: {
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    clinic: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    clinicMembership: {
      create: jest.Mock;
    };
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  const validInput = {
    email: 'admin@clinic.com',
    password: 'ValidPassword123!',
    fullName: 'Dr. System Administrator',
    phone: '+919876543210',
    clinicName: 'Apollo Care OPD',
  };

  beforeEach(() => {
    executionOrder = [];
    prisma = {
      user: {
        count: jest.fn(() => {
          executionOrder.push('user.count');
          return Promise.resolve(0);
        }),
        findUnique: jest.fn(() => {
          executionOrder.push('user.findUnique');
          return Promise.resolve(null);
        }),
        create: jest.fn(() => {
          executionOrder.push('user.create');
          return Promise.resolve({});
        }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      clinic: {
        findUnique: jest.fn(() => {
          executionOrder.push('clinic.findUnique');
          return Promise.resolve({
            id: 'clinic-1',
            name: 'Apollo Care OPD',
            isActive: true,
          });
        }),
        create: jest.fn(() => {
          executionOrder.push('clinic.create');
          return Promise.resolve({});
        }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      clinicMembership: {
        create: jest.fn(() => {
          executionOrder.push('clinicMembership.create');
          return Promise.resolve({});
        }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $executeRaw: jest.fn(() => {
        executionOrder.push('$executeRaw');
        return Promise.resolve(1);
      }),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => {
        executionOrder.push('$transaction.begin');
        const res = await callback(prisma);
        executionOrder.push('$transaction.commit');
        return res;
      }),
    };

    service = new BootstrapService(prisma as unknown as PrismaService);
  });

  describe('Preconditions & Input Validation', () => {
    it('should reject if email is invalid', async () => {
      await expect(
        service.bootstrapAdmin({ ...validInput, email: 'not-an-email' }),
      ).rejects.toThrow('Bootstrap failed: A valid email address is required.');
    });

    it('should reject if password is shorter than 8 characters', async () => {
      await expect(
        service.bootstrapAdmin({ ...validInput, password: 'short' }),
      ).rejects.toThrow(
        'Bootstrap failed: Password must be at least 8 characters long.',
      );
    });

    it('should reject if phone is missing', async () => {
      await expect(
        service.bootstrapAdmin({ ...validInput, phone: '   ' }),
      ).rejects.toThrow('Bootstrap failed: Phone number is required.');
    });

    it('should reject if fullName is missing', async () => {
      await expect(
        service.bootstrapAdmin({ ...validInput, fullName: '' }),
      ).rejects.toThrow('Bootstrap failed: Full name is required.');
    });

    it('should reject if clinicName is missing', async () => {
      await expect(
        service.bootstrapAdmin({ ...validInput, clinicName: '   ' }),
      ).rejects.toThrow('Bootstrap failed: Clinic name is required.');
    });
  });

  describe('Idempotency, Advisory Locking & Concurrency Control', () => {
    it('should refuse bootstrap if user accounts already exist in the database', async () => {
      prisma.user.count.mockResolvedValue(1);

      await expect(service.bootstrapAdmin(validInput)).rejects.toThrow(
        'Bootstrap refused: Database already contains user accounts. Initial bootstrap is strictly permitted only on a fresh database.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should acquire transaction-scoped advisory lock before rechecking user count', async () => {
      prisma.user.count.mockImplementation(() => {
        executionOrder.push('user.count');
        return Promise.resolve(0);
      });

      await service.bootstrapAdmin(validInput);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify that $executeRaw was called before the in-transaction user.count
      const lockIndex = executionOrder.indexOf('$executeRaw');
      const inTxCountIndex = executionOrder.indexOf('user.count', 1);

      expect(lockIndex).toBeGreaterThan(-1);
      expect(inTxCountIndex).toBeGreaterThan(lockIndex);

      // Verify lock key used
      expect(BOOTSTRAP_ADVISORY_LOCK_KEY).toBe(BigInt(428172901));
    });

    it('should abort if a competing bootstrap completed and created a user while lock was being acquired', async () => {
      // First count check (before transaction) returns 0.
      // Second count check (inside transaction, after acquiring lock) returns 1 because competing process committed.
      prisma.user.count
        .mockResolvedValueOnce(0) // Initial pre-transaction check
        .mockResolvedValueOnce(1); // In-transaction check under advisory lock

      await expect(service.bootstrapAdmin(validInput)).rejects.toThrow(
        'Bootstrap refused: Concurrent creation detected; database is not empty.',
      );

      // Verify user, clinic, and membership were NOT created
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.clinic.create).not.toHaveBeenCalled();
      expect(prisma.clinicMembership.create).not.toHaveBeenCalled();
    });
  });

  describe('Successful Provisioning & Security Invariants', () => {
    it('should hash password with Argon2id and create user, clinic, and ADMIN membership transactionally', async () => {
      prisma.user.count.mockResolvedValue(0);

      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'admin@clinic.com',
        phone: '+919876543210',
        fullName: 'Dr. System Administrator',
        passwordHash: 'dummy-hash',
        isActive: true,
      };

      const mockCreatedClinic = {
        id: 'new-clinic-id',
        name: 'Apollo Care OPD',
        isActive: true,
      };

      const mockCreatedMembership = {
        id: 'new-membership-id',
        userId: 'new-user-id',
        clinicId: 'new-clinic-id',
        role: ClinicRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      };

      prisma.user.create.mockResolvedValue(mockCreatedUser);
      prisma.clinic.create.mockResolvedValue(mockCreatedClinic);
      prisma.clinicMembership.create.mockResolvedValue(mockCreatedMembership);

      const result = await service.bootstrapAdmin(validInput);

      expect(result).toEqual({
        userId: 'new-user-id',
        clinicId: 'new-clinic-id',
        membershipId: 'new-membership-id',
        email: 'admin@clinic.com',
        role: ClinicRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });

      // Assert password was hashed with Argon2id and never stored in plaintext
      const userCreateCalls = prisma.user.create.mock.calls as Array<
        [{ data: { email: string; passwordHash: string } }]
      >;
      const storedHash = userCreateCalls[0][0].data.passwordHash;
      expect(storedHash).not.toBe(validInput.password);
      expect(storedHash.startsWith('$argon2id$')).toBe(true);

      const isHashValid = await argon2.verify(storedHash, validInput.password);
      expect(isHashValid).toBe(true);

      // Verify email was normalized to lowercase
      expect(userCreateCalls[0][0].data.email).toBe('admin@clinic.com');

      // Verify transaction was used
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('bootstrapDoctor', () => {
    const validDoctorInput = {
      email: 'dr.sharma@clinic.com',
      password: 'DoctorPassword123!',
      fullName: 'Dr. Ramesh Sharma',
      phone: '+919876500001',
      clinicId: 'clinic-1',
    };

    const mockActiveClinic = {
      id: 'clinic-1',
      name: 'Apollo Care OPD',
      isActive: true,
    };

    const mockCreatedDoctorUser = {
      id: 'doc-user-id',
      email: 'dr.sharma@clinic.com',
      phone: '+919876500001',
      fullName: 'Dr. Ramesh Sharma',
      passwordHash: 'dummy-doc-hash',
      isActive: true,
    };

    const mockCreatedDoctorMembership = {
      id: 'doc-membership-id',
      userId: 'doc-user-id',
      clinicId: 'clinic-1',
      role: ClinicRole.DOCTOR,
      status: MembershipStatus.ACTIVE,
    };

    it('should reject if doctor email is invalid', async () => {
      await expect(
        service.bootstrapDoctor({
          ...validDoctorInput,
          email: 'invalid-email',
        }),
      ).rejects.toThrow('Bootstrap failed: A valid email address is required.');
    });

    it('should reject if doctor password is shorter than 8 characters', async () => {
      await expect(
        service.bootstrapDoctor({
          ...validDoctorInput,
          password: 'short',
        }),
      ).rejects.toThrow(
        'Bootstrap failed: Password must be at least 8 characters long.',
      );
    });

    it('should reject if doctor phone is missing', async () => {
      await expect(
        service.bootstrapDoctor({
          ...validDoctorInput,
          phone: '',
        }),
      ).rejects.toThrow('Bootstrap failed: Phone number is required.');
    });

    it('should reject if doctor fullName is missing', async () => {
      await expect(
        service.bootstrapDoctor({
          ...validDoctorInput,
          fullName: '  ',
        }),
      ).rejects.toThrow('Bootstrap failed: Full name is required.');
    });

    it('should reject if clinicId is missing', async () => {
      await expect(
        service.bootstrapDoctor({
          ...validDoctorInput,
          clinicId: '  ',
        }),
      ).rejects.toThrow('Bootstrap failed: Target clinic ID is required.');
    });

    it('should reject if target clinic does not exist', async () => {
      prisma.clinic.findUnique.mockResolvedValue(null);

      await expect(
        service.bootstrapDoctor(validDoctorInput),
      ).rejects.toThrow(
        'Bootstrap failed: Target clinic with ID "clinic-1" not found.',
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.clinicMembership.create).not.toHaveBeenCalled();
    });

    it('should reject if target clinic is inactive', async () => {
      prisma.clinic.findUnique.mockResolvedValue({
        id: 'clinic-1',
        name: 'Suspended Clinic',
        isActive: false,
      });

      await expect(
        service.bootstrapDoctor(validDoctorInput),
      ).rejects.toThrow(
        'Bootstrap failed: Target clinic "Suspended Clinic" (clinic-1) is inactive.',
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.clinicMembership.create).not.toHaveBeenCalled();
    });

    it('should reject if a user with the same email already exists (abort safely)', async () => {
      prisma.clinic.findUnique.mockResolvedValue(mockActiveClinic);
      prisma.user.findUnique.mockImplementation(
        ({ where }: { where: { email?: string; phone?: string } }) => {
          if (where.email === 'dr.sharma@clinic.com') {
            return Promise.resolve({
              id: 'existing-admin-id',
              email: 'dr.sharma@clinic.com',
            });
          }
          return Promise.resolve(null);
        },
      );

      await expect(
        service.bootstrapDoctor(validDoctorInput),
      ).rejects.toThrow(
        'Bootstrap failed: A user with email "dr.sharma@clinic.com" already exists.',
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.clinicMembership.create).not.toHaveBeenCalled();
    });

    it('should reject if a user with the same phone already exists (abort safely)', async () => {
      prisma.clinic.findUnique.mockResolvedValue(mockActiveClinic);
      prisma.user.findUnique.mockImplementation(
        ({ where }: { where: { email?: string; phone?: string } }) => {
          if (where.phone === '+919876500001') {
            return Promise.resolve({
              id: 'existing-admin-id',
              phone: '+919876500001',
            });
          }
          return Promise.resolve(null);
        },
      );

      await expect(
        service.bootstrapDoctor(validDoctorInput),
      ).rejects.toThrow(
        'Bootstrap failed: A user with phone number "+919876500001" already exists.',
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.clinicMembership.create).not.toHaveBeenCalled();
    });

    it('should create doctor identity with DOCTOR role and ACTIVE status in single transaction', async () => {
      prisma.clinic.findUnique.mockResolvedValue(mockActiveClinic);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockCreatedDoctorUser);
      prisma.clinicMembership.create.mockResolvedValue(
        mockCreatedDoctorMembership,
      );

      const result = await service.bootstrapDoctor(validDoctorInput);

      expect(result).toEqual({
        userId: 'doc-user-id',
        clinicId: 'clinic-1',
        membershipId: 'doc-membership-id',
        email: 'dr.sharma@clinic.com',
        fullName: 'Dr. Ramesh Sharma',
        role: ClinicRole.DOCTOR,
        status: MembershipStatus.ACTIVE,
      });

      // Verify transaction was used
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify user was created with hashed password
      const userCreateCalls = prisma.user.create.mock.calls as Array<
        [{ data: { email: string; passwordHash: string; fullName: string } }]
      >;
      const createdData = userCreateCalls[0][0].data;
      expect(createdData.email).toBe('dr.sharma@clinic.com');
      expect(createdData.fullName).toBe('Dr. Ramesh Sharma');
      expect(createdData.passwordHash.startsWith('$argon2id$')).toBe(true);

      const isPasswordValid = await argon2.verify(
        createdData.passwordHash,
        validDoctorInput.password,
      );
      expect(isPasswordValid).toBe(true);

      // Verify DOCTOR membership was created for the existing clinic
      const membershipCreateCalls = prisma.clinicMembership.create.mock
        .calls as Array<
        [{ data: { userId: string; clinicId: string; role: ClinicRole; status: MembershipStatus } }]
      >;
      expect(membershipCreateCalls[0][0].data).toEqual({
        userId: 'doc-user-id',
        clinicId: 'clinic-1',
        role: ClinicRole.DOCTOR,
        status: MembershipStatus.ACTIVE,
      });

      // Preservation requirement: clinic.create should NOT be called (existing clinic is preserved)
      expect(prisma.clinic.create).not.toHaveBeenCalled();
    });

    it('should rollback transaction if membership creation fails', async () => {
      prisma.clinic.findUnique.mockResolvedValue(mockActiveClinic);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockCreatedDoctorUser);
      prisma.clinicMembership.create.mockRejectedValue(
        new Error('Database foreign key violation'),
      );

      await expect(
        service.bootstrapDoctor(validDoctorInput),
      ).rejects.toThrow('Database foreign key violation');

      // Verify transaction caught error
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should preserve existing ADMIN account and membership when provisioning doctor', async () => {
      prisma.clinic.findUnique.mockResolvedValue(mockActiveClinic);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockCreatedDoctorUser);
      prisma.clinicMembership.create.mockResolvedValue(
        mockCreatedDoctorMembership,
      );

      const result = await service.bootstrapDoctor(validDoctorInput);

      expect(result.role).toBe(ClinicRole.DOCTOR);
      expect(result.status).toBe(MembershipStatus.ACTIVE);

      // Verify no updates or deletes occurred on user, clinic, or clinicMembership
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.clinic.update).not.toHaveBeenCalled();
      expect(prisma.clinic.delete).not.toHaveBeenCalled();
      expect(prisma.clinic.create).not.toHaveBeenCalled();
      expect(prisma.clinicMembership.update).not.toHaveBeenCalled();
      expect(prisma.clinicMembership.delete).not.toHaveBeenCalled();
    });
  });
});
