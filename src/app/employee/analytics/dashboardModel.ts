export type LocationOption = {
  id: string;
  display_name: string;
  airport_code: string;
  code: string;
};

export type AnalyticsFilters = {
  location_id: string | null;
  date_start: string | null;
  date_end: string | null;
  customer_type: 'paying' | 'priority_pass' | null;
};

export type AnalyticsKpis = {
  arrivals_total: number;
  arrivals_paying: number;
  arrivals_non_paying: number;
  served_total: number;
  completed_total: number;
  adjusted_completed_total: number | null;
  cancelled_total: number;
  cancelled_before_served_total: number;
  completion_rate: number | null;
  dropoff_rate: number | null;
  average_queue_length: number | null;
  utilization_rate: number | null;
  wait_avg_minutes: number | null;
  time_in_system_avg_minutes: number | null;
  new_customers_total?: number | null;
  repeat_customers_total?: number | null;
  classified_customers_total?: number | null;
  new_customers_rate: number | null;
  repeat_customers_rate: number | null;
};

export type AnalyticsSeriesRow = {
  local_date: string;
  arrivals_total: number;
  arrivals_paying: number;
  arrivals_non_paying: number;
  served_total: number;
  completed_total: number;
  cancelled_total: number;
  cancelled_before_served_total: number;
  completion_rate: number | null;
  dropoff_rate: number | null;
  wait_avg_minutes: number | null;
  time_in_system_avg_minutes: number | null;
};

export type AnalyticsHourlyRow = {
  hour_of_day: number;
  arrivals_total: number;
  served_total: number;
  wait_avg_minutes: number | null;
};

export type AnalyticsPreviousKpis = {
  arrivals_total: number;
  completion_rate: number | null;
  dropoff_rate: number | null;
  average_queue_length: number | null;
  utilization_rate: number | null;
  wait_avg_minutes: number | null;
  completed_total: number;
  adjusted_completed_total: number | null;
  cancelled_total: number;
};

export type AnalyticsPreviousPeriod = {
  date_start: string | null;
  date_end: string | null;
  kpis: AnalyticsPreviousKpis | null;
};

export type AnalyticsResponse = {
  filters: AnalyticsFilters;
  kpis: AnalyticsKpis;
  series: AnalyticsSeriesRow[];
  hourly_series: AnalyticsHourlyRow[];
  previous_period: AnalyticsPreviousPeriod | null;
};

export type StoryMode = 'single_day' | 'multi_day' | 'long_range';
export type SortDirection = 'asc' | 'desc';
export type LocationSortKey =
  | 'attention'
  | 'completed'
  | 'adjusted_completed'
  | 'completion'
  | 'wait'
  | 'utilization'
  | 'queue_length';

export type LocationComparisonRow = {
  location_id: string;
  location_name: string;
  airport_code: string;
  code: string;
  severity: 'stable' | 'watch' | 'attention' | 'urgent';
  arrivals_total: number;
  served_total: number;
  completed_total: number;
  adjusted_completed_total: number | null;
  cancelled_total: number;
  cancelled_before_served_total: number;
  completion_rate: number | null;
  dropoff_rate: number | null;
  average_queue_length: number | null;
  utilization_rate: number | null;
  wait_avg_minutes: number | null;
  time_in_system_avg_minutes: number | null;
  paying_share: number | null;
  repeat_share: number | null;
  service_conversion_rate: number | null;
  before_service_loss_rate: number | null;
  arrivals_delta: number | null;
  completed_delta: number | null;
  adjusted_completed_delta: number | null;
  completion_delta: number | null;
  wait_delta: number | null;
  dropoff_delta: number | null;
  average_queue_length_delta: number | null;
  utilization_delta: number | null;
  attention_score: number;
  issue_label: string;
};

export type ExecutiveSignal = {
  title: string;
  detail: string;
  tone: 'good' | 'watch' | 'attention' | 'urgent';
};

export type ExecutiveSummary = {
  status: 'healthy' | 'watch' | 'attention' | 'urgent';
  headline: string;
  summary: string;
  primary_driver: string | null;
  best_location: string | null;
  watch_location: string | null;
  signals: ExecutiveSignal[];
};

export type SegmentComparisonMetric = {
  key:
    | 'wait'
    | 'completion'
    | 'loss'
    | 'time_in_system'
    | 'repeat_share';
  label: string;
  format: 'minutes' | 'percent';
  higher_is_better: boolean;
  paying_value: number | null;
  priority_value: number | null;
  gap_value: number | null;
  leading_segment: 'paying' | 'priority_pass' | 'tie' | 'none';
};

export type SegmentComparisonInsight = {
  title: string;
  detail: string;
  tone: 'good' | 'watch' | 'attention';
};

export type SegmentMixInteractionRow = {
  key: 'paying' | 'priority_pass';
  label: string;
  total: number;
  share_of_arrivals: number | null;
  new_total: number | null;
  repeat_total: number | null;
  classified_total: number | null;
  unclassified_total: number | null;
};

export type SegmentComparisonModel = {
  mix: {
    paying_total: number;
    priority_total: number;
    new_total: number | null;
    repeat_total: number | null;
    classified_total: number | null;
    interaction_rows: SegmentMixInteractionRow[];
  };
  loss_share: {
    paying: number | null;
    priority: number | null;
  };
  metrics: SegmentComparisonMetric[];
  insights: SegmentComparisonInsight[];
};

