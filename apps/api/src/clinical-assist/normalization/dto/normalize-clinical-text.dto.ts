import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class NormalizeClinicalTextDto {
  @IsString({ message: 'text must be a string' })
  @IsNotEmpty({ message: 'text is required and cannot be empty' })
  @MaxLength(5000, { message: 'text cannot exceed 5000 characters' })
  @Transform(({ value }: { value: unknown }): string =>
    typeof value === 'string' ? value.trim() : '',
  )
  text: string;
}
