'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { ResponsiveCard, Button, LoadingSpinner } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { toLocationSlug } from '@/lib/locationSlug';
import {
  WAIT_TARGET_MINUTES,
  buildSegmentComparisonModel,
  buildTrailingAverageBaselineKpis,
  buildExecutiveSummary,
  buildLocationComparisonRows,
  getStoryMode,
  sortLocationComparisonRows,
  type ExecutiveSummary,
  type LocationComparisonRow,
  type LocationSortKey,
  type SegmentComparisonModel,
  type SortDirection,
} from './dashboardModel';

type EmployeeProfile = {
  role: 'employee' | 'admin';
  is_open: boolean;
};

type LocationOption = {
  id: string;
  display_name: string;
  airport_code: string;
  code: string;
};

type AnalyticsFilters = {
  location_id: string | null;
  date_start: string | null;
  date_end: string | null;
  customer_type: 'paying' | 'priority_pass' | null;
};

type AnalyticsKpis = {
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

type AnalyticsSeriesRow = {
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

type AnalyticsHourlyRow = {
  hour_of_day: number;
  arrivals_total: number;
  served_total: number;
  wait_avg_minutes: number | null;
};

type AnalyticsPreviousKpis = {
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

type AnalyticsPreviousPeriod = {
  date_start: string | null;
  date_end: string | null;
  kpis: AnalyticsPreviousKpis | null;
};

type AnalyticsResponse = {
  filters: AnalyticsFilters;
  kpis: AnalyticsKpis;
  series: AnalyticsSeriesRow[];
  hourly_series: AnalyticsHourlyRow[];
  previous_period: AnalyticsPreviousPeriod | null;
};

type SegmentAnalyticsPair = {
  paying: AnalyticsResponse | null;
  priority: AnalyticsResponse | null;
};

type DailyRepeatShareRow = {
  local_date: string;
  arrivals_total: number;
  repeat_total: number | null;
  repeat_share: number | null;
  classified_total: number | null;
};

type DatePreset =
  | 'latest'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'last_180'
  | 'last_365'
  | 'all_time';

type CustomerFilter = 'all' | 'paying' | 'priority_pass';
type ComparisonMode = 'previous_period' | 'trailing_30_day_average';
type ComparisonReference = {
  mode: ComparisonMode;
  longLabel: string;
  chipLabel: string;
};

const DATE_PRESETS: { value: DatePreset; label: string; days?: number }[] = [
  { value: 'latest', label: 'Latest settled day' },
  { value: 'last_7', label: 'Last 7 days', days: 7 },
  { value: 'last_30', label: 'Last 30 days', days: 30 },
  { value: 'last_90', label: 'Last 3 months', days: 90 },
  { value: 'last_180', label: 'Last 6 months', days: 180 },
  { value: 'last_365', label: 'Last year', days: 365 },
  { value: 'all_time', label: 'All time' },
];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function subtractDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function resolveDateRange(preset: DatePreset): { start: string | null; end: string | null } {
  if (preset === 'latest') {
    return { start: null, end: null };
  }

  const today = new Date();
  const end = formatLocalDate(today);

  if (preset === 'all_time') {
    return { start: '2000-01-01', end };
  }

  const days = DATE_PRESETS.find((option) => option.value === preset)?.days ?? 7;
  const start = formatLocalDate(subtractDays(today, days - 1));
  return { start, end };
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${formatNumber(value * 100, 0)}%`;
}

function formatMinutesShort(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${formatNumber(value, digits)} min`;
}

function formatAdjustedCompletions(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  const digits = Number.isInteger(value) ? 0 : 2;
  return formatNumber(value, digits);
}

function formatSignedRatePoints(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : '−'}${formatNumber(Math.abs(value * 100), digits)}%`;
}

function getNiceTickStep(range: number, targetTickCount = 4): number {
  const roughStep = Math.max(range, 1) / Math.max(targetTickCount, 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function buildNiceAxis(maxValue: number, minValue = 0, targetTickCount = 4) {
  const range = Math.max(maxValue - minValue, 1);
  const step = getNiceTickStep(range, targetTickCount);
  const start = Math.floor(minValue / step) * step;
  const resolvedMax = Math.max(start + step, Math.ceil(maxValue / step) * step);
  const ticks: number[] = [];

  for (let tick = start; tick <= resolvedMax + step / 2; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return {
    resolvedMax,
    step,
    ticks,
  };
}

function buildRepeatShareAxis(maxShare: number) {
  const paddedMax = Math.max(maxShare * 1.1, 0.1);
  const candidates = [0.2, 0.4, 0.5, 0.6, 0.8, 1];
  const resolvedMax = candidates.find((candidate) => paddedMax <= candidate) ?? 1;

  return {
    resolvedMax,
    ticks: [resolvedMax / 2, resolvedMax],
  };
}

function getAdaptiveBarChartLayout(
  totalBars: number,
  leftPadding: number,
  rightPadding: number
) {
  const safeTotalBars = Math.max(totalBars, 1);
  const baseWidth = 860;
  const preferredSlotWidth =
    safeTotalBars <= 7
      ? 78
      : safeTotalBars <= 14
        ? 52
        : safeTotalBars <= 31
          ? 30
          : safeTotalBars <= 90
            ? 18
            : safeTotalBars <= 180
              ? 14
              : 10;
  const width = Math.max(
    baseWidth,
    leftPadding + rightPadding + safeTotalBars * preferredSlotWidth
  );
  const chartWidth = width - leftPadding - rightPadding;
  const slotWidth = chartWidth / safeTotalBars;
  const maxBarWidth =
    safeTotalBars <= 7 ? 68 : safeTotalBars <= 14 ? 36 : safeTotalBars <= 31 ? 18 : 12;
  const barWidth = Math.max(3, Math.min(maxBarWidth, slotWidth * 0.56));
  const labelCount =
    safeTotalBars <= 14
      ? safeTotalBars
      : Math.min(
          safeTotalBars,
          Math.max(7, Math.min(12, Math.floor(chartWidth / 125)))
        );

  return {
    width,
    chartWidth,
    slotWidth,
    barWidth,
    xLabelIndexes: getVisibleCategoryIndexes(safeTotalBars, labelCount),
  };
}

function getVisibleCategoryIndexes(totalCount: number, desiredCount = 7) {
  if (totalCount <= 0) return [];
  if (totalCount <= desiredCount) {
    return Array.from({ length: totalCount }, (_, index) => index);
  }
  return [...new Set(
    Array.from({ length: desiredCount }, (_, index) =>
      Math.round((index * (totalCount - 1)) / Math.max(desiredCount - 1, 1))
    )
  )].sort((left, right) => left - right);
}

function formatResolvedWindowLabel(dateStart: string | null, dateEnd: string | null): string {
  if (!dateStart || !dateEnd) return 'Latest settled day';
  if (dateStart === dateEnd) return formatHumanDate(dateStart);
  return `${formatHumanDate(dateStart)} – ${formatHumanDate(dateEnd)}`;
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

function formatHumanDate(value: string | null) {
  if (!value) return '—';
  const date = parseIsoDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function shiftIsoDate(value: string, days: number) {
  const date = parseIsoDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

function buildDateSequence(dateStart: string | null, dateEnd: string | null, maxDays = 120) {
  const totalDays = getDateSpanInDays(dateStart, dateEnd);
  if (!dateStart || !dateEnd || !totalDays || totalDays <= 0 || totalDays > maxDays) {
    return null;
  }

  return Array.from({ length: totalDays }, (_, index) => shiftIsoDate(dateStart, index)).filter(
    (value): value is string => Boolean(value)
  );
}

function getDateSpanInDays(dateStart: string | null, dateEnd: string | null) {
  if (!dateStart || !dateEnd) return null;
  const start = parseIsoDate(dateStart);
  const end = parseIsoDate(dateEnd);
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  if (Number.isNaN(diff)) return null;
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

function getTrailingThirtyDayWindow(dateStart: string | null, dateEnd: string | null) {
  if (!dateStart || !dateEnd || dateStart !== dateEnd) {
    return null;
  }

  const baselineEnd = shiftIsoDate(dateStart, -1);
  if (!baselineEnd) return null;

  const baselineStart = shiftIsoDate(baselineEnd, -29);
  if (!baselineStart) return null;

  return {
    start: baselineStart,
    end: baselineEnd,
  };
}

function applyComparisonBaseline(
  analytics: AnalyticsResponse,
  previousPeriod: AnalyticsPreviousPeriod | null
) {
  return {
    ...analytics,
    previous_period: previousPeriod,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getChartPointX(
  index: number,
  totalPoints: number,
  chartLeft: number,
  chartWidth: number
): number {
  if (totalPoints <= 1) return chartLeft + chartWidth / 2;
  return chartLeft + (index / (totalPoints - 1)) * chartWidth;
}

function getChartPointY(
  value: number,
  chartTop: number,
  chartHeight: number,
  minValue: number,
  maxValue: number
): number {
  const span = Math.max(maxValue - minValue, Number.EPSILON);
  return chartTop + chartHeight - ((value - minValue) / span) * chartHeight;
}

function buildLinePath(
  values: Array<number | null | undefined>,
  chartLeft: number,
  chartTop: number,
  chartWidth: number,
  chartHeight: number,
  minValue: number,
  maxValue: number
): string {
  if (!values.length) return '';
  const span = Math.max(maxValue - minValue, 1);
  let path = '';

  values.forEach((value, index) => {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    const x =
      values.length === 1
        ? chartLeft + chartWidth / 2
        : chartLeft + (index / (values.length - 1)) * chartWidth;
    const y =
      chartTop + chartHeight - ((value - minValue) / span) * chartHeight;
    path += path ? ` L ${x} ${y}` : `M ${x} ${y}`;
  });

  return path;
}

function resolveRepeatCount(kpis: AnalyticsKpis) {
  if (
    kpis.repeat_customers_total !== null &&
    kpis.repeat_customers_total !== undefined &&
    !Number.isNaN(kpis.repeat_customers_total)
  ) {
    return kpis.repeat_customers_total;
  }

  if (
    kpis.repeat_customers_rate === null ||
    kpis.repeat_customers_rate === undefined ||
    Number.isNaN(kpis.repeat_customers_rate) ||
    kpis.classified_customers_total === null ||
    kpis.classified_customers_total === undefined ||
    Number.isNaN(kpis.classified_customers_total)
  ) {
    return null;
  }

  return kpis.repeat_customers_rate * kpis.classified_customers_total;
}

function buildTopRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (width <= 0 || height <= 0) return '';

  const resolvedRadius = Math.max(0, Math.min(radius, width / 2, height));
  const right = x + width;
  const bottom = y + height;

  if (resolvedRadius === 0) {
    return `M ${x} ${bottom} L ${x} ${y} L ${right} ${y} L ${right} ${bottom} Z`;
  }

  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + resolvedRadius}`,
    `Q ${x} ${y} ${x + resolvedRadius} ${y}`,
    `L ${right - resolvedRadius} ${y}`,
    `Q ${right} ${y} ${right} ${y + resolvedRadius}`,
    `L ${right} ${bottom}`,
    'Z',
  ].join(' ');
}

type TrendBadgeProps = {
  current: number | null | undefined;
  previous: number | null | undefined;
  higherIsBetter?: boolean;
  isRate?: boolean;
  neutral?: boolean;
  absoluteUnit?: string;
  absoluteDigits?: number;
};

function TrendBadge({
  current,
  previous,
  higherIsBetter = true,
  isRate = false,
  neutral = false,
  absoluteUnit,
  absoluteDigits = 1,
}: TrendBadgeProps) {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    Number.isNaN(current) ||
    Number.isNaN(previous)
  ) {
    return <span className="text-xs text-slate-400">No comparison baseline</span>;
  }

  const diff = current - previous;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';

  const isImproving =
    direction === 'flat'
      ? true
      : higherIsBetter
        ? direction === 'up'
        : direction === 'down';

  const toneClass = neutral
    ? 'text-slate-500'
    : isImproving
      ? 'text-emerald-700'
      : 'text-red-600';

  const label = isRate
    ? `${arrow} ${formatNumber(Math.abs(diff * 100), 1)}%`
    : absoluteUnit
      ? `${arrow} ${formatNumber(Math.abs(diff), absoluteDigits)} ${absoluteUnit}`
    : previous === 0
      ? `${arrow} ${formatNumber(diff, 1)}`
      : `${arrow} ${Math.abs((diff / Math.abs(previous)) * 100).toFixed(0)}%`;

  return <span className={`text-xs font-medium ${toneClass}`}>{label}</span>;
}

