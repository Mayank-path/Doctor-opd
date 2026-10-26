import { IsEnum, IsNotEmpty } from 'class-validator';
import { QueueStatus } from '@prisma/client';

export class UpdateQueueStatusDto {
  @IsEnum(QueueStatus, {
    message: `status must be a valid QueueStatus (${Object.values(QueueStatus).join(', ')})`,
  })
  @IsNotEmpty({ message: 'status is required' })
  status: QueueStatus;
}
