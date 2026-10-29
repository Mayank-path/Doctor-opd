import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreatePrescriptionItemDto } from './create-prescription-item.dto';

export class CreateConsultationPrescriptionDto {
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

