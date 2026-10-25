import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AuthTestDto } from './auth-test.dto';

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
});
