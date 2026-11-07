// Model representations for Practice Performance & Revenue Analytics.

class PracticeOverview {
  final String period;
  final String startDate;
  final String endDate;
  final int totalPatients;
  final int newPatients;
  final int returningPatients;
  final int uniquePatientsSeen;
  final int totalConsultations;
  final double averagePatientsPerDay;
  final double todayRevenue;
  final double periodRevenue;
  final int totalSuccessfulPayments;

  const PracticeOverview({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.totalPatients,
    required this.newPatients,
    required this.returningPatients,
    required this.uniquePatientsSeen,
    required this.totalConsultations,
    required this.averagePatientsPerDay,
    required this.todayRevenue,
    required this.periodRevenue,
    required this.totalSuccessfulPayments,
  });

  factory PracticeOverview.fromJson(Map<String, dynamic> json) {
    return PracticeOverview(
      period: json['period'] as String? ?? '30d',
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
      totalPatients: (json['totalPatients'] as num?)?.toInt() ?? 0,
      newPatients: (json['newPatients'] as num?)?.toInt() ?? 0,
      returningPatients: (json['returningPatients'] as num?)?.toInt() ?? 0,
      uniquePatientsSeen: (json['uniquePatientsSeen'] as num?)?.toInt() ?? 0,
      totalConsultations: (json['totalConsultations'] as num?)?.toInt() ?? 0,
      averagePatientsPerDay: (json['averagePatientsPerDay'] as num?)?.toDouble() ?? 0.0,
      todayRevenue: (json['todayRevenue'] as num?)?.toDouble() ?? 0.0,
      periodRevenue: (json['periodRevenue'] as num?)?.toDouble() ?? 0.0,
      totalSuccessfulPayments: (json['totalSuccessfulPayments'] as num?)?.toInt() ?? 0,
    );
  }
}

class DateBucketCount {
  final String date;
  final int count;

  const DateBucketCount({
    required this.date,
    required this.count,
  });

