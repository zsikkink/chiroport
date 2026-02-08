'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { ResponsiveCard, Button, LoadingSpinner } from '@/components/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { toLocationSlug } from '@/lib/locationSlug';

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
  cancelled_total: number;
  cancelled_before_served_total: number;
  completion_rate: number | null;
  dropoff_rate: number | null;
  wait_avg_minutes: number | null;
  time_in_system_avg_minutes: number | null;
};

type AnalyticsSeriesRow = AnalyticsKpis & {
  local_date: string;
};

type AnalyticsResponse = {
  filters: AnalyticsFilters;
  kpis: AnalyticsKpis;
  series: AnalyticsSeriesRow[];
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

const DATE_PRESETS: { value: DatePreset; label: string; days?: number }[] = [
  { value: 'latest', label: 'Latest day' },
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

    setLocations(data ?? []);
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

      const params = new URLSearchParams();
      if (selectedLocationId !== 'all') {
        params.set('locationId', selectedLocationId);
      }
      if (selectedCustomerType !== 'all') {
        params.set('customerType', selectedCustomerType);
      }
      if (dateRange.start && dateRange.end) {
        params.set('dateStart', dateRange.start);
        params.set('dateEnd', dateRange.end);
      }

      const url = params.size
        ? `/api/analytics?${params.toString()}`
        : '/api/analytics';

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        });

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
          console.error('[Analytics] API error', {
            status: response.status,
            payload,
            rawText: rawText.slice(0, 500),
            locationId: selectedLocationId,
            customerType: selectedCustomerType,
            dateStart: dateRange.start,
            dateEnd: dateRange.end,
          });
          const errorMessage =
            (payload &&
              typeof payload === 'object' &&
              'error' in payload &&
              typeof (payload as { error?: string }).error === 'string' &&
              (payload as { error?: string }).error) ||
            'Failed to load analytics.';
          setAnalyticsError(errorMessage);
          setAnalyticsData(null);
          return;
        }

        if (!payload) {
          console.error('[Analytics] Empty response payload', {
            status: response.status,
            rawText: rawText.slice(0, 500),
          });
          setAnalyticsError('Failed to load analytics.');
          setAnalyticsData(null);
          return;
        }

        setAnalyticsData(payload as AnalyticsResponse);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[Analytics] Network error', {
            error,
            locationId: selectedLocationId,
            customerType: selectedCustomerType,
            dateStart: dateRange.start,
            dateEnd: dateRange.end,
          });
          setAnalyticsError('Failed to load analytics.');
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
      <div className="relative z-10 max-w-7xl mx-auto space-y-6 px-4 sm:px-8 py-10">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Analytics
              </p>
              <h1 className="text-3xl sm:text-4xl font-libre-baskerville">
                Employee Dashboard
              </h1>
              <p className="text-sm text-slate-500">
                Track arrivals, wait times, completion, and dropoff trends across locations.
              </p>
            </div>
            <Button variant="secondary" onClick={handleSignOut} className="self-start">
              Sign Out
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              Signed in as {currentUser.email} (admin)
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
              Live data
            </span>
          </div>
          {uiError ? (
            <p className="text-sm text-red-200">{uiError}</p>
          ) : null}
          {analyticsError ? (
            <p className="text-sm text-red-200">{analyticsError}</p>
          ) : null}
        </header>

        <ResponsiveCard className="border border-slate-200 bg-white">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              Location
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 px-3 py-2 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              Date range
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 px-3 py-2 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              Customer type
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 px-3 py-2 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
          <p className="mt-3 text-xs text-slate-500">
            Non-paying customers are treated as Priority Pass in analytics.
          </p>
        </ResponsiveCard>

        {analyticsLoading ? (
          <LoadingSpinner text="Loading analytics..." />
        ) : analyticsData ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <span>
                Data range:{' '}
                {analyticsData.filters.date_start &&
                analyticsData.filters.date_end
                  ? `${analyticsData.filters.date_start} → ${analyticsData.filters.date_end}`
                  : 'Latest day'}
              </span>
              <span>
                Customer filter:{' '}
                {analyticsData.filters.customer_type
                  ? analyticsData.filters.customer_type === 'paying'
                    ? 'Paying'
                    : 'Priority Pass'
                  : 'All'}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: 'Total arrivals',
                  value: formatNumber(analyticsData.kpis.arrivals_total),
                },
                {
                  label: 'Paying arrivals',
                  value: formatNumber(analyticsData.kpis.arrivals_paying),
                },
                {
                  label: 'Priority Pass arrivals',
                  value: formatNumber(analyticsData.kpis.arrivals_non_paying),
                },
                {
                  label: 'Served total',
                  value: formatNumber(analyticsData.kpis.served_total),
                },
                {
                  label: 'Completed total',
                  value: formatNumber(analyticsData.kpis.completed_total),
                },
                {
                  label: 'Cancelled total',
                  value: formatNumber(analyticsData.kpis.cancelled_total),
                },
                {
                  label: 'Completion rate',
                  value: formatPercent(analyticsData.kpis.completion_rate),
                },
                {
                  label: 'Dropoff rate',
                  value: formatPercent(analyticsData.kpis.dropoff_rate),
                },
                {
                  label: 'Avg wait (mins)',
                  value: formatNumber(analyticsData.kpis.wait_avg_minutes, 1),
                },
                {
                  label: 'Avg time in system (mins)',
                  value: formatNumber(
                    analyticsData.kpis.time_in_system_avg_minutes,
                    1
                  ),
                },
                {
                  label: 'Cancelled before served',
                  value: formatNumber(
                    analyticsData.kpis.cancelled_before_served_total
                  ),
                },
              ].map((item) => (
                <ResponsiveCard
                  key={item.label}
                  className="border border-slate-200 bg-white py-4 shadow-sm"
                >
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {item.value}
                  </p>
                </ResponsiveCard>
              ))}
            </div>

            <ResponsiveCard className="border border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Daily breakdown</h2>
                <span className="text-xs text-slate-500">
                  {analyticsData.series.length} days
                </span>
              </div>
              {analyticsData.series.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No data available for the selected filters.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">
                      <tr>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Arrivals</th>
                        <th className="py-2 pr-4">Paying</th>
                        <th className="py-2 pr-4">Priority Pass</th>
                        <th className="py-2 pr-4">Served</th>
                        <th className="py-2 pr-4">Completed</th>
                        <th className="py-2 pr-4">Cancelled</th>
                        <th className="py-2 pr-4">Completion %</th>
                        <th className="py-2 pr-4">Dropoff %</th>
                        <th className="py-2 pr-4">Avg wait</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {analyticsData.series.map((row) => (
                        <tr
                          key={row.local_date}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-2 pr-4">{row.local_date}</td>
                          <td className="py-2 pr-4">
                            {formatNumber(row.arrivals_total)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatNumber(row.arrivals_paying)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatNumber(row.arrivals_non_paying)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatNumber(row.served_total)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatNumber(row.completed_total)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatNumber(row.cancelled_total)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatPercent(row.completion_rate)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatPercent(row.dropoff_rate)}
                          </td>
                          <td className="py-2 pr-4">
                            {formatNumber(row.wait_avg_minutes, 1)}m
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ResponsiveCard>
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
              className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-left text-blue-700"
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
