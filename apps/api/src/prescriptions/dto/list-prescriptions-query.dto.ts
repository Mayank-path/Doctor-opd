import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionStatus } from '@prisma/client';

export class ListPrescriptionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit?: number = 20;

  @IsOptional()
  @IsUUID('all', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'consultationId must be a valid UUID' })
  consultationId?: string;

  @IsOptional()
  @IsEnum(PrescriptionStatus, {
    message: `status must be one of: ${Object.values(PrescriptionStatus).join(', ')}`,
  })
  status?: PrescriptionStatus;
}

export interface PaginatedPrescriptionResponse<T> {
  data: T[];
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
