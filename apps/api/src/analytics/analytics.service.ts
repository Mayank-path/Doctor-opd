import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsPeriod, AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  DiseaseSearchPeriod,
  DiseaseSearchQueryDto,
} from './dto/disease-search-query.dto';
import {
  DateBucketCount,
  DailyConsultationTrend,
  DailyRevenueTrend,
  WeeklyRevenueTrend,
  MonthlyRevenueTrend,
  PaymentMethodBreakdown,
  PracticeOverviewResponse,
  PatientAnalyticsResponse,
  RevenueAnalyticsResponse,
  DiseaseSearchResponse,
  DiseaseSearchResultItem,
  DiseaseSuggestionsResponse,
  MatchCategory,
} from './interfaces/analytics.interfaces';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve start and end dates based on period enum and timezone.
   */
  resolveDateRange(dto: AnalyticsQueryDto): { start: Date; end: Date; periodLabel: string; daysCount: number } {
    const tz = dto.timezone || 'Asia/Kolkata';
    const now = new Date();

    if (dto.period === AnalyticsPeriod.CUSTOM && dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      const diffMs = Math.max(1, end.getTime() - start.getTime());
      const daysCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return { start, end, periodLabel: 'custom', daysCount };
    }

    let days = 30;
    let label = '30d';

    switch (dto.period) {
      case AnalyticsPeriod.TODAY:
        days = 1;
        label = 'today';
        break;
      case AnalyticsPeriod.LAST_7_DAYS:
        days = 7;
        label = '7d';
        break;
      case AnalyticsPeriod.LAST_90_DAYS:
        days = 90;
        label = '90d';
        break;
      case AnalyticsPeriod.LAST_30_DAYS:
      default:
        days = 30;
        label = '30d';
        break;
    }

    const end = new Date(now);
    const start = new Date(now);
    if (days === 1) {
      // Beginning of today in UTC approximation or calendar day
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
    }

    return { start, end, periodLabel: label, daysCount: days };
  }

  /**
   * High-level practice performance overview combining core patient and revenue metrics.
   */
  async getOverview(clinicId: string, query: AnalyticsQueryDto): Promise<PracticeOverviewResponse> {
    const { start, end, periodLabel, daysCount } = this.resolveDateRange(query);
    const tz = query.timezone || 'Asia/Kolkata';

    // 1. Patient metrics
    const [totalPatients, newPatients] = await Promise.all([
      this.prisma.patient.count({
        where: { clinicId, isActive: true },
      }),
      this.prisma.patient.count({
        where: {
          clinicId,
          isActive: true,
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

    // Returning patients in range: patients seen in consultation within range who had a prior consultation before `start`
    const returningResult = await this.prisma.$queryRawUnsafe<Array<{ count: string | number }>>(`
      SELECT COUNT(DISTINCT c."patientId")::int AS count
      FROM "consultations" c
      WHERE c."clinicId" = $1
        AND c."status" != 'VOIDED'
        AND c."encounterDate" >= $2 AND c."encounterDate" <= $3
        AND EXISTS (
          SELECT 1 FROM "consultations" c_prior
          WHERE c_prior."clinicId" = $1
            AND c_prior."patientId" = c."patientId"
            AND c_prior."status" != 'VOIDED'
            AND c_prior."encounterDate" < $2
        )
    `, clinicId, start, end);
    const returningPatients = Number(returningResult[0]?.count ?? 0);

    // Unique patients seen and total consultations in range
    const consultStats = await this.prisma.$queryRawUnsafe<Array<{ total_consults: string | number; unique_patients: string | number }>>(`
      SELECT
        COUNT(*)::int AS total_consults,
        COUNT(DISTINCT "patientId")::int AS unique_patients
      FROM "consultations"
      WHERE "clinicId" = $1
        AND "status" != 'VOIDED'
        AND "encounterDate" >= $2 AND "encounterDate" <= $3
    `, clinicId, start, end);

    const totalConsultations = Number(consultStats[0]?.total_consults ?? 0);
    const uniquePatientsSeen = Number(consultStats[0]?.unique_patients ?? 0);
    const averagePatientsPerDay = daysCount > 0
      ? Math.round((uniquePatientsSeen / daysCount) * 10) / 10
      : 0;

    // 2. Revenue metrics
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayRevenueResult, periodRevenueResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ total: string | number }>>(`
        SELECT COALESCE(SUM("amount"), 0)::float AS total
        FROM "payments"
        WHERE "clinic_id" = $1
          AND "status" = 'COMPLETED'
          AND "paid_at" >= $2
      `, clinicId, startOfToday),
      this.prisma.$queryRawUnsafe<Array<{ total: string | number; successful_count: string | number }>>(`
        SELECT
          COALESCE(SUM("amount"), 0)::float AS total,
          COUNT(*)::int AS successful_count
        FROM "payments"
        WHERE "clinic_id" = $1
          AND "status" = 'COMPLETED'
          AND "paid_at" >= $2 AND "paid_at" <= $3
      `, clinicId, start, end),
    ]);

    const todayRevenue = Number(todayRevenueResult[0]?.total ?? 0);
    const periodRevenue = Number(periodRevenueResult[0]?.total ?? 0);
    const totalSuccessfulPayments = Number(periodRevenueResult[0]?.successful_count ?? 0);

    return {
      period: periodLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalPatients,
      newPatients,
      returningPatients,
      uniquePatientsSeen,
      totalConsultations,
      averagePatientsPerDay,
      todayRevenue,
      periodRevenue,
      totalSuccessfulPayments,
    };
  }

  /**
   * Detailed patient growth, return rates, and daily consultation trends.
   */
  async getPatientAnalytics(clinicId: string, query: AnalyticsQueryDto): Promise<PatientAnalyticsResponse> {
    const overview = await this.getOverview(clinicId, query);
    const { start, end } = this.resolveDateRange(query);
    const tz = query.timezone || 'Asia/Kolkata';

    // Daily registrations
    const dailyRegistrationsRaw = await this.prisma.$queryRawUnsafe<Array<{ bucket_date: string; reg_count: string | number }>>(`
      SELECT
        to_char("createdAt" AT TIME ZONE $1, 'YYYY-MM-DD') AS bucket_date,
        COUNT(*)::int AS reg_count
      FROM "patients"
      WHERE "clinicId" = $2
        AND "isActive" = true
        AND "createdAt" >= $3 AND "createdAt" <= $4
      GROUP BY bucket_date
      ORDER BY bucket_date ASC
    `, tz, clinicId, start, end);

    const dailyRegistrations: DateBucketCount[] = dailyRegistrationsRaw.map((row) => ({
      date: row.bucket_date,
      count: Number(row.reg_count),
    }));

    // Daily consultations
    const dailyConsultsRaw = await this.prisma.$queryRawUnsafe<Array<{ bucket_date: string; consult_count: string | number; unique_pts: string | number }>>(`
      SELECT
        to_char("encounterDate" AT TIME ZONE $1, 'YYYY-MM-DD') AS bucket_date,
        COUNT(*)::int AS consult_count,
        COUNT(DISTINCT "patientId")::int AS unique_pts
      FROM "consultations"
      WHERE "clinicId" = $2
        AND "status" != 'VOIDED'
        AND "encounterDate" >= $3 AND "encounterDate" <= $4
      GROUP BY bucket_date
      ORDER BY bucket_date ASC
    `, tz, clinicId, start, end);

    const dailyConsultations: DailyConsultationTrend[] = dailyConsultsRaw.map((row) => ({
      date: row.bucket_date,
      consultationCount: Number(row.consult_count),
      uniquePatientCount: Number(row.unique_pts),
    }));

    return {
      period: overview.period,
      startDate: overview.startDate,
      endDate: overview.endDate,
      totalPatients: overview.totalPatients,
      newPatients: overview.newPatients,
      returningPatients: overview.returningPatients,
      uniquePatientsSeen: overview.uniquePatientsSeen,
      totalConsultations: overview.totalConsultations,
      averagePatientsPerDay: overview.averagePatientsPerDay,
      dailyRegistrations,
      dailyConsultations,
    };
  }

  /**
   * Detailed practice revenue, payment methods distribution, and trend timelines.
   */
  async getRevenueAnalytics(clinicId: string, query: AnalyticsQueryDto): Promise<RevenueAnalyticsResponse> {
    const { start, end, periodLabel } = this.resolveDateRange(query);
    const tz = query.timezone || 'Asia/Kolkata';
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOf7d = new Date(now);
    startOf7d.setDate(startOf7d.getDate() - 6);
    startOf7d.setHours(0, 0, 0, 0);

    const startOf30d = new Date(now);
    startOf30d.setDate(startOf30d.getDate() - 29);
    startOf30d.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Headline summaries
    const [todayRes, periodRes, last7dRes, last30dRes, monthlyRes] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ total: string | number }>>(`
        SELECT COALESCE(SUM("amount"), 0)::float AS total
        FROM "payments"
        WHERE "clinic_id" = $1
          AND "status" = 'COMPLETED'
          AND "paid_at" >= $2
      `, clinicId, startOfToday),
      this.prisma.$queryRawUnsafe<Array<{ total: string | number; count: string | number }>>(`
        SELECT
          COALESCE(SUM("amount"), 0)::float AS total,
          COUNT(*)::int AS count
        FROM "payments"
        WHERE "clinic_id" = $1
          AND "status" = 'COMPLETED'
          AND "paid_at" >= $2 AND "paid_at" <= $3
      `, clinicId, start, end),
      this.prisma.$queryRawUnsafe<Array<{ total: string | number }>>(`
        SELECT COALESCE(SUM("amount"), 0)::float AS total
        FROM "payments"
        WHERE "clinic_id" = $1
          AND "status" = 'COMPLETED'
          AND "paid_at" >= $2
      `, clinicId, startOf7d),
      this.prisma.$queryRawUnsafe<Array<{ total: string | number }>>(`
        SELECT COALESCE(SUM("amount"), 0)::float AS total
        FROM "payments"
        WHERE "clinic_id" = $1
          AND "status" = 'COMPLETED'
          AND "paid_at" >= $2
      `, clinicId, startOf30d),
      this.prisma.$queryRawUnsafe<Array<{ total: string | number }>>(`
        SELECT COALESCE(SUM("amount"), 0)::float AS total
        FROM "payments"
        WHERE "clinic_id" = $1
          AND "status" = 'COMPLETED'
          AND "paid_at" >= $2
      `, clinicId, startOfMonth),
    ]);

    const todayRevenue = Number(todayRes[0]?.total ?? 0);
    const periodRevenue = Number(periodRes[0]?.total ?? 0);
    const totalSuccessfulPayments = Number(periodRes[0]?.count ?? 0);
    const last7DaysRevenue = Number(last7dRes[0]?.total ?? 0);
    const last30DaysRevenue = Number(last30dRes[0]?.total ?? 0);
    const monthlyRevenue = Number(monthlyRes[0]?.total ?? 0);

    // Daily revenue trend
    const dailyRaw = await this.prisma.$queryRawUnsafe<Array<{ bucket_date: string; amount: string | number; tx_count: string | number }>>(`
      SELECT
        to_char("paid_at" AT TIME ZONE $1, 'YYYY-MM-DD') AS bucket_date,
        COALESCE(SUM("amount"), 0)::float AS amount,
        COUNT(*)::int AS tx_count
      FROM "payments"
      WHERE "clinic_id" = $2
        AND "status" = 'COMPLETED'
        AND "paid_at" >= $3 AND "paid_at" <= $4
      GROUP BY bucket_date
      ORDER BY bucket_date ASC
    `, tz, clinicId, start, end);

    const dailyRevenue: DailyRevenueTrend[] = dailyRaw.map((r) => ({
      date: r.bucket_date,
      amount: Number(r.amount),
      transactionCount: Number(r.tx_count),
    }));

    // Weekly revenue trend (ISO week)
    const weeklyRaw = await this.prisma.$queryRawUnsafe<Array<{ week_label: string; week_start: string; amount: string | number; tx_count: string | number }>>(`
      SELECT
        to_char("paid_at" AT TIME ZONE $1, 'IYYY-"W"IW') AS week_label,
        to_char(date_trunc('week', "paid_at" AT TIME ZONE $1), 'YYYY-MM-DD') AS week_start,
        COALESCE(SUM("amount"), 0)::float AS amount,
        COUNT(*)::int AS tx_count
      FROM "payments"
      WHERE "clinic_id" = $2
        AND "status" = 'COMPLETED'
        AND "paid_at" >= $3 AND "paid_at" <= $4
      GROUP BY week_label, week_start
      ORDER BY week_start ASC
    `, tz, clinicId, start, end);

    const weeklyRevenue: WeeklyRevenueTrend[] = weeklyRaw.map((r) => ({
      week: r.week_label,
      startDate: r.week_start,
      amount: Number(r.amount),
      transactionCount: Number(r.tx_count),
    }));

    // Monthly revenue trend
    const monthlyRaw = await this.prisma.$queryRawUnsafe<Array<{ month_label: string; amount: string | number; tx_count: string | number }>>(`
      SELECT
        to_char("paid_at" AT TIME ZONE $1, 'YYYY-MM') AS month_label,
        COALESCE(SUM("amount"), 0)::float AS amount,
        COUNT(*)::int AS tx_count
      FROM "payments"
      WHERE "clinic_id" = $2
        AND "status" = 'COMPLETED'
        AND "paid_at" >= $3 AND "paid_at" <= $4
      GROUP BY month_label
      ORDER BY month_label ASC
    `, tz, clinicId, start, end);

    const monthlyRevenueTrend: MonthlyRevenueTrend[] = monthlyRaw.map((r) => ({
      month: r.month_label,
      amount: Number(r.amount),
      transactionCount: Number(r.tx_count),
    }));

    // Payment method distribution
    const methodRaw = await this.prisma.$queryRawUnsafe<Array<{ method: string; total_amount: string | number; count: string | number }>>(`
      SELECT
        "method",
        COALESCE(SUM("amount"), 0)::float AS total_amount,
        COUNT(*)::int AS count
      FROM "payments"
      WHERE "clinic_id" = $1
        AND "status" = 'COMPLETED'
        AND "paid_at" >= $2 AND "paid_at" <= $3
      GROUP BY "method"
      ORDER BY total_amount DESC
    `, clinicId, start, end);

    const paymentMethodDistribution: PaymentMethodBreakdown[] = methodRaw.map((r) => {
      const amt = Number(r.total_amount);
      const cnt = Number(r.count);
      const pct = periodRevenue > 0 ? Math.round((amt / periodRevenue) * 1000) / 10 : 0;
      return {
        method: r.method,
        amount: amt,
        count: cnt,
        percentage: pct,
      };
    });

    return {
      period: periodLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      todayRevenue,
      periodRevenue,
      last7DaysRevenue,
      last30DaysRevenue,
      monthlyRevenue,
      totalSuccessfulPayments,
      dailyRevenue,
      weeklyRevenue,
      monthlyRevenueTrend,
      paymentMethodDistribution,
    };
  }

  /**
   * Search historical consultation records by disease or clinical term.
   * Scoped strictly to the active clinic and FINALIZED consultations.
   * DRAFT and VOIDED consultations are excluded.
   * Symptoms are never classified as confirmed diagnoses.
   */
  async searchDiseases(
    clinicId: string,
    query: DiseaseSearchQueryDto,
  ): Promise<DiseaseSearchResponse> {
    const rawTerm = query.q?.trim();
    if (!rawTerm) {
      throw new BadRequestException('Search term cannot be empty');
    }
    const termLower = rawTerm.toLowerCase();
    const pattern = `%${rawTerm}%`;

    // Date range resolution
    let start: Date | null = null;
    let end: Date | null = null;

    if (query.period === DiseaseSearchPeriod.CUSTOM || (query.startDate && query.endDate)) {
      if (query.startDate) start = new Date(query.startDate);
      if (query.endDate) end = new Date(query.endDate);
      if (start && isNaN(start.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
      if (end && isNaN(end.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
      if (start && end && start > end) {
        throw new BadRequestException('startDate cannot be after endDate');
      }
    } else if (query.period && query.period !== DiseaseSearchPeriod.ALL) {
      const now = new Date();
      end = now;
      if (query.period === DiseaseSearchPeriod.TODAY) {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
      } else if (query.period === DiseaseSearchPeriod.LAST_7D) {
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else if (query.period === DiseaseSearchPeriod.LAST_30D) {
        start = new Date(now);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
      } else if (query.period === DiseaseSearchPeriod.LAST_90D) {
        start = new Date(now);
        start.setDate(start.getDate() - 89);
        start.setHours(0, 0, 0, 0);
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    // 1. Perform aggregated counts: single count rule for total consultations,
    // unique patient count, diagnosis matches, and clinical note matches.
    const aggResult = await this.prisma.$queryRawUnsafe<
      Array<{
        total_consultations: number;
        unique_patients: number;
        diagnosis_matches: number;
        clinical_note_matches: number;
      }>
    >(
      `
      SELECT
        COUNT(*)::int AS total_consultations,
        COUNT(DISTINCT "patientId")::int AS unique_patients,
        COUNT(*) FILTER (WHERE "diagnosis" ILIKE $2)::int AS diagnosis_matches,
        COUNT(*) FILTER (
          WHERE "chiefComplaint" ILIKE $2
             OR "symptoms" ILIKE $2
             OR "examination" ILIKE $2
             OR "treatmentPlan" ILIKE $2
        )::int AS clinical_note_matches
      FROM "consultations"
      WHERE "clinicId" = $1
        AND "status" = 'FINALIZED'
        AND (
          "diagnosis" ILIKE $2
          OR "chiefComplaint" ILIKE $2
          OR "symptoms" ILIKE $2
          OR "examination" ILIKE $2
          OR "treatmentPlan" ILIKE $2
        )
        AND ($3::timestamptz IS NULL OR "encounterDate" >= $3)
        AND ($4::timestamptz IS NULL OR "encounterDate" <= $4)
    `,
      clinicId,
      pattern,
      start,
      end,
    );

    const totalConsultations = Number(aggResult[0]?.total_consultations ?? 0);
    const uniquePatients = Number(aggResult[0]?.unique_patients ?? 0);
    const diagnosisMatchesCount = Number(aggResult[0]?.diagnosis_matches ?? 0);
    const clinicalNoteMatchesCount = Number(aggResult[0]?.clinical_note_matches ?? 0);
    const totalPages = Math.ceil(totalConsultations / limit) || (totalConsultations === 0 ? 0 : 1);

    // 2. Fetch paginated records
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        consultationId: string;
        consultationDate: Date;
        patientId: string;
        patientName: string;
        patientUhid: string;
        recordedDiagnosis: string | null;
        chiefComplaint: string | null;
        symptoms: string | null;
        examination: string | null;
        treatmentPlan: string | null;
        status: string;
      }>
    >(
      `
      SELECT
        c."id" AS "consultationId",
        c."encounterDate" AS "consultationDate",
        c."patientId" AS "patientId",
        p."fullName" AS "patientName",
        p."uhid" AS "patientUhid",
        c."diagnosis" AS "recordedDiagnosis",
        c."chiefComplaint" AS "chiefComplaint",
        c."symptoms" AS "symptoms",
        c."examination" AS "examination",
        c."treatmentPlan" AS "treatmentPlan",
        c."status" AS "status"
      FROM "consultations" c
      JOIN "patients" p ON p."id" = c."patientId" AND p."clinicId" = c."clinicId"
      WHERE c."clinicId" = $1
        AND c."status" = 'FINALIZED'
        AND (
          c."diagnosis" ILIKE $2
          OR c."chiefComplaint" ILIKE $2
          OR c."symptoms" ILIKE $2
          OR c."examination" ILIKE $2
          OR c."treatmentPlan" ILIKE $2
        )
        AND ($3::timestamptz IS NULL OR c."encounterDate" >= $3)
        AND ($4::timestamptz IS NULL OR c."encounterDate" <= $4)
      ORDER BY c."encounterDate" DESC
      LIMIT $5 OFFSET $6
    `,
      clinicId,
      pattern,
      start,
      end,
      limit,
      offset,
    );

    const results: DiseaseSearchResultItem[] = rows.map((row) => {
      const diagMatch = row.recordedDiagnosis?.toLowerCase().includes(termLower) ?? false;
      const symptomMatch = row.symptoms?.toLowerCase().includes(termLower) ?? false;
      const chiefMatch = row.chiefComplaint?.toLowerCase().includes(termLower) ?? false;
      const examMatch = row.examination?.toLowerCase().includes(termLower) ?? false;
      const treatmentMatch = row.treatmentPlan?.toLowerCase().includes(termLower) ?? false;

      const isNoteMatch = symptomMatch || chiefMatch || examMatch || treatmentMatch;

      let matchCategory: MatchCategory = 'CLINICAL_NOTE';
      if (diagMatch && isNoteMatch) {
        matchCategory = 'BOTH';
      } else if (diagMatch) {
        matchCategory = 'DIAGNOSIS';
      }

      const matchedFields: string[] = [];
      if (diagMatch) matchedFields.push('Diagnosis');
      if (symptomMatch) matchedFields.push('Symptoms');
      if (chiefMatch) matchedFields.push('Chief Complaint');
      if (examMatch) matchedFields.push('Examination');
      if (treatmentMatch) matchedFields.push('Treatment Plan');

      const snippet =
        this.extractSnippet(row.recordedDiagnosis, rawTerm) ||
        this.extractSnippet(row.chiefComplaint, rawTerm) ||
        this.extractSnippet(row.symptoms, rawTerm) ||
        this.extractSnippet(row.examination, rawTerm) ||
        this.extractSnippet(row.treatmentPlan, rawTerm) ||
        '';

      return {
        consultationId: row.consultationId,
        consultationDate: row.consultationDate instanceof Date ? row.consultationDate.toISOString() : String(row.consultationDate),
        patientId: row.patientId,
        patientName: row.patientName,
        patientUhid: row.patientUhid,
        recordedDiagnosis: row.recordedDiagnosis,
        matchCategory,
        matchedFields,
        snippet,
        status: row.status,
      };
    });

    return {
      searchTerm: rawTerm,
      totalConsultations,
      uniquePatients,
      diagnosisMatchesCount,
      clinicalNoteMatchesCount,
      page,
      limit,
      totalPages,
      results,
    };
  }

  /**
   * Search suggestions derived from existing recorded diagnosis terms in the clinic.
   * No hardcoded disease DB or synthetic inferences.
   */
  async getDiseaseSuggestions(
    clinicId: string,
    q?: string,
  ): Promise<DiseaseSuggestionsResponse> {
    const raw = q?.trim();
    const pattern = raw && raw.length > 0 ? `%${raw}%` : null;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ diagnosis: string }>>(
      `
      SELECT DISTINCT "diagnosis"
      FROM "consultations"
      WHERE "clinicId" = $1
        AND "status" = 'FINALIZED'
        AND "diagnosis" IS NOT NULL
        AND length(trim("diagnosis")) > 0
        AND ($2::text IS NULL OR "diagnosis" ILIKE $2)
      ORDER BY "diagnosis" ASC
      LIMIT 10
    `,
      clinicId,
      pattern,
    );

    return {
      query: raw || '',
      suggestions: rows.map((r) => r.diagnosis),
    };
  }

  private extractSnippet(
    text: string | null | undefined,
    term: string,
    maxLength = 120,
  ): string | null {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const idx = lowerText.indexOf(lowerTerm);
    if (idx === -1) return null;

    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + term.length + 60);
    let snippet = text.slice(start, end).trim();
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  }
}


