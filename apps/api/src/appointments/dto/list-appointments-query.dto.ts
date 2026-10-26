import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus } from '@prisma/client';

export class ListAppointmentsQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'serviceDate must be in YYYY-MM-DD calendar date format',
  })
  @IsNotEmpty({ message: 'serviceDate is required' })
  serviceDate: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'doctorId must be a valid UUID' })
  doctorId?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus, {
    message: `status must be a valid AppointmentStatus (${Object.values(AppointmentStatus).join(', ')})`,
  })
  status?: AppointmentStatus;

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
}

export interface PaginatedAppointmentResponse<T> {
  data: T[];
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
