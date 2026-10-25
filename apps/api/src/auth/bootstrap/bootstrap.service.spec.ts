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
      create: jest.Mock;
    };
    clinic: {
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
        create: jest.fn(() => {
          executionOrder.push('user.create');
          return Promise.resolve({});
        }),
      },
      clinic: {
        create: jest.fn(() => {
          executionOrder.push('clinic.create');
          return Promise.resolve({});
        }),
      },
      clinicMembership: {
        create: jest.fn(() => {
          executionOrder.push('clinicMembership.create');
          return Promise.resolve({});
        }),
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
});
