import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ConsultationStatus } from '@prisma/client';

export class ConsultationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(50, { message: 'limit cannot exceed 50' })
  limit: number = 20;

  @IsOptional()
  @IsEnum(ConsultationStatus, {
    message: `status must be a valid ConsultationStatus (${Object.values(ConsultationStatus).join(', ')})`,
  })
  status?: ConsultationStatus;

  @IsOptional()
  @IsUUID(undefined, { message: 'patientId must be a valid UUID' })
  patientId?: string;
}

export interface PaginatedConsultationResponse<T> {
  data: T[];
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
