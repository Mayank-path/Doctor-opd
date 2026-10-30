import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreatePrescriptionItemDto } from './create-prescription-item.dto';

export class CreatePrescriptionDto {
  @IsUUID('all', { message: 'patientId must be a valid UUID' })
  @IsNotEmpty({ message: 'patientId is required' })
  patientId!: string;

  @IsOptional()
  @IsUUID('all', { message: 'consultationId must be a valid UUID' })
  consultationId?: string;

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
