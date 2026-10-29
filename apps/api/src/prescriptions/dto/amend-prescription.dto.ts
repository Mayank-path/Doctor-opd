import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreatePrescriptionItemDto } from './create-prescription-item.dto';

export class AmendPrescriptionDto {
  @IsString({ message: 'amendmentReason must be a string' })
  @IsNotEmpty({
    message: 'amendmentReason is required to amend an approved prescription',
  })
  @MinLength(5, {
    message:
      'amendmentReason must provide clear clinical justification (at least 5 characters)',
  })
  @MaxLength(1000, {
    message: 'amendmentReason exceeds maximum length of 1000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  amendmentReason!: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(2000, {
    message: 'notes exceeds maximum length of 2000 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @IsArray({ message: 'items must be an array of prescription items' })
  @ArrayMinSize(1, { message: 'At least one medication item is required' })
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items!: CreatePrescriptionItemDto[];
}
