import {
  buildChainComparisonSummary,
  buildSegmentComparisonModel,
  buildTrailingAverageBaselineKpis,
  buildExecutiveSummary,
  buildLocationComparisonRows,
  getStoryMode,
  sortLocationComparisonRows,
  type AnalyticsResponse,
  type LocationOption,
} from '@/app/employee/analytics/dashboardModel';

type AnalyticsResponseOverrides = {
  filters?: Partial<AnalyticsResponse['filters']>;
  kpis?: Partial<AnalyticsResponse['kpis']>;
  series?: AnalyticsResponse['series'];
  hourly_series?: AnalyticsResponse['hourly_series'];
  previous_period?:
    | {
        date_start?: string | null;
        date_end?: string | null;
        kpis?:
          | Partial<NonNullable<NonNullable<AnalyticsResponse['previous_period']>['kpis']>>
          | null;
      }
    | null;
};

function makeAnalyticsResponse(overrides?: AnalyticsResponseOverrides): AnalyticsResponse {
  const base: AnalyticsResponse = {
    filters: {
      location_id: null,
      date_start: '2026-03-10',
      date_end: '2026-03-16',
      customer_type: null,
    },
    kpis: {
      arrivals_total: 100,
      arrivals_paying: 60,
      arrivals_non_paying: 40,
      served_total: 82,
      completed_total: 78,
      adjusted_completed_total: 69,
      cancelled_total: 22,
      cancelled_before_served_total: 16,
      completion_rate: 0.78,
      dropoff_rate: 0.22,
      average_queue_length: 1.8,
      utilization_rate: 0.41,
      wait_avg_minutes: 19,
      time_in_system_avg_minutes: 32,
      new_customers_rate: 0.58,
      repeat_customers_rate: 0.42,
    },
    series: [],
    hourly_series: [],
    previous_period: {
      date_start: '2026-03-03',
      date_end: '2026-03-09',
      kpis: {
        arrivals_total: 92,
        completion_rate: 0.84,
        dropoff_rate: 0.16,
        average_queue_length: 1.5,
        utilization_rate: 0.37,
        wait_avg_minutes: 13,
        completed_total: 77,
        adjusted_completed_total: 68,
        cancelled_total: 15,
      },
    },
  };

  const previousPeriod =
    overrides?.previous_period === null
      ? null
      : ({
          ...(base.previous_period ?? {}),
          ...(overrides?.previous_period ?? {}),
          kpis:
            overrides?.previous_period?.kpis === null
              ? null
              : {
                  ...(base.previous_period?.kpis ?? {}),
                  ...(overrides?.previous_period?.kpis ?? {}),
                },
        } as AnalyticsResponse['previous_period']);

  return {
    ...base,
    ...overrides,
    filters: {
      ...base.filters,
      ...(overrides?.filters ?? {}),
    },
    kpis: {
      ...base.kpis,
      ...(overrides?.kpis ?? {}),
    },
    previous_period: previousPeriod,
    series: overrides?.series ?? base.series,
    hourly_series: overrides?.hourly_series ?? base.hourly_series,
  };
}

