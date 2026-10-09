/** @jest-environment node */

import { loadAnalyticsDashboard } from '@/app/api/analytics/route';

function analyticsResponse() {
  return {
    filters: {
      location_id: null,
      date_start: '2026-08-27',
      date_end: '2026-08-27',
      customer_type: null,
    },
    kpis: { arrivals_total: 0 },
    series: [],
    hourly_series: [],
    previous_period: null,
  };
}

function scopeResponse(locationCount: number) {
  const emptyKpis = { arrivals_total: 0 };
  return {
    date_start: '2026-08-27',
    date_end: '2026-08-27',
    baseline_date_start: '2026-07-28',
    baseline_date_end: '2026-08-26',
    baseline_mode: 'trailing_daily_average',
    primary_current_kpis: emptyKpis,
    primary_baseline_kpis: emptyKpis,
    locations: Array.from({ length: locationCount }, (_, index) => ({
      location: {
        id: `location-${index}`,
        display_name: `Location ${index}`,
        airport_code: 'TST',
        code: `location-${index}`,
      },
      current_kpis: emptyKpis,
      baseline_kpis: emptyKpis,
    })),
    segments: {
      paying: emptyKpis,
      priority_pass: emptyKpis,
    },
  };
}

function fakeAnalyticsClient(locationCount: number) {
  const calls: string[] = [];
  const client = {
    async rpc(name: string) {
      calls.push(name);
      if (name === 'get_admin_analytics') {
        return { data: analyticsResponse(), error: null };
      }
      if (name === 'get_admin_dashboard_scopes') {
        return { data: scopeResponse(locationCount), error: null };
      }
      if (name === 'get_admin_workforce_analytics') {
        return { data: { employees: [], priority_unserved_total: 0 }, error: null };
      }
      if (name === 'get_admin_daily_repeat_share') {
        return { data: [], error: null };
      }
      return { data: null, error: { message: `Unexpected RPC ${name}` } };
    },
  };
  return { client: client as never, calls };
}

describe('analytics dashboard orchestration', () => {
  it.each([1, 8, 40])(
    'keeps database calls fixed with %i locations',
    async (locationCount) => {
      const fake = fakeAnalyticsClient(locationCount);
      const result = await loadAnalyticsDashboard(fake.client, {
        locationId: null,
        customerType: null,
        dateStart: '2026-08-27',
        dateEnd: '2026-08-27',
      });

      expect(result.databaseCalls).toBe(4);
      expect(fake.calls).toEqual([
        'get_admin_analytics',
        'get_admin_dashboard_scopes',
        'get_admin_workforce_analytics',
        'get_admin_daily_repeat_share',
      ]);
      expect(result.payload.location_analytics).toHaveLength(locationCount);
    }
  );
});
