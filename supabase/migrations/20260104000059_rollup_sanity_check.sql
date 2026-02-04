begin;

create table if not exists public.queue_rollup_anomalies (
  id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null default now(),
  rollup_level text not null,
  location_id uuid null,
  period_start date not null,
  metric text not null,
  metric_value numeric null,
  detail jsonb null
);

create index if not exists idx_queue_rollup_anomalies_detected_at
  on public.queue_rollup_anomalies (detected_at desc);
create index if not exists idx_queue_rollup_anomalies_period
  on public.queue_rollup_anomalies (rollup_level, period_start);

create or replace function public.queue_rollup_sanity_check(
  p_since date default (current_date - interval '90 days')::date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  insert into public.queue_rollup_anomalies (
    rollup_level,
    location_id,
    period_start,
    metric,
    metric_value,
    detail
  )
  select
    'daily' as rollup_level,
    d.location_id,
    d.local_date as period_start,
    'completion_rate_paying' as metric,
    d.completion_rate_paying as metric_value,
    jsonb_build_object(
      'arrivals_paying', d.arrivals_paying,
      'arrivals_total', d.arrivals_total
    ) as detail
  from public.queue_daily_stats d
  where d.local_date >= p_since
    and d.completion_rate_paying is not null
    and (d.completion_rate_paying < 0 or d.completion_rate_paying > 1)

  union all
  select
    'daily',
    d.location_id,
    d.local_date,
    'completion_rate_priority',
    d.completion_rate_priority,
    jsonb_build_object(
      'arrivals_priority', d.arrivals_priority,
      'arrivals_total', d.arrivals_total
    )
  from public.queue_daily_stats d
  where d.local_date >= p_since
    and d.completion_rate_priority is not null
    and (d.completion_rate_priority < 0 or d.completion_rate_priority > 1)

  union all
  select
    'daily',
    d.location_id,
    d.local_date,
    'counts_inconsistent',
    null,
    jsonb_build_object(
      'arrivals_total', d.arrivals_total,
      'arrivals_paying', d.arrivals_paying,
      'arrivals_priority', d.arrivals_priority,
      'served_total', d.served_total,
      'completed_total', d.completed_total
    )
  from public.queue_daily_stats d
  where d.local_date >= p_since
    and (
      d.arrivals_paying > d.arrivals_total
      or d.arrivals_priority > d.arrivals_total
      or d.served_total > d.arrivals_total
      or d.completed_total > d.served_total
    )

  union all
  select
    'monthly',
    m.location_id,
    m.month_start,
    'completion_rate_paying',
    m.completion_rate_paying,
    jsonb_build_object(
      'arrivals_paying', m.arrivals_paying,
      'arrivals_total', m.arrivals_total
    )
  from public.queue_monthly_stats m
  where m.month_start >= date_trunc('month', p_since)::date
    and m.completion_rate_paying is not null
    and (m.completion_rate_paying < 0 or m.completion_rate_paying > 1)

  union all
  select
    'monthly',
    m.location_id,
    m.month_start,
    'completion_rate_priority',
    m.completion_rate_priority,
    jsonb_build_object(
      'arrivals_priority', m.arrivals_priority,
      'arrivals_total', m.arrivals_total
    )
  from public.queue_monthly_stats m
  where m.month_start >= date_trunc('month', p_since)::date
    and m.completion_rate_priority is not null
    and (m.completion_rate_priority < 0 or m.completion_rate_priority > 1)

  union all
  select
    'monthly',
    m.location_id,
    m.month_start,
    'counts_inconsistent',
    null,
    jsonb_build_object(
      'arrivals_total', m.arrivals_total,
      'arrivals_paying', m.arrivals_paying,
      'arrivals_priority', m.arrivals_priority,
      'served_total', m.served_total,
      'completed_total', m.completed_total,
      'wait_count', m.wait_count,
      'time_in_system_count', m.time_in_system_count,
      'service_count', m.service_count
    )
  from public.queue_monthly_stats m
  where m.month_start >= date_trunc('month', p_since)::date
    and (
      m.arrivals_paying > m.arrivals_total
      or m.arrivals_priority > m.arrivals_total
      or m.served_total > m.arrivals_total
      or m.completed_total > m.served_total
      or m.wait_count <> m.served_total
      or m.time_in_system_count <> m.completed_total
      or m.service_count <> m.completed_total
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'queue_rollup_sanity_check') then
    perform cron.unschedule('queue_rollup_sanity_check');
  end if;
end $$;

select
  cron.schedule(
    'queue_rollup_sanity_check',
    '15 3 * * *',
    $$select public.queue_rollup_sanity_check();$$
  );

commit;
