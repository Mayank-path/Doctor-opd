import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return service status string', () => {
      expect(appController.getHello()).toBe('Doctor OPD API is running');
    });
  });

  describe('health', () => {
    it('should return health status with status, timestamp, and uptime', () => {
      const result = appController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
    });
  });
});
