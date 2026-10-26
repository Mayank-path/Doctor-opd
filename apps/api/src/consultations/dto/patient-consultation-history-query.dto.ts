import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ConsultationStatus } from '@prisma/client';

export class PatientConsultationHistoryQueryDto {
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
}
