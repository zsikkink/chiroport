import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { logError, logSecurityEvent, debugLog } from '@/server/config';

export const runtime = 'nodejs';

type CustomerTypeFilter = 'paying' | 'priority_pass' | null;

type AnalyticsResponsePayload = {
  filters?: {
    date_start?: string | null;
    date_end?: string | null;
  };
  kpis?: Record<string, unknown>;
  previous_period?: {
    date_start?: string | null;
    date_end?: string | null;
    kpis?: Record<string, unknown> | null;
  } | null | undefined;
};

type ScopedLocation = {
  id: string;
  timezone: string;
};

type LocationHoursRow = {
  location_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

type HistoryTimingRow = {
  id: string;
  location_id: string;
  timezone: string;
  customer_type: 'paying' | 'priority_pass' | null;
  created_at: string;
  served_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
};

type OpenWindow = {
  startMinute: number;
  endMinute: number;
};

type OperationalKpis = {
  average_queue_length: number | null;
  utilization_rate: number | null;
  adjusted_completed_total: number | null;
};

const localFormatterCache = new Map<string, Intl.DateTimeFormat>();

type HistoryTimingQueryResult = {
  data: HistoryTimingRow[] | null;
  error: { message: string } | null;
};

type HistoryTimingQuery = {
  eq: (column: string, value: string) => HistoryTimingQuery;
  gte: (column: string, value: string) => HistoryTimingQuery;
  in: (column: string, values: string[]) => HistoryTimingQuery;
  lte: (column: string, value: string) => HistoryTimingQuery;
  order: (
    column: string,
    options: { ascending: boolean }
  ) => HistoryTimingQuery;
  range: (from: number, to: number) => Promise<HistoryTimingQueryResult>;
};

type HistoryTimingClient = {
  from: (relation: 'queue_entries_history') => {
    select: (columns: string) => HistoryTimingQuery;
  };
};

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function normalizeCustomerType(input: string | null): CustomerTypeFilter {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === 'paying') return 'paying';
  if (normalized === 'priority_pass' || normalized === 'non_paying') {
    return 'priority_pass';
  }
  return null;
}