type CompactDeltaProps = {
  delta: number | null | undefined;
  higherIsBetter?: boolean;
  isRate?: boolean;
  suffix?: string;
  neutral?: boolean;
  digits?: number;
};

function CompactDelta({
  delta,
  higherIsBetter = true,
  isRate = false,
  suffix = '',
  neutral = false,
  digits = 1,
}: CompactDeltaProps) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return <span className="text-[11px] text-slate-400">No baseline</span>;
  }

  const isImproving = neutral ? true : higherIsBetter ? delta >= 0 : delta <= 0;
  const toneClass = neutral
    ? 'text-slate-500'
    : isImproving
      ? 'text-emerald-700'
      : 'text-rose-700';

  const label = isRate
    ? formatSignedRatePoints(delta)
    : `${delta >= 0 ? '+' : '−'}${formatNumber(Math.abs(delta), digits)}${suffix}`;

  return <span className={`text-[11px] font-medium ${toneClass}`}>{label}</span>;
}

type KpiCardProps = {
  label: string;
  value: string;
  trend: ReactNode;
};

function KpiCard({ label, value, trend }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-[0.6rem] uppercase tracking-[0.24em] text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
      <div className="mt-1.5">{trend}</div>
    </div>
  );
}

type ThroughputArrivalsServedChartProps = {
  rows: AnalyticsSeriesRow[];
};

