export interface DateBucketCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface DailyConsultationTrend {
  date: string; // YYYY-MM-DD
  consultationCount: number;
  uniquePatientCount: number;
}

export interface DailyRevenueTrend {
  date: string; // YYYY-MM-DD
  amount: number;
  transactionCount: number;
}

export interface WeeklyRevenueTrend {
  week: string; // YYYY-Www
  startDate: string; // YYYY-MM-DD
  amount: number;
  transactionCount: number;
}

export interface MonthlyRevenueTrend {
  month: string; // YYYY-MM
  amount: number;
  transactionCount: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface PracticeOverviewResponse {
  period: string;
  startDate: string;
  endDate: string;
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  uniquePatientsSeen: number;
  totalConsultations: number;
  averagePatientsPerDay: number;
  todayRevenue: number;
  periodRevenue: number;
  totalSuccessfulPayments: number;
}

export interface PatientAnalyticsResponse {
  period: string;
  startDate: string;
  endDate: string;
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  uniquePatientsSeen: number;
  totalConsultations: number;
  averagePatientsPerDay: number;
  dailyRegistrations: DateBucketCount[];
  dailyConsultations: DailyConsultationTrend[];
}

export interface RevenueAnalyticsResponse {
  period: string;
  startDate: string;
  endDate: string;
  todayRevenue: number;
  periodRevenue: number;
  last7DaysRevenue: number;
  last30DaysRevenue: number;
  monthlyRevenue: number;
  totalSuccessfulPayments: number;
  dailyRevenue: DailyRevenueTrend[];
  weeklyRevenue: WeeklyRevenueTrend[];
  monthlyRevenueTrend: MonthlyRevenueTrend[];
  paymentMethodDistribution: PaymentMethodBreakdown[];
}

export type MatchCategory = 'DIAGNOSIS' | 'CLINICAL_NOTE' | 'BOTH';

export interface DiseaseSearchResultItem {
  consultationId: string;
  consultationDate: string;
  patientId: string;
  patientName: string;
  patientUhid: string;
  recordedDiagnosis: string | null;
  matchCategory: MatchCategory;
  matchedFields: string[];
  snippet: string;
  status: string;
}

export interface DiseaseSearchResponse {
  searchTerm: string;
  totalConsultations: number;
  uniquePatients: number;
  diagnosisMatchesCount: number;
  clinicalNoteMatchesCount: number;
  page: number;
  limit: number;
  totalPages: number;
  results: DiseaseSearchResultItem[];
}

export interface DiseaseSuggestionsResponse {
  query: string;
  suggestions: string[];
}


