import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

@Injectable()
export class AppService {
  getHello(): string {
    return 'Doctor OPD API is running';
  }

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
