import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../src/auth/guards/clinic-auth.guard';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import { ActiveClinic } from '../src/auth/decorators/active-clinic.decorator';
import { RequireRoles } from '../src/auth/decorators/require-roles.decorator';
import {
  ActiveClinicContext,
  AuthenticatedUser,
} from '../src/auth/interfaces/auth.interfaces';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Test-only controller declared exclusively within this E2E test file.
 * NEVER exposed in AppModule or production artifacts.
 */
@Controller('test-auth')
class TestAuthController {
  @Get('jwt-protected')
  @UseGuards(JwtAuthGuard)
  getJwtProtected(@CurrentUser() user: AuthenticatedUser) {
    return {
      status: 'authenticated',
      userId: user.id,
      fullName: user.fullName,
    };
  }

  @Get('clinic/:clinicId')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard)
  @RequireRoles(ClinicRole.DOCTOR)
  getClinicDoctorRoute(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveClinic() clinic: ActiveClinicContext,
  ) {
    return {
      status: 'authorized',
      userId: user.id,
      clinicId: clinic.clinicId,
      role: clinic.role,
    };
  }

  @Get('clinic-general/:clinicId')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard)
  getClinicGeneralRoute(@ActiveClinic() clinic: ActiveClinicContext) {
    return {
      status: 'authorized',
      clinicId: clinic.clinicId,
      role: clinic.role,
    };
  }
}

