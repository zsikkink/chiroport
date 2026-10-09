import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server';
import { logError, logSecurityEvent, debugLog } from '@/server/config';
import {
  normalizeAnalyticsResponse,
  type AnalyticsDashboardPayload,
  type AnalyticsKpis,
  type AnalyticsPreviousKpis,
  type AnalyticsResponse,
  type DailyRepeatShareRow,
  type LocationAnalyticsInput,
  type LocationOption,
  type SegmentAnalyticsPair,
  type WorkforceAnalytics,
} from '@/app/employee/analytics/dashboardModel';

export const runtime = 'nodejs';

type CustomerTypeFilter = 'paying' | 'priority_pass' | null;

type AnalyticsScope = {
  locationId: string | null;
  customerType: CustomerTypeFilter;
  dateStart: string | null;
  dateEnd: string | null;
  includeOperationalKpis: boolean;
};

type DashboardScopeLocation = {
  location: LocationOption;
  current_kpis: Partial<AnalyticsKpis>;
  baseline_kpis: Partial<AnalyticsPreviousKpis>;
};

type DashboardScopes = {
  date_start: string;
  date_end: string;
  baseline_date_start: string;
  baseline_date_end: string;
  baseline_mode: 'trailing_daily_average' | 'previous_period';
  primary_current_kpis: Partial<AnalyticsKpis>;
  primary_baseline_kpis: Partial<AnalyticsPreviousKpis>;
  locations: DashboardScopeLocation[];
  segments: {
    paying: Partial<AnalyticsKpis>;
    priority_pass: Partial<AnalyticsKpis>;
  } | null;
};

type AnalyticsClient = ReturnType<typeof createSupabaseServiceClient>;

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

function withDashboardScope(
  analytics: AnalyticsResponse,
  currentKpis: Partial<AnalyticsKpis>,
  baselineKpis: Partial<AnalyticsPreviousKpis>,
  baselineDateStart: string,
  baselineDateEnd: string
): AnalyticsResponse {
  return {
    ...analytics,
    kpis: { ...analytics.kpis, ...currentKpis },
    previous_period: {
      date_start: baselineDateStart,
      date_end: baselineDateEnd,
      kpis: {
        arrivals_total: 0,
        completion_rate: null,
        dropoff_rate: null,
        average_queue_length: null,
        utilization_rate: null,
        wait_avg_minutes: null,
        completed_total: 0,
        adjusted_completed_total: null,
        cancelled_total: 0,
        ...baselineKpis,
      },
    },
  };
}

async function loadDashboardScopes(
  adminClient: AnalyticsClient,
  scope: Omit<AnalyticsScope, 'includeOperationalKpis'> & {
    dateStart: string;
    dateEnd: string;
  }
) {
  const { data, error } = await adminClient.rpc(
    'get_admin_dashboard_scopes',
    {
      p_date_start: scope.dateStart,
      p_date_end: scope.dateEnd,
      ...(scope.locationId ? { p_location_id: scope.locationId } : {}),
      ...(scope.customerType
        ? { p_customer_type: scope.customerType }
        : {}),
    }
  );
  if (error) {
    throw new Error(`Dashboard scope query failed: ${error.message}`);
  }
  return data as unknown as DashboardScopes;
}

async function loadAnalyticsScope(
  adminClient: AnalyticsClient,
  scope: AnalyticsScope
) {
  const { data, error } = await adminClient.rpc('get_admin_analytics', {
    ...(scope.locationId ? { p_location_id: scope.locationId } : {}),
    ...(scope.dateStart ? { p_date_start: scope.dateStart } : {}),
    ...(scope.dateEnd ? { p_date_end: scope.dateEnd } : {}),
    ...(scope.customerType ? { p_customer_type: scope.customerType } : {}),
  });

  if (error) {
    throw new Error(`Analytics query failed: ${error.message}`);
  }

  const analytics = normalizeAnalyticsResponse(
    data as Partial<AnalyticsResponse>
  );
  if (
    !scope.includeOperationalKpis ||
    !analytics.filters.date_start ||
    !analytics.filters.date_end
  ) {
    return analytics;
  }

  const dashboardScopes = await loadDashboardScopes(adminClient, {
    locationId: scope.locationId,
    customerType: scope.customerType,
    dateStart: analytics.filters.date_start,
    dateEnd: analytics.filters.date_end,
  });
  return withDashboardScope(
    analytics,
    dashboardScopes.primary_current_kpis,
    dashboardScopes.primary_baseline_kpis,
    dashboardScopes.baseline_date_start,
    dashboardScopes.baseline_date_end
  );
}

async function loadDailyRepeatShare(
  adminClient: AnalyticsClient,
  locationId: string | null,
  dateStart: string,
  dateEnd: string
): Promise<DailyRepeatShareRow[]> {
  const { data, error } = await adminClient.rpc(
    'get_admin_daily_repeat_share',
    {
      ...(locationId ? { p_location_id: locationId } : {}),
      p_date_start: dateStart,
      p_date_end: dateEnd,
    }
  );
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const arrivalsTotal = Number(row.arrivals_total ?? 0);
    const repeatTotal = Number(row.repeat_total ?? 0);
    const classifiedTotal = Number(row.classified_total ?? 0);
    return {
      local_date: row.local_date,
      arrivals_total: arrivalsTotal,
      repeat_total: repeatTotal,
      repeat_share:
        classifiedTotal > 0 ? repeatTotal / classifiedTotal : null,
      classified_total: classifiedTotal,
    };
  });
}

