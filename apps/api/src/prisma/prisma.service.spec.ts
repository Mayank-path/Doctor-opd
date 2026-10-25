import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should provide a checkHealth method that safely returns health status', async () => {
    // If not connected to a live database, checkHealth should return isHealthy: false without throwing
    const result = await service.checkHealth();
    expect(result).toHaveProperty('isHealthy');
    expect(typeof result.isHealthy).toBe('boolean');
  });

  it('should handle lifecycle hooks gracefully', async () => {
    await expect(service.onModuleInit()).resolves.not.toThrow();
    await expect(service.onModuleDestroy()).resolves.not.toThrow();
  });
});