function ThroughputArrivalsServedChart({ rows }: ThroughputArrivalsServedChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!rows.length) {
    return <p className="text-sm text-slate-500">No daily demand data available.</p>;
  }

  const height = 300;
  const leftPadding = 64;
  const rightPadding = 92;
  const topPadding = 24;
  const bottomPadding = 44;
  const chartHeight = height - topPadding - bottomPadding;
  const arrivalsValues = rows.map((row) => row.arrivals_total);
  const axis = buildNiceAxis(Math.max(1, ...arrivalsValues), 0, 4);
  const axisDigits = axis.step < 1 ? 1 : 0;
  const totalBars = rows.length;
  const { width, slotWidth, barWidth, xLabelIndexes } = getAdaptiveBarChartLayout(
    totalBars,
    leftPadding,
    rightPadding
  );

  const hoveredRow = hoverIndex === null ? null : (rows[hoverIndex] ?? null);
  const hoverX =
    hoverIndex === null ? null : leftPadding + hoverIndex * slotWidth + slotWidth / 2;
  const tooltipWidth = 196;
  const tooltipHeight = 84;
  const tooltipX =
    hoverX === null
      ? null
      : clampNumber(
          hoverX + 12,
          leftPadding + 6,
          width - rightPadding - tooltipWidth
        );
  const tooltipY = topPadding + 8;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div
          className="h-72 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
          style={{ width: `${width}px`, minWidth: '100%' }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full"
            role="img"
            aria-label="Daily settled visits split between completed visits and overall loss"
          >
          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={leftPadding}
                x2={width - rightPadding}
                y1={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax)}
                y2={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax)}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={leftPadding - 8}
                y={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax) + 4}
                textAnchor="end"
                fill="#475569"
                fontSize="12"
              >
                {formatNumber(tick, axisDigits)}
              </text>
            </g>
          ))}

          <line
            x1={leftPadding}
            x2={leftPadding}
            y1={topPadding}
            y2={height - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.25"
          />
          <line
            x1={leftPadding}
            x2={width - rightPadding}
            y1={height - bottomPadding}
            y2={height - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.25"
          />

          <text
            x={leftPadding}
            y={topPadding - 8}
            fill="#334155"
            fontSize="12"
            fontWeight="600"
          >
            Settled visits
          </text>
          <text
            x={width / 2}
            y={height - 6}
            fill="#475569"
            fontSize="12"
            textAnchor="middle"
          >
            Day in selected window
          </text>

          {rows.map((row, index) => {
            const x = leftPadding + index * slotWidth + (slotWidth - barWidth) / 2;
            const completedHeight =
              row.completed_total > 0
                ? (row.completed_total / axis.resolvedMax) * chartHeight
                : 0;
            const lossHeight =
              row.cancelled_total > 0
                ? (row.cancelled_total / axis.resolvedMax) * chartHeight
                : 0;
            const completedY = topPadding + chartHeight - completedHeight;
            const lossY = completedY - lossHeight;
            return (
              <g key={`stacked-bar-${row.local_date}`}>
                {completedHeight > 0 ? (
                  lossHeight > 0 ? (
                    <rect
                      x={x}
                      y={completedY}
                      width={barWidth}
                      height={completedHeight}
                      fill="#16a34a"
                    />
                  ) : (
                    <path
                      d={buildTopRoundedRectPath(x, completedY, barWidth, completedHeight, 6)}
                      fill="#16a34a"
                    />
                  )
                ) : null}
                {lossHeight > 0 ? (
                  <path
                    d={buildTopRoundedRectPath(x, lossY, barWidth, lossHeight, 6)}
                    fill="#dc2626"
                  />
                ) : null}
              </g>
            );
          })}

          {xLabelIndexes.map((index) => {
            const label = rows[index]?.local_date;
            const shortLabel = label
              ? (() => {
                  const parts = label.split('-');
                  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : label;
                })()
              : '—';
            const x = leftPadding + index * slotWidth + slotWidth / 2;
            return (
              <g key={`x-label-${label ?? index}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={height - bottomPadding}
                  y2={height - bottomPadding + 6}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - bottomPadding + 20}
                  textAnchor="middle"
                  fill="#475569"
                  fontSize="11"
                  fontWeight="500"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}

          {hoverX !== null ? (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={topPadding}
              y2={height - bottomPadding}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          ) : null}

          {hoveredRow !== null && tooltipX !== null && hoverX !== null ? (
            <g>
              <rect
                x={tooltipX}
                y={tooltipY}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                ry="8"
                fill="#ffffff"
                stroke="#cbd5e1"
              />
              <text x={tooltipX + 10} y={tooltipY + 18} fill="#475569" fontSize="11">
                {hoveredRow.local_date}
              </text>
              <text x={tooltipX + 10} y={tooltipY + 38} fill="#15803d" fontSize="12">
                Settled visits: {formatNumber(hoveredRow.arrivals_total)}
              </text>
              <text x={tooltipX + 10} y={tooltipY + 55} fill="#dc2626" fontSize="12">
                Overall loss: {formatNumber(hoveredRow.cancelled_total)}
              </text>
              <text x={tooltipX + 10} y={tooltipY + 72} fill="#475569" fontSize="11">
                Loss rate: {formatPercent(hoveredRow.dropoff_rate)}
              </text>
            </g>
          ) : null}

          {rows.map((row, index) => {
            const xCenter = leftPadding + index * slotWidth + slotWidth / 2;
            const hitWidth = slotWidth;
            const rectX = clampNumber(
              xCenter - hitWidth / 2,
              leftPadding,
              width - rightPadding - hitWidth
            );

            return (
              <rect
                key={`hit-${row.local_date}`}
                x={rectX}
                y={topPadding}
                width={hitWidth}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-600" />
          Completed visits
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-600" />
          Overall loss
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Each bar equals settled visits created that day, split into completed visits and overall losses.
      </p>
    </div>
  );
}

type DailyWaitBarChartProps = {
  rows: AnalyticsSeriesRow[];
  targetMinutes?: number;
};

function DailyWaitBarChart({
  rows,
  targetMinutes = WAIT_TARGET_MINUTES,
}: DailyWaitBarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!rows.length) {
    return <p className="text-sm text-slate-500">No daily wait data available.</p>;
  }

  const height = 300;
  const leftPadding = 64;
  const rightPadding = 24;
  const topPadding = 24;
  const bottomPadding = 44;
  const chartHeight = height - topPadding - bottomPadding;
  const values = rows.map((row) => row.wait_avg_minutes);
  const numericValues = values.filter(
    (value): value is number => value !== null && value !== undefined
  );

  if (!numericValues.length) {
    return <p className="text-sm text-slate-500">No daily wait data available.</p>;
  }

  const axis = buildNiceAxis(Math.max(1, targetMinutes, ...numericValues), 0, 4);
  const axisDigits = axis.step < 1 ? 1 : axis.step % 1 === 0 ? 0 : 1;
  const totalBars = rows.length;
  const { width, slotWidth, barWidth, xLabelIndexes } = getAdaptiveBarChartLayout(
    totalBars,
    leftPadding,
    rightPadding
  );
  const thresholdY = getChartPointY(
    targetMinutes,
    topPadding,
    chartHeight,
    0,
    axis.resolvedMax
  );

  const hoveredRow = hoverIndex === null ? null : (rows[hoverIndex] ?? null);
  const hoverX =
    hoverIndex === null ? null : leftPadding + hoverIndex * slotWidth + slotWidth / 2;
  const tooltipWidth = 170;
  const tooltipHeight = 56;
  const tooltipX =
    hoverX === null
      ? null
      : clampNumber(
          hoverX + 12,
          leftPadding + 6,
          width - rightPadding - tooltipWidth
        );
  const tooltipY = topPadding + 8;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div
          className="h-72 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
          style={{ width: `${width}px`, minWidth: '100%' }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full"
            role="img"
            aria-label="Daily average wait time"
          >
          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={leftPadding}
                x2={width - rightPadding}
                y1={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax)}
                y2={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax)}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={leftPadding - 8}
                y={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax) + 4}
                textAnchor="end"
                fill="#475569"
                fontSize="12"
              >
                {formatMinutesShort(tick, axisDigits)}
              </text>
            </g>
          ))}

          <line
            x1={leftPadding}
            x2={leftPadding}
            y1={topPadding}
            y2={height - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.25"
          />
          <line
            x1={leftPadding}
            x2={width - rightPadding}
            y1={height - bottomPadding}
            y2={height - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.25"
          />

          <line
            x1={leftPadding}
            x2={width - rightPadding}
            y1={thresholdY}
            y2={thresholdY}
            stroke="#f59e0b"
            strokeDasharray="6 4"
            strokeWidth="1.5"
          />
          <text
            x={width - rightPadding + 12}
            y={thresholdY - 6}
            textAnchor="start"
            fill="#b45309"
            fontSize="11"
            fontWeight="600"
          >
            Target {targetMinutes} min
          </text>

          <text
            x={leftPadding}
            y={topPadding - 8}
            fill="#334155"
            fontSize="12"
            fontWeight="600"
          >
            Minutes
          </text>
          <text
            x={width / 2}
            y={height - 6}
            fill="#475569"
            fontSize="12"
            textAnchor="middle"
          >
            Day in selected window
          </text>

          {rows.map((row, index) => {
            if (row.wait_avg_minutes === null || row.wait_avg_minutes === undefined) {
              return null;
            }
            const x = leftPadding + index * slotWidth + (slotWidth - barWidth) / 2;
            const barHeight = (row.wait_avg_minutes / axis.resolvedMax) * chartHeight;
            const y = topPadding + chartHeight - barHeight;
            return (
              <rect
                key={`wait-bar-${row.local_date}`}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="6"
                ry="6"
                fill={row.wait_avg_minutes <= targetMinutes ? '#16a34a' : '#dc2626'}
              />
            );
          })}

          {xLabelIndexes.map((index) => {
            const label = rows[index]?.local_date;
            const shortLabel = label
              ? (() => {
                  const parts = label.split('-');
                  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : label;
                })()
              : '—';
            const x = leftPadding + index * slotWidth + slotWidth / 2;
            return (
              <g key={`wait-x-label-${label ?? index}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={height - bottomPadding}
                  y2={height - bottomPadding + 6}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - bottomPadding + 20}
                  textAnchor="middle"
                  fill="#475569"
                  fontSize="11"
                  fontWeight="500"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}

          {hoverX !== null ? (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={topPadding}
              y2={height - bottomPadding}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          ) : null}

          {hoveredRow !== null &&
          hoveredRow.wait_avg_minutes !== null &&
          tooltipX !== null ? (
            <g>
              <rect
                x={tooltipX}
                y={tooltipY}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                ry="8"
                fill="#ffffff"
                stroke="#cbd5e1"
              />
              <text x={tooltipX + 10} y={tooltipY + 19} fill="#475569" fontSize="11">
                {hoveredRow.local_date}
              </text>
              <text
                x={tooltipX + 10}
                y={tooltipY + 39}
                fill={hoveredRow.wait_avg_minutes <= targetMinutes ? '#15803d' : '#dc2626'}
                fontSize="12"
              >
                Avg wait: {formatMinutesShort(hoveredRow.wait_avg_minutes, 1)}
              </text>
            </g>
          ) : null}

          {rows.map((row, index) => {
            const xCenter = leftPadding + index * slotWidth + slotWidth / 2;
            const hitWidth = slotWidth;
            const rectX = clampNumber(
              xCenter - hitWidth / 2,
              leftPadding,
              width - rightPadding - hitWidth
            );

            return (
              <rect
                key={`wait-hit-${row.local_date}`}
                x={rectX}
                y={topPadding}
                width={hitWidth}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-600" />
          At or under target
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-600" />
          Above target
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 bg-amber-500" />
          {targetMinutes}-minute target
        </span>
      </div>
    </div>
  );
}

type DailyRepeatShareBarChartProps = {
  rows: DailyRepeatShareRow[];
};

function DailyRepeatShareBarChart({ rows }: DailyRepeatShareBarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!rows.length) {
    return <p className="text-sm text-slate-500">No repeat-share trend data available.</p>;
  }

  const width = 860;
  const height = 290;
  const leftPadding = 64;
  const rightPadding = 24;
  const topPadding = 24;
  const bottomPadding = 44;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;
  const numericShares = rows
    .map((row) => row.repeat_share)
    .filter((value): value is number => value !== null && value !== undefined);

  if (!numericShares.length) {
    return <p className="text-sm text-slate-500">No repeat-share trend data available.</p>;
  }

  const axis = buildRepeatShareAxis(Math.max(0, ...numericShares));
  const totalBars = rows.length;
  const slotWidth = chartWidth / Math.max(totalBars, 1);
  const barWidth = Math.min(
    totalBars <= 7 ? 52 : 30,
    Math.max(8, slotWidth * 0.58)
  );
  const xLabelIndexes = getVisibleCategoryIndexes(rows.length, rows.length <= 7 ? rows.length : 7);

  const hoveredRow = hoverIndex === null ? null : (rows[hoverIndex] ?? null);
  const hoverX =
    hoverIndex === null ? null : leftPadding + hoverIndex * slotWidth + slotWidth / 2;
  const tooltipWidth = 220;
  const tooltipHeight = 72;
  const tooltipX =
    hoverX === null
      ? null
      : clampNumber(
          hoverX + 12,
          leftPadding + 6,
          width - rightPadding - tooltipWidth
        );
  const tooltipY = topPadding + 8;

  return (
    <div className="space-y-3">
      <div className="h-72 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          role="img"
          aria-label="Daily repeat customer share"
        >
          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={leftPadding}
                x2={width - rightPadding}
                y1={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax)}
                y2={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax)}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={leftPadding - 8}
                y={getChartPointY(tick, topPadding, chartHeight, 0, axis.resolvedMax) + 4}
                textAnchor="end"
                fill="#334155"
                fontSize="12"
                fontWeight="600"
              >
                {formatPercent(tick)}
              </text>
            </g>
          ))}

          <line
            x1={leftPadding}
            x2={leftPadding}
            y1={topPadding}
            y2={height - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.25"
          />
          <line
            x1={leftPadding}
            x2={width - rightPadding}
            y1={height - bottomPadding}
            y2={height - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.25"
          />

          <text
            x={leftPadding}
            y={topPadding - 8}
            fill="#334155"
            fontSize="12"
            fontWeight="600"
          >
            Repeat share (% of daily customers)
          </text>
          <text
            x={width / 2}
            y={height - 6}
            fill="#334155"
            fontSize="12"
            fontWeight="500"
            textAnchor="middle"
          >
            Date in selected analysis window
          </text>

          {rows.map((row, index) => {
            if (row.repeat_share === null || row.repeat_share === undefined) {
              return null;
            }
            const x = leftPadding + index * slotWidth + (slotWidth - barWidth) / 2;
            const barHeight = (row.repeat_share / axis.resolvedMax) * chartHeight;
            const y = topPadding + chartHeight - barHeight;
            return (
              <rect
                key={`repeat-share-bar-${row.local_date}`}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="6"
                ry="6"
                fill="#6366f1"
              />
            );
          })}

          {xLabelIndexes.map((index) => {
            const label = rows[index]?.local_date;
            const shortLabel = label
              ? (() => {
                  const parts = label.split('-');
                  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : label;
                })()
              : '—';
            const x = leftPadding + index * slotWidth + slotWidth / 2;
            return (
              <g key={`repeat-share-x-label-${label ?? index}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={height - bottomPadding}
                  y2={height - bottomPadding + 6}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - bottomPadding + 20}
                  textAnchor="middle"
                  fill="#334155"
                  fontSize="11"
                  fontWeight="600"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}

          {hoverX !== null ? (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={topPadding}
              y2={height - bottomPadding}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          ) : null}

          {hoveredRow !== null && tooltipX !== null ? (
            <g>
              <rect
                x={tooltipX}
                y={tooltipY}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                ry="8"
                fill="#ffffff"
                stroke="#cbd5e1"
              />
              <text x={tooltipX + 10} y={tooltipY + 19} fill="#475569" fontSize="11">
                {hoveredRow.local_date}
              </text>
              {hoveredRow.repeat_share !== null ? (
                <>
                  <text
                    x={tooltipX + 10}
                    y={tooltipY + 39}
                    fill="#4338ca"
                    fontSize="12"
                  >
                    Repeat share: {formatPercent(hoveredRow.repeat_share)}
                  </text>
                  <text
                    x={tooltipX + 10}
                    y={tooltipY + 57}
                    fill="#64748b"
                    fontSize="11"
                  >
                    {formatNumber(hoveredRow.repeat_total)} repeat of {formatNumber(
                      hoveredRow.arrivals_total
                    )} total
                  </text>
                </>
              ) : (
                <text
                  x={tooltipX + 10}
                  y={tooltipY + 39}
                  fill="#64748b"
                  fontSize="12"
                >
                  No settled visits on this date
                </text>
              )}
            </g>
          ) : null}

          {rows.map((row, index) => {
            const xCenter = leftPadding + index * slotWidth + slotWidth / 2;
            const hitWidth = slotWidth;
            const rectX = clampNumber(
              xCenter - hitWidth / 2,
              leftPadding,
              width - rightPadding - hitWidth
            );

            return (
              <rect
                key={`repeat-share-hit-${row.local_date}`}
                x={rectX}
                y={topPadding}
                width={hitWidth}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function SegmentInteractionChart({
  model,
  totalArrivals,
}: {
  model: SegmentComparisonModel;
  totalArrivals: number;
}) {
  const rows = model.mix.interaction_rows;
  const payingRow = rows.find((row) => row.key === 'paying') ?? null;
  const nonPayingRow = rows.find((row) => row.key === 'priority_pass') ?? null;
  const overallUnclassified =
    model.mix.classified_total !== null
      ? Math.max(totalArrivals - model.mix.classified_total, 0)
      : null;

  const categories = [
    {
      key: 'paying',
      label: 'Paying',
      total: payingRow?.total ?? 0,
      share: payingRow?.share_of_arrivals ?? null,
      classifiedTotal: payingRow?.classified_total ?? null,
      newValue: payingRow?.new_total ?? null,
      repeatValue: payingRow?.repeat_total ?? null,
    },
    {
      key: 'priority_pass',
      label: 'Non-paying',
      total: nonPayingRow?.total ?? 0,
      share: nonPayingRow?.share_of_arrivals ?? null,
      classifiedTotal: nonPayingRow?.classified_total ?? null,
      newValue: nonPayingRow?.new_total ?? null,
      repeatValue: nonPayingRow?.repeat_total ?? null,
    },
  ] as const;

  const withinShare = (
    numerator: number | null | undefined,
    denominator: number | null | undefined
  ) => {
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
  };

  const payingNewShare = withinShare(payingRow?.new_total ?? null, payingRow?.classified_total ?? null);
  const payingRepeatShare = withinShare(
    payingRow?.repeat_total ?? null,
    payingRow?.classified_total ?? null
  );
  const nonPayingNewShare = withinShare(
    nonPayingRow?.new_total ?? null,
    nonPayingRow?.classified_total ?? null
  );
  const nonPayingRepeatShare = withinShare(
    nonPayingRow?.repeat_total ?? null,
    nonPayingRow?.classified_total ?? null
  );

  const axis = {
    resolvedMax: 1,
    ticks: [0, 0.25, 0.5, 0.75, 1],
  };
  const width = 700;
  const height = 250;
  const leftPadding = 60;
  const rightPadding = 116;
  const topPadding = 20;
  const bottomPadding = 52;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;
  const categoryPositions = categories.map((_category, index) =>
    getChartPointX(index, categories.length, leftPadding, chartWidth)
  );

  const series = [
    {
      key: 'new',
      label: 'New',
      color: '#0ea5e9',
      values: categories.map((category) =>
        withinShare(category.newValue, category.classifiedTotal)
      ),
    },
    {
      key: 'repeat',
      label: 'Repeat',
      color: '#6366f1',
      values: categories.map((category) =>
        withinShare(category.repeatValue, category.classifiedTotal)
      ),
    },
  ] as const;

  const repeatGap =
    payingRepeatShare !== null && nonPayingRepeatShare !== null
      ? payingRepeatShare - nonPayingRepeatShare
      : null;
  const bothSkewNew =
    payingNewShare !== null &&
    nonPayingNewShare !== null &&
    payingNewShare >= 0.5 &&
    nonPayingNewShare >= 0.5;
  const bothSkewRepeat =
    payingRepeatShare !== null &&
    nonPayingRepeatShare !== null &&
    payingRepeatShare >= 0.5 &&
    nonPayingRepeatShare >= 0.5;
  const takeaway = (() => {
    if (repeatGap === null || payingRepeatShare === null || nonPayingRepeatShare === null) {
      return 'New versus repeat mix is shown as the share of classified visits within each payment segment.';
    }

    if (Math.abs(repeatGap) < 0.05) {
      return `Repeat share is similar across payment types: ${formatPercent(
        payingRepeatShare
      )} of classified paying visits are repeat versus ${formatPercent(
        nonPayingRepeatShare
      )} of classified non-paying visits.`;
    }

    const leadingSegment = repeatGap > 0 ? 'paying' : 'non-paying';
    const leadingShare = repeatGap > 0 ? payingRepeatShare : nonPayingRepeatShare;
    const trailingShare = repeatGap > 0 ? nonPayingRepeatShare : payingRepeatShare;
    const intensity =
      Math.abs(repeatGap) >= 0.2
        ? 'materially'
        : Math.abs(repeatGap) >= 0.1
          ? 'noticeably'
          : 'slightly';

    if (bothSkewNew) {
      return `Both payment segments skew new, but repeat customers are ${intensity} more common in ${leadingSegment} visits: ${formatPercent(
        leadingShare
      )} versus ${formatPercent(trailingShare)}.`;
    }

    if (bothSkewRepeat) {
      return `Both payment segments lean repeat, with ${leadingSegment} visits carrying the stronger repeat mix: ${formatPercent(
        leadingShare
      )} versus ${formatPercent(trailingShare)}.`;
    }

    return `Payment type changes the mix: repeat customers are ${intensity} more common in ${leadingSegment} visits at ${formatPercent(
      leadingShare
    )}, versus ${formatPercent(trailingShare)} in the other segment.`;
  })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
            Payment type × customer history
          </p>
          <h4 className="mt-1 text-base font-semibold text-slate-900">
            How customer history shifts within paying and non-paying visits
          </h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The x-axis compares payment type. Each line shows one customer-history group, and the y-axis shows its share within that payment segment.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {formatNumber(totalArrivals)} total arrivals
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-slate-700">
        <span className="font-semibold text-slate-900">Takeaway:</span> {takeaway}
      </p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-64 w-full"
          role="img"
          aria-label="Interaction plot comparing payment type with new and repeat customer shares within each payment segment"
        >
          {axis.ticks.map((tick) => {
            const y = getChartPointY(
              tick,
              topPadding,
              chartHeight,
              0,
              axis.resolvedMax
            );
            return (
              <g key={tick}>
                <line
                  x1={leftPadding}
                  x2={width - rightPadding}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={tick === 0 ? 1.4 : 1}
                />
                <text
                  x={leftPadding - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#475569"
                  fontSize="12"
                  fontWeight="500"
                >
                  {formatPercent(tick)}
                </text>
              </g>
            );
          })}

          <line
            x1={leftPadding}
            x2={leftPadding}
            y1={topPadding}
            y2={height - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.4"
          />
          <text
            x={leftPadding}
            y={topPadding - 8}
            fill="#475569"
            fontSize="12"
            fontWeight="600"
          >
            Share within payment type
          </text>

          {series.map((item) => {
            const path = buildLinePath(
              item.values,
              leftPadding,
              topPadding,
              chartWidth,
              chartHeight,
              0,
              axis.resolvedMax
            );

            return path ? (
              <path
                key={`${item.key}-line`}
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null;
          })}

          {series.map((item) =>
            item.values.map((value, index) => {
              if (value === null || Number.isNaN(value)) return null;
              const x = categoryPositions[index] ?? leftPadding;
              const y = getChartPointY(
                value,
                topPadding,
                chartHeight,
                0,
                axis.resolvedMax
              );
              const isNewSeries = item.key === 'new';
              const pointLabelY = isNewSeries ? Math.max(topPadding + 12, y - 12) : y + 20;

              return (
                <g key={`${item.key}-${categories[index]?.key ?? index}`}>
                  <circle cx={x} cy={y} r={5.5} fill={item.color} stroke="#ffffff" strokeWidth="2" />
                  <text
                    x={index === item.values.length - 1 ? x + 12 : x}
                    y={index === item.values.length - 1 ? y + 4 : pointLabelY}
                    textAnchor={index === item.values.length - 1 ? 'start' : 'middle'}
                    fill="#0f172a"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {index === item.values.length - 1
                      ? `${item.label} ${formatPercent(value)}`
                      : formatPercent(value)}
                  </text>
                </g>
              );
            })
          )}

          {categories.map((category, index) => {
            const x = categoryPositions[index] ?? leftPadding;
            return (
              <g key={category.key}>
                <line
                  x1={x}
                  x2={x}
                  y1={height - bottomPadding}
                  y2={height - bottomPadding + 6}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />
                <text
                  x={x}
                  y={height - bottomPadding + 22}
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="13"
                  fontWeight="700"
                >
                  {category.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {categories.map((category) => (
          <span key={category.key}>
            <span className="font-semibold text-slate-800">{category.label}:</span>{' '}
            {formatNumber(category.total)} arrivals · {formatPercent(category.share)} of all arrivals
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Read it left to right: if the lines stay close together, new and repeat customers are distributed similarly across payment types. The farther apart the lines are, the more payment type changes the new-versus-repeat mix.
        {overallUnclassified !== null && overallUnclassified > 0.5
          ? ` ${formatNumber(overallUnclassified)} arrivals in this window could not be classified as new or repeat, so they are excluded from the plotted points.`
          : ''}
      </p>
    </div>
  );
}

function formatSegmentMetricValue(
  metric: SegmentComparisonModel['metrics'][number],
  value: number | null
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  if (metric.format === 'minutes') {
    return formatMinutesShort(value, 1);
  }

  return formatPercent(value);
}

function getSegmentMetricDirectionLabel(
  metric: SegmentComparisonModel['metrics'][number]
) {
  return metric.higher_is_better ? 'Higher is better' : 'Lower is better';
}

function getSegmentMetricScaleMax(
  metric: SegmentComparisonModel['metrics'][number]
) {
  const values = [metric.paying_value, metric.priority_value].filter(
    (value): value is number => value !== null && value !== undefined && !Number.isNaN(value)
  );

  if (!values.length) {
    return 1;
  }

  return buildNiceAxis(Math.max(0.01, ...values), 0, 4).resolvedMax;
}

function getSegmentMetricTrackWidth(
  metric: SegmentComparisonModel['metrics'][number],
  value: number | null
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0%';
  }

  const scaleMax = getSegmentMetricScaleMax(metric);
  return `${clampNumber((value / scaleMax) * 100, 0, 100)}%`;
}

function getSegmentMetricCellTone(
  metric: SegmentComparisonModel['metrics'][number],
  side: 'paying' | 'priority_pass'
) {
  const isLeader = metric.leading_segment === side;
  const isTie = metric.leading_segment === 'tie';

  if (isLeader) {
    return {
      panel: 'border-emerald-200 bg-emerald-50/80',
      value: 'text-emerald-800',
      marker: side === 'paying' ? 'bg-sky-500' : 'bg-violet-500',
      indicator: 'bg-emerald-500',
    };
  }

  if (isTie) {
    return {
      panel: 'border-slate-200 bg-slate-50/70',
      value: 'text-slate-900',
      marker: 'bg-slate-400',
      indicator: 'bg-slate-400',
    };
  }

  return {
    panel: 'border-slate-200 bg-white',
    value: 'text-slate-900',
    marker: side === 'paying' ? 'bg-sky-500' : 'bg-violet-500',
    indicator: 'bg-transparent',
  };
}

function getSummaryToneClasses(status: ExecutiveSummary['status']) {
  if (status === 'healthy') {
    return {
      panel: 'border-emerald-200 bg-[linear-gradient(135deg,#f4fff8_0%,#ecfdf5_100%)]',
    };
  }
  return {
    panel: 'border-rose-300 bg-[linear-gradient(135deg,#fff5f5_0%,#ffe4e6_100%)]',
  };
}

function getSignalToneClasses(tone: 'good' | 'watch' | 'attention' | 'urgent') {
  if (tone === 'urgent') {
    return 'border-rose-100 bg-rose-50 text-rose-800';
  }
  if (tone === 'attention') {
    return 'border-orange-100 bg-orange-50 text-orange-800';
  }
  if (tone === 'watch') {
    return 'border-amber-100 bg-amber-50 text-amber-800';
  }
  return 'border-emerald-100 bg-emerald-50 text-emerald-800';
}

function getSeverityBadgeClasses(severity: LocationComparisonRow['severity']) {
  if (severity === 'urgent') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (severity === 'attention') {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }
  if (severity === 'watch') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function getLocationStatusPillLabel(issueLabel: string) {
  if (issueLabel === 'Stable') return 'Within range';
  if (issueLabel === 'Wait watch') return 'Wait rising';
  if (issueLabel === 'Overall loss watch') return 'Overall loss rising';
  if (issueLabel === 'Before-service watch') return 'Before-service loss rising';
  if (issueLabel === 'Completion watch') return 'Completion softening';
  return issueLabel;
}

type LocationComparisonTableProps = {
  rows: LocationComparisonRow[];
  selectedLocationId: string;
  sortKey: LocationSortKey;
  sortDirection: SortDirection;
  onSort: (key: LocationSortKey) => void;
};

function LocationComparisonTable({
  rows,
  selectedLocationId,
  sortKey,
  sortDirection,
  onSort,
}: LocationComparisonTableProps) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No location comparison data available.</p>;
  }

  const headers: Array<{
    key?: LocationSortKey;
    label: string;
    align?: 'left' | 'right';
  }> = [
    { label: 'Location' },
    { key: 'attention', label: 'Status' },
    { key: 'completed', label: 'Completed Visits', align: 'right' },
    { key: 'adjusted_completed', label: 'Adjusted Completions', align: 'right' },
    { key: 'completion', label: 'Completion Rate', align: 'right' },
    { key: 'wait', label: 'Avg wait', align: 'right' },
    { key: 'utilization', label: 'Utilization Rate', align: 'right' },
    { key: 'queue_length', label: 'Avg Queue Length', align: 'right' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50/90">
          <tr className="border-b border-slate-200 text-[0.65rem] uppercase tracking-[0.22em] text-slate-600">
            {headers.map((header) => {
              const isActive = header.key ? sortKey === header.key : false;
              const arrow = isActive ? (sortDirection === 'desc' ? '↓' : '↑') : '';
              return (
                <th
                  key={header.key ?? header.label}
                  className={`px-3 py-2.5 font-semibold ${header.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {header.key ? (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 text-inherit hover:text-slate-800 ${
                        isActive ? 'text-slate-800' : ''
                      }`}
                      onClick={() => onSort(header.key as LocationSortKey)}
                    >
                      <span>{header.label}</span>
                      <span>{arrow}</span>
                    </button>
                  ) : (
                    <span>{header.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedLocationId !== 'all' && row.location_id === selectedLocationId;
            return (
              <tr
                key={row.location_id}
                className={`border-b border-slate-100 align-top ${
                  isSelected ? 'bg-sky-50/70' : ''
                }`}
              >
                <td className={`px-3 py-2.5 ${isSelected ? 'border-l-4 border-sky-400 pl-2' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {row.location_name}
                    </p>
                    {isSelected ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        Selected
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${getSeverityBadgeClasses(
                      row.severity
                    )}`}
                  >
                    {getLocationStatusPillLabel(row.issue_label)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatNumber(row.completed_total)}
                  </div>
                  <CompactDelta delta={row.completed_delta} digits={0} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatAdjustedCompletions(row.adjusted_completed_total)}
                  </div>
                  <CompactDelta delta={row.adjusted_completed_delta} digits={2} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatPercent(row.completion_rate)}
                  </div>
                  <CompactDelta
                    delta={row.completion_delta}
                    isRate
                    higherIsBetter
                  />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatMinutesShort(row.wait_avg_minutes, 1)}
                  </div>
                  <CompactDelta
                    delta={row.wait_delta}
                    higherIsBetter={false}
                    suffix=" min"
                  />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatPercent(row.utilization_rate)}
                  </div>
                  <CompactDelta
                    delta={row.utilization_delta}
                    isRate
                    higherIsBetter
                  />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-sm font-semibold text-slate-900">
                    {row.average_queue_length === null
                      ? '—'
                      : formatNumber(row.average_queue_length, 1)}
                  </div>
                  <CompactDelta
                    delta={row.average_queue_length_delta}
                    higherIsBetter={false}
                    suffix=" cust"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const EMPTY_KPIS: AnalyticsKpis = {
  arrivals_total: 0,
  arrivals_paying: 0,
  arrivals_non_paying: 0,
  served_total: 0,
  completed_total: 0,
  adjusted_completed_total: null,
  cancelled_total: 0,
  cancelled_before_served_total: 0,
  completion_rate: null,
  dropoff_rate: null,
  average_queue_length: null,
  utilization_rate: null,
  wait_avg_minutes: null,
  time_in_system_avg_minutes: null,
  new_customers_rate: null,
  repeat_customers_rate: null,
};

type AnalyticsFetchOptions = {
  accessToken: string;
  signal: AbortSignal;
  locationId: string;
  customerType: CustomerFilter;
  dateStart: string | null;
  dateEnd: string | null;
  includeOperationalKpis?: boolean;
};

function normalizeAnalyticsResponse(candidate: Partial<AnalyticsResponse>): AnalyticsResponse {
  return {
    filters: candidate.filters ?? {
      location_id: null,
      date_start: null,
      date_end: null,
      customer_type: null,
    },
    kpis: {
      ...EMPTY_KPIS,
      ...(candidate.kpis ?? {}),
    },
    series: Array.isArray(candidate.series) ? (candidate.series as AnalyticsSeriesRow[]) : [],
    hourly_series: Array.isArray(candidate.hourly_series)
      ? (candidate.hourly_series as AnalyticsHourlyRow[])
      : [],
    previous_period:
      candidate.previous_period && typeof candidate.previous_period === 'object'
        ? (candidate.previous_period as AnalyticsPreviousPeriod)
        : null,
  };
}

function buildAnalyticsUrl(
  locationId: string,
  customerType: CustomerFilter,
  dateStart: string | null,
  dateEnd: string | null,
  includeOperationalKpis = false
) {
  const params = new URLSearchParams();
  if (locationId !== 'all') {
    params.set('locationId', locationId);
  }
  if (customerType !== 'all') {
    params.set('customerType', customerType);
  }
  if (dateStart && dateEnd) {
    params.set('dateStart', dateStart);
    params.set('dateEnd', dateEnd);
  }
  if (includeOperationalKpis) {
    params.set('includeOperationalKpis', '1');
  }

  return params.size ? `/api/analytics?${params.toString()}` : '/api/analytics';
}

async function fetchAnalyticsResponse({
  accessToken,
  signal,
  locationId,
  customerType,
  dateStart,
  dateEnd,
  includeOperationalKpis = false,
}: AnalyticsFetchOptions) {
  const response = await fetch(
    buildAnalyticsUrl(
      locationId,
      customerType,
      dateStart,
      dateEnd,
      includeOperationalKpis
    ),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    }
  );

  const rawText = await response.text();
  let payload: AnalyticsResponse | { error?: string } | null = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as AnalyticsResponse;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof (payload as { error?: string }).error === 'string' &&
        (payload as { error?: string }).error) ||
      'Failed to load analytics.';
    throw new Error(errorMessage);
  }

  if (!payload || typeof payload !== 'object' || !('kpis' in payload)) {
    throw new Error('Failed to load analytics.');
  }

  return normalizeAnalyticsResponse(payload as Partial<AnalyticsResponse>);
}

const supabase = getSupabaseBrowserClient();

export default function AnalyticsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedCustomerType, setSelectedCustomerType] =
    useState<CustomerFilter>('all');
  const [selectedDatePreset, setSelectedDatePreset] =
    useState<DatePreset>('latest');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(
    null
  );
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [comparisonError, setComparisonError] = useState('');
  const [segmentComparisonError, setSegmentComparisonError] = useState('');
  const [segmentAnalytics, setSegmentAnalytics] = useState<SegmentAnalyticsPair | null>(null);
  const [dailyRepeatShareRows, setDailyRepeatShareRows] = useState<DailyRepeatShareRow[]>([]);
  const [dailyRepeatShareLoading, setDailyRepeatShareLoading] = useState(false);
  const [dailyRepeatShareError, setDailyRepeatShareError] = useState('');
  const [locationComparisonRows, setLocationComparisonRows] = useState<
    LocationComparisonRow[]
  >([]);
  const [comparisonSortKey, setComparisonSortKey] =
    useState<LocationSortKey>('attention');
  const [comparisonSortDirection, setComparisonSortDirection] =
    useState<SortDirection>('desc');
  const [uiError, setUiError] = useState('');
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
  const router = useRouter();

  const currentUser = session?.user ?? null;
  const isAdmin = profile?.role === 'admin';
  const locationOptions = useMemo(() => {
    return locations.map((location) => ({
      ...location,
      slug: toLocationSlug(location.airport_code, location.code),
    }));
  }, [locations]);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('role,is_open')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      setAuthError(error.message);
      setProfile(null);
      return;
    }

    if (!data || !data.is_open || data.role !== 'admin') {
      setAccessDenied(true);
      setProfile(null);
      return;
    }

    setAccessDenied(false);
    setProfile({ role: data.role, is_open: data.is_open });
  }, []);

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id,display_name,airport_code,code')
      .eq('is_open', true)
      .order('airport_code', { ascending: true })
      .order('code', { ascending: true });

    if (error) {
      setUiError(error.message);
      return;
    }

    const loadedLocations = data ?? [];
    setLocations(loadedLocations);

  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    loadProfile(currentUser.id);
  }, [currentUser, loadProfile]);

  useEffect(() => {
    if (!isAdmin) return;
    loadLocations();
  }, [isAdmin, loadLocations]);

  const dateRange = useMemo(
    () => resolveDateRange(selectedDatePreset),
    [selectedDatePreset]
  );

  useEffect(() => {
    if (!isAdmin || !session?.access_token) return;

    const controller = new AbortController();

    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      setComparisonError('');
      setSegmentComparisonError('');
      setSegmentAnalytics(null);

      try {
        const primaryAnalytics = await fetchAnalyticsResponse({
          accessToken: session.access_token,
          signal: controller.signal,
          locationId: selectedLocationId,
          customerType: selectedCustomerType,
          dateStart: dateRange.start,
          dateEnd: dateRange.end,
          includeOperationalKpis: true,
        });

        if (controller.signal.aborted) return;

        const trailingBaselineWindow = getTrailingThirtyDayWindow(
          primaryAnalytics.filters.date_start,
          primaryAnalytics.filters.date_end
        );

        let baselineReadyForComparison =
          trailingBaselineWindow !== null;
        let primaryAnalyticsWithResolvedBaseline = primaryAnalytics;
        const shouldLoadSegmentComparison = selectedCustomerType === 'all';

        const segmentComparisonPromise = shouldLoadSegmentComparison
          ? Promise.allSettled([
              fetchAnalyticsResponse({
                accessToken: session.access_token,
                signal: controller.signal,
                locationId: selectedLocationId,
                customerType: 'paying',
                dateStart: primaryAnalytics.filters.date_start,
                dateEnd: primaryAnalytics.filters.date_end,
              }),
              fetchAnalyticsResponse({
                accessToken: session.access_token,
                signal: controller.signal,
                locationId: selectedLocationId,
                customerType: 'priority_pass',
                dateStart: primaryAnalytics.filters.date_start,
                dateEnd: primaryAnalytics.filters.date_end,
              }),
            ])
          : null;

        const applySegmentComparisonResults = (
          results: PromiseSettledResult<AnalyticsResponse>[] | null
        ) => {
          if (!results || !shouldLoadSegmentComparison) {
            setSegmentAnalytics(null);
            return;
          }

          const payingResult = results[0];
          const priorityResult = results[1];

          if (
            payingResult?.status === 'fulfilled' &&
            priorityResult?.status === 'fulfilled'
          ) {
            setSegmentAnalytics({
              paying: payingResult.value,
              priority: priorityResult.value,
            });
            return;
          }

          setSegmentAnalytics(null);
          setSegmentComparisonError(
            'Paying versus non-paying comparison could not be loaded for this view.'
          );
        };

        if (trailingBaselineWindow) {
          try {
            const trailingBaselineAnalytics = await fetchAnalyticsResponse({
              accessToken: session.access_token,
              signal: controller.signal,
              locationId: selectedLocationId,
              customerType: selectedCustomerType,
              dateStart: trailingBaselineWindow.start,
              dateEnd: trailingBaselineWindow.end,
              includeOperationalKpis: true,
            });

            if (controller.signal.aborted) return;

            const trailingBaselineKpis = buildTrailingAverageBaselineKpis(
              trailingBaselineAnalytics
            );
            if (trailingBaselineKpis) {
              primaryAnalyticsWithResolvedBaseline = applyComparisonBaseline(
                primaryAnalytics,
                {
                  date_start: trailingBaselineWindow.start,
                  date_end: trailingBaselineWindow.end,
                  kpis: trailingBaselineKpis,
                }
              );
            } else {
              baselineReadyForComparison = false;
            }
          } catch (error) {
            if ((error as Error).name === 'AbortError') {
              throw error;
            }
            baselineReadyForComparison = false;
            console.warn('[Analytics] Trailing 30-day baseline unavailable for primary scope', {
              error,
              locationId: selectedLocationId,
              customerType: selectedCustomerType,
              dateStart: trailingBaselineWindow.start,
              dateEnd: trailingBaselineWindow.end,
            });
          }
        }

        if (!locationOptions.length) {
          const segmentResults = segmentComparisonPromise
            ? await segmentComparisonPromise
            : null;

          if (controller.signal.aborted) return;

          setAnalyticsData(primaryAnalyticsWithResolvedBaseline);
          setLocationComparisonRows([]);
          applySegmentComparisonResults(segmentResults);
          return;
        }

        const [comparisonResults, segmentResults] = await Promise.all([
          Promise.allSettled(
            locationOptions.map(async (location) => {
              const currentAnalytics = await fetchAnalyticsResponse({
                accessToken: session.access_token,
                signal: controller.signal,
                locationId: location.id,
                customerType: selectedCustomerType,
                includeOperationalKpis: true,
                dateStart: primaryAnalytics.filters.date_start,
                dateEnd: primaryAnalytics.filters.date_end,
              });

              let analyticsWithResolvedBaseline = currentAnalytics;
              let baselineApplied = false;

              if (trailingBaselineWindow && baselineReadyForComparison) {
                const trailingBaselineAnalytics = await fetchAnalyticsResponse({
                  accessToken: session.access_token,
                  signal: controller.signal,
                  locationId: location.id,
                  customerType: selectedCustomerType,
                  dateStart: trailingBaselineWindow.start,
                  dateEnd: trailingBaselineWindow.end,
                  includeOperationalKpis: true,
                });
                const trailingBaselineKpis = buildTrailingAverageBaselineKpis(
                  trailingBaselineAnalytics
                );

                if (trailingBaselineKpis) {
                  analyticsWithResolvedBaseline = applyComparisonBaseline(
                    currentAnalytics,
                    {
                      date_start: trailingBaselineWindow.start,
                      date_end: trailingBaselineWindow.end,
                      kpis: trailingBaselineKpis,
                    }
                  );
                  baselineApplied = true;
                }
              }

              return {
                location,
                currentAnalytics,
                analyticsWithResolvedBaseline,
                baselineApplied,
              };
            })
          ),
          segmentComparisonPromise ?? Promise.resolve(null),
        ]);

        if (controller.signal.aborted) return;

        const successfulComparisons = comparisonResults.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : []
        );
        const failedComparisons = comparisonResults.filter(
          (result) => result.status === 'rejected'
        );

        const canUseTrailingBaselineEverywhere =
          trailingBaselineWindow !== null &&
          baselineReadyForComparison &&
          successfulComparisons.length === locationOptions.length &&
          successfulComparisons.every((result) => result.baselineApplied);

        setAnalyticsData(
          canUseTrailingBaselineEverywhere
            ? primaryAnalyticsWithResolvedBaseline
            : primaryAnalytics
        );

        setLocationComparisonRows(
          buildLocationComparisonRows(
            successfulComparisons.map((result) => ({
              location: result.location,
              analytics: canUseTrailingBaselineEverywhere
                ? result.analyticsWithResolvedBaseline
                : result.currentAnalytics,
            }))
          )
        );
        if (failedComparisons.length > 0) {
          setComparisonError('Some location comparisons could not be loaded.');
        } else if (trailingBaselineWindow && !canUseTrailingBaselineEverywhere) {
          setComparisonError(
            'Trailing 30-day baselines were unavailable for this single-day comparison, so the dashboard fell back to the previous period.'
          );
        }
        applySegmentComparisonResults(segmentResults);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[Analytics] Network error', {
            error,
            locationId: selectedLocationId,
            customerType: selectedCustomerType,
            dateStart: dateRange.start,
            dateEnd: dateRange.end,
          });
          setAnalyticsError(
            error instanceof Error ? error.message : 'Failed to load analytics.'
          );
          setAnalyticsData(null);
          setLocationComparisonRows([]);
          setSegmentAnalytics(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAnalyticsLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      controller.abort();
    };
  }, [
    dateRange.end,
    dateRange.start,
    isAdmin,
    selectedCustomerType,
    selectedLocationId,
    session?.access_token,
    locationOptions,
  ]);

  useEffect(() => {
    if (
      !isAdmin ||
      !session?.access_token ||
      !analyticsData ||
      selectedCustomerType !== 'all'
    ) {
      setDailyRepeatShareRows([]);
      setDailyRepeatShareError('');
      setDailyRepeatShareLoading(false);
      return;
    }

    const dateStart = analyticsData.filters.date_start;
    const dateEnd = analyticsData.filters.date_end;
    if (!dateStart || !dateEnd) {
      setDailyRepeatShareRows([]);
      setDailyRepeatShareError('');
      setDailyRepeatShareLoading(false);
      return;
    }

    const controller = new AbortController();
    const activeDates = analyticsData.series.map((row) => row.local_date);
    const fullWindowDates = buildDateSequence(dateStart, dateEnd);
    const targetDates = fullWindowDates ?? activeDates;

    const loadDailyRepeatShare = async () => {
      setDailyRepeatShareLoading(true);
      setDailyRepeatShareError('');

      try {
        const settledVisitDates = new Set(activeDates);
        const fetchDates = targetDates.filter((date) => settledVisitDates.has(date));
        const results = await Promise.allSettled(
          fetchDates.map((date) =>
            fetchAnalyticsResponse({
              accessToken: session.access_token,
              signal: controller.signal,
              locationId: selectedLocationId,
              customerType: 'all',
              dateStart: date,
              dateEnd: date,
            })
          )
        );

        if (controller.signal.aborted) return;

        const rowsByDate = new Map<string, DailyRepeatShareRow>();
        results.forEach((result, index) => {
          const date = fetchDates[index];
          if (!date) return;

          if (result.status === 'fulfilled') {
            const repeatTotal = resolveRepeatCount(result.value.kpis);
            rowsByDate.set(date, {
              local_date: date,
              arrivals_total: result.value.kpis.arrivals_total,
              repeat_total: repeatTotal,
              repeat_share:
                repeatTotal !== null && result.value.kpis.arrivals_total > 0
                  ? repeatTotal / result.value.kpis.arrivals_total
                  : null,
              classified_total: result.value.kpis.classified_customers_total ?? null,
            });
          }
        });

        setDailyRepeatShareRows(
          targetDates.map((date) => {
            return (
              rowsByDate.get(date) ?? {
                local_date: date,
                arrivals_total: 0,
                repeat_total: null,
                repeat_share: null,
                classified_total: null,
              }
            );
          })
        );

        if (results.some((result) => result.status === 'rejected')) {
          setDailyRepeatShareError('Some daily repeat-share values could not be loaded.');
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        setDailyRepeatShareRows([]);
        setDailyRepeatShareError(
          error instanceof Error
            ? error.message
            : 'Failed to load repeat-share trend.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setDailyRepeatShareLoading(false);
        }
      }
    };

    loadDailyRepeatShare();

    return () => {
      controller.abort();
    };
  }, [
    analyticsData,
    isAdmin,
    selectedCustomerType,
    selectedLocationId,
    session?.access_token,
  ]);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const handleLocationSelect = useCallback(
    (locationId: string) => {
      const selected = locationOptions.find(
        (location) => location.id === locationId
      );
      if (!selected) return;
      setIsLocationMenuOpen(false);
      router.push(`/employee/${selected.slug}`);
    },
    [locationOptions, router]
  );

  const openLocationMenu = useCallback(() => {
    setIsLocationMenuOpen(true);
  }, []);

  const closeLocationMenu = useCallback(() => {
    setIsLocationMenuOpen(false);
  }, []);

  const toggleLocationMenu = useCallback(() => {
    setIsLocationMenuOpen((prev) => !prev);
  }, []);

  const handleComparisonSort = useCallback((key: LocationSortKey) => {
    setComparisonSortKey((prevKey) => {
      if (prevKey === key) {
        setComparisonSortDirection((prevDirection) =>
          prevDirection === 'desc' ? 'asc' : 'desc'
        );
        return prevKey;
      }
      setComparisonSortDirection('desc');
      return key;
    });
  }, []);

  const previousPeriodKpis = analyticsData?.previous_period?.kpis ?? null;
  const selectedLocationOption = useMemo(
    () =>
      locationOptions.find((location) => location.id === selectedLocationId) ?? null,
    [locationOptions, selectedLocationId]
  );
  const scopeLabel =
    selectedLocationId === 'all'
      ? 'Chain-wide performance'
      : selectedLocationOption?.display_name ?? 'Selected location';
  const resolvedWindowLabel = formatResolvedWindowLabel(
    analyticsData?.filters.date_start ?? null,
    analyticsData?.filters.date_end ?? null
  );
  const storyMode = analyticsData ? getStoryMode(analyticsData.filters) : 'single_day';
  const comparisonReference = useMemo<ComparisonReference>(() => {
    const previousDateStart = analyticsData?.previous_period?.date_start ?? null;
    const previousDateEnd = analyticsData?.previous_period?.date_end ?? null;
    const comparisonRangeLabel =
      previousDateStart && previousDateEnd
        ? formatResolvedWindowLabel(previousDateStart, previousDateEnd)
        : 'Unavailable';
    const comparisonWindowDays = getDateSpanInDays(previousDateStart, previousDateEnd);
    const usesTrailingThirtyDayAverage =
      storyMode === 'single_day' && (comparisonWindowDays ?? 0) >= 30;

    if (usesTrailingThirtyDayAverage) {
      return {
        mode: 'trailing_30_day_average',
        longLabel: 'the trailing 30-day average day',
        chipLabel: `Comparison period: ${comparisonRangeLabel} (30-day average)`,
      };
    }

    return {
      mode: 'previous_period',
      longLabel: 'the previous period',
      chipLabel: `Comparison period: ${comparisonRangeLabel}`,
    };
  }, [analyticsData, storyMode]);
  const sortedLocationComparisonRows = useMemo(
    () =>
      sortLocationComparisonRows(
        locationComparisonRows,
        comparisonSortKey,
        comparisonSortDirection
      ),
    [comparisonSortDirection, comparisonSortKey, locationComparisonRows]
  );
  const executiveSummary = useMemo(
    () =>
      analyticsData
        ? buildExecutiveSummary(
            analyticsData,
            locationComparisonRows,
            scopeLabel,
            comparisonReference.longLabel
          )
        : null,
    [analyticsData, comparisonReference.longLabel, locationComparisonRows, scopeLabel]
  );

  const repeatShareSummary = useMemo(() => {
    const rows = dailyRepeatShareRows.filter(
      (row): row is DailyRepeatShareRow & { repeat_share: number } =>
        row.repeat_share !== null && !Number.isNaN(row.repeat_share)
    );

    if (!rows.length) {
      return null;
    }

    const average =
      rows.reduce((sum, row) => sum + row.repeat_share, 0) / rows.length;
    const peak = rows.reduce((currentPeak, row) =>
      row.repeat_share > currentPeak.repeat_share ? row : currentPeak
    );

    return {
      average,
      peak,
    };
  }, [dailyRepeatShareRows]);
  const peakWaitDay = useMemo(() => {
    const rows = analyticsData?.series ?? [];
    return rows.reduce<{ local_date: string; value: number } | null>((peak, row) => {
      if (row.wait_avg_minutes === null || row.wait_avg_minutes === undefined) {
        return peak;
      }
      if (!peak || row.wait_avg_minutes > peak.value) {
        return {
          local_date: row.local_date,
          value: row.wait_avg_minutes,
        };
      }
      return peak;
    }, null);
  }, [analyticsData]);
  const currentPriorityShare =
    analyticsData && analyticsData.kpis.arrivals_total > 0
      ? analyticsData.kpis.arrivals_non_paying / analyticsData.kpis.arrivals_total
      : null;
  const segmentComparisonModel = useMemo<SegmentComparisonModel | null>(() => {
    if (!analyticsData || !segmentAnalytics?.paying || !segmentAnalytics.priority) {
      return null;
    }
    return buildSegmentComparisonModel(
      analyticsData,
      segmentAnalytics.paying,
      segmentAnalytics.priority
    );
  }, [analyticsData, segmentAnalytics]);
  const customerFilterLabel =
    selectedCustomerType === 'all'
      ? 'All customers'
      : selectedCustomerType === 'paying'
        ? 'Paying only'
        : 'Priority Pass only';
  const selectedLocationComparison =
    selectedLocationId === 'all'
      ? null
      : locationComparisonRows.find((row) => row.location_id === selectedLocationId) ?? null;
  const chainAverageWait = useMemo(() => {
    const values = locationComparisonRows
      .map((row) => row.wait_avg_minutes)
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [locationComparisonRows]);
  const chainAverageCompletion = useMemo(() => {
    const values = locationComparisonRows
      .map((row) => row.completion_rate)
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [locationComparisonRows]);
  const selectedBenchmarkDetail = useMemo(() => {
    if (!selectedLocationComparison || chainAverageWait === null || chainAverageCompletion === null) {
      return 'Comparison uses the same resolved window across all visible locations.';
    }

    const notes: string[] = [];
    if (selectedLocationComparison.wait_avg_minutes !== null) {
      notes.push(
        `${formatMinutesShort(selectedLocationComparison.wait_avg_minutes, 1)} wait vs ${formatMinutesShort(
          chainAverageWait,
          1
        )} chain wait`
      );
    }
    if (selectedLocationComparison.completion_rate !== null) {
      notes.push(
        `${formatPercent(selectedLocationComparison.completion_rate)} completion vs ${formatPercent(
          chainAverageCompletion
        )} chain completion`
      );
    }

    return notes.length
      ? `Selected location: ${notes.join(' · ')}.`
      : 'Comparison uses the same resolved window across all visible locations.';
  }, [
    chainAverageCompletion,
    chainAverageWait,
    selectedLocationComparison,
  ]);
  const highestVolumeLocation = useMemo(
    () =>
      [...locationComparisonRows].sort(
        (left, right) => right.arrivals_total - left.arrivals_total
      )[0] ?? null,
    [locationComparisonRows]
  );
  const worstWaitLocation = useMemo(
    () =>
      [...locationComparisonRows]
        .filter((row) => row.wait_avg_minutes !== null)
        .sort(
          (left, right) => (right.wait_avg_minutes ?? 0) - (left.wait_avg_minutes ?? 0)
        )[0] ?? null,
    [locationComparisonRows]
  );
  const bestCompletionLocation = useMemo(
    () =>
      [...locationComparisonRows]
        .filter((row) => row.completion_rate !== null)
        .sort(
          (left, right) => (right.completion_rate ?? 0) - (left.completion_rate ?? 0)
        )[0] ?? null,
    [locationComparisonRows]
  );
  const highestAdjustedLocation = useMemo(
    () =>
      [...locationComparisonRows]
        .filter(
          (row): row is LocationComparisonRow & { adjusted_completed_total: number } =>
            row.adjusted_completed_total !== null
        )
        .sort(
          (left, right) =>
            (right.adjusted_completed_total ?? 0) - (left.adjusted_completed_total ?? 0)
        )[0] ?? null,
    [locationComparisonRows]
  );
  const primaryDriverRow = useMemo(
    () =>
      executiveSummary?.primary_driver
        ? locationComparisonRows.find(
            (row) => row.location_name === executiveSummary.primary_driver
          ) ?? null
        : null,
    [executiveSummary?.primary_driver, locationComparisonRows]
  );
  const largestAdjustedGainLocation = useMemo(
    () =>
      [...locationComparisonRows]
        .filter(
          (row): row is LocationComparisonRow & { adjusted_completed_delta: number } =>
            row.adjusted_completed_delta !== null && row.adjusted_completed_delta > 0
        )
        .sort(
          (left, right) => right.adjusted_completed_delta - left.adjusted_completed_delta
        )[0] ?? null,
    [locationComparisonRows]
  );
  const summaryToneStatus = useMemo<ExecutiveSummary['status']>(() => {
    if (!analyticsData) {
      return executiveSummary?.status ?? 'healthy';
    }

    if (analyticsData.kpis.arrivals_total === 0) {
      return 'urgent';
    }

    const currentAdjustedCompletions = analyticsData.kpis.adjusted_completed_total;
    const previousAdjustedCompletions =
      analyticsData.previous_period?.kpis?.adjusted_completed_total ?? null;

    if (
      currentAdjustedCompletions !== null &&
      previousAdjustedCompletions !== null &&
      previousAdjustedCompletions !== undefined
    ) {
      const adjustedCompletionsDelta =
        currentAdjustedCompletions - previousAdjustedCompletions;

      if (adjustedCompletionsDelta > 0.01) {
        return 'healthy';
      }
      if (adjustedCompletionsDelta < -0.01) {
        return 'urgent';
      }
    }

    return executiveSummary?.status ?? 'healthy';
  }, [analyticsData, executiveSummary?.status]);
  const summaryTone = getSummaryToneClasses(summaryToneStatus);
  const topSignals = (executiveSummary?.signals ?? []).slice(0, 2);

  if (authLoading) {
    return <LoadingSpinner text="Loading admin access..." className="mt-20" />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <ResponsiveCard className="w-full max-w-md">
          <h1 className="text-2xl font-libre-baskerville mb-4 text-center">
            Admin Sign In
          </h1>
          <form className="space-y-4" onSubmit={handleSignIn}>
            <label className="block text-sm">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-md bg-white text-black px-3 py-2"
              />
            </label>
            {authError ? <p className="text-sm text-red-200">{authError}</p> : null}
            <Button type="submit" fullWidth>
              Sign In
            </Button>
          </form>
        </ResponsiveCard>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <ResponsiveCard className="w-full max-w-md">
          <h1 className="text-2xl font-libre-baskerville mb-4 text-center">
            Access Denied
          </h1>
          <p className="text-sm text-center">
            Analytics are only available to admins.
          </p>
          <Button className="mt-4" fullWidth onClick={handleSignOut}>
            Sign Out
          </Button>
        </ResponsiveCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-lato">
      {!isLocationMenuOpen ? (
        <div className="fixed left-4 top-8 z-50">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-100"
            onMouseEnter={openLocationMenu}
            onFocus={openLocationMenu}
            onClick={toggleLocationMenu}
            aria-label="Open locations menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      ) : null}
      <div className="relative z-10 mx-auto max-w-7xl space-y-5 px-4 py-10 sm:px-8">
        <header className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Analytics
              </p>
              <h1 className="text-3xl sm:text-4xl font-libre-baskerville">
                Owner Dashboard
              </h1>
            </div>
            <Button variant="secondary" onClick={handleSignOut} className="self-start">
              Sign Out
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              Signed in as {currentUser.email} (admin)
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
              Settled outcomes only
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              {locationOptions.length > 0
                ? `${locationOptions.length}-location chain comparison`
                : 'Chain comparison'}
            </span>
          </div>
          {uiError ? <p className="text-sm text-red-600">{uiError}</p> : null}
          {analyticsError ? <p className="text-sm text-red-600">{analyticsError}</p> : null}
        </header>

        <ResponsiveCard className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Analytics Filters
              </h2>
            </div>
            {analyticsData ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                {storyMode === 'single_day'
                  ? 'Hourly operating view'
                  : storyMode === 'multi_day'
                    ? 'Daily operating view'
                    : 'Trend operating view'}
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
            <label className="text-sm">
              Location scope
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={selectedLocationId}
                onChange={(event) => setSelectedLocationId(event.target.value)}
              >
                <option value="all">All locations</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Time window
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={selectedDatePreset}
                onChange={(event) =>
                  setSelectedDatePreset(event.target.value as DatePreset)
                }
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Customer segment
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={selectedCustomerType}
                onChange={(event) =>
                  setSelectedCustomerType(event.target.value as CustomerFilter)
                }
              >
                <option value="all">All customers</option>
                <option value="paying">Paying</option>
                <option value="priority_pass">Priority Pass</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              Window: {resolvedWindowLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              {comparisonReference.chipLabel}
            </span>
          </div>

          {analyticsData ? (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid gap-3 xl:grid-cols-[1.5fr_0.95fr]">
                <div className={`rounded-2xl border px-4 py-4 shadow-sm ${summaryTone.panel}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      Top-line evidence
                    </p>
                    <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-600">
                      {resolvedWindowLabel}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950">
                    {executiveSummary?.headline ?? 'Executive summary unavailable.'}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {executiveSummary?.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {primaryDriverRow &&
                    primaryDriverRow.wait_avg_minutes !== null &&
                    chainAverageWait !== null ? (
                      <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1">
                        Largest wait gap: {primaryDriverRow.location_name}{' '}
                        {formatMinutesShort(primaryDriverRow.wait_avg_minutes, 1)} vs{' '}
                        {formatMinutesShort(chainAverageWait, 1)} chain wait
                      </span>
                    ) : null}
                    {highestAdjustedLocation &&
                    highestAdjustedLocation.adjusted_completed_total !== null ? (
                      <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1">
                        Highest adjusted completions: {highestAdjustedLocation.location_name}{' '}
                        {formatAdjustedCompletions(
                          highestAdjustedLocation.adjusted_completed_total
                        )}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1">
                      Non-paying {formatPercent(currentPriorityShare)} · Repeat{' '}
                      {formatPercent(analyticsData.kpis.repeat_customers_rate)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    {selectedBenchmarkDetail}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      Key comparisons in this window
                    </p>
                  </div>
                  {topSignals.length > 0 ? (
                    topSignals.map((signal) => (
                      <div
                        key={`${signal.title}-${signal.detail}`}
                        className={`rounded-2xl border px-4 py-3 ${getSignalToneClasses(signal.tone)}`}
                      >
                        <p className="text-sm font-semibold">{signal.title}</p>
                        <p className="mt-1 text-xs leading-5">{signal.detail}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-800">
                      <p className="text-sm font-semibold">
                        Average wait was {formatMinutesShort(analyticsData.kpis.wait_avg_minutes, 1)} and overall loss was{' '}
                        {formatPercent(analyticsData.kpis.dropoff_rate)}.
                      </p>
                      <p className="mt-1 text-xs leading-5">
                        No location or KPI gap exceeded the current wait or overall-loss thresholds in this filtered view.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <KpiCard
                  label="Completed Visits"
                  value={formatNumber(analyticsData.kpis.completed_total)}
                  trend={
                    <TrendBadge
                      current={analyticsData.kpis.completed_total}
                      previous={previousPeriodKpis?.completed_total}
                    />
                  }
                />
                <KpiCard
                  label="Adj. Completions"
                  value={formatAdjustedCompletions(analyticsData.kpis.adjusted_completed_total)}
                  trend={
                    <TrendBadge
                      current={analyticsData.kpis.adjusted_completed_total}
                      previous={previousPeriodKpis?.adjusted_completed_total}
                      absoluteDigits={2}
                    />
                  }
                />
                <KpiCard
                  label="Completion Rate"
                  value={formatPercent(analyticsData.kpis.completion_rate)}
                  trend={
                    <TrendBadge
                      current={analyticsData.kpis.completion_rate}
                      previous={previousPeriodKpis?.completion_rate}
                      isRate
                      higherIsBetter
                    />
                  }
                />
                <KpiCard
                  label="Avg Wait"
                  value={
                    analyticsData.kpis.wait_avg_minutes === null
                      ? '—'
                      : formatMinutesShort(analyticsData.kpis.wait_avg_minutes, 1)
                  }
                  trend={
                    <TrendBadge
                      current={analyticsData.kpis.wait_avg_minutes}
                      previous={previousPeriodKpis?.wait_avg_minutes}
                      higherIsBetter={false}
                      absoluteUnit="min"
                    />
                  }
                />
                <KpiCard
                  label="Utilization Rate"
                  value={formatPercent(analyticsData.kpis.utilization_rate)}
                  trend={
                    <TrendBadge
                      current={analyticsData.kpis.utilization_rate}
                      previous={previousPeriodKpis?.utilization_rate}
                      isRate
                      higherIsBetter
                    />
                  }
                />
                <KpiCard
                  label="Avg Queue Length"
                  value={
                    analyticsData.kpis.average_queue_length === null
                      ? '—'
                      : formatNumber(analyticsData.kpis.average_queue_length, 1)
                  }
                  trend={
                    <TrendBadge
                      current={analyticsData.kpis.average_queue_length}
                      previous={previousPeriodKpis?.average_queue_length}
                      higherIsBetter={false}
                      absoluteUnit="customers"
                      absoluteDigits={1}
                    />
                  }
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Adjusted Completions gives full credit to each paying completion and quarter
                credit to each non-paying completion (i.e. four priority pass customers equal one paying customer).
              </p>
            </div>
          ) : null}
        </ResponsiveCard>

        {analyticsLoading ? (
          <LoadingSpinner text="Loading owner dashboard..." />
        ) : analyticsData ? (
          <>
            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Chain operating table
                  </h2>
                  <p className="text-xs text-slate-500">
                    Compare locations early so owners can see the biggest exception before drilling into deeper cause analysis.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  Same resolved window across every visible location
                </span>
              </div>

              <ResponsiveCard className="border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Chain operating table
                    </h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {locationComparisonRows.length} locations
                  </span>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Highest volume
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {highestVolumeLocation?.location_name ?? '—'}
                      </p>
                      <span className="text-xs text-slate-500">
                        {highestVolumeLocation
                          ? formatNumber(highestVolumeLocation.arrivals_total)
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Best completion rate
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {bestCompletionLocation?.location_name ?? '—'}
                      </p>
                      <span className="text-xs text-slate-500">
                        {bestCompletionLocation
                          ? formatPercent(bestCompletionLocation.completion_rate)
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Longest wait
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {worstWaitLocation?.location_name ?? '—'}
                      </p>
                      <span className="text-xs text-slate-500">
                        {worstWaitLocation?.wait_avg_minutes !== null &&
                        worstWaitLocation?.wait_avg_minutes !== undefined
                          ? formatMinutesShort(worstWaitLocation.wait_avg_minutes, 1)
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Largest adjusted-completions gain
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {largestAdjustedGainLocation?.location_name ?? '—'}
                      </p>
                      <span className="text-xs text-slate-500">
                        {largestAdjustedGainLocation?.adjusted_completed_delta !== null &&
                        largestAdjustedGainLocation?.adjusted_completed_delta !== undefined
                          ? `+${formatAdjustedCompletions(
                              largestAdjustedGainLocation.adjusted_completed_delta
                            )}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <LocationComparisonTable
                    rows={sortedLocationComparisonRows}
                    selectedLocationId={selectedLocationId}
                    sortKey={comparisonSortKey}
                    sortDirection={comparisonSortDirection}
                    onSort={handleComparisonSort}
                  />
                </div>
                {comparisonError ? (
                  <p className="mt-4 text-xs text-amber-700">{comparisonError}</p>
                ) : null}
              </ResponsiveCard>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Operating trends
                  </h2>
                  <p className="text-xs text-slate-500">
                    Track daily settled volume, overall loss, and wait across the selected window with one consistent bar-based view.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  Daily bar trends
                </span>
              </div>

              <div className="space-y-4">
                <ResponsiveCard className="border border-slate-200 bg-white shadow-sm">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Daily settled visits with overall loss
                      </h3>
                      <p className="text-xs text-slate-500">
                        Each bar shows settled visits created that day, split into completed visits and overall loss so owners can see daily volume and leakage in one view.
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                      Window total {formatNumber(analyticsData.kpis.arrivals_total)} settled visits
                    </span>
                  </div>
                  <ThroughputArrivalsServedChart rows={analyticsData.series} />
                </ResponsiveCard>

                <ResponsiveCard className="border border-slate-200 bg-white shadow-sm">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Average wait by day
                      </h3>
                      <p className="text-xs text-slate-500">
                        Daily average wait for visits that reached service, shown as category-aligned bars with a clearly marked target line.
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                      Window avg {formatMinutesShort(analyticsData.kpis.wait_avg_minutes, 1)}
                    </span>
                  </div>
                  <DailyWaitBarChart
                    rows={analyticsData.series}
                    targetMinutes={WAIT_TARGET_MINUTES}
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    {peakWaitDay
                      ? `Peak wait reached ${formatMinutesShort(
                          peakWaitDay.value,
                          1
                        )} on ${peakWaitDay.local_date}.`
                      : 'No wait trend data is available for this window.'}
                  </p>
                </ResponsiveCard>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Segment comparison
                  </h2>
                  <p className="text-xs text-slate-500">
                    Compare who is arriving, how each segment experiences the system, and whether losses are concentrated in one segment.
                  </p>
                </div>
              </div>

              <ResponsiveCard className="border border-slate-200 bg-white shadow-sm">
                <div className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Customer composition
                      </h3>
                      <p className="text-xs text-slate-500">
                        One chart shows how payment type and customer history combine, so owners can see both the arrival split and where repeat business sits inside it.
                      </p>
                    </div>

                    {segmentComparisonModel ? (
                      <>
                        <SegmentInteractionChart
                          model={segmentComparisonModel}
                          totalArrivals={analyticsData.kpis.arrivals_total}
                        />

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                                Repeat customer trend
                              </p>
                              <h4 className="mt-1 text-base font-semibold text-slate-900">
                                Repeat share by day
                              </h4>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                Each bar shows repeat customers as a share of all customers on that date.
                              </p>
                            </div>
                            {repeatShareSummary ? (
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                                Average repeat share {formatPercent(repeatShareSummary.average)}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-4">
                            {dailyRepeatShareLoading ? (
                              <p className="text-sm text-slate-500">
                                Loading repeat-customer trend...
                              </p>
                            ) : dailyRepeatShareRows.length > 0 ? (
                              <DailyRepeatShareBarChart rows={dailyRepeatShareRows} />
                            ) : (
                              <p className="text-sm text-slate-500">
                                Repeat-share trend is unavailable for this window.
                              </p>
                            )}
                          </div>

                          {dailyRepeatShareError ? (
                            <p className="mt-3 text-xs text-amber-700">
                              {dailyRepeatShareError}
                            </p>
                          ) : repeatShareSummary ? (
                            <p className="mt-3 text-xs text-slate-500">
                              Highest repeat share was {formatPercent(repeatShareSummary.peak.repeat_share)} on{' '}
                              {repeatShareSummary.peak.local_date}. The selected-window average was{' '}
                              {formatPercent(repeatShareSummary.average)}.
                            </p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-sm font-semibold text-slate-900">
                          Customer composition is unavailable right now
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Paying and non-paying segment detail is required to combine payment type with new versus repeat history.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {selectedCustomerType === 'all' ? (
                      segmentComparisonModel ? (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">
                                Paying vs non-paying experience
                              </h3>
                              <p className="text-xs text-slate-500">
                                Compare queue experience, outcomes, and repeat mix with aligned values and row-level tracks.
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                              Same resolved window for both segments
                            </span>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="divide-y divide-slate-100">
                              {segmentComparisonModel.metrics.map((metric) => {
                                const payingTone = getSegmentMetricCellTone(metric, 'paying');
                                const priorityTone = getSegmentMetricCellTone(
                                  metric,
                                  'priority_pass'
                                );

                                return (
                                  <div
                                    key={metric.key}
                                    className="px-4 py-4"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-slate-900">
                                        {metric.label}
                                      </p>
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        {getSegmentMetricDirectionLabel(metric)}
                                      </p>
                                    </div>

                                    <div className="mt-3 space-y-2.5">
                                      <div className={`rounded-xl border px-3 py-3 ${payingTone.panel}`}>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                                            Paying
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <p
                                              className={`tabular-nums text-base font-semibold ${payingTone.value}`}
                                            >
                                              {formatSegmentMetricValue(metric, metric.paying_value)}
                                            </p>
                                            <span
                                              className={`h-2.5 w-2.5 rounded-full ${payingTone.indicator}`}
                                            />
                                          </div>
                                        </div>
                                        <div className="mt-2 h-2.5 rounded-full bg-slate-200/80">
                                          <div
                                            className={`h-2.5 rounded-full ${payingTone.marker}`}
                                            style={{
                                              width: getSegmentMetricTrackWidth(
                                                metric,
                                                metric.paying_value
                                              ),
                                            }}
                                          />
                                        </div>
                                      </div>

                                      <div className={`rounded-xl border px-3 py-3 ${priorityTone.panel}`}>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                                            Non-paying
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <p
                                              className={`tabular-nums text-base font-semibold ${priorityTone.value}`}
                                            >
                                              {formatSegmentMetricValue(
                                                metric,
                                                metric.priority_value
                                              )}
                                            </p>
                                            <span
                                              className={`h-2.5 w-2.5 rounded-full ${priorityTone.indicator}`}
                                            />
                                          </div>
                                        </div>
                                        <div className="mt-2 h-2.5 rounded-full bg-slate-200/80">
                                          <div
                                            className={`h-2.5 rounded-full ${priorityTone.marker}`}
                                            style={{
                                              width: getSegmentMetricTrackWidth(
                                                metric,
                                                metric.priority_value
                                              ),
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[11px] text-slate-500">
                              Each stacked pair uses a shared scale, so the segment gap is visible in the bar lengths without a separate gap column.
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Segment comparison is unavailable right now
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {segmentComparisonError ||
                              'Paying versus non-paying comparison could not be loaded for this view.'}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Segment comparison is available in All customers view
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            The current customer filter is {customerFilterLabel.toLowerCase()}. Switch back to All customers to compare paying and non-paying experience side by side.
                          </p>
                        </div>
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                              Avg wait
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">
                              {formatMinutesShort(analyticsData.kpis.wait_avg_minutes, 1)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                              Completion rate
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">
                              {formatPercent(analyticsData.kpis.completion_rate)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                              Overall loss rate
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">
                              {formatPercent(analyticsData.kpis.dropoff_rate)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                              Time in system
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">
                              {analyticsData.kpis.time_in_system_avg_minutes === null
                                ? '—'
                                : formatMinutesShort(
                                    analyticsData.kpis.time_in_system_avg_minutes,
                                    1
                                  )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ResponsiveCard>
            </section>
          </>
        ) : (
          <ResponsiveCard>
            <p className="text-sm text-slate-500">
              Analytics are not available yet.
            </p>
          </ResponsiveCard>
        )}
      </div>

      <div
        className={`fixed inset-0 z-40 ${
          isLocationMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-slate-900/20 transition-opacity ${
            isLocationMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeLocationMenu}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-slate-200 bg-white p-5 transition-transform ${
            isLocationMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onMouseEnter={openLocationMenu}
          onMouseLeave={closeLocationMenu}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Locations</h2>
          </div>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsLocationMenuOpen(false);
                router.push('/employee/analytics');
              }}
              className="w-full rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-left text-sky-800"
            >
              <p className="text-sm font-semibold">Analytics</p>
            </button>
            {locationOptions.length === 0 ? (
              <p className="text-sm text-slate-500">No locations available.</p>
            ) : (
              locationOptions.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => handleLocationSelect(location.id)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold">
                    {location.display_name}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