  factory DateBucketCount.fromJson(Map<String, dynamic> json) {
    return DateBucketCount(
      date: json['date'] as String? ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class DailyConsultationTrend {
  final String date;
  final int consultationCount;
  final int uniquePatientCount;

  const DailyConsultationTrend({
    required this.date,
    required this.consultationCount,
    required this.uniquePatientCount,
  });

  factory DailyConsultationTrend.fromJson(Map<String, dynamic> json) {
    return DailyConsultationTrend(
      date: json['date'] as String? ?? '',
      consultationCount: (json['consultationCount'] as num?)?.toInt() ?? 0,
      uniquePatientCount: (json['uniquePatientCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class DailyRevenueTrend {
  final String date;
  final double amount;
  final int transactionCount;

  const DailyRevenueTrend({
    required this.date,
    required this.amount,
    required this.transactionCount,
  });

  factory DailyRevenueTrend.fromJson(Map<String, dynamic> json) {
    return DailyRevenueTrend(
      date: json['date'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      transactionCount: (json['transactionCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class WeeklyRevenueTrend {
  final String week;
  final String startDate;
  final double amount;
  final int transactionCount;

  const WeeklyRevenueTrend({
    required this.week,
    required this.startDate,
    required this.amount,
    required this.transactionCount,
  });

  factory WeeklyRevenueTrend.fromJson(Map<String, dynamic> json) {
    return WeeklyRevenueTrend(
      week: json['week'] as String? ?? '',
      startDate: json['startDate'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      transactionCount: (json['transactionCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class MonthlyRevenueTrend {
  final String month;
  final double amount;
  final int transactionCount;

  const MonthlyRevenueTrend({
    required this.month,
    required this.amount,
    required this.transactionCount,
  });

  factory MonthlyRevenueTrend.fromJson(Map<String, dynamic> json) {
    return MonthlyRevenueTrend(
      month: json['month'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      transactionCount: (json['transactionCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class PaymentMethodBreakdown {
  final String method;
  final double amount;
  final int count;
  final double percentage;

  const PaymentMethodBreakdown({
    required this.method,
    required this.amount,
    required this.count,
    required this.percentage,
  });

  factory PaymentMethodBreakdown.fromJson(Map<String, dynamic> json) {
    return PaymentMethodBreakdown(
      method: json['method'] as String? ?? 'OTHER',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      count: (json['count'] as num?)?.toInt() ?? 0,
      percentage: (json['percentage'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class PatientAnalytics {
  final String period;
  final String startDate;
  final String endDate;
  final int totalPatients;
  final int newPatients;
  final int returningPatients;
  final int uniquePatientsSeen;
  final int totalConsultations;
  final double averagePatientsPerDay;
  final List<DateBucketCount> dailyRegistrations;
  final List<DailyConsultationTrend> dailyConsultations;

  const PatientAnalytics({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.totalPatients,
    required this.newPatients,
    required this.returningPatients,
    required this.uniquePatientsSeen,
    required this.totalConsultations,
    required this.averagePatientsPerDay,
    required this.dailyRegistrations,
    required this.dailyConsultations,
  });

  factory PatientAnalytics.fromJson(Map<String, dynamic> json) {
    final regList = (json['dailyRegistrations'] as List<dynamic>? ?? [])
        .map((e) => DateBucketCount.fromJson(e as Map<String, dynamic>))
        .toList();
    final consultList = (json['dailyConsultations'] as List<dynamic>? ?? [])
        .map((e) => DailyConsultationTrend.fromJson(e as Map<String, dynamic>))
        .toList();

    return PatientAnalytics(
      period: json['period'] as String? ?? '30d',
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
      totalPatients: (json['totalPatients'] as num?)?.toInt() ?? 0,
      newPatients: (json['newPatients'] as num?)?.toInt() ?? 0,
      returningPatients: (json['returningPatients'] as num?)?.toInt() ?? 0,
      uniquePatientsSeen: (json['uniquePatientsSeen'] as num?)?.toInt() ?? 0,
      totalConsultations: (json['totalConsultations'] as num?)?.toInt() ?? 0,
      averagePatientsPerDay: (json['averagePatientsPerDay'] as num?)?.toDouble() ?? 0.0,
      dailyRegistrations: regList,
      dailyConsultations: consultList,
    );
  }
}

class RevenueAnalytics {
  final String period;
  final String startDate;
  final String endDate;
  final double todayRevenue;
  final double periodRevenue;
  final double last7DaysRevenue;
  final double last30DaysRevenue;
  final double monthlyRevenue;
  final int totalSuccessfulPayments;
  final List<DailyRevenueTrend> dailyRevenue;
  final List<WeeklyRevenueTrend> weeklyRevenue;
  final List<MonthlyRevenueTrend> monthlyRevenueTrend;
  final List<PaymentMethodBreakdown> paymentMethodDistribution;

  const RevenueAnalytics({
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.todayRevenue,
    required this.periodRevenue,
    required this.last7DaysRevenue,
    required this.last30DaysRevenue,
    required this.monthlyRevenue,
    required this.totalSuccessfulPayments,
    required this.dailyRevenue,
    required this.weeklyRevenue,
    required this.monthlyRevenueTrend,
    required this.paymentMethodDistribution,
  });

  factory RevenueAnalytics.fromJson(Map<String, dynamic> json) {
    final daily = (json['dailyRevenue'] as List<dynamic>? ?? [])
        .map((e) => DailyRevenueTrend.fromJson(e as Map<String, dynamic>))
        .toList();
    final weekly = (json['weeklyRevenue'] as List<dynamic>? ?? [])
        .map((e) => WeeklyRevenueTrend.fromJson(e as Map<String, dynamic>))
        .toList();
    final monthly = (json['monthlyRevenueTrend'] as List<dynamic>? ?? [])
        .map((e) => MonthlyRevenueTrend.fromJson(e as Map<String, dynamic>))
        .toList();
    final methods = (json['paymentMethodDistribution'] as List<dynamic>? ?? [])
        .map((e) => PaymentMethodBreakdown.fromJson(e as Map<String, dynamic>))
        .toList();

    return RevenueAnalytics(
      period: json['period'] as String? ?? '30d',
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
      todayRevenue: (json['todayRevenue'] as num?)?.toDouble() ?? 0.0,
      periodRevenue: (json['periodRevenue'] as num?)?.toDouble() ?? 0.0,
      last7DaysRevenue: (json['last7DaysRevenue'] as num?)?.toDouble() ?? 0.0,
      last30DaysRevenue: (json['last30DaysRevenue'] as num?)?.toDouble() ?? 0.0,
      monthlyRevenue: (json['monthlyRevenue'] as num?)?.toDouble() ?? 0.0,
      totalSuccessfulPayments: (json['totalSuccessfulPayments'] as num?)?.toInt() ?? 0,
      dailyRevenue: daily,
      weeklyRevenue: weekly,
      monthlyRevenueTrend: monthly,
      paymentMethodDistribution: methods,
    );
  }
}