export type ChainComparisonSummary = {
  visible_locations: number;
  active_locations: number;
  arrivals_total: number;
  arrivals_average_per_location: number;
  served_total: number;
  completed_total: number;
  cancelled_total: number;
  cancelled_before_served_total: number;
  completion_rate: number | null;
  dropoff_rate: number | null;
  wait_avg_minutes: number | null;
  before_service_loss_rate: number | null;
};

type LocationAnalyticsInput = {
  location: LocationOption;
  analytics: AnalyticsResponse | null;
};

export const WAIT_TARGET_MINUTES = 15;
const WAIT_ALERT_MINUTES = 18;
const WAIT_URGENT_MINUTES = 26;
const DROPOFF_ALERT_RATE = 0.12;
const DROPOFF_URGENT_RATE = 0.25;
const PRE_SERVICE_LOSS_RATE = 0.08;
const PRE_SERVICE_URGENT_RATE = 0.18;
const ZERO_VISIT_ALERT_SCORE = 45;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeRate(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    denominator <= 0
  ) {
    return null;
  }
  return numerator / denominator;
}

function averageOf(
  rows: LocationComparisonRow[],
  selector: (row: LocationComparisonRow) => number | null
) {
  const values = rows
    .map(selector)
    .filter((value): value is number => value !== null && !Number.isNaN(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compareNullable(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function formatPercent(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatCount(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatAdjustedCompletions(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const digits = Number.isInteger(value) ? 0 : 2;
  return formatCount(value, digits);
}

function formatMinutes(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)} minutes`;
}

function parseIsoDate(value: string) {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3) {
    return null;
  }
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftIsoDate(value: string, days: number) {
  const date = parseIsoDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

function getDateSpanInDays(dateStart: string, dateEnd: string) {
  const start = parseIsoDate(dateStart);
  const end = parseIsoDate(dateEnd);
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  if (Number.isNaN(diff)) return null;
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

function averageNumbers(values: Array<number | null | undefined>) {
  const definedValues = values.filter(
    (value): value is number => value !== null && value !== undefined && !Number.isNaN(value)
  );
  if (!definedValues.length) return null;
  return definedValues.reduce((sum, value) => sum + value, 0) / definedValues.length;
}

function resolveCountFromRate(
  explicitCount: number | null | undefined,
  rate: number | null | undefined,
  denominator: number | null | undefined
) {
  if (explicitCount !== null && explicitCount !== undefined && !Number.isNaN(explicitCount)) {
    return explicitCount;
  }
  if (
    rate === null ||
    rate === undefined ||
    Number.isNaN(rate) ||
    denominator === null ||
    denominator === undefined ||
    Number.isNaN(denominator)
  ) {
    return null;
  }
  return rate * denominator;
}

function getSegmentLeader(
  payingValue: number | null,
  priorityValue: number | null,
  higherIsBetter: boolean
): SegmentComparisonMetric['leading_segment'] {
  if (payingValue === null || priorityValue === null) {
    return 'none';
  }

  const difference = payingValue - priorityValue;
  if (Math.abs(difference) < 0.000001) {
    return 'tie';
  }

  if (higherIsBetter) {
    return difference > 0 ? 'paying' : 'priority_pass';
  }
  return difference < 0 ? 'paying' : 'priority_pass';
}

function buildSegmentMetric(
  key: SegmentComparisonMetric['key'],
  label: string,
  format: SegmentComparisonMetric['format'],
  higherIsBetter: boolean,
  payingValue: number | null,
  priorityValue: number | null
): SegmentComparisonMetric {
  return {
    key,
    label,
    format,
    higher_is_better: higherIsBetter,
    paying_value: payingValue,
    priority_value: priorityValue,
    gap_value:
      payingValue !== null && priorityValue !== null
        ? Math.abs(payingValue - priorityValue)
        : null,
    leading_segment: getSegmentLeader(payingValue, priorityValue, higherIsBetter),
  };
}

function buildSegmentMixInteractionRow(
  key: SegmentMixInteractionRow['key'],
  label: string,
  kpis: AnalyticsKpis,
  totalArrivals: number
): SegmentMixInteractionRow {
  const newTotal = resolveCountFromRate(
    kpis.new_customers_total,
    kpis.new_customers_rate,
    kpis.classified_customers_total
  );
  const repeatTotal = resolveCountFromRate(
    kpis.repeat_customers_total,
    kpis.repeat_customers_rate,
    kpis.classified_customers_total
  );
  const classifiedTotal =
    kpis.classified_customers_total ??
    (newTotal !== null && repeatTotal !== null ? newTotal + repeatTotal : null);
  const unclassifiedTotal =
    classifiedTotal !== null ? Math.max(kpis.arrivals_total - classifiedTotal, 0) : null;

  return {
    key,
    label,
    total: kpis.arrivals_total,
    share_of_arrivals: safeRate(kpis.arrivals_total, totalArrivals),
    new_total: newTotal,
    repeat_total: repeatTotal,
    classified_total: classifiedTotal,
    unclassified_total: unclassifiedTotal,
  };
}

export function buildTrailingAverageBaselineKpis(
  analytics: AnalyticsResponse
): AnalyticsPreviousKpis | null {
  const dateStart = analytics.filters.date_start;
  const dateEnd = analytics.filters.date_end;
  if (!dateStart || !dateEnd) return null;

  const totalDays = getDateSpanInDays(dateStart, dateEnd);
  if (!totalDays || totalDays <= 0) return null;

  const seriesByDate = new Map(analytics.series.map((row) => [row.local_date, row]));
  const dates = Array.from({ length: totalDays }, (_, index) => shiftIsoDate(dateStart, index)).filter(
    (value): value is string => Boolean(value)
  );

  if (!dates.length) return null;

  const averageCount = (
    selector: (row: AnalyticsSeriesRow) => number | null | undefined
  ) => {
    const total = dates.reduce((sum, date) => {
      const row = seriesByDate.get(date);
      return sum + (row ? selector(row) ?? 0 : 0);
    }, 0);
    return total / dates.length;
  };

  const averageMetric = (
    selector: (row: AnalyticsSeriesRow) => number | null | undefined
  ) =>
    averageNumbers(
      dates.map((date) => {
        const row = seriesByDate.get(date);
        return row ? selector(row) : null;
      })
    );

  return {
    arrivals_total: averageCount((row) => row.arrivals_total),
    completion_rate: averageMetric((row) => row.completion_rate),
    dropoff_rate: averageMetric((row) => row.dropoff_rate),
    average_queue_length: analytics.kpis.average_queue_length ?? null,
    utilization_rate: analytics.kpis.utilization_rate ?? null,
    wait_avg_minutes: averageMetric((row) => row.wait_avg_minutes),
    completed_total: averageCount((row) => row.completed_total),
    adjusted_completed_total:
      analytics.kpis.adjusted_completed_total !== null &&
      analytics.kpis.adjusted_completed_total !== undefined
        ? analytics.kpis.adjusted_completed_total / dates.length
        : null,
    cancelled_total: averageCount((row) => row.cancelled_total),
  };
}

export function buildSegmentComparisonModel(
  overallAnalytics: AnalyticsResponse,
  payingAnalytics: AnalyticsResponse,
  priorityAnalytics: AnalyticsResponse
): SegmentComparisonModel {
  const overallKpis = overallAnalytics.kpis;
  const payingKpis = payingAnalytics.kpis;
  const priorityKpis = priorityAnalytics.kpis;

  const totalLosses = payingKpis.cancelled_total + priorityKpis.cancelled_total;
  const totalArrivals = payingKpis.arrivals_total + priorityKpis.arrivals_total;

  const payingArrivalShare = safeRate(payingKpis.arrivals_total, totalArrivals);
  const priorityArrivalShare = safeRate(priorityKpis.arrivals_total, totalArrivals);
  const payingLossShare = safeRate(payingKpis.cancelled_total, totalLosses);
  const priorityLossShare = safeRate(priorityKpis.cancelled_total, totalLosses);

  const newTotal = resolveCountFromRate(
    overallKpis.new_customers_total,
    overallKpis.new_customers_rate,
    overallKpis.classified_customers_total ?? overallKpis.arrivals_total
  );
  const repeatTotal = resolveCountFromRate(
    overallKpis.repeat_customers_total,
    overallKpis.repeat_customers_rate,
    overallKpis.classified_customers_total ?? overallKpis.arrivals_total
  );
  const classifiedTotal =
    overallKpis.classified_customers_total ??
    (newTotal !== null && repeatTotal !== null ? newTotal + repeatTotal : null);
  const interactionRows: SegmentMixInteractionRow[] = [
    buildSegmentMixInteractionRow('paying', 'Paying', payingKpis, totalArrivals),
    buildSegmentMixInteractionRow('priority_pass', 'Non-paying', priorityKpis, totalArrivals),
  ];

  const metrics: SegmentComparisonMetric[] = [
    buildSegmentMetric(
      'wait',
      'Avg wait',
      'minutes',
      false,
      payingKpis.wait_avg_minutes,
      priorityKpis.wait_avg_minutes
    ),
    buildSegmentMetric(
      'completion',
      'Completion rate',
      'percent',
      true,
      payingKpis.completion_rate,
      priorityKpis.completion_rate
    ),
    buildSegmentMetric(
      'loss',
      'Overall loss rate',
      'percent',
      false,
      payingKpis.dropoff_rate,
      priorityKpis.dropoff_rate
    ),
    buildSegmentMetric(
      'time_in_system',
      'Time in system',
      'minutes',
      false,
      payingKpis.time_in_system_avg_minutes,
      priorityKpis.time_in_system_avg_minutes
    ),
    buildSegmentMetric(
      'repeat_share',
      'Repeat share',
      'percent',
      true,
      payingKpis.repeat_customers_rate,
      priorityKpis.repeat_customers_rate
    ),
  ];

  const insights: SegmentComparisonInsight[] = [];

  const waitMetric = metrics.find((metric) => metric.key === 'wait') ?? null;
  if (
    waitMetric &&
    waitMetric.gap_value !== null &&
    waitMetric.gap_value >= 2 &&
    waitMetric.leading_segment !== 'none' &&
    waitMetric.leading_segment !== 'tie'
  ) {
    const betterLabel = waitMetric.leading_segment === 'paying' ? 'Paying' : 'Non-paying';
    const worseLabel = waitMetric.leading_segment === 'paying' ? 'Non-paying' : 'Paying';
    insights.push({
      title: 'Wait gap',
      detail: `${worseLabel} customers wait ${formatMinutes(
        waitMetric.gap_value,
        1
      )} longer on average than ${betterLabel.toLowerCase()} customers.`,
      tone: 'attention',
    });
  }

  const payingLossOverShare =
    payingLossShare !== null && payingArrivalShare !== null
      ? payingLossShare - payingArrivalShare
      : null;
  const priorityLossOverShare =
    priorityLossShare !== null && priorityArrivalShare !== null
      ? priorityLossShare - priorityArrivalShare
      : null;

  if (
    priorityLossOverShare !== null &&
    priorityLossOverShare >= 0.05 &&
    priorityLossShare !== null &&
    priorityArrivalShare !== null
  ) {
    insights.push({
      title: 'Loss is concentrated in non-paying visits',
      detail: `Non-paying customers make up ${formatPercent(
        priorityLossShare,
        0
      )} of losses on ${formatPercent(priorityArrivalShare, 0)} of arrivals.`,
      tone: 'attention',
    });
  } else if (
    payingLossOverShare !== null &&
    payingLossOverShare >= 0.05 &&
    payingLossShare !== null &&
    payingArrivalShare !== null
  ) {
    insights.push({
      title: 'Loss is concentrated in paying visits',
      detail: `Paying customers make up ${formatPercent(
        payingLossShare,
        0
      )} of losses on ${formatPercent(payingArrivalShare, 0)} of arrivals.`,
      tone: 'watch',
    });
  }

  const repeatMetric = metrics.find((metric) => metric.key === 'repeat_share') ?? null;
  if (
    repeatMetric &&
    repeatMetric.gap_value !== null &&
    repeatMetric.gap_value >= 0.05 &&
    repeatMetric.leading_segment !== 'none' &&
    repeatMetric.leading_segment !== 'tie'
  ) {
    const leadingLabel = repeatMetric.leading_segment === 'paying' ? 'Paying' : 'Non-paying';
    const trailingLabel = repeatMetric.leading_segment === 'paying' ? 'non-paying' : 'paying';
    insights.push({
      title: 'Repeat mix differs by segment',
      detail: `${leadingLabel} customers have a ${formatPercent(
        repeatMetric.gap_value,
        0
      )} higher repeat share than ${trailingLabel} customers.`,
      tone: 'watch',
    });
  }

  if (!insights.length) {
    insights.push({
      title: 'Segment gaps are narrow',
      detail: 'Paying and non-paying customers are currently moving through the system with no standout experience or loss gap.',
      tone: 'good',
    });
  }

  return {
    mix: {
      paying_total: overallKpis.arrivals_paying,
      priority_total: overallKpis.arrivals_non_paying,
      new_total: newTotal,
      repeat_total: repeatTotal,
      classified_total: classifiedTotal,
      interaction_rows: interactionRows,
    },
    loss_share: {
      paying: payingLossShare,
      priority: priorityLossShare,
    },
    metrics,
    insights,
  };
}

function getLocationSeverity(
  row: Omit<LocationComparisonRow, 'attention_score' | 'issue_label' | 'severity'>
) {
  if (row.arrivals_total === 0) {
    return 'attention' as const;
  }
  if (
    (row.wait_avg_minutes ?? 0) >= WAIT_URGENT_MINUTES ||
    (row.wait_delta ?? 0) >= 8 ||
    (row.dropoff_rate ?? 0) >= DROPOFF_URGENT_RATE ||
    (row.dropoff_delta ?? 0) >= 0.08 ||
    (row.before_service_loss_rate ?? 0) >= PRE_SERVICE_URGENT_RATE
  ) {
    return 'urgent' as const;
  }
  if (
    (row.wait_avg_minutes ?? 0) >= WAIT_ALERT_MINUTES ||
    (row.wait_delta ?? 0) >= 4 ||
    (row.dropoff_rate ?? 0) >= DROPOFF_ALERT_RATE ||
    (row.dropoff_delta ?? 0) >= 0.03 ||
    (row.before_service_loss_rate ?? 0) >= PRE_SERVICE_LOSS_RATE ||
    (row.completion_delta ?? 0) <= -0.06
  ) {
    return 'attention' as const;
  }
  if (
    (row.wait_avg_minutes ?? 0) > WAIT_TARGET_MINUTES ||
    (row.wait_delta ?? 0) >= 2 ||
    (row.dropoff_rate ?? 0) >= 0.08 ||
    (row.dropoff_delta ?? 0) >= 0.02 ||
    (row.before_service_loss_rate ?? 0) >= 0.05 ||
    (row.completion_delta ?? 0) <= -0.03
  ) {
    return 'watch' as const;
  }
  return 'stable' as const;
}

function getLocationIssueLabel(
  row: Omit<LocationComparisonRow, 'attention_score' | 'issue_label' | 'severity'>
) {
  if (row.arrivals_total === 0) {
    return 'No visits';
  }
  if ((row.wait_avg_minutes ?? 0) >= WAIT_ALERT_MINUTES || (row.wait_delta ?? 0) >= 4) {
    return 'Wait above target';
  }
  if ((row.wait_avg_minutes ?? 0) > WAIT_TARGET_MINUTES || (row.wait_delta ?? 0) >= 2) {
    return 'Wait watch';
  }
  if ((row.dropoff_rate ?? 0) >= DROPOFF_ALERT_RATE || (row.dropoff_delta ?? 0) >= 0.03) {
    return 'Overall loss above normal';
  }
  if ((row.dropoff_rate ?? 0) >= 0.08 || (row.dropoff_delta ?? 0) >= 0.02) {
    return 'Overall loss watch';
  }
  if ((row.before_service_loss_rate ?? 0) >= PRE_SERVICE_LOSS_RATE) {
    return 'Before-service loss';
  }
  if ((row.before_service_loss_rate ?? 0) >= 0.05) {
    return 'Before-service watch';
  }
  if ((row.completion_delta ?? 0) <= -0.03) {
    return 'Completion softening';
  }
  if ((row.completion_delta ?? 0) <= -0.02) {
    return 'Completion watch';
  }
  return 'Stable';
}

function scoreLocation(
  row: Omit<LocationComparisonRow, 'attention_score' | 'issue_label' | 'severity'>
) {
  if (row.arrivals_total === 0) {
    return ZERO_VISIT_ALERT_SCORE;
  }

  let score = 0;

  if (row.wait_avg_minutes !== null) {
    score += clamp((row.wait_avg_minutes - WAIT_TARGET_MINUTES) * 3.5, 0, 35);
  }
  if (row.dropoff_rate !== null) {
    score += clamp((row.dropoff_rate - 0.08) * 220, 0, 35);
  }
  if (row.before_service_loss_rate !== null) {
    score += clamp(row.before_service_loss_rate * 180, 0, 20);
  }
  if (row.completion_delta !== null && row.completion_delta < 0) {
    score += clamp(Math.abs(row.completion_delta) * 220, 0, 15);
  }
  if (row.wait_delta !== null && row.wait_delta > 0) {
    score += clamp(row.wait_delta * 2, 0, 15);
  }
  if (row.dropoff_delta !== null && row.dropoff_delta > 0) {
    score += clamp(row.dropoff_delta * 180, 0, 15);
  }

  return Math.round(score * 10) / 10;
}

export function getWindowDays(filters: AnalyticsFilters) {
  if (!filters.date_start || !filters.date_end) return 1;
  const start = new Date(`${filters.date_start}T00:00:00Z`).getTime();
  const end = new Date(`${filters.date_end}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function getStoryMode(filters: AnalyticsFilters): StoryMode {
  const windowDays = getWindowDays(filters);
  if (windowDays <= 1) return 'single_day';
  if (windowDays <= 31) return 'multi_day';
  return 'long_range';
}

export function buildLocationComparisonRows(inputs: LocationAnalyticsInput[]) {
  return inputs.map(({ location, analytics }) => {
    const kpis = analytics?.kpis;
    const previous = analytics?.previous_period?.kpis ?? null;

    const baseRow = {
      location_id: location.id,
      location_name: location.display_name,
      airport_code: location.airport_code,
      code: location.code,
      arrivals_total: kpis?.arrivals_total ?? 0,
      served_total: kpis?.served_total ?? 0,
      completed_total: kpis?.completed_total ?? 0,
      adjusted_completed_total: kpis?.adjusted_completed_total ?? null,
      cancelled_total: kpis?.cancelled_total ?? 0,
      cancelled_before_served_total: kpis?.cancelled_before_served_total ?? 0,
      completion_rate: kpis?.completion_rate ?? null,
      dropoff_rate: kpis?.dropoff_rate ?? null,
      average_queue_length: kpis?.average_queue_length ?? null,
      utilization_rate: kpis?.utilization_rate ?? null,
      wait_avg_minutes: kpis?.wait_avg_minutes ?? null,
      time_in_system_avg_minutes: kpis?.time_in_system_avg_minutes ?? null,
      paying_share: safeRate(kpis?.arrivals_paying ?? 0, kpis?.arrivals_total ?? 0),
      repeat_share: kpis?.repeat_customers_rate ?? null,
      service_conversion_rate: safeRate(kpis?.served_total ?? 0, kpis?.arrivals_total ?? 0),
      before_service_loss_rate: safeRate(
        kpis?.cancelled_before_served_total ?? 0,
        kpis?.arrivals_total ?? 0
      ),
      arrivals_delta:
        previous && previous.arrivals_total !== undefined
          ? (kpis?.arrivals_total ?? 0) - previous.arrivals_total
          : null,
      completed_delta:
        previous && previous.completed_total !== undefined
          ? (kpis?.completed_total ?? 0) - previous.completed_total
          : null,
      adjusted_completed_delta:
        previous?.adjusted_completed_total !== null &&
        previous?.adjusted_completed_total !== undefined &&
        kpis?.adjusted_completed_total !== null &&
        kpis?.adjusted_completed_total !== undefined
          ? kpis.adjusted_completed_total - previous.adjusted_completed_total
          : null,
      completion_delta:
        previous?.completion_rate !== null &&
        previous?.completion_rate !== undefined &&
        kpis?.completion_rate !== null &&
        kpis?.completion_rate !== undefined
          ? kpis.completion_rate - previous.completion_rate
          : null,
      wait_delta:
        previous?.wait_avg_minutes !== null &&
        previous?.wait_avg_minutes !== undefined &&
        kpis?.wait_avg_minutes !== null &&
        kpis?.wait_avg_minutes !== undefined
          ? kpis.wait_avg_minutes - previous.wait_avg_minutes
          : null,
      dropoff_delta:
        previous?.dropoff_rate !== null &&
        previous?.dropoff_rate !== undefined &&
        kpis?.dropoff_rate !== null &&
        kpis?.dropoff_rate !== undefined
          ? kpis.dropoff_rate - previous.dropoff_rate
          : null,
      average_queue_length_delta:
        previous?.average_queue_length !== null &&
        previous?.average_queue_length !== undefined &&
        kpis?.average_queue_length !== null &&
        kpis?.average_queue_length !== undefined
          ? kpis.average_queue_length - previous.average_queue_length
          : null,
      utilization_delta:
        previous?.utilization_rate !== null &&
        previous?.utilization_rate !== undefined &&
        kpis?.utilization_rate !== null &&
        kpis?.utilization_rate !== undefined
          ? kpis.utilization_rate - previous.utilization_rate
          : null,
    };

    return {
      ...baseRow,
      attention_score: scoreLocation(baseRow),
      issue_label: getLocationIssueLabel(baseRow),
      severity: getLocationSeverity(baseRow),
    };
  });
}

export function buildChainComparisonSummary(
  rows: LocationComparisonRow[]
): ChainComparisonSummary | null {
  if (!rows.length) return null;

  const visibleLocations = rows.length;
  const activeLocations = rows.filter((row) => row.arrivals_total > 0).length;
  const arrivalsTotal = rows.reduce((sum, row) => sum + row.arrivals_total, 0);
  const servedTotal = rows.reduce((sum, row) => sum + row.served_total, 0);
  const completedTotal = rows.reduce((sum, row) => sum + row.completed_total, 0);
  const cancelledTotal = rows.reduce((sum, row) => sum + row.cancelled_total, 0);
  const cancelledBeforeServedTotal = rows.reduce(
    (sum, row) => sum + row.cancelled_before_served_total,
    0
  );

  const weightedWaitTotal = rows.reduce((sum, row) => {
    if (row.wait_avg_minutes === null || row.served_total <= 0) {
      return sum;
    }
    return sum + row.wait_avg_minutes * row.served_total;
  }, 0);

  return {
    visible_locations: visibleLocations,
    active_locations: activeLocations,
    arrivals_total: arrivalsTotal,
    arrivals_average_per_location: arrivalsTotal / visibleLocations,
    served_total: servedTotal,
    completed_total: completedTotal,
    cancelled_total: cancelledTotal,
    cancelled_before_served_total: cancelledBeforeServedTotal,
    completion_rate: safeRate(completedTotal, arrivalsTotal),
    dropoff_rate: safeRate(cancelledTotal, arrivalsTotal),
    wait_avg_minutes:
      servedTotal > 0 ? weightedWaitTotal / servedTotal : null,
    before_service_loss_rate: safeRate(cancelledBeforeServedTotal, arrivalsTotal),
  };
}

export function sortLocationComparisonRows(
  rows: LocationComparisonRow[],
  sortKey: LocationSortKey,
  direction: SortDirection
) {
  const factor = direction === 'asc' ? 1 : -1;
  const sorted = [...rows].sort((left, right) => {
    switch (sortKey) {
      case 'completed':
        return factor * (left.completed_total - right.completed_total);
      case 'adjusted_completed':
        return factor * compareNullable(left.adjusted_completed_total, right.adjusted_completed_total);
      case 'completion':
        return factor * compareNullable(left.completion_rate, right.completion_rate);
      case 'wait':
        return factor * compareNullable(left.wait_avg_minutes, right.wait_avg_minutes);
      case 'utilization':
        return factor * compareNullable(left.utilization_rate, right.utilization_rate);
      case 'queue_length':
        return factor * compareNullable(left.average_queue_length, right.average_queue_length);
      case 'attention':
      default:
        return factor * (left.attention_score - right.attention_score);
    }
  });

  if (sortKey === 'attention' && direction === 'desc') {
    sorted.sort((left, right) => {
      if (right.attention_score === left.attention_score) {
        return right.arrivals_total - left.arrivals_total;
      }
      return right.attention_score - left.attention_score;
    });
  }

  return sorted;
}

export function buildExecutiveSummary(
  analytics: AnalyticsResponse,
  rows: LocationComparisonRow[],
  scopeLabel: string,
  comparisonLabel = 'the previous period'
): ExecutiveSummary {
  const kpis = analytics.kpis;
  const previous = analytics.previous_period?.kpis ?? null;
  const currentWait = kpis.wait_avg_minutes ?? null;
  const currentDropoff = kpis.dropoff_rate ?? null;
  const currentCompletion = kpis.completion_rate ?? null;
  const currentAdjustedCompletions = kpis.adjusted_completed_total ?? null;
  const previousAdjustedCompletions = previous?.adjusted_completed_total ?? null;
  const priorityShare = safeRate(kpis.arrivals_non_paying, kpis.arrivals_total);
  const waitDelta =
    previous?.wait_avg_minutes !== null &&
    previous?.wait_avg_minutes !== undefined &&
    currentWait !== null
      ? currentWait - previous.wait_avg_minutes
      : null;
  const completionDelta =
    previous?.completion_rate !== null &&
    previous?.completion_rate !== undefined &&
    currentCompletion !== null
      ? currentCompletion - previous.completion_rate
      : null;
  const dropoffDelta =
    previous?.dropoff_rate !== null &&
    previous?.dropoff_rate !== undefined &&
    currentDropoff !== null
      ? currentDropoff - previous.dropoff_rate
      : null;
  const adjustedCompletionsDelta =
    previousAdjustedCompletions !== null &&
    previousAdjustedCompletions !== undefined &&
    currentAdjustedCompletions !== null
      ? currentAdjustedCompletions - previousAdjustedCompletions
      : null;
  const noVisitsInScope = kpis.arrivals_total === 0;

  const watchLocation = sortLocationComparisonRows(rows, 'attention', 'desc')[0] ?? null;
  const bestLocation = [...rows]
    .filter((row) => row.arrivals_total > 0)
    .sort((left, right) => {
      const completionDiff =
        compareNullable(right.completion_rate, left.completion_rate);
      if (completionDiff !== 0) return completionDiff;
      const waitDiff = compareNullable(left.wait_avg_minutes, right.wait_avg_minutes);
      if (waitDiff !== 0) return waitDiff;
      return compareNullable(left.dropoff_rate, right.dropoff_rate);
    })[0] ?? null;

  const chainWaitAverage = averageOf(rows, (row) => row.wait_avg_minutes);
  const chainDropoffAverage = averageOf(rows, (row) => row.dropoff_rate);
  const watchLocationSeverity = watchLocation?.severity ?? 'stable';

  const signals: ExecutiveSignal[] = [];

  if (watchLocation && watchLocation.issue_label === 'No visits') {
    signals.push({
      title: `${watchLocation.location_name} recorded 0 settled visits in this window.`,
      detail: `Adjusted completions at ${watchLocation.location_name} were 0 in the same period.`,
      tone: 'attention',
    });
  } else if (
    watchLocation &&
    watchLocation.issue_label !== 'Stable' &&
    watchLocation.attention_score >= 12
  ) {
    const waitGap =
      chainWaitAverage !== null && watchLocation.wait_avg_minutes !== null
        ? watchLocation.wait_avg_minutes - chainWaitAverage
        : null;
    const dropoffGap =
      chainDropoffAverage !== null && watchLocation.dropoff_rate !== null
        ? watchLocation.dropoff_rate - chainDropoffAverage
        : null;
    signals.push({
      title:
        waitGap !== null && waitGap > 0
          ? `${watchLocation.location_name} averaged ${formatMinutes(
              watchLocation.wait_avg_minutes,
              1
            )} of wait time.`
          : dropoffGap !== null && dropoffGap > 0
            ? `${watchLocation.location_name} recorded ${formatPercent(
                watchLocation.dropoff_rate
              )} overall loss.`
            : watchLocation.completion_rate !== null
              ? `${watchLocation.location_name} completed ${formatPercent(
                  watchLocation.completion_rate
                )} of settled visits.`
              : `${watchLocation.location_name} recorded ${formatCount(
                  watchLocation.arrivals_total
                )} settled visits.`,
      detail:
        waitGap !== null && waitGap > 0
          ? `${formatMinutes(waitGap, 1)} above the current chain wait average${
              watchLocation.completion_rate !== null
                ? `, with ${formatPercent(watchLocation.completion_rate)} completion.`
                : '.'
            }`
          : dropoffGap !== null && dropoffGap > 0
            ? `${formatPercent(dropoffGap, 1)} above the current chain overall loss average${
                watchLocation.wait_avg_minutes !== null
                  ? `, with ${formatMinutes(watchLocation.wait_avg_minutes, 1)} average wait.`
                  : '.'
              }`
            : watchLocation.completion_delta !== null && watchLocation.completion_delta < 0
              ? `${formatPercent(Math.abs(watchLocation.completion_delta), 1)} below ${comparisonLabel}.`
              : `${watchLocation.issue_label}.`,
      tone:
        watchLocationSeverity === 'urgent'
          ? 'urgent'
          : watchLocationSeverity === 'attention'
            ? 'attention'
            : 'watch',
    });
  }

  if (!noVisitsInScope && currentWait !== null) {
    const waitTargetGap = currentWait - WAIT_TARGET_MINUTES;
    signals.push({
      title:
        waitTargetGap >= 0
          ? `Average wait was ${formatMinutes(currentWait, 1)}, ${formatMinutes(
              waitTargetGap,
              1
            )} above the ${WAIT_TARGET_MINUTES}-minute target.`
          : `Average wait was ${formatMinutes(currentWait, 1)}, ${formatMinutes(
              Math.abs(waitTargetGap),
              1
            )} below the ${WAIT_TARGET_MINUTES}-minute target.`,
      detail:
        waitDelta !== null
          ? `That is ${waitDelta >= 0 ? 'up' : 'down'} ${formatMinutes(
              Math.abs(waitDelta),
              1
            )} versus ${comparisonLabel}.`
          : `Based on visits that reached service in ${scopeLabel}.`,
      tone:
        currentWait >= WAIT_URGENT_MINUTES
          ? 'urgent'
          : currentWait >= WAIT_ALERT_MINUTES
            ? 'attention'
            : currentWait > WAIT_TARGET_MINUTES
              ? 'watch'
            : 'good',
    });
  }

  if (!noVisitsInScope && currentDropoff !== null) {
    signals.push({
      title:
        dropoffDelta !== null
          ? `Overall loss rate was ${formatPercent(currentDropoff)}, ${
              dropoffDelta >= 0 ? 'up' : 'down'
            } ${formatPercent(Math.abs(dropoffDelta), 1)} versus ${comparisonLabel}.`
          : `Overall loss rate was ${formatPercent(currentDropoff)} in this window.`,
      detail:
        currentDropoff >= DROPOFF_ALERT_RATE
          ? `${formatPercent(currentDropoff)} of settled visits in ${scopeLabel} ended in cancellation or no-show${
              chainDropoffAverage !== null
                ? ` versus a ${formatPercent(chainDropoffAverage)} location average.`
                : '.'
            }`
          : `${formatPercent(currentDropoff)} of settled visits in ${scopeLabel} ended in cancellation or no-show.`,
      tone:
        currentDropoff >= DROPOFF_URGENT_RATE
          ? 'urgent'
          : currentDropoff >= DROPOFF_ALERT_RATE
            ? 'attention'
            : currentDropoff >= 0.08
              ? 'watch'
              : 'good',
    });
  }

  if (bestLocation && bestLocation.location_name !== watchLocation?.location_name) {
    signals.push({
      title: `${bestLocation.location_name} completed ${
        bestLocation.completion_rate === null
          ? 'no measured settled-visit baseline'
          : `${formatPercent(bestLocation.completion_rate)} of settled visits`
      }.`,
      detail: `${bestLocation.location_name} also recorded ${
        bestLocation.wait_avg_minutes === null
          ? 'no wait baseline'
          : `${formatMinutes(bestLocation.wait_avg_minutes)} average wait`
      } among locations with settled visits.`,
      tone: 'good',
    });
  }

  if (!noVisitsInScope && priorityShare !== null && priorityShare >= 0.45) {
    signals.push({
      title: `${formatPercent(priorityShare)} of settled visits were non-paying.`,
      detail: `Non-paying mix can shift wait, utilization, and adjusted-completion totals in this window.`,
      tone: 'watch',
    });
  }

  const status: ExecutiveSummary['status'] =
    (currentWait ?? 0) >= WAIT_URGENT_MINUTES ||
    (currentDropoff ?? 0) >= DROPOFF_URGENT_RATE ||
    watchLocationSeverity === 'urgent'
      ? 'urgent'
      : noVisitsInScope ||
          watchLocationSeverity === 'attention' ||
          (currentWait ?? 0) >= WAIT_ALERT_MINUTES ||
          (currentDropoff ?? 0) >= DROPOFF_ALERT_RATE
        ? 'attention'
        : watchLocationSeverity === 'watch' ||
            (currentWait ?? 0) > WAIT_TARGET_MINUTES ||
            (waitDelta ?? 0) > 2 ||
            (dropoffDelta ?? 0) > 0.02 ||
            (completionDelta ?? 0) < -0.03
          ? 'watch'
          : 'healthy';

  const headline =
    noVisitsInScope
      ? `Adjusted completions totaled 0 because no settled visits were recorded in this window.`
      : currentAdjustedCompletions !== null
        ? adjustedCompletionsDelta !== null && Math.abs(adjustedCompletionsDelta) >= 0.01
          ? `Adjusted completions totaled ${formatAdjustedCompletions(
              currentAdjustedCompletions
            )}, ${adjustedCompletionsDelta >= 0 ? 'up' : 'down'} ${formatAdjustedCompletions(
              Math.abs(adjustedCompletionsDelta)
            )} versus ${comparisonLabel}.`
          : `Adjusted completions totaled ${formatAdjustedCompletions(
              currentAdjustedCompletions
            )} in this window.`
        : currentCompletion !== null
          ? `Completion rate was ${formatPercent(currentCompletion)} in this window.`
          : `Executive summary unavailable for ${scopeLabel} in this window.`;

  const summaryParts = [
    `Completed visits totaled ${formatCount(kpis.completed_total)}`,
    currentCompletion !== null
      ? `${formatPercent(currentCompletion)} completion`
      : null,
    currentWait !== null ? `${formatMinutes(currentWait)} average wait` : null,
    currentDropoff !== null
      ? `${formatPercent(currentDropoff)} overall loss rate`
      : null,
  ].filter(Boolean);

  const locationNote =
    watchLocation?.issue_label === 'No visits'
      ? `${watchLocation.location_name} recorded 0 settled visits.`
      : watchLocation &&
          chainWaitAverage !== null &&
          watchLocation.wait_avg_minutes !== null &&
          watchLocation.wait_avg_minutes > chainWaitAverage
        ? `${watchLocation.location_name} averaged ${formatMinutes(
            watchLocation.wait_avg_minutes,
            1
          )}, ${formatMinutes(watchLocation.wait_avg_minutes - chainWaitAverage, 1)} above the current chain wait average.`
        : watchLocation &&
            chainDropoffAverage !== null &&
            watchLocation.dropoff_rate !== null &&
            watchLocation.dropoff_rate > chainDropoffAverage
          ? `${watchLocation.location_name} recorded ${formatPercent(
              watchLocation.dropoff_rate
            )} overall loss, ${formatPercent(
              watchLocation.dropoff_rate - chainDropoffAverage,
              1
            )} above the current chain average.`
          : null;

  return {
    status,
    headline,
    summary: noVisitsInScope
      ? `${scopeLabel} recorded zero settled visits in the selected window, so completion, wait, and overall loss are unavailable.`
      : `${scopeLabel} recorded ${summaryParts.join(', ')}.${
          locationNote ? ` ${locationNote}` : ''
        }`,
    primary_driver: watchLocation?.location_name ?? null,
    best_location: bestLocation?.location_name ?? null,
    watch_location: watchLocation?.location_name ?? null,
    signals: signals.slice(0, 4),
  };
}
