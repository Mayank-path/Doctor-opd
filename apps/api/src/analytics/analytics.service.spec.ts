import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsPeriod } from './dto/analytics-query.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  const mockClinicId = 'clinic-uuid-1';

  beforeEach(async () => {
    prisma = {
      patient: {
        count: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('resolveDateRange', () => {
    it('resolves 7d period correctly', () => {
      const res = service.resolveDateRange({ period: AnalyticsPeriod.LAST_7_DAYS });
      expect(res.daysCount).toBe(7);
      expect(res.periodLabel).toBe('7d');
    });

    it('resolves custom period correctly', () => {
      const res = service.resolveDateRange({
        period: AnalyticsPeriod.CUSTOM,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-05T00:00:00.000Z',
      });
      expect(res.daysCount).toBe(4);
      expect(res.periodLabel).toBe('custom');
    });
  });

  describe('getOverview', () => {
    it('aggregates patient and revenue metrics correctly for the clinic', async () => {
      prisma.patient.count
        .mockResolvedValueOnce(150) // totalPatients
        .mockResolvedValueOnce(20); // newPatients

      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ count: 8 }]) // returningPatients
        .mockResolvedValueOnce([{ total_consults: 45, unique_patients: 35 }]) // consultStats
        .mockResolvedValueOnce([{ total: 1200 }]) // todayRevenue
        .mockResolvedValueOnce([{ total: 18500, successful_count: 37 }]); // periodRevenue

      const res = await service.getOverview(mockClinicId, {
        period: AnalyticsPeriod.LAST_30_DAYS,
      });

      expect(res.totalPatients).toBe(150);
      expect(res.newPatients).toBe(20);
      expect(res.returningPatients).toBe(8);
      expect(res.totalConsultations).toBe(45);
      expect(res.uniquePatientsSeen).toBe(35);
      expect(res.todayRevenue).toBe(1200);
      expect(res.periodRevenue).toBe(18500);
      expect(res.totalSuccessfulPayments).toBe(37);
      expect(res.averagePatientsPerDay).toBeCloseTo(35 / 30, 1);
    });
  });

  describe('getPatientAnalytics', () => {
    it('returns daily registration and consultation trends', async () => {
      // Mock getOverview internals
      prisma.patient.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10);
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ count: 4 }])
        .mockResolvedValueOnce([{ total_consults: 20, unique_patients: 15 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 0, successful_count: 0 }])
        // Daily registrations query
        .mockResolvedValueOnce([
          { bucket_date: '2026-11-01', reg_count: 3 },
          { bucket_date: '2026-11-02', reg_count: 7 },
        ])
        // Daily consultations query
        .mockResolvedValueOnce([
          { bucket_date: '2026-11-01', consult_count: 5, unique_pts: 4 },
          { bucket_date: '2026-11-02', consult_count: 15, unique_pts: 11 },
        ]);

      const res = await service.getPatientAnalytics(mockClinicId, {
        period: AnalyticsPeriod.LAST_7_DAYS,
      });

      expect(res.dailyRegistrations).toHaveLength(2);
      expect(res.dailyRegistrations[0].date).toBe('2026-11-01');
      expect(res.dailyRegistrations[0].count).toBe(3);
      expect(res.dailyConsultations).toHaveLength(2);
      expect(res.dailyConsultations[1].consultationCount).toBe(15);
      expect(res.dailyConsultations[1].uniquePatientCount).toBe(11);
    });
  });

  describe('getRevenueAnalytics', () => {
    it('returns revenue timeline and payment method breakdown', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 500 }]) // today
        .mockResolvedValueOnce([{ total: 10000, count: 20 }]) // period
        .mockResolvedValueOnce([{ total: 3500 }]) // 7d
        .mockResolvedValueOnce([{ total: 10000 }]) // 30d
        .mockResolvedValueOnce([{ total: 12000 }]) // monthly
        // daily
        .mockResolvedValueOnce([
          { bucket_date: '2026-11-01', amount: 2000, tx_count: 4 },
        ])
        // weekly
        .mockResolvedValueOnce([
          { week_label: '2026-W44', week_start: '2026-10-27', amount: 5000, tx_count: 10 },
        ])
        // monthly trend
        .mockResolvedValueOnce([
          { month_label: '2026-11', amount: 10000, tx_count: 20 },
        ])
        // method breakdown
        .mockResolvedValueOnce([
          { method: 'UPI', total_amount: 7000, count: 14 },
          { method: 'CASH', total_amount: 3000, count: 6 },
        ]);

      const res = await service.getRevenueAnalytics(mockClinicId, {
        period: AnalyticsPeriod.LAST_30_DAYS,
      });

      expect(res.periodRevenue).toBe(10000);
      expect(res.totalSuccessfulPayments).toBe(20);
      expect(res.paymentMethodDistribution).toHaveLength(2);
      expect(res.paymentMethodDistribution[0].method).toBe('UPI');
      expect(res.paymentMethodDistribution[0].percentage).toBe(70);
      expect(res.paymentMethodDistribution[1].method).toBe('CASH');
      expect(res.paymentMethodDistribution[1].percentage).toBe(30);
    });
  });

  describe('searchDiseases', () => {
    it('throws BadRequestException when search term is empty', async () => {
      await expect(
        service.searchDiseases(mockClinicId, { q: '   ' } as any),
      ).rejects.toThrow('Search term cannot be empty');
    });

    it('throws BadRequestException when startDate is after endDate', async () => {
      await expect(
        service.searchDiseases(mockClinicId, {
          q: 'fever',
          startDate: '2026-11-10T00:00:00.000Z',
          endDate: '2026-11-01T00:00:00.000Z',
        } as any),
      ).rejects.toThrow('startDate cannot be after endDate');
    });

    it('returns aggregated matches with single consultation count and match category classification', async () => {
      // 1. Aggregation result mock
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          {
            total_consultations: 2,
            unique_patients: 2,
            diagnosis_matches: 1,
            clinical_note_matches: 2,
          },
        ])
        // 2. Paginated rows mock
        .mockResolvedValueOnce([
          {
            consultationId: 'c-1',
            consultationDate: new Date('2026-11-05T10:00:00.000Z'),
            patientId: 'p-1',
            patientName: 'John Doe',
            patientUhid: 'UHID-001',
            recordedDiagnosis: 'Viral Fever with dehydration',
            chiefComplaint: 'High fever for 3 days',
            symptoms: 'Chills, body ache',
            examination: 'Temperature 102F',
            treatmentPlan: 'Paracetamol 650mg, ORS',
            status: 'FINALIZED',
          },
          {
            consultationId: 'c-2',
            consultationDate: new Date('2026-11-06T14:30:00.000Z'),
            patientId: 'p-2',
            patientName: 'Jane Smith',
            patientUhid: 'UHID-002',
            recordedDiagnosis: 'Acute Bronchitis',
            chiefComplaint: 'Persistent cough and low-grade fever',
            symptoms: 'Mild fever, fatigue',
            examination: 'Chest wheezing',
            treatmentPlan: 'Bronchodilator inhaler',
            status: 'FINALIZED',
          },
        ]);

      const res = await service.searchDiseases(mockClinicId, {
        q: 'fever',
        page: 1,
        limit: 10,
      });

      expect(res.searchTerm).toBe('fever');
      expect(res.totalConsultations).toBe(2);
      expect(res.uniquePatients).toBe(2);
      expect(res.diagnosisMatchesCount).toBe(1);
      expect(res.clinicalNoteMatchesCount).toBe(2);
      expect(res.totalPages).toBe(1);
      expect(res.results).toHaveLength(2);

      // Record 1: matches both diagnosis and chief complaint -> BOTH
      expect(res.results[0].consultationId).toBe('c-1');
      expect(res.results[0].matchCategory).toBe('BOTH');
      expect(res.results[0].recordedDiagnosis).toBe('Viral Fever with dehydration');
      expect(res.results[0].matchedFields).toContain('Diagnosis');
      expect(res.results[0].matchedFields).toContain('Chief Complaint');

      // Record 2: matches chief complaint and symptoms, NOT diagnosis -> CLINICAL_NOTE
      // Clinical safety requirement: recordedDiagnosis is kept as 'Acute Bronchitis', never altered to symptom
      expect(res.results[1].consultationId).toBe('c-2');
      expect(res.results[1].matchCategory).toBe('CLINICAL_NOTE');
      expect(res.results[1].recordedDiagnosis).toBe('Acute Bronchitis');
      expect(res.results[1].matchedFields).not.toContain('Diagnosis');
      expect(res.results[1].matchedFields).toContain('Chief Complaint');
      expect(res.results[1].matchedFields).toContain('Symptoms');
    });

    it('classifies DIAGNOSIS match when only recordedDiagnosis contains the search term', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          {
            total_consultations: 1,
            unique_patients: 1,
            diagnosis_matches: 1,
            clinical_note_matches: 0,
          },
        ])
        .mockResolvedValueOnce([
          {
            consultationId: 'c-3',
            consultationDate: new Date('2026-11-07T09:00:00.000Z'),
            patientId: 'p-3',
            patientName: 'Bob Vance',
            patientUhid: 'UHID-003',
            recordedDiagnosis: 'Hypertension Stage 2',
            chiefComplaint: 'Routine blood pressure checkup',
            symptoms: 'No complaints',
            examination: 'BP 160/100',
            treatmentPlan: 'Amlodipine 5mg OD',
            status: 'FINALIZED',
          },
        ]);

      const res = await service.searchDiseases(mockClinicId, {
        q: 'Hypertension',
      });

      expect(res.totalConsultations).toBe(1);
      expect(res.diagnosisMatchesCount).toBe(1);
      expect(res.clinicalNoteMatchesCount).toBe(0);
      expect(res.results[0].matchCategory).toBe('DIAGNOSIS');
      expect(res.results[0].matchedFields).toEqual(['Diagnosis']);
    });
  });

  describe('getDiseaseSuggestions', () => {
    it('returns distinct diagnosis terms from finalized consultations', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([
        { diagnosis: 'Acute Pharyngitis' },
        { diagnosis: 'Acute Tonsillitis' },
      ]);

      const res = await service.getDiseaseSuggestions(mockClinicId, 'acute');
      expect(res.query).toBe('acute');
      expect(res.suggestions).toEqual(['Acute Pharyngitis', 'Acute Tonsillitis']);
    });
  });
});

