import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { QueueStatus } from '@prisma/client';

export class ListQueueQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'serviceDate must be in YYYY-MM-DD calendar date format',
  })
  @IsNotEmpty({ message: 'serviceDate is required' })
  serviceDate: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'doctorId must be a valid UUID' })
  doctorId?: string;

  @IsOptional()
  @IsEnum(QueueStatus, {
    message: `status must be a valid QueueStatus (${Object.values(QueueStatus).join(', ')})`,
  })
  status?: QueueStatus;
}
