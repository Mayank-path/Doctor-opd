import { IsNotEmpty, IsString } from 'class-validator';

export class RevokePublicKeyDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

