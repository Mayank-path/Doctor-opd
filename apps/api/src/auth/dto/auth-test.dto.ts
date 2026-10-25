import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AuthTestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