describe('analytics dashboard model', () => {
  it('selects the correct story mode from the resolved window', () => {
    expect(
      getStoryMode({
        location_id: null,
        date_start: null,
        date_end: null,
        customer_type: null,
      })
    ).toBe('single_day');

    expect(
      getStoryMode({
        location_id: null,
        date_start: '2026-03-01',
        date_end: '2026-03-07',
        customer_type: null,
      })
    ).toBe('multi_day');

    expect(
      getStoryMode({
        location_id: null,
        date_start: '2026-01-01',
        date_end: '2026-03-31',
        customer_type: null,
      })
    ).toBe('long_range');
  });

  it('builds sortable location comparison rows with attention scoring', () => {
    const atlA: LocationOption = {
      id: 'loc-1',
      display_name: 'ATL A',
      airport_code: 'ATL',
      code: 'a',
    };
    const atlB: LocationOption = {
      id: 'loc-2',
      display_name: 'ATL B',
      airport_code: 'ATL',
      code: 'b',
    };

    const rows = buildLocationComparisonRows([
      {
        location: atlA,
        analytics: makeAnalyticsResponse({
          kpis: {
            arrivals_total: 120,
            arrivals_paying: 70,
            arrivals_non_paying: 50,
            served_total: 104,
            completed_total: 100,
            adjusted_completed_total: 86.5,
            cancelled_total: 20,
            cancelled_before_served_total: 5,
            completion_rate: 0.83,
            dropoff_rate: 0.09,
            average_queue_length: 1.3,
            utilization_rate: 0.52,
            wait_avg_minutes: 13.5,
            time_in_system_avg_minutes: 26,
            new_customers_rate: 0.5,
            repeat_customers_rate: 0.5,
          },
          previous_period: {
            date_start: '2026-03-01',
            date_end: '2026-03-07',
            kpis: {
              arrivals_total: 115,
              completion_rate: 0.81,
              dropoff_rate: 0.08,
              average_queue_length: 1.2,
              utilization_rate: 0.49,
              wait_avg_minutes: 12,
              completed_total: 93,
              adjusted_completed_total: 79.75,
              cancelled_total: 22,
            },
          },
        }),
      },
      {
        location: atlB,
        analytics: makeAnalyticsResponse({
          kpis: {
            arrivals_total: 110,
            arrivals_paying: 58,
            arrivals_non_paying: 52,
            served_total: 76,
            completed_total: 68,
            adjusted_completed_total: 56.25,
            cancelled_total: 42,
            cancelled_before_served_total: 25,
            completion_rate: 0.62,
            dropoff_rate: 0.38,
            average_queue_length: 2.4,
            utilization_rate: 0.31,
            wait_avg_minutes: 24,
            time_in_system_avg_minutes: 39,
            new_customers_rate: 0.66,
            repeat_customers_rate: 0.34,
          },
          previous_period: {
            date_start: '2026-03-01',
            date_end: '2026-03-07',
            kpis: {
              arrivals_total: 103,
              completion_rate: 0.74,
              dropoff_rate: 0.26,
              average_queue_length: 1.9,
              utilization_rate: 0.35,
              wait_avg_minutes: 18,
              completed_total: 76,
              adjusted_completed_total: 63.5,
              cancelled_total: 27,
            },
          },
        }),
      },
    ]);

    expect(rows[1]?.issue_label).toBe('Wait above target');
    expect(rows[1]?.attention_score).toBeGreaterThan(rows[0]?.attention_score ?? 0);
    expect(rows[1]?.severity).toBe('urgent');
    expect(rows[0]?.severity).toBe('watch');
    expect(rows[0]?.adjusted_completed_total).toBe(86.5);
    expect(rows[0]?.adjusted_completed_delta).toBeCloseTo(6.75, 5);

    const sorted = sortLocationComparisonRows(rows, 'attention', 'desc');
    expect(sorted[0]?.location_name).toBe('ATL B');
  });

  it('builds a chain comparison summary with totals and weighted rates', () => {
    const rows = [
      {
        location_id: 'loc-1',
        location_name: 'ATL A',
        airport_code: 'ATL',
        code: 'a',
        severity: 'watch' as const,
        arrivals_total: 100,
        served_total: 80,
        completed_total: 75,
        adjusted_completed_total: 64.5,
        cancelled_total: 25,
        cancelled_before_served_total: 10,
        completion_rate: 0.75,
        dropoff_rate: 0.25,
        average_queue_length: 1.4,
        utilization_rate: 0.52,
        wait_avg_minutes: 10,
        time_in_system_avg_minutes: 24,
        paying_share: 0.6,
        repeat_share: 0.4,
        service_conversion_rate: 0.8,
        before_service_loss_rate: 0.1,
        arrivals_delta: 4,
        completed_delta: 5,
        adjusted_completed_delta: 4.25,
        completion_delta: 0.02,
        wait_delta: 1,
        dropoff_delta: 0.01,
        average_queue_length_delta: 0.2,
        utilization_delta: 0.03,
        attention_score: 12,
        issue_label: 'Wait watch',
      },
      {
        location_id: 'loc-2',
        location_name: 'ATL B',
        airport_code: 'ATL',
        code: 'b',
        severity: 'attention' as const,
        arrivals_total: 50,
        served_total: 30,
        completed_total: 25,
        adjusted_completed_total: 19.75,
        cancelled_total: 25,
        cancelled_before_served_total: 15,
        completion_rate: 0.5,
        dropoff_rate: 0.5,
        average_queue_length: 2.3,
        utilization_rate: 0.28,
        wait_avg_minutes: 20,
        time_in_system_avg_minutes: 31,
        paying_share: 0.5,
        repeat_share: 0.5,
        service_conversion_rate: 0.6,
        before_service_loss_rate: 0.3,
        arrivals_delta: -3,
        completed_delta: -7,
        adjusted_completed_delta: -6.5,
        completion_delta: -0.05,
        wait_delta: 5,
        dropoff_delta: 0.06,
        average_queue_length_delta: 0.6,
        utilization_delta: -0.04,
        attention_score: 35,
        issue_label: 'Overall loss above normal',
      },
    ];

    const summary = buildChainComparisonSummary(rows);

    expect(summary?.visible_locations).toBe(2);
    expect(summary?.active_locations).toBe(2);
    expect(summary?.arrivals_total).toBe(150);
    expect(summary?.arrivals_average_per_location).toBe(75);
    expect(summary?.completion_rate).toBeCloseTo(100 / 150, 5);
    expect(summary?.dropoff_rate).toBeCloseTo(50 / 150, 5);
    expect(summary?.before_service_loss_rate).toBeCloseTo(25 / 150, 5);
    expect(summary?.wait_avg_minutes).toBeCloseTo((10 * 80 + 20 * 30) / 110, 5);
  });

  it('builds an executive summary around the largest current risk', () => {
    const atlA: LocationOption = {
      id: 'loc-1',
      display_name: 'ATL A',
      airport_code: 'ATL',
      code: 'a',
    };
    const atlB: LocationOption = {
      id: 'loc-2',
      display_name: 'ATL B',
      airport_code: 'ATL',
      code: 'b',
    };

    const rows = buildLocationComparisonRows([
      {
        location: atlA,
        analytics: makeAnalyticsResponse({
          kpis: {
            arrivals_total: 120,
            arrivals_paying: 76,
            arrivals_non_paying: 44,
            served_total: 112,
            completed_total: 104,
            cancelled_total: 16,
            cancelled_before_served_total: 7,
            completion_rate: 0.87,
            dropoff_rate: 0.13,
            average_queue_length: 1.1,
            utilization_rate: 0.58,
            wait_avg_minutes: 11,
            time_in_system_avg_minutes: 23,
            new_customers_rate: 0.48,
            repeat_customers_rate: 0.52,
          },
          previous_period: {
            date_start: '2026-03-01',
            date_end: '2026-03-07',
            kpis: {
              arrivals_total: 118,
              completion_rate: 0.85,
              dropoff_rate: 0.15,
              average_queue_length: 1.2,
              utilization_rate: 0.54,
              wait_avg_minutes: 12,
              completed_total: 100,
              cancelled_total: 18,
            },
          },
        }),
      },
      {
        location: atlB,
        analytics: makeAnalyticsResponse(),
      },
    ]);

    const summary = buildExecutiveSummary(
      makeAnalyticsResponse(),
      rows,
      'Chain-wide performance',
      'the prior period'
    );

    expect(summary.status).toBe('attention');
    expect(summary.headline).toContain('Adjusted completions totaled');
    expect(summary.headline).toContain('up 1');
    expect(summary.watch_location).toBe('ATL B');
    expect(summary.signals[0]?.title).toContain('ATL B');
    expect(summary.signals[0]?.title).toContain('minutes of wait time');
    expect(summary.signals.some((signal) => signal.title.includes('Overall loss'))).toBe(true);
    expect(summary.summary).toContain('Completed visits totaled 78');
    expect(summary.summary).toContain('overall loss rate');
    expect(summary.summary).toContain('ATL B averaged');
  });

  it('treats zero-visit locations as an attention case instead of healthy', () => {
    const atlA: LocationOption = {
      id: 'loc-1',
      display_name: 'ATL A',
      airport_code: 'ATL',
      code: 'a',
    };
    const atlB: LocationOption = {
      id: 'loc-2',
      display_name: 'ATL B',
      airport_code: 'ATL',
      code: 'b',
    };

    const rows = buildLocationComparisonRows([
      {
        location: atlA,
        analytics: makeAnalyticsResponse({
          kpis: {
            arrivals_total: 120,
            arrivals_paying: 76,
            arrivals_non_paying: 44,
            served_total: 112,
            completed_total: 104,
            cancelled_total: 16,
            cancelled_before_served_total: 7,
            completion_rate: 0.87,
            dropoff_rate: 0.13,
            average_queue_length: 1.1,
            utilization_rate: 0.58,
            wait_avg_minutes: 11,
            time_in_system_avg_minutes: 23,
            new_customers_rate: 0.48,
            repeat_customers_rate: 0.52,
          },
        }),
      },
      {
        location: atlB,
        analytics: makeAnalyticsResponse({
          kpis: {
            arrivals_total: 0,
            arrivals_paying: 0,
            arrivals_non_paying: 0,
            served_total: 0,
            completed_total: 0,
            cancelled_total: 0,
            cancelled_before_served_total: 0,
            completion_rate: null,
            dropoff_rate: null,
            average_queue_length: 0,
            utilization_rate: 0,
            wait_avg_minutes: null,
            time_in_system_avg_minutes: null,
            new_customers_rate: null,
            repeat_customers_rate: null,
          },
          previous_period: {
            date_start: '2026-03-01',
            date_end: '2026-03-07',
            kpis: {
              arrivals_total: 18,
              completion_rate: 0.8,
              dropoff_rate: 0.2,
              average_queue_length: 0.4,
              utilization_rate: 0.12,
              wait_avg_minutes: 10,
              completed_total: 14,
              cancelled_total: 4,
            },
          },
        }),
      },
    ]);

    const sorted = sortLocationComparisonRows(rows, 'attention', 'desc');
    expect(sorted[0]?.location_name).toBe('ATL B');
    expect(sorted[0]?.issue_label).toBe('No visits');
    expect(sorted[0]?.attention_score).toBeGreaterThan(30);
    expect(sorted[0]?.severity).toBe('attention');
  });

  it('builds a trailing daily average baseline from an existing 30-day series window', () => {
    const analytics = makeAnalyticsResponse({
      filters: {
        location_id: null,
        date_start: '2026-02-01',
        date_end: '2026-03-02',
        customer_type: null,
      },
      series: [
        {
          local_date: '2026-02-01',
          arrivals_total: 12,
          arrivals_paying: 7,
          arrivals_non_paying: 5,
          served_total: 10,
          completed_total: 9,
          cancelled_total: 3,
          cancelled_before_served_total: 2,
          completion_rate: 0.75,
          dropoff_rate: 0.25,
          wait_avg_minutes: 15,
          time_in_system_avg_minutes: 29,
        },
        {
          local_date: '2026-02-02',
          arrivals_total: 18,
          arrivals_paying: 10,
          arrivals_non_paying: 8,
          served_total: 16,
          completed_total: 14,
          cancelled_total: 4,
          cancelled_before_served_total: 3,
          completion_rate: 0.78,
          dropoff_rate: 0.22,
          wait_avg_minutes: 12,
          time_in_system_avg_minutes: 27,
        },
      ],
    });

    const baseline = buildTrailingAverageBaselineKpis(analytics);

    expect(baseline?.arrivals_total).toBeCloseTo(1, 5);
    expect(baseline?.completed_total).toBeCloseTo(23 / 30, 5);
    expect(baseline?.adjusted_completed_total).toBeCloseTo(69 / 30, 5);
    expect(baseline?.cancelled_total).toBeCloseTo(7 / 30, 5);
    expect(baseline?.completion_rate).toBeCloseTo(0.765, 5);
    expect(baseline?.dropoff_rate).toBeCloseTo(0.235, 5);
    expect(baseline?.average_queue_length).toBeCloseTo(1.8, 5);
    expect(baseline?.utilization_rate).toBeCloseTo(0.41, 5);
    expect(baseline?.wait_avg_minutes).toBeCloseTo(13.5, 5);
  });

  it('builds a segment comparison model with mix, KPI gaps, and loss concentration', () => {
    const overall = makeAnalyticsResponse({
      kpis: {
        arrivals_total: 100,
        arrivals_paying: 60,
        arrivals_non_paying: 40,
        served_total: 84,
        completed_total: 80,
        cancelled_total: 20,
        cancelled_before_served_total: 14,
        completion_rate: 0.8,
        dropoff_rate: 0.2,
        average_queue_length: 1.7,
        utilization_rate: 0.44,
        wait_avg_minutes: 16,
        time_in_system_avg_minutes: 31,
        new_customers_total: 55,
        repeat_customers_total: 35,
        classified_customers_total: 90,
        new_customers_rate: 55 / 90,
        repeat_customers_rate: 35 / 90,
      },
    });
    const paying = makeAnalyticsResponse({
      filters: {
        location_id: null,
        date_start: '2026-03-10',
        date_end: '2026-03-16',
        customer_type: 'paying',
      },
      kpis: {
        arrivals_total: 60,
        arrivals_paying: 60,
        arrivals_non_paying: 0,
        served_total: 56,
        completed_total: 54,
        cancelled_total: 6,
        cancelled_before_served_total: 3,
        completion_rate: 0.9,
        dropoff_rate: 0.1,
        average_queue_length: 1.2,
        utilization_rate: 0.48,
        wait_avg_minutes: 11,
        time_in_system_avg_minutes: 24,
        new_customers_total: 24,
        repeat_customers_total: 30,
        classified_customers_total: 54,
        new_customers_rate: 0.4,
        repeat_customers_rate: 0.6,
      },
    });
    const priority = makeAnalyticsResponse({
      filters: {
        location_id: null,
        date_start: '2026-03-10',
        date_end: '2026-03-16',
        customer_type: 'priority_pass',
      },
      kpis: {
        arrivals_total: 40,
        arrivals_paying: 0,
        arrivals_non_paying: 40,
        served_total: 28,
        completed_total: 26,
        cancelled_total: 14,
        cancelled_before_served_total: 11,
        completion_rate: 0.65,
        dropoff_rate: 0.35,
        average_queue_length: 2.2,
        utilization_rate: 0.32,
        wait_avg_minutes: 18,
        time_in_system_avg_minutes: 36,
        new_customers_total: 31,
        repeat_customers_total: 5,
        classified_customers_total: 36,
        new_customers_rate: 0.72,
        repeat_customers_rate: 0.28,
      },
    });

    const model = buildSegmentComparisonModel(overall, paying, priority);

    expect(model.mix.paying_total).toBe(60);
    expect(model.mix.priority_total).toBe(40);
    expect(model.mix.new_total).toBe(55);
    expect(model.mix.repeat_total).toBe(35);
    expect(model.mix.classified_total).toBe(90);
    expect(model.mix.interaction_rows).toHaveLength(2);
    expect(model.mix.interaction_rows[0]).toMatchObject({
      key: 'paying',
      label: 'Paying',
      total: 60,
      new_total: 24,
      repeat_total: 30,
      classified_total: 54,
      unclassified_total: 6,
    });
    expect(model.mix.interaction_rows[1]).toMatchObject({
      key: 'priority_pass',
      label: 'Non-paying',
      total: 40,
      new_total: 31,
      repeat_total: 5,
      classified_total: 36,
      unclassified_total: 4,
    });
    expect(model.loss_share.priority).toBeCloseTo(14 / 20, 5);
    expect(model.metrics.map((metric) => metric.key)).toEqual([
      'wait',
      'completion',
      'loss',
      'time_in_system',
      'repeat_share',
    ]);
    expect(model.metrics[0]?.gap_value).toBeCloseTo(7, 5);
    expect(model.metrics[0]?.leading_segment).toBe('paying');
    expect(model.metrics[2]?.leading_segment).toBe('paying');
    expect(model.insights[0]?.title).toBe('Wait gap');
    expect(
      model.insights.some(
        (insight) => insight.title === 'Loss is concentrated in non-paying visits'
      )
    ).toBe(true);
  });

  it('falls back to a stable segment-comparison insight when gaps are narrow', () => {
    const overall = makeAnalyticsResponse();
    const paying = makeAnalyticsResponse({
      filters: {
        location_id: null,
        date_start: '2026-03-10',
        date_end: '2026-03-16',
        customer_type: 'paying',
      },
      kpis: {
        arrivals_total: 52,
        arrivals_paying: 52,
        arrivals_non_paying: 0,
        served_total: 43,
        completed_total: 41,
        cancelled_total: 11,
        cancelled_before_served_total: 7,
        completion_rate: 0.79,
        dropoff_rate: 0.21,
        average_queue_length: 1.7,
        utilization_rate: 0.43,
        wait_avg_minutes: 18,
        time_in_system_avg_minutes: 32,
        new_customers_total: 28,
        repeat_customers_total: 20,
        classified_customers_total: 48,
        new_customers_rate: 0.57,
        repeat_customers_rate: 0.43,
      },
    });
    const priority = makeAnalyticsResponse({
      filters: {
        location_id: null,
        date_start: '2026-03-10',
        date_end: '2026-03-16',
        customer_type: 'priority_pass',
      },
      kpis: {
        arrivals_total: 48,
        arrivals_paying: 0,
        arrivals_non_paying: 48,
        served_total: 39,
        completed_total: 37,
        cancelled_total: 9,
        cancelled_before_served_total: 6,
        completion_rate: 0.77,
        dropoff_rate: 0.19,
        average_queue_length: 1.8,
        utilization_rate: 0.4,
        wait_avg_minutes: 19,
        time_in_system_avg_minutes: 33,
        new_customers_total: 28,
        repeat_customers_total: 20,
        classified_customers_total: 48,
        new_customers_rate: 0.59,
        repeat_customers_rate: 0.41,
      },
    });

    const model = buildSegmentComparisonModel(overall, paying, priority);

    expect(model.insights).toHaveLength(1);
    expect(model.insights[0]?.title).toBe('Segment gaps are narrow');
    expect(model.insights[0]?.tone).toBe('good');
  });
});
