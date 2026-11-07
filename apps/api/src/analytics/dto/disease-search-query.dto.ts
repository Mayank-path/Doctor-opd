import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DiseaseSearchPeriod {
  ALL = 'all',
  TODAY = 'today',
  LAST_7D = '7d',
  LAST_30D = '30d',
  LAST_90D = '90d',
  CUSTOM = 'custom',
}

export class DiseaseSearchQueryDto {
  @IsNotEmpty({ message: 'Search term "q" is required' })
  @IsString()
  @MinLength(1, { message: 'Search term must contain at least 1 character' })
  q: string;

  @IsOptional()
  @IsEnum(DiseaseSearchPeriod, {
    message: 'Period must be one of: all, today, 7d, 30d, 90d, custom',
  })
  period?: DiseaseSearchPeriod = DiseaseSearchPeriod.ALL;

  @IsOptional()
  @IsISO8601(
    { strict: false },
    { message: 'startDate must be a valid ISO 8601 date string' },
  )
  startDate?: string;

  @IsOptional()
  @IsISO8601(
    { strict: false },
    { message: 'endDate must be a valid ISO 8601 date string' },
  )
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be greater than or equal to 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be greater than or equal to 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit?: number = 20;

  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Kolkata';
}

