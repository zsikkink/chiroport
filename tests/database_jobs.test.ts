/** @jest-environment node */

import { createServiceClient, getTestEnv } from './helpers/supabase';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const env = getTestEnv();
const itIf = env?.serviceKey ? test : test.skip;

describe('scheduled database jobs', () => {
  itIf('conserves fixture totals and weighted means across rollup, replay, and rebuild', () => {
    const url = new URL(process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Synthetic rollup fixture requires local PostgreSQL');
    expect(() => execFileSync('psql', [url.toString(), '-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, 'fixtures/rollup-conservation.sql')], { stdio: ['ignore', 'pipe', 'pipe'] })).not.toThrow();
  });
  itIf('expires prior-location-day waiting, serving, and completed operational visits while retaining legal/contact evidence', () => {
    const url = new URL(process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        !['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash || url.pathname !== '/postgres') {
      throw new Error('Synthetic midnight fixture requires plain local PostgreSQL without connection overrides');
    }
    if (process.env.CHIROPORT_LOCAL_DEMO !== '1' ||
        Object.entries(process.env).some(([key, value]) => key.startsWith('TWILIO_') && value)) {
      throw new Error('Synthetic midnight fixture requires explicit provider-free local mode');
    }
    // Record current policy, including unsettled visits. All global rollup
    // effects and fixtures are rolled back; no retention rule is changed.
    const sql = `
      begin;
      do $$
      declare
        v_location_id uuid := gen_random_uuid();
        v_queue_id uuid := gen_random_uuid();
        v_entry_ids uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
        v_inbound_ids uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
        v_statuses public.queue_status[] := array['waiting', 'serving', 'completed', 'waiting']::public.queue_status[];
        v_reference timestamptz := date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York';
        v_customer_id uuid;
        v_consent_id uuid;
        v_created_at timestamptz;
        v_legal_before jsonb;
        v_contacts_before jsonb;
        v_events_before uuid[];
        v_outbox_before uuid[];
      begin
        if exists (select 1 from cron.job where active) then
          raise exception 'Synthetic midnight fixture requires disabled local cron';
        end if;
        select id into strict v_consent_id from public.consent_versions
          where is_active and key = 'queue_join_consent_chiropractic';
        insert into public.locations (id, airport_code, code, display_name, timezone)
          values (v_location_id, 'ATL', v_location_id::text, 'Synthetic midnight fixture', 'America/New_York');
        insert into public.queues (id, location_id) values (v_queue_id, v_location_id);
        for i in 1..4 loop
          v_created_at := case when i = 4 then v_reference + interval '1 minute' else v_reference - interval '10 minutes' end;
          insert into public.customers (full_name, phone_e164, email)
            values ('Synthetic midnight visitor', '+1202555018' || i::text, 'midnight@example.invalid')
            returning id into v_customer_id;
          insert into public.queue_entries (id, queue_id, customer_id, customer_type, status, created_at,
              served_at, completed_at, consent_version_id, consent_accepted_at, service_label, offering_code, sort_key)
            values (v_entry_ids[i], v_queue_id, v_customer_id, 'paying', v_statuses[i], v_created_at,
              case when i in (2, 3) then v_created_at + interval '1 minute' end,
              case when i = 3 then v_created_at + interval '2 minutes' end,
              v_consent_id, v_created_at, 'Chiropractor', 'chiropractic', i);
          insert into public.queue_events (queue_entry_id, event_type)
            values (v_entry_ids[i], 'synthetic_midnight_fixture');
          insert into public.sms_outbox (queue_entry_id, message_type, to_phone, body, status, idempotency_key)
            values (v_entry_ids[i], 'employee', '+1202555018' || i::text, 'Synthetic fixture only', 'queued', 'midnight:' || v_entry_ids[i]::text);
          insert into public.sms_inbound (id, queue_entry_id, from_phone, to_phone, body)
            values (v_inbound_ids[i], v_entry_ids[i], '+1202555018' || i::text, '+12025550199', 'Synthetic fixture only');
        end loop;
        select jsonb_agg(to_jsonb(t) order by t.queue_entry_id) into v_legal_before
          from public.queue_entries_legal_archive t where t.queue_entry_id = any(v_entry_ids);
        select jsonb_agg(to_jsonb(t) order by t.id) into v_contacts_before
          from public.customer_contact_snapshots t where t.id in
            (select contact_snapshot_id from public.queue_entries_legal_archive where queue_entry_id = any(v_entry_ids));
        if jsonb_array_length(v_legal_before) is distinct from 4 or jsonb_array_length(v_contacts_before) is distinct from 4 then
          raise exception 'Synthetic legal/contact capture incomplete';
        end if;
        select array_agg(id) into v_events_before from public.queue_events where queue_entry_id = v_entry_ids[4];
        select array_agg(id) into v_outbox_before from public.sms_outbox where queue_entry_id = v_entry_ids[4];

        -- The UTC date has already changed, but the location day has not.
        perform public.rollup_queue_daily_stats(v_reference - interval '1 second');
        if (select count(*) from public.queue_entries where id = any(v_entry_ids)) <> 4 then
          raise exception 'Operational visits expired before location-local midnight';
        end if;
        drop table pg_temp.tmp_monthly_rollup, pg_temp.tmp_monthly_rollup_global;
        perform public.rollup_queue_daily_stats(v_reference);

        if exists (select 1 from public.queue_entries where id = any(v_entry_ids[1:3])) or
            (select count(*) from public.queue_entries where id = v_entry_ids[4] and status = 'waiting') <> 1 then
          raise exception 'Prior-day statuses must expire while current-day waiting remains';
        end if;
        if (select count(*) from public.queue_entries_archive where id = any(v_entry_ids[1:3])) <> 3 or exists
            (select 1 from public.queue_entries_archive where id = any(v_entry_ids[1:3]) and status is distinct from v_statuses[array_position(v_entry_ids, id)]) then
          raise exception 'Prior-day archive must retain all three original statuses';
        end if;
        if exists (select 1 from public.queue_events where queue_entry_id = any(v_entry_ids[1:3])) or
            exists (select 1 from public.sms_outbox where queue_entry_id = any(v_entry_ids[1:3])) then
          raise exception 'Operational events and pending outbox must cascade on expiry';
        end if;
        -- Expiry can notify the new head; all existing current-day rows survive.
        if (select count(*) from public.queue_events where id = any(v_events_before)) <> cardinality(v_events_before) or
            (select count(*) from public.sms_outbox where id = any(v_outbox_before)) <> cardinality(v_outbox_before) then
          raise exception 'Current-day events/outbox must remain';
        end if;
        if (select count(*) from public.sms_inbound where id = any(v_inbound_ids[1:3]) and queue_entry_id is null) <> 3 or
            (select count(*) from public.sms_inbound where id = v_inbound_ids[4] and queue_entry_id = v_entry_ids[4]) <> 1 then
          raise exception 'Inbound receipts must remain with only expired visit IDs disassociated';
        end if;
        if (select jsonb_agg(to_jsonb(t) order by t.queue_entry_id) from public.queue_entries_legal_archive t where t.queue_entry_id = any(v_entry_ids))
            is distinct from v_legal_before or
            (select jsonb_agg(to_jsonb(t) order by t.id) from public.customer_contact_snapshots t where t.id in
              (select contact_snapshot_id from public.queue_entries_legal_archive where queue_entry_id = any(v_entry_ids)))
            is distinct from v_contacts_before then
          raise exception 'Rollup must preserve captured legal rows and contacts byte-for-byte';
        end if;
      end $$;
      rollback;
    `;
    const localEnv = { ...process.env };
    for (const key of Object.keys(localEnv)) {
      if (key.startsWith('PG')) delete localEnv[key];
    }
    try {
      execFileSync('psql', [url.toString(), '-X', '-q', '-v', 'ON_ERROR_STOP=1'], {
        input: sql, env: localEnv, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000,
      });
    } catch {
      // Child-process errors include the connection URL; never emit credentials.
      throw new Error('Synthetic midnight fixture failed; required database invariants did not pass');
    }
  }, 25_000);
  itIf('can execute both monthly rollup paths', async () => {
    const service = createServiceClient(env!);
    const today = new Date().toISOString().slice(0, 10);

    const rebuild = await service.rpc('rebuild_queue_monthly_stats', {
      p_start: today,
      p_end: today,
    });
    expect(rebuild.error).toBeNull();

    const rollup = await service.rpc('rollup_queue_monthly_stats');
    expect(rollup.error).toBeNull();
  });
});