function buildComparisonAnalytics(
  filters: AnalyticsResponse['filters'],
  currentKpis: Partial<AnalyticsKpis>,
  baselineKpis: Partial<AnalyticsPreviousKpis>,
  scopes: DashboardScopes,
  locationId: string | null
) {
  return withDashboardScope(
    normalizeAnalyticsResponse({
      filters: { ...filters, location_id: locationId },
      kpis: currentKpis as AnalyticsKpis,
      series: [],
      hourly_series: [],
      previous_period: null,
    }),
    currentKpis,
    baselineKpis,
    scopes.baseline_date_start,
    scopes.baseline_date_end
  );
}

function buildSegmentAnalytics(
  filters: AnalyticsResponse['filters'],
  customerType: Exclude<CustomerTypeFilter, null>,
  kpis: Partial<AnalyticsKpis>
) {
  return normalizeAnalyticsResponse({
    filters: { ...filters, customer_type: customerType },
    kpis: kpis as AnalyticsKpis,
    series: [],
    hourly_series: [],
    previous_period: null,
  });
}

export async function loadAnalyticsDashboard(
  adminClient: AnalyticsClient,
  scope: Omit<AnalyticsScope, 'includeOperationalKpis'>
): Promise<{ payload: AnalyticsDashboardPayload; databaseCalls: number }> {
  let databaseCalls = 1;
  const primary = await loadAnalyticsScope(adminClient, {
    ...scope,
    includeOperationalKpis: false,
  });
  const resolvedStart = primary.filters.date_start;
  const resolvedEnd = primary.filters.date_end;
  if (!resolvedStart || !resolvedEnd) {
    return {
      databaseCalls,
      payload: {
        analytics: primary,
        workforce_analytics: null,
        location_analytics: [],
        segment_analytics: null,
        daily_repeat_share_rows: [],
        warnings: {
          comparison: null,
          segment: null,
          daily_repeat: null,
        },
      },
    };
  }

  databaseCalls += 1;
  const scopes = await loadDashboardScopes(adminClient, {
    ...scope,
    dateStart: resolvedStart,
    dateEnd: resolvedEnd,
  });
  const analytics = withDashboardScope(
    primary,
    scopes.primary_current_kpis,
    scopes.primary_baseline_kpis,
    scopes.baseline_date_start,
    scopes.baseline_date_end
  );

  databaseCalls += 1;
  const { data: workforceData, error: workforceError } = await adminClient.rpc(
    'get_admin_workforce_analytics',
    {
      p_date_start: resolvedStart,
      p_date_end: resolvedEnd,
      ...(scope.locationId ? { p_location_id: scope.locationId } : {}),
      ...(scope.customerType ? { p_customer_type: scope.customerType } : {}),
    }
  );
  if (workforceError) {
    throw new Error(`Workforce analytics query failed: ${workforceError.message}`);
  }

  const locationAnalytics: LocationAnalyticsInput[] = scopes.locations.map(
    (row) => ({
      location: row.location,
      analytics: buildComparisonAnalytics(
        analytics.filters,
        row.current_kpis,
        row.baseline_kpis,
        scopes,
        row.location.id
      ),
    })
  );

  let segmentAnalytics: SegmentAnalyticsPair | null = null;
  if (scope.customerType === null && scopes.segments) {
    segmentAnalytics = {
      paying: buildSegmentAnalytics(
        analytics.filters,
        'paying',
        scopes.segments.paying
      ),
      priority: buildSegmentAnalytics(
        analytics.filters,
        'priority_pass',
        scopes.segments.priority_pass
      ),
    };
  }

  let dailyRepeatShareRows: DailyRepeatShareRow[] = [];
  let dailyRepeatWarning: string | null = null;
  if (scope.customerType === null) {
    databaseCalls += 1;
    try {
      dailyRepeatShareRows = await loadDailyRepeatShare(
        adminClient,
        scope.locationId,
        resolvedStart,
        resolvedEnd
      );
    } catch (error) {
      logError(error as Error, 'analytics_daily_repeat_failed');
      dailyRepeatWarning = 'Daily repeat-share values could not be loaded.';
    }
  }

  return {
    databaseCalls,
    payload: {
      analytics,
      workforce_analytics: workforceData as unknown as WorkforceAnalytics,
      location_analytics: locationAnalytics,
      segment_analytics: segmentAnalytics,
      daily_repeat_share_rows: dailyRepeatShareRows,
      warnings: {
        comparison: null,
        segment: null,
        daily_repeat: dailyRepeatWarning,
      },
    },
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
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Unauthorized' } },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Unauthorized' } },
        { status: 401 }
      );
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
        {
          error: {
            code: 'dependency_unavailable',
            message: 'Failed to validate access.',
          },
        },
        { status: 503 }
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
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Forbidden' } },
        { status: 403 }
      );
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

    let responsePayload: AnalyticsDashboardPayload | AnalyticsResponse;
    let databaseCalls: number;
    if (searchParams.get('dashboard') === '1') {
      const dashboard = await loadAnalyticsDashboard(adminClient, {
        locationId,
        customerType,
        dateStart,
        dateEnd,
      });
      responsePayload = dashboard.payload;
      databaseCalls = dashboard.databaseCalls;
    } else {
      responsePayload = await loadAnalyticsScope(adminClient, {
        locationId,
        customerType,
        dateStart,
        dateEnd,
        includeOperationalKpis,
      });
      databaseCalls = includeOperationalKpis ? 2 : 1;
    }

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Server-Timing': `analytics-db;desc="${databaseCalls} bounded RPC calls"`,
      },
    });
  } catch (error) {
    logError(error as Error, 'analytics_unhandled_exception');
    return NextResponse.json(
      {
        error: {
          code: 'internal_error',
          message: 'Internal server error.',
        },
      },
      { status: 500 }
    );
  }
}
