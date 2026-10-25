import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { json } from 'express';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth Login Endpoint (E2E)', () => {
  let app: INestApplication<App>;
  let validPasswordHash: string;

  const validPassword = 'AdminSecurePassword123!';

  const mockDbUser = {
    id: 'user-admin-1',
    phone: '+919876543210',
    email: 'admin@clinic.com',
    fullName: 'Dr. System Administrator',
    isActive: true,
    passwordHash: '',
  };

  const mockInactiveUser = {
    id: 'user-inactive-1',
    phone: '+919876543211',
    email: 'inactive@clinic.com',
    fullName: 'Inactive Doctor',
    isActive: false,
    passwordHash: '',
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret-at-least-32-characters-long';
    process.env.JWT_ISSUER = 'doctor-opd-api';
    process.env.JWT_AUDIENCE = 'doctor-opd-client';
    process.env.JWT_EXPIRES_IN = '1h';

    validPasswordHash = await argon2.hash(validPassword, {
      type: argon2.argon2id,
    });
    mockDbUser.passwordHash = validPasswordHash;
    mockInactiveUser.passwordHash = validPasswordHash;
  });

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(
          (args: { where: { email?: string; id?: string } }) => {
            if (args.where.email === 'admin@clinic.com') {
              return Promise.resolve(mockDbUser);
            }
            if (args.where.email === 'inactive@clinic.com') {
              return Promise.resolve(mockInactiveUser);
            }
            return Promise.resolve(null);
          },
        ),
      },
      clinicMembership: {
        findUnique: jest.fn(() => Promise.resolve(null)),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(json({ limit: '64kb' }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login - Credential Verification', () => {
    it('should successfully authenticate and return token and user info', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@clinic.com',
          password: validPassword,
        })
        .expect(200);

      const body = response.body as {
        accessToken: string;
        tokenType: string;
        expiresIn: string;
        user: { id: string; email: string; fullName: string };
        password?: string;
        passwordHash?: string;
      };

      expect(typeof body.accessToken).toBe('string');
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBe('1h');
      expect(body.user).toEqual({
        id: 'user-admin-1',
        email: 'admin@clinic.com',
        fullName: 'Dr. System Administrator',
      });

      // Passwords or hashes must never be returned
      expect(body.password).toBeUndefined();
      expect(body.passwordHash).toBeUndefined();
      expect(
        (body.user as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
    });

    it('should reject incorrect password with generic 401 error', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@clinic.com',
          password: 'IncorrectPassword999!',
        })
        .expect(401)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toBe('Invalid email or password');
        });
    });

    it('should reject unknown email with identical generic 401 error', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@clinic.com',
          password: validPassword,
        })
        .expect(401)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toBe('Invalid email or password');
        });
    });

    it('should reject inactive account with identical generic 401 error', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@clinic.com',
          password: validPassword,
        })
        .expect(401)
        .expect((res: { body: { message?: string } }) => {
          expect(res.body.message).toBe('Invalid email or password');
        });
    });
  });

  describe('POST /api/v1/auth/login - DTO Validation', () => {
    it('should reject unexpected/unknown fields with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@clinic.com',
          password: validPassword,
          role: 'ADMIN', // Injected extra field
          isAdmin: true,
        })
        .expect(400)
        .expect((res: { body: { message?: string[] } }) => {
          expect(Array.isArray(res.body.message)).toBe(true);
          expect(
            res.body.message?.some((m) =>
              m.includes('property role should not exist'),
            ),
          ).toBe(true);
        });
    });

    it('should reject malformed email with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'not-an-email-format',
          password: validPassword,
        })
        .expect(400);
    });

    it('should reject empty password with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@clinic.com',
          password: '',
        })
        .expect(400);
    });

    it('should reject password length exceeding 128 characters without leaking password (400)', async () => {
      const longPassword = 'P'.repeat(129);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@clinic.com',
          password: longPassword,
        })
        .expect(400)
        .expect((res: { body: { message?: string[] } }) => {
          expect(Array.isArray(res.body.message)).toBe(true);
          expect(
            res.body.message?.some((m) =>
              m.includes('Password exceeds maximum permitted length'),
            ),
          ).toBe(true);
          // Verify raw password is not reflected in error response
          const responseString = JSON.stringify(res.body);
          expect(responseString.includes(longPassword)).toBe(false);
        });
    });

    it('should reject oversized request bodies exceeding 64kb with 413 Payload Too Large', async () => {
      const hugePadding = 'X'.repeat(70 * 1024); // 70 KB payload

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@clinic.com',
          password: 'ValidPassword123!',
          extraData: hugePadding,
        })
        .expect(413);
    });
  });

  describe('POST /api/v1/auth/login - Rate Limiting', () => {
    it('should throttle and return 429 Too Many Requests after exceeding threshold', async () => {
      // 5 requests allowed per minute; we already made 1 valid request in the first test.
      // Let's send requests until 429 is encountered.
      let hit429 = false;
      for (let i = 0; i < 7; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'admin@clinic.com',
            password: 'AnyPassword',
          });

        if (res.status === 429) {
          hit429 = true;
          break;
        }
      }

      expect(hit429).toBe(true);
    });
  });
});
