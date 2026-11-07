import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import * as argon2 from 'argon2';

describe('AuthService — Clinic Owner Registration (Phase 5D.1)', () => {
  let authService: AuthService;
  let prisma: PrismaService;

  const mockSecret = 'test-secret-at-least-32-characters-long-key';
  const mockIssuer = 'doctor-opd-api';
  const mockAudience = 'doctor-opd-client';

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    clinic: {
      create: jest.fn(),
    },
    clinicMembership: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeAll(() => {
    process.env.JWT_SECRET = mockSecret;
    process.env.JWT_ISSUER = mockIssuer;
    process.env.JWT_AUDIENCE = mockAudience;
    process.env.JWT_EXPIRES_IN = '1h';
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const validDto: RegisterClinicDto = {
    fullName: 'Dr. Anita Desai',
    email: 'anita.desai@careclinic.in',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    clinicName: 'Desai Care Clinic',
    clinicAddress: '42 MG Road, Bengaluru',
    phone: '+919876543210',
  };

  it('should successfully register a clinic owner in a single transaction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const createdUser = {
      id: 'user-owner-uuid-1',
      fullName: 'Dr. Anita Desai',
      email: 'anita.desai@careclinic.in',
      phone: '+919876543210',
    };

    const createdClinic = {
      id: 'clinic-uuid-1',
      name: 'Desai Care Clinic',
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(createdUser) },
        clinic: { create: jest.fn().mockResolvedValue(createdClinic) },
        clinicMembership: { create: jest.fn().mockResolvedValue({ id: 'mem-1' }) },
      };
      return callback(tx);
    });

    const response = await authService.registerClinic(validDto);

    expect(response).toBeDefined();
    expect(response.accessToken).toBeDefined();
    expect(response.tokenType).toBe('Bearer');
    expect(response.user.id).toBe('user-owner-uuid-1');
    expect(response.user.email).toBe('anita.desai@careclinic.in');
    expect(response.user.fullName).toBe('Dr. Anita Desai');
    expect(response.clinic).toEqual({
      id: 'clinic-uuid-1',
      name: 'Desai Care Clinic',
      role: ClinicRole.ADMIN,
    });
    expect(response.clinics).toEqual([
      {
        id: 'clinic-uuid-1',
        name: 'Desai Care Clinic',
        role: ClinicRole.ADMIN,
      },
    ]);
    // Ensure no password hash is returned
    expect((response as any).passwordHash).toBeUndefined();
    expect((response.user as any).passwordHash).toBeUndefined();

    // Verify transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should reject registration when password and confirmPassword do not match', async () => {
    const mismatchDto: RegisterClinicDto = {
      ...validDto,
      confirmPassword: 'DifferentPassword123!',
    };

    await expect(authService.registerClinic(mismatchDto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(authService.registerClinic(mismatchDto)).rejects.toThrow(
      'Passwords do not match',
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject registration when email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'existing-user-id',
      email: 'anita.desai@careclinic.in',
    });

    await expect(authService.registerClinic(validDto)).rejects.toThrow(
      new ConflictException('An account with this email already exists'),
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject registration when phone already exists', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email check passes
      .mockResolvedValueOnce({ id: 'existing-phone-user', phone: '+919876543210' }); // phone check fails

    await expect(authService.registerClinic(validDto)).rejects.toThrow(
      new ConflictException('An account with this phone number already exists'),
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should safely handle optional phone by generating a non-null unique phone placeholder', async () => {
    const dtoWithoutPhone: RegisterClinicDto = {
      fullName: 'Dr. Rahul Sharma',
      email: 'rahul.sharma@health.in',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      clinicName: 'Sharma Wellness',
    };

    mockPrisma.user.findUnique.mockResolvedValue(null);

    let capturedUserData: any;
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        user: {
          create: jest.fn().mockImplementation((args: any) => {
            capturedUserData = args.data;
            return {
              id: 'user-uuid-2',
              fullName: args.data.fullName,
              email: args.data.email,
              phone: args.data.phone,
            };
          }),
        },
        clinic: {
          create: jest.fn().mockResolvedValue({ id: 'clinic-2', name: 'Sharma Wellness' }),
        },
        clinicMembership: {
          create: jest.fn().mockResolvedValue({ id: 'mem-2' }),
        },
      };
      return callback(tx);
    });

    const response = await authService.registerClinic(dtoWithoutPhone);
    expect(response).toBeDefined();
    expect(capturedUserData.phone).toBeDefined();
    expect(capturedUserData.phone.startsWith('+reg-')).toBe(true);
  });

  it('should enforce ClinicRole.ADMIN regardless of any client tampering attempts', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    let capturedMembershipData: any;
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'user-tamper-id',
            fullName: 'Dr. Test',
            email: 'test@clinic.com',
            phone: '+919888877777',
          }),
        },
        clinic: {
          create: jest.fn().mockResolvedValue({
            id: 'clinic-tamper-id',
            name: 'Test Clinic',
          }),
        },
        clinicMembership: {
          create: jest.fn().mockImplementation((args: any) => {
            capturedMembershipData = args.data;
            return { id: 'mem-tamper' };
          }),
        },
      };
      return callback(tx);
    });

    // DTO with injected illegal properties
    const tamperedDto: any = {
      ...validDto,
      role: 'SUPERADMIN',
      clinicId: 'injected-clinic-id',
    };

    await authService.registerClinic(tamperedDto);

    // Membership MUST be ADMIN and link strictly to newly created clinic
    expect(capturedMembershipData.role).toBe(ClinicRole.ADMIN);
    expect(capturedMembershipData.status).toBe(MembershipStatus.ACTIVE);
    expect(capturedMembershipData.clinicId).toBe('clinic-tamper-id');
    expect(capturedMembershipData.userId).toBe('user-tamper-id');
  });

  it('should rollback transaction if clinic or membership creation fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'user-id-rollback',
            fullName: 'Dr. Fail',
            email: 'fail@clinic.com',
            phone: '+919000000000',
          }),
        },
        clinic: {
          create: jest.fn().mockRejectedValue(new Error('Simulated Database Error')),
        },
        clinicMembership: { create: jest.fn() },
      };
      return callback(tx);
    });

    await expect(authService.registerClinic(validDto)).rejects.toThrow(
      'Simulated Database Error',
    );
  });

  it('should hash passwords with Argon2id', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    let capturedPasswordHash = '';
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        user: {
          create: jest.fn().mockImplementation((args: any) => {
            capturedPasswordHash = args.data.passwordHash;
            return {
              id: 'user-hash-id',
              fullName: args.data.fullName,
              email: args.data.email,
              phone: args.data.phone,
            };
          }),
        },
        clinic: { create: jest.fn().mockResolvedValue({ id: 'c-1', name: 'C' }) },
        clinicMembership: { create: jest.fn().mockResolvedValue({ id: 'm-1' }) },
      };
      return callback(tx);
    });

    await authService.registerClinic(validDto);

    expect(capturedPasswordHash).toBeDefined();
    expect(capturedPasswordHash).not.toBe(validDto.password);
    // Verify it is a valid Argon2 hash
    const isValid = await argon2.verify(capturedPasswordHash, validDto.password);
    expect(isValid).toBe(true);
  });
});
