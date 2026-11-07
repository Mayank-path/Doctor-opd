import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum AnalyticsPeriod {
  TODAY = 'today',
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  LAST_90_DAYS = '90d',
  CUSTOM = 'custom',
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsPeriod, {
    message: 'period must be one of: today, 7d, 30d, 90d, custom',
  })
  period?: AnalyticsPeriod = AnalyticsPeriod.LAST_30_DAYS;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Kolkata';
}