describe('Auth HTTP Pipeline (E2E)', () => {
  let app: INestApplication<App>;
  let authService: AuthService;

  const mockUsers = new Map<string, AuthenticatedUser>([
    [
      'user-doctor-1',
      {
        id: 'user-doctor-1',
        phone: '9876543210',
        email: 'doc@example.com',
        fullName: 'Dr. Doctor',
        isActive: true,
      },
    ],
    [
      'user-staff-1',
      {
        id: 'user-staff-1',
        phone: '9876543211',
        email: 'staff@example.com',
        fullName: 'Staff Member',
        isActive: true,
      },
    ],
    [
      'user-nonmember-1',
      {
        id: 'user-nonmember-1',
        phone: '9876543212',
        email: 'outsider@example.com',
        fullName: 'Outsider',
        isActive: true,
      },
    ],
    [
      'user-suspended-1',
      {
        id: 'user-suspended-1',
        phone: '9876543213',
        email: 'suspended@example.com',
        fullName: 'Suspended Doctor',
        isActive: true,
      },
    ],
  ]);

  const mockMemberships = new Map<
    string,
    {
      id: string;
      userId: string;
      clinicId: string;
      role: ClinicRole;
      status: MembershipStatus;
    }
  >([
    [
      'user-doctor-1:clinic-100',
      {
        id: 'membership-1',
        userId: 'user-doctor-1',
        clinicId: 'clinic-100',
        role: ClinicRole.DOCTOR,
        status: MembershipStatus.ACTIVE,
      },
    ],
    [
      'user-staff-1:clinic-100',
      {
        id: 'membership-2',
        userId: 'user-staff-1',
        clinicId: 'clinic-100',
        role: ClinicRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    ],
    [
      'user-suspended-1:clinic-100',
      {
        id: 'membership-3',
        userId: 'user-suspended-1',
        clinicId: 'clinic-100',
        role: ClinicRole.DOCTOR,
        status: MembershipStatus.SUSPENDED,
      },
    ],
  ]);

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret-at-least-32-characters-long';
    process.env.JWT_ISSUER = 'doctor-opd-api';
    process.env.JWT_AUDIENCE = 'doctor-opd-client';
    process.env.JWT_EXPIRES_IN = '1h';

    const mockPrismaService = {
      user: {
        findUnique: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(mockUsers.get(args.where.id) ?? null),
        ),
      },
      clinicMembership: {
        findUnique: jest.fn(
          (args: {
            where: { userId_clinicId: { userId: string; clinicId: string } };
          }) => {
            const key = `${args.where.userId_clinicId.userId}:${args.where.userId_clinicId.clinicId}`;
            return Promise.resolve(mockMemberships.get(key) ?? null);
          },
        ),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [TestAuthController],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('JwtAuthGuard HTTP Pipeline', () => {
    it('should reject requests with missing bearer token (401)', async () => {
      await request(app.getHttpServer())
        .get('/test-auth/jwt-protected')
        .expect(401)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toBe('Missing authorization bearer token');
        });
    });

    it('should reject requests with malformed bearer token (401)', async () => {
      await request(app.getHttpServer())
        .get('/test-auth/jwt-protected')
        .set('Authorization', 'InvalidScheme xyz')
        .expect(401)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toBe('Malformed authorization bearer token');
        });
    });

    it('should reject requests with invalid or signed-by-untrusted-key token (401)', async () => {
      await request(app.getHttpServer())
        .get('/test-auth/jwt-protected')
        .set('Authorization', 'Bearer invalid.untrusted.token')
        .expect(401)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toBe(
            'Invalid or expired authentication token',
          );
        });
    });

    it('should accept valid HS256 bearer token and attach verified user (200)', async () => {
      const token = await authService.signToken('user-doctor-1', '9876543210');

      await request(app.getHttpServer())
        .get('/test-auth/jwt-protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({
          status: 'authenticated',
          userId: 'user-doctor-1',
          fullName: 'Dr. Doctor',
        });
    });

    it('should ensure client-supplied identity headers cannot override verified token subject (200)', async () => {
      const token = await authService.signToken('user-doctor-1', '9876543210');

      await request(app.getHttpServer())
        .get('/test-auth/jwt-protected')
        .set('Authorization', `Bearer ${token}`)
        .set('x-user-id', 'spoofed-attacker-id')
        .set('x-authenticated-user', 'fake-admin')
        .expect(200)
        .expect({
          status: 'authenticated',
          userId: 'user-doctor-1',
          fullName: 'Dr. Doctor',
        });
    });
  });

  describe('ClinicAuthGuard HTTP Pipeline', () => {
    it('should reject clinic route when no bearer token is supplied (401)', async () => {
      await request(app.getHttpServer())
        .get('/test-auth/clinic/clinic-100')
        .expect(401);
    });

    it('should reject when authenticated user is not a member of the requested clinic (403)', async () => {
      const token = await authService.signToken(
        'user-nonmember-1',
        '9876543212',
      );

      await request(app.getHttpServer())
        .get('/test-auth/clinic/clinic-100')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toContain(
            'user is not a member of the requested clinic',
          );
        });
    });

    it('should reject when user membership is SUSPENDED (403)', async () => {
      const token = await authService.signToken(
        'user-suspended-1',
        '9876543213',
      );

      await request(app.getHttpServer())
        .get('/test-auth/clinic/clinic-100')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toContain('membership status is SUSPENDED');
        });
    });

    it('should reject when user role is not authorized by @RequireRoles (403)', async () => {
      const token = await authService.signToken('user-staff-1', '9876543211');

      // Route requires DOCTOR, user is STAFF
      await request(app.getHttpServer())
        .get('/test-auth/clinic/clinic-100')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toContain(
            'role STAFF is not authorized for this operation',
          );
        });
    });

    it('should authorize active member matching required role (200)', async () => {
      const token = await authService.signToken('user-doctor-1', '9876543210');

      await request(app.getHttpServer())
        .get('/test-auth/clinic/clinic-100')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({
          status: 'authorized',
          userId: 'user-doctor-1',
          clinicId: 'clinic-100',
          role: 'DOCTOR',
        });
    });

    it('should allow active member of any role on general clinic route without @RequireRoles (200)', async () => {
      const staffToken = await authService.signToken(
        'user-staff-1',
        '9876543211',
      );

      await request(app.getHttpServer())
        .get('/test-auth/clinic-general/clinic-100')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200)
        .expect({
          status: 'authorized',
          clinicId: 'clinic-100',
          role: 'STAFF',
        });
    });
  });
});
