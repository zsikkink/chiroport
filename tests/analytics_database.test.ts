/** @jest-environment node */

import { createServiceClient, getTestEnv, randomPhone } from './helpers/supabase';

const env = getTestEnv();
const itIf = env?.serviceKey ? test : test.skip;

type Kpis = Record<string, number | null>;

describe('bounded analytics database contract', () => {
  itIf('preserves aggregate semantics and computes interval metrics in one scope result', async () => {
    const service = createServiceClient(env!);
    const { data: location } = await service
      .from('locations')
      .select('id,timezone')
      .eq('airport_code', 'HOU')
      .eq('code', 'west-concourse')
      .single();
    const { data: queue } = await service
      .from('queues')
      .select('id')
      .eq('location_id', location!.id)
      .eq('code', 'default')
      .single();
    const { data: consents } = await service
      .from('consent_versions')
      .select('id,key')
      .in('key', [
        'queue_join_consent_chiropractic',
        'queue_join_consent_bodywork',
      ])
      .eq('is_active', true);
    const chiropracticConsent = consents?.find(
      (row) => row.key === 'queue_join_consent_chiropractic'
    )?.id;
    const bodyworkConsent = consents?.find(
      (row) => row.key === 'queue_join_consent_bodywork'
    )?.id;
    expect(chiropracticConsent).toBeTruthy();
    expect(bodyworkConsent).toBeTruthy();

    const phones = [randomPhone(), randomPhone(), randomPhone()];
    const { data: customers, error: customerError } = await service
      .from('customers')
      .insert(
        phones.map((phone, index) => ({
          full_name: `Analytics Fixture ${index + 1}`,
          phone_e164: phone,
          email: `analytics-${index + 1}@example.com`,
        }))
      )
      .select('id,phone_e164');
    expect(customerError).toBeNull();

    const customerId = (phone: string) =>
      customers?.find((customer) => customer.phone_e164 === phone)?.id;
    const entries = [
      {
        queue_id: queue!.id,
        customer_id: customerId(phones[0]!),
        customer_type: 'paying' as const,
        consent_version_id: chiropracticConsent!,
        offering_code: 'chiropractic',
        service_label: 'Chiropractor',
        sort_key: 1,
        status: 'completed' as const,
        created_at: '2026-08-19T14:00:00.000Z',
        consent_accepted_at: '2026-08-19T14:00:00.000Z',
        served_at: '2026-08-19T14:20:00.000Z',
        completed_at: '2026-08-19T14:40:00.000Z',
      },
      {
        queue_id: queue!.id,
        customer_id: customerId(phones[0]!),
        customer_type: 'paying' as const,
        consent_version_id: chiropracticConsent!,
        offering_code: 'chiropractic',
        service_label: 'Chiropractor',
        sort_key: 2,
        status: 'completed' as const,
        created_at: '2026-08-20T14:00:00.000Z',
        consent_accepted_at: '2026-08-20T14:00:00.000Z',
        served_at: '2026-08-20T14:10:00.000Z',
        completed_at: '2026-08-20T14:30:00.000Z',
      },
      {
        queue_id: queue!.id,
        customer_id: customerId(phones[1]!),
        customer_type: 'priority_pass' as const,
        consent_version_id: bodyworkConsent!,
        offering_code: 'priority_pass',
        service_label: 'Priority Pass',
        sort_key: 1,
        status: 'completed' as const,
        created_at: '2026-08-20T14:05:00.000Z',
        consent_accepted_at: '2026-08-20T14:05:00.000Z',
        served_at: '2026-08-20T14:25:00.000Z',
        completed_at: '2026-08-20T14:45:00.000Z',
      },
      {
        queue_id: queue!.id,
        customer_id: customerId(phones[2]!),
        customer_type: 'paying' as const,
        consent_version_id: chiropracticConsent!,
        offering_code: 'chiropractic',
        service_label: 'Chiropractor',
        sort_key: 3,
        status: 'cancelled' as const,
        created_at: '2026-08-20T15:00:00.000Z',
        consent_accepted_at: '2026-08-20T15:00:00.000Z',
        cancelled_at: '2026-08-20T15:15:00.000Z',
      },
    ];

    const { data: inserted, error: insertError } = await service
      .from('queue_entries')
      .insert(entries)
      .select('id');
    expect(insertError).toBeNull();

    try {
      const [legacy, bounded] = await Promise.all([
        service.rpc('get_admin_analytics', {
          p_location_id: location!.id,
          p_date_start: '2026-08-20',
          p_date_end: '2026-08-20',
          p_customer_type: null,
        }),
        service.rpc('get_admin_dashboard_scopes', {
          p_location_id: location!.id,
          p_date_start: '2026-08-20',
          p_date_end: '2026-08-20',
          p_customer_type: null,
        }),
      ]);
      expect(legacy.error).toBeNull();
      expect(bounded.error).toBeNull();

      const legacyKpis = (legacy.data as { kpis: Kpis }).kpis;
      const scope = bounded.data as unknown as {
        primary_current_kpis: Kpis;
        locations: Array<{
          location: { id: string };
          current_kpis: Kpis;
        }>;
        segments: { paying: Kpis; priority_pass: Kpis };
      };
      const current = scope.primary_current_kpis;

      for (const key of [
        'arrivals_total',
        'arrivals_paying',
        'arrivals_non_paying',
        'served_total',
        'completed_total',
        'cancelled_total',
        'cancelled_before_served_total',
        'completion_rate',
        'dropoff_rate',
        'wait_avg_minutes',
        'time_in_system_avg_minutes',
        'new_customers_total',
        'repeat_customers_total',
        'classified_customers_total',
        'new_customers_rate',
        'repeat_customers_rate',
      ]) {
        expect(Number(current[key])).toBeCloseTo(Number(legacyKpis[key]), 8);
      }

      expect(current).toMatchObject({
        arrivals_total: 3,
        arrivals_paying: 2,
        arrivals_non_paying: 1,
        served_total: 2,
        completed_total: 2,
        adjusted_completed_total: 1.25,
        cancelled_total: 1,
        cancelled_before_served_total: 1,
        repeat_customers_total: 1,
        new_customers_total: 2,
      });
      expect(Number(current.wait_avg_minutes)).toBeCloseTo(15, 8);
      expect(Number(current.time_in_system_avg_minutes)).toBeCloseTo(35, 8);
      // HOU is seeded 08:00–18:00: ten hours (600 minutes), not twelve.
      expect(Number(current.average_queue_length)).toBeCloseTo(45 / 600, 8);
      expect(Number(current.utilization_rate)).toBeCloseTo(35 / 600, 8);

      const locationScope = scope.locations.find(
        (row) => row.location.id === location!.id
      );
      expect(locationScope?.current_kpis).toEqual(current);
      expect(scope.segments.paying.arrivals_total).toBe(2);
      expect(scope.segments.priority_pass.arrivals_total).toBe(1);
    } finally {
      const entryIds = inserted?.map((entry) => entry.id) ?? [];
      if (entryIds.length) {
        await service.from('sms_outbox').delete().in('queue_entry_id', entryIds);
        await service.from('queue_entries').delete().in('id', entryIds);
      }
      const customerIds = customers?.map((customer) => customer.id) ?? [];
      if (customerIds.length) {
        await service.from('customers').delete().in('id', customerIds);
      }
    }
  });

  itIf('keeps a selected closed location available for historical reporting', async () => {
    const service = createServiceClient(env!);
    const [{ data: location }, { data: consent }] = await Promise.all([
      service
        .from('locations')
        .select('id')
        .eq('airport_code', 'DFW')
        .eq('code', 'concourse-a')
        .eq('is_open', false)
        .single(),
      service
        .from('consent_versions')
        .select('id')
        .eq('key', 'queue_join_consent_chiropractic')
        .eq('is_active', true)
        .single(),
    ]);
    const { data: queue } = await service
      .from('queues')
      .select('id')
      .eq('location_id', location!.id)
      .eq('code', 'default')
      .single();
    const phone = randomPhone();
    const { data: customer } = await service
      .from('customers')
      .insert({
        full_name: 'Closed Analytics Fixture',
        phone_e164: phone,
        email: 'closed-analytics@example.com',
      })
      .select('id')
      .single();
    const { data: entry, error: entryError } = await service
      .from('queue_entries')
      .insert({
        queue_id: queue!.id,
        customer_id: customer!.id,
        customer_type: 'paying',
        consent_version_id: consent!.id,
        consent_accepted_at: '2026-08-20T15:00:00.000Z',
        offering_code: 'chiropractic',
        service_label: 'Chiropractor',
        sort_key: 1,
        status: 'completed',
        created_at: '2026-08-20T15:00:00.000Z',
        served_at: '2026-08-20T15:10:00.000Z',
        completed_at: '2026-08-20T15:25:00.000Z',
      })
      .select('id')
      .single();
    expect(entryError).toBeNull();

    try {
      const { data, error } = await service.rpc(
        'get_admin_dashboard_scopes',
        {
          p_location_id: location!.id,
          p_date_start: '2026-08-20',
          p_date_end: '2026-08-20',
        }
      );
      expect(error).toBeNull();
      const scope = data as unknown as {
        primary_current_kpis: { arrivals_total: number };
        locations: Array<{ location: { id: string } }>;
      };
      expect(scope.primary_current_kpis.arrivals_total).toBe(1);
      expect(
        scope.locations.some((row) => row.location.id === location!.id)
      ).toBe(false);
    } finally {
      if (entry?.id) {
        await service.from('sms_outbox').delete().eq('queue_entry_id', entry.id);
        await service.from('queue_entries').delete().eq('id', entry.id);
      }
      await service.from('customers').delete().eq('id', customer!.id);
    }
  });
});
