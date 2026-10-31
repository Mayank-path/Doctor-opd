import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AuthTestDto } from './auth-test.dto';
import { RegisterClinicDto } from './register-clinic.dto';

describe('Global ValidationPipe Behavior', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  it('should accept valid DTO input with whitelisted properties', async () => {
    const rawInput = {
      name: 'Valid Name',
      description: 'Optional description',
    };

    const result = (await pipe.transform(rawInput, {
      type: 'body',
      metatype: AuthTestDto,
    })) as AuthTestDto;

    expect(result).toBeInstanceOf(AuthTestDto);
    expect(result.name).toBe('Valid Name');
  });

  it('should reject when unknown properties are present (forbidNonWhitelisted)', async () => {
    const rawInputWithExtra = {
      name: 'Valid Name',
      unknownProperty: 'should-fail',
      anotherInjectedField: 12345,
    };

    await expect(
      pipe.transform(rawInputWithExtra, {
        type: 'body',
        metatype: AuthTestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject when required fields are missing', async () => {
    const invalidInput = {
      description: 'Only description',
    };

    await expect(
      pipe.transform(invalidInput, {
        type: 'body',
        metatype: AuthTestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  describe('RegisterClinicDto Validation', () => {
    const validRegistration = {
      fullName: 'Dr. Anita Desai',
      email: 'ANITA@careclinic.in',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      clinicName: 'Desai Care Clinic',
      clinicAddress: '123 MG Road',
      phone: '+919876543210',
    };

    it('should validate and normalize valid registration data', async () => {
      const result = (await pipe.transform(validRegistration, {
        type: 'body',
        metatype: RegisterClinicDto,
      })) as RegisterClinicDto;

      expect(result).toBeInstanceOf(RegisterClinicDto);
      expect(result.fullName).toBe('Dr. Anita Desai');
      expect(result.email).toBe('anita@careclinic.in'); // normalized to lowercase
      expect(result.password).toBe('SecurePassword123!');
      expect(result.clinicName).toBe('Desai Care Clinic');
    });

    it('should reject registration when email is invalid', async () => {
      const badEmail = { ...validRegistration, email: 'not-an-email' };
      await expect(
        pipe.transform(badEmail, {
          type: 'body',
          metatype: RegisterClinicDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject registration when password is shorter than 8 characters', async () => {
      const weakPassword = { ...validRegistration, password: 'short' };
      await expect(
        pipe.transform(weakPassword, {
          type: 'body',
          metatype: RegisterClinicDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject registration with injected client role or clinicId (forbidNonWhitelisted)', async () => {
      const injectedInput = {
        ...validRegistration,
        role: 'ADMIN',
        clinicId: 'illegal-clinic-id',
      };
      await expect(
        pipe.transform(injectedInput, {
          type: 'body',
          metatype: RegisterClinicDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