function shouldIncludeOperationalKpis(input: string | null) {
  if (!input) return false;
  const normalized = input.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseIsoDate(value: string) {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return new Date(Date.UTC(parts[0] as number, (parts[1] as number) - 1, parts[2] as number));
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

function getDateDayOfWeek(value: string) {
  const date = parseIsoDate(value);
  return date ? date.getUTCDay() : null;
}

function parseTimeToMinutes(value: string) {
  const [hoursString, minutesString] = value.split(':');
  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function buildLocationHoursLookup(rows: LocationHoursRow[]) {
  const lookup = new Map<string, Map<number, OpenWindow>>();

  rows.forEach((row) => {
    if (row.is_closed) return;
    const startMinute = parseTimeToMinutes(row.opens_at);
    const endMinute = parseTimeToMinutes(row.closes_at);
    if (
      startMinute === null ||
      endMinute === null ||
      endMinute <= startMinute
    ) {
      return;
    }

    const byDay = lookup.get(row.location_id) ?? new Map<number, OpenWindow>();
    byDay.set(row.day_of_week, { startMinute, endMinute });
    lookup.set(row.location_id, byDay);
  });

  return lookup;
}

function getFormatter(timezone: string) {
  const cached = localFormatterCache.get(timezone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  localFormatterCache.set(timezone, formatter);
  return formatter;
}

function getLocalTimestampParts(timestamp: string, timezone: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = getFormatter(timezone).formatToParts(parsed);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;

  if (!year || !month || !day || !hour || !minute) {
    return null;
  }

  const resolvedHour = Number(hour);
  const resolvedMinute = Number(minute);
  if (Number.isNaN(resolvedHour) || Number.isNaN(resolvedMinute)) {
    return null;
  }

  return {
    date: `${year}-${month}-${day}`,
    minuteOfDay: resolvedHour * 60 + resolvedMinute,
  };
}

function getOpenMinutesForWindow(
  locations: ScopedLocation[],
  hoursLookup: Map<string, Map<number, OpenWindow>>,
  dateStart: string,
  dateEnd: string
) {
  let totalOpenMinutes = 0;

  for (const location of locations) {
    for (
      let currentDate = dateStart;
      currentDate <= dateEnd;
      currentDate = shiftIsoDate(currentDate, 1) ?? ''
    ) {
      if (!currentDate) break;
      const dayOfWeek = getDateDayOfWeek(currentDate);
      if (dayOfWeek === null) continue;
      const window = hoursLookup.get(location.id)?.get(dayOfWeek);
      if (!window) continue;
      totalOpenMinutes += window.endMinute - window.startMinute;
    }
  }

  return totalOpenMinutes;
}

function addIntervalOverlap(
  intervalStore: Map<string, Array<[number, number]>> | null,
  row: HistoryTimingRow,
  startTimestamp: string,
  endTimestamp: string,
  dateStart: string,
  dateEnd: string,
  hoursLookup: Map<string, Map<number, OpenWindow>>,
  onOverlap?: (minutes: number) => void
) {
  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return;
  }

  const startParts = getLocalTimestampParts(startTimestamp, row.timezone);
  const endParts = getLocalTimestampParts(endTimestamp, row.timezone);
  if (!startParts || !endParts) {
    return;
  }

  const loopStart = startParts.date > dateStart ? startParts.date : dateStart;
  const loopEnd = endParts.date < dateEnd ? endParts.date : dateEnd;
  if (loopStart > loopEnd) {
    return;
  }

  for (
    let currentDate = loopStart;
    currentDate <= loopEnd;
    currentDate = shiftIsoDate(currentDate, 1) ?? ''
  ) {
    if (!currentDate) break;
    const dayOfWeek = getDateDayOfWeek(currentDate);
    if (dayOfWeek === null) continue;

    const openWindow = hoursLookup.get(row.location_id)?.get(dayOfWeek);
    if (!openWindow) continue;

    const intervalStart = currentDate === startParts.date ? startParts.minuteOfDay : 0;
    const intervalEnd = currentDate === endParts.date ? endParts.minuteOfDay : 1440;
    const overlapStart = Math.max(intervalStart, openWindow.startMinute);
    const overlapEnd = Math.min(intervalEnd, openWindow.endMinute);

    if (overlapEnd <= overlapStart) continue;

    onOverlap?.(overlapEnd - overlapStart);

    if (intervalStore) {
      const key = `${row.location_id}:${currentDate}`;
      const intervals = intervalStore.get(key) ?? [];
      intervals.push([overlapStart, overlapEnd]);
      intervalStore.set(key, intervals);
    }
  }
}

function calculateMergedMinutes(intervalStore: Map<string, Array<[number, number]>>) {
  let totalMinutes = 0;

  intervalStore.forEach((intervals) => {
    const sorted = [...intervals].sort((left, right) => left[0] - right[0]);
    let currentStart: number | null = null;
    let currentEnd: number | null = null;

    sorted.forEach(([start, end]) => {
      if (currentStart === null || currentEnd === null) {
        currentStart = start;
        currentEnd = end;
        return;
      }

      if (start <= currentEnd) {
        currentEnd = Math.max(currentEnd, end);
        return;
      }

      totalMinutes += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    });

    if (currentStart !== null && currentEnd !== null) {
      totalMinutes += currentEnd - currentStart;
    }
  });

  return totalMinutes;
}

async function fetchScopedLocations(
  adminClient: ReturnType<typeof createSupabaseServiceClient>,
  locationId: string | null
) {
  let query = adminClient.from('locations').select('id,timezone');

  if (locationId) {
    query = query.eq('id', locationId);
  } else {
    query = query.eq('is_open', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ScopedLocation[];
}

async function fetchLocationHours(
  adminClient: ReturnType<typeof createSupabaseServiceClient>,
  locationIds: string[]
) {
  if (!locationIds.length) {
    return [];
  }

  const { data, error } = await adminClient
    .from('location_hours')
    .select('location_id,day_of_week,opens_at,closes_at,is_closed')
    .in('location_id', locationIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LocationHoursRow[];
}

async function fetchHistoryTimingRows(
  adminClient: ReturnType<typeof createSupabaseServiceClient>,
  {
    locationIds,
    customerType,
    dateStart,
    dateEnd,
  }: {
    locationIds: string[];
    customerType: CustomerTypeFilter;
    dateStart: string;
    dateEnd: string;
  }
) {
  if (!locationIds.length) {
    return [];
  }

  const allRows: HistoryTimingRow[] = [];
  const pageSize = 1000;
  const historyClient = adminClient as unknown as HistoryTimingClient;

  for (let from = 0; ; from += pageSize) {
    let query = historyClient
      .from('queue_entries_history')
      .select(
        'id,location_id,timezone,customer_type,created_at,served_at,completed_at,cancelled_at,no_show_at'
      )
      .in('status', ['completed', 'cancelled', 'no_show'])
      .in('location_id', locationIds)
      .gte('local_date', dateStart)
      .lte('local_date', dateEnd)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (customerType) {
      query = query.eq('customer_type', customerType);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = (data ?? []) as HistoryTimingRow[];
    allRows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }
  }

  return allRows;
}

function calculateAdjustedCompletedTotal(rows: HistoryTimingRow[]) {
  return rows.reduce((sum, row) => {
    if (!row.completed_at) {
      return sum;
    }
    return sum + (row.customer_type === 'priority_pass' ? 0.25 : 1);
  }, 0);
}

function calculateOperationalKpis({
  rows,
  locations,
  hours,
  dateStart,
  dateEnd,
}: {
  rows: HistoryTimingRow[];
  locations: ScopedLocation[];
  hours: LocationHoursRow[];
  dateStart: string;
  dateEnd: string;
}): OperationalKpis {
  const hoursLookup = buildLocationHoursLookup(hours);
  const adjustedCompletedTotal = calculateAdjustedCompletedTotal(rows);
  const totalOpenMinutes = getOpenMinutesForWindow(
    locations,
    hoursLookup,
    dateStart,
    dateEnd
  );

  if (totalOpenMinutes <= 0) {
    return {
      average_queue_length: null,
      utilization_rate: null,
      adjusted_completed_total: adjustedCompletedTotal,
    };
  }

  let totalWaitingMinutes = 0;
  const activeServiceIntervals = new Map<string, Array<[number, number]>>();

  rows.forEach((row) => {
    const queueEndTimestamp =
      row.served_at ??
      row.completed_at ??
      row.cancelled_at ??
      row.no_show_at;

    if (queueEndTimestamp) {
      addIntervalOverlap(
        null,
        row,
        row.created_at,
        queueEndTimestamp,
        dateStart,
        dateEnd,
        hoursLookup,
        (minutes) => {
          totalWaitingMinutes += minutes;
        }
      );
    }

    const serviceEndTimestamp =
      row.completed_at ?? row.cancelled_at ?? row.no_show_at;

    if (row.served_at && serviceEndTimestamp) {
      addIntervalOverlap(
        activeServiceIntervals,
        row,
        row.served_at,
        serviceEndTimestamp,
        dateStart,
        dateEnd,
        hoursLookup
      );
    }
  });

  const activeServiceMinutes = calculateMergedMinutes(activeServiceIntervals);

  return {
    average_queue_length: totalWaitingMinutes / totalOpenMinutes,
    utilization_rate: activeServiceMinutes / totalOpenMinutes,
    adjusted_completed_total: adjustedCompletedTotal,
  };
}

async function deriveOperationalKpis(
  adminClient: ReturnType<typeof createSupabaseServiceClient>,
  {
    locationId,
    customerType,
    dateStart,
    dateEnd,
  }: {
    locationId: string | null;
    customerType: CustomerTypeFilter;
    dateStart: string | null | undefined;
    dateEnd: string | null | undefined;
  }
  ) {
  if (!dateStart || !dateEnd) {
    return {
      average_queue_length: null,
      utilization_rate: null,
      adjusted_completed_total: null,
    };
  }

  const locations = await fetchScopedLocations(adminClient, locationId);
  const locationIds = locations.map((location) => location.id);
  if (!locationIds.length) {
    return {
      average_queue_length: null,
      utilization_rate: null,
      adjusted_completed_total: 0,
    };
  }

  const [hours, rows] = await Promise.all([
    fetchLocationHours(adminClient, locationIds),
    fetchHistoryTimingRows(adminClient, {
      locationIds,
      customerType,
      dateStart,
      dateEnd,
    }),
  ]);

  return calculateOperationalKpis({
    rows,
    locations,
    hours,
    dateStart,
    dateEnd,
  });
}

function withOperationalKpis(
  analytics: AnalyticsResponsePayload,
  currentKpis: OperationalKpis,
  previousKpis: OperationalKpis | null
): AnalyticsResponsePayload {
  const previousPeriod = analytics.previous_period;

  return {
    ...analytics,
    kpis: {
      ...(analytics.kpis ?? {}),
      ...currentKpis,
    },
    previous_period:
      previousPeriod === null || previousPeriod === undefined
        ? null
        : previousPeriod
          ? {
              ...previousPeriod,
              kpis: previousPeriod.kpis
                ? {
                    ...previousPeriod.kpis,
                    ...(previousKpis ?? {
                      average_queue_length: null,
                      utilization_rate: null,
                      adjusted_completed_total: null,
                    }),
                  }
                : previousPeriod.kpis ?? null,
            }
          : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      logSecurityEvent('analytics_missing_bearer', {
        path: request.nextUrl.pathname,
        method: request.method,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      logSecurityEvent('analytics_invalid_bearer', {
        path: request.nextUrl.pathname,
        method: request.method,
        error: authError?.message ?? 'unknown',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createSupabaseServiceClient();
    const { data: profile, error: profileError } = await adminClient
      .from('employee_profiles')
      .select('role,is_open')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      logError(profileError, 'analytics_profile_lookup_failed');
      return NextResponse.json(
        { error: 'Failed to validate access.' },
        { status: 500 }
      );
    }

    if (!profile || !profile.is_open || profile.role !== 'admin') {
      logSecurityEvent('analytics_forbidden', {
        path: request.nextUrl.pathname,
        method: request.method,
        user_id: authData.user.id,
        role: profile?.role ?? null,
        is_open: profile?.is_open ?? null,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const locationIdParam = searchParams.get('locationId');
    const customerTypeParam = searchParams.get('customerType');
    const dateStartParam = searchParams.get('dateStart');
    const dateEndParam = searchParams.get('dateEnd');
    const includeOperationalKpis = shouldIncludeOperationalKpis(
      searchParams.get('includeOperationalKpis')
    );

    const hasDateRange = Boolean(dateStartParam && dateEndParam);
    const locationId =
      locationIdParam && locationIdParam !== 'all' ? locationIdParam : null;
    const customerType = normalizeCustomerType(customerTypeParam);
    const dateStart = hasDateRange ? dateStartParam : null;
    const dateEnd = hasDateRange ? dateEndParam : null;

    debugLog('analytics_request', {
      user_id: authData.user.id,
      location_id: locationId,
      customer_type: customerType,
      date_start: dateStart,
      date_end: dateEnd,
    });

    const { data: analytics, error: analyticsError } = await adminClient.rpc(
      'get_admin_analytics',
      {
        p_location_id: locationId,
        p_date_start: dateStart,
        p_date_end: dateEnd,
        p_customer_type: customerType,
      }
    );

    if (analyticsError) {
      logError(
        new Error(analyticsError.message),
        `analytics_rpc_failed:${analyticsError.code ?? 'unknown'}`
      );
      console.error('[ANALYTICS_RPC]', {
        user_id: authData.user.id,
        location_id: locationId,
        customer_type: customerType,
        date_start: dateStart,
        date_end: dateEnd,
        code: analyticsError.code,
        details: analyticsError.details,
        hint: analyticsError.hint,
      });
      return NextResponse.json(
        { error: 'Failed to load analytics.' },
        { status: 500 }
      );
    }

    let responsePayload = analytics as AnalyticsResponsePayload;

    if (includeOperationalKpis && responsePayload && typeof responsePayload === 'object') {
      try {
        const currentDerivedKpis = await deriveOperationalKpis(adminClient, {
          locationId,
          customerType,
          dateStart: responsePayload.filters?.date_start,
          dateEnd: responsePayload.filters?.date_end,
        });

        const previousDerivedKpis =
          responsePayload.previous_period?.date_start &&
          responsePayload.previous_period?.date_end
            ? await deriveOperationalKpis(adminClient, {
                locationId,
                customerType,
                dateStart: responsePayload.previous_period.date_start,
                dateEnd: responsePayload.previous_period.date_end,
              })
            : null;

        responsePayload = withOperationalKpis(
          responsePayload,
          currentDerivedKpis,
          previousDerivedKpis
        );
      } catch (derivedMetricsError) {
        logError(
          derivedMetricsError as Error,
          'analytics_operational_kpis_failed'
        );
        responsePayload = withOperationalKpis(
          responsePayload,
          {
            average_queue_length: null,
            utilization_rate: null,
            adjusted_completed_total: null,
          },
          null
        );
      }
    }

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    logError(error as Error, 'analytics_unhandled_exception');
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
