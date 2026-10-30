import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterPublicKeyDto {
  @IsNotEmpty()
  @IsString()
  publicKeyPem: string;

  @IsOptional()
  @IsDateString()
  customExpiresAt?: string;
}

