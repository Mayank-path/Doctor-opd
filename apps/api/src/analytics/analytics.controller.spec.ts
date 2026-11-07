import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPeriod } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: any;

  const mockClinic = { clinicId: 'clinic-1' };

  beforeEach(async () => {
    service = {
      getOverview: jest.fn(),
      getPatientAnalytics: jest.fn(),
      getRevenueAnalytics: jest.fn(),
      searchDiseases: jest.fn(),
      getDiseaseSuggestions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClinicAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('delegates getOverview with extracted active clinicId', async () => {
    service.getOverview.mockResolvedValue({ totalPatients: 10 });
    const query = { period: AnalyticsPeriod.TODAY };

    const result = await controller.getOverview(mockClinic, query);
    expect(result).toEqual({ totalPatients: 10 });
    expect(service.getOverview).toHaveBeenCalledWith('clinic-1', query);
  });

  it('delegates getPatientAnalytics with extracted active clinicId', async () => {
    service.getPatientAnalytics.mockResolvedValue({ dailyRegistrations: [] });
    const query = { period: AnalyticsPeriod.LAST_7_DAYS };

    const result = await controller.getPatientAnalytics(mockClinic, query);
    expect(result).toEqual({ dailyRegistrations: [] });
    expect(service.getPatientAnalytics).toHaveBeenCalledWith('clinic-1', query);
  });

  it('delegates getRevenueAnalytics with extracted active clinicId', async () => {
    service.getRevenueAnalytics.mockResolvedValue({ todayRevenue: 500 });
    const query = { period: AnalyticsPeriod.LAST_30_DAYS };

    const result = await controller.getRevenueAnalytics(mockClinic, query);
    expect(result).toEqual({ todayRevenue: 500 });
    expect(service.getRevenueAnalytics).toHaveBeenCalledWith('clinic-1', query);
  });

  it('delegates searchDiseases with extracted active clinicId and query', async () => {
    service.searchDiseases.mockResolvedValue({
      searchTerm: 'asthma',
      totalConsultations: 1,
      uniquePatients: 1,
      diagnosisMatchesCount: 1,
      clinicalNoteMatchesCount: 0,
      results: [],
    });
    const query = { q: 'asthma' } as any;

    const result = await controller.searchDiseases(mockClinic, query);
    expect(result.searchTerm).toBe('asthma');
    expect(service.searchDiseases).toHaveBeenCalledWith('clinic-1', query);
  });

  it('delegates getDiseaseSuggestions with extracted active clinicId and term', async () => {
    service.getDiseaseSuggestions.mockResolvedValue({
      query: 'copd',
      suggestions: ['COPD exacerbation'],
    });

    const result = await controller.getDiseaseSuggestions(mockClinic, 'copd');
    expect(result.suggestions).toContain('COPD exacerbation');
    expect(service.getDiseaseSuggestions).toHaveBeenCalledWith('clinic-1', 'copd');
  });
});
