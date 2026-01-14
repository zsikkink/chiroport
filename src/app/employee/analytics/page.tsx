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

type StatLocation = {
  display_name: string | null;
  airport_code: string | null;
  code: string | null;
};

type StatsRow = {
  id?: string;
  location_id?: string | null;
  local_date?: string | null;
  month_start?: string | null;
  timezone?: string | null;
  created_at?: string | null;
  locations?: StatLocation | null;
  [key: string]: unknown;
};

const supabase = getSupabaseBrowserClient();

const METADATA_KEYS = new Set(['locations', 'local_date', 'month_start']);

function formatMetricLabel(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetricValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function buildMetricEntries(row: StatsRow) {
  const entries = Object.entries(row).filter(
    ([key]) => !METADATA_KEYS.has(key)
  );
  entries.sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  return entries;
}

function getLocationLabel(row: StatsRow) {
  if (row.location_id == null) {
    return 'All locations';
  }
  return row.locations?.display_name ?? row.location_id ?? 'Unknown location';
}

function getDateLabel(row: StatsRow) {
  if (row.local_date) {
    return row.local_date;
  }
  if (row.month_start) {
    return row.month_start;
  }
  return '—';
}

export default function AnalyticsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [dailyStats, setDailyStats] = useState<StatsRow[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<StatsRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
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
      setStatsError(error.message);
      return;
    }

    setLocations(data ?? []);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    const supabaseAny = supabase as unknown as {
      from: (table: string) => {
        select: (query: string) => {
          order: (column: string, options?: { ascending?: boolean }) => Promise<{
            data: StatsRow[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };

    const [daily, monthly] = await Promise.all([
      supabaseAny
        .from('queue_daily_stats')
        .select('*, locations(display_name, airport_code, code)')
        .order('local_date', { ascending: false }),
      supabaseAny
        .from('queue_monthly_stats')
        .select('*, locations(display_name, airport_code, code)')
        .order('month_start', { ascending: false }),
    ]);

    if (daily.error || monthly.error) {
      setStatsError(
        daily.error?.message ||
          monthly.error?.message ||
          'Failed to load analytics.'
      );
    } else {
      setDailyStats(daily.data ?? []);
      setMonthlyStats(monthly.data ?? []);
    }

    setStatsLoading(false);
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
    loadStats();
  }, [isAdmin, loadLocations, loadStats]);

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
    <div className="min-h-screen px-4 sm:px-8 py-8">
      {!isLocationMenuOpen ? (
        <div className="fixed left-4 top-8 z-50">
          <button
            type="button"
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
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
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-libre-baskerville">
              Analytics · Employee Dashboard
            </h1>
            <Button variant="secondary" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
          <p className="text-sm text-white/80">
            Signed in as {currentUser.email} (admin)
          </p>
          {statsError ? (
            <p className="text-sm text-red-200">{statsError}</p>
          ) : null}
        </header>

        {statsLoading ? (
          <LoadingSpinner text="Loading analytics..." />
        ) : (
          <div className="space-y-6">
            <ResponsiveCard title="Daily Stats (last 7 days)" className="space-y-3">
              {dailyStats.length === 0 ? (
                <p className="text-sm text-white/70">No daily stats available.</p>
              ) : (
                dailyStats.map((row) => {
                  const key =
                    row.id ??
                    `${row.location_id ?? 'all'}:${row.local_date ?? 'unknown'}`;
                  return (
                    <details
                      key={key}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        {getLocationLabel(row)} · {getDateLabel(row)}{' '}
                        {row.timezone ? `(${row.timezone})` : ''}
                      </summary>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        {buildMetricEntries(row).map(([field, value]) => (
                          <div key={field} className="flex justify-between gap-3">
                            <span className="text-white/70">
                              {formatMetricLabel(field)}
                            </span>
                            <span className="text-white">
                              {formatMetricValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })
              )}
            </ResponsiveCard>

            <ResponsiveCard title="Monthly Stats" className="space-y-3">
              {monthlyStats.length === 0 ? (
                <p className="text-sm text-white/70">No monthly stats available.</p>
              ) : (
                monthlyStats.map((row) => {
                  const key =
                    row.id ??
                    `${row.location_id ?? 'all'}:${row.month_start ?? 'unknown'}`;
                  return (
                    <details
                      key={key}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        {getLocationLabel(row)} · {getDateLabel(row)}{' '}
                        {row.timezone ? `(${row.timezone})` : ''}
                      </summary>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        {buildMetricEntries(row).map(([field, value]) => (
                          <div key={field} className="flex justify-between gap-3">
                            <span className="text-white/70">
                              {formatMetricLabel(field)}
                            </span>
                            <span className="text-white">
                              {formatMetricValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })
              )}
            </ResponsiveCard>
          </div>
        )}
      </div>

      <div
        className={`fixed inset-0 z-40 ${
          isLocationMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${
            isLocationMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeLocationMenu}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-white/10 bg-[#1f241f] p-5 transition-transform ${
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
              className="w-full rounded-md border border-emerald-300/60 bg-emerald-500/20 px-3 py-2 text-left text-emerald-100"
            >
              <p className="text-sm font-semibold">Analytics</p>
            </button>
            {locationOptions.length === 0 ? (
              <p className="text-sm text-white/70">No locations available.</p>
            ) : (
              locationOptions.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => handleLocationSelect(location.id)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-white hover:bg-white/10"
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
