import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL via Prisma');
    } catch (error) {
      this.logger.warn(
        `Database connection deferred or unavailable: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async checkHealth(): Promise<{ isHealthy: boolean; error?: string }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return { isHealthy: true };
    } catch (error) {
      return { isHealthy: false, error: (error as Error).message };
    }
  }
}
