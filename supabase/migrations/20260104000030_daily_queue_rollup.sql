begin;

create table if not exists public.queue_daily_stats (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  local_date date not null,
  timezone text not null,
  open_minutes integer null,
  arrivals_total integer not null default 0,
  arrivals_paying integer not null default 0,
  arrivals_priority integer not null default 0,
  arrivals_per_hour numeric null,
  interarrival_avg_seconds numeric null,
  interarrival_stddev_seconds numeric null,
  arrival_counts_by_hour jsonb null,
  served_total integer not null default 0,
  completed_total integer not null default 0,
  cancelled_total integer not null default 0,
  cancelled_before_served_total integer not null default 0,
  completion_rate_paying numeric null,
  completion_rate_priority numeric null,
  wait_avg_minutes numeric null,
  wait_median_minutes numeric null,
  wait_p90_minutes numeric null,
  wait_p95_minutes numeric null,
  wait_avg_minutes_paying numeric null,
  wait_avg_minutes_priority numeric null,
  wait_max_minutes_paying numeric null,
  wait_max_minutes_priority numeric null,
  time_in_system_avg_minutes numeric null,
  time_in_system_median_minutes numeric null,
  time_in_system_p90_minutes numeric null,
  time_in_system_p95_minutes numeric null,
  service_avg_minutes numeric null,
  service_stddev_minutes numeric null,
  throughput_per_hour numeric null,
  sla_wait_over_20_rate numeric null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_queue_daily_stats_location_date
  on public.queue_daily_stats (location_id, local_date);

alter table public.queue_daily_stats enable row level security;

drop policy if exists "Admins read queue daily stats" on public.queue_daily_stats;
create policy "Admins read queue daily stats"
  on public.queue_daily_stats
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create or replace function public.rollup_queue_daily_stats(
  p_reference timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  with entries as (
    select
      qe.*,
      q.location_id,
      l.timezone,
      (qe.created_at at time zone l.timezone)::date as local_date
    from public.queue_entries qe
    join public.queues q on q.id = qe.queue_id
    join public.locations l on l.id = q.location_id
  ),
  pending_dates as (
    select location_id, timezone, local_date
    from entries
    where local_date < (p_reference at time zone timezone)::date
    group by location_id, timezone, local_date
  ),
  open_hours as (
    select
      pd.location_id,
      pd.local_date,
      case
        when lh.is_closed then 0
        when lh.opens_at is null or lh.closes_at is null then null
        else greatest(0, extract(epoch from (lh.closes_at - lh.opens_at)) / 60)
      end as open_minutes
    from pending_dates pd
    left join public.location_hours lh
      on lh.location_id = pd.location_id
     and lh.day_of_week = extract(dow from pd.local_date::timestamp)::int
  ),
  aggregates as (
    select
      e.location_id,
      e.timezone,
      e.local_date,
      count(*) as arrivals_total,
      count(*) filter (where e.customer_type = 'paying') as arrivals_paying,
      count(*) filter (where e.customer_type = 'priority_pass') as arrivals_priority,
      count(*) filter (where e.served_at is not null) as served_total,
      count(*) filter (where e.status = 'completed') as completed_total,
      count(*) filter (where e.status = 'completed' and e.customer_type = 'paying') as completed_paying,
      count(*) filter (where e.status = 'completed' and e.customer_type = 'priority_pass') as completed_priority,
      count(*) filter (where e.status in ('cancelled', 'no_show')) as cancelled_total,
      count(*) filter (
        where e.status in ('cancelled', 'no_show') and e.served_at is null
      ) as cancelled_before_served_total
    from entries e
    join pending_dates pd
      on pd.location_id = e.location_id
     and pd.local_date = e.local_date
    group by e.location_id, e.timezone, e.local_date
  ),
  interarrival as (
    select
      location_id,
      local_date,
      avg(diff_seconds) as interarrival_avg_seconds,
      stddev_samp(diff_seconds) as interarrival_stddev_seconds
    from (
      select
        e.location_id,
        e.local_date,
        extract(
          epoch from (e.created_at - lag(e.created_at) over (
            partition by e.location_id, e.local_date
            order by e.created_at
          ))
        ) as diff_seconds
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
    ) diffs
    where diff_seconds is not null
    group by location_id, local_date
  ),
  arrivals_by_hour as (
    select
      e.location_id,
      e.local_date,
      jsonb_object_agg(hour::text, count order by hour) as arrival_counts_by_hour
    from (
      select
        e.location_id,
        e.local_date,
        extract(hour from e.created_at at time zone e.timezone)::int as hour,
        count(*) as count
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      group by e.location_id, e.local_date, hour
    ) e
    group by e.location_id, e.local_date
  ),
  wait_stats as (
    select
      location_id,
      local_date,
      avg(wait_seconds) / 60 as wait_avg_minutes,
      percentile_cont(0.5) within group (order by wait_seconds) / 60 as wait_median_minutes,
      percentile_cont(0.9) within group (order by wait_seconds) / 60 as wait_p90_minutes,
      percentile_cont(0.95) within group (order by wait_seconds) / 60 as wait_p95_minutes,
      sum(case when wait_seconds >= 1200 then 1 else 0 end)::numeric
        / nullif(count(*), 0) as sla_wait_over_20_rate
    from (
      select
        e.location_id,
        e.local_date,
        extract(epoch from (e.served_at - e.created_at)) as wait_seconds
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.served_at is not null
    ) waits
    group by location_id, local_date
  ),
  wait_by_class as (
    select
      location_id,
      local_date,
      avg(case when customer_type = 'paying' then wait_seconds end) / 60
        as wait_avg_minutes_paying,
      avg(case when customer_type = 'priority_pass' then wait_seconds end) / 60
        as wait_avg_minutes_priority,
      max(case when customer_type = 'paying' then wait_seconds end) / 60
        as wait_max_minutes_paying,
      max(case when customer_type = 'priority_pass' then wait_seconds end) / 60
        as wait_max_minutes_priority
    from (
      select
        e.location_id,
        e.local_date,
        e.customer_type,
        extract(epoch from (e.served_at - e.created_at)) as wait_seconds
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.served_at is not null
    ) waits
    group by location_id, local_date
  ),
  time_in_system as (
    select
      location_id,
      local_date,
      avg(total_seconds) / 60 as time_in_system_avg_minutes,
      percentile_cont(0.5) within group (order by total_seconds) / 60
        as time_in_system_median_minutes,
      percentile_cont(0.9) within group (order by total_seconds) / 60
        as time_in_system_p90_minutes,
      percentile_cont(0.95) within group (order by total_seconds) / 60
        as time_in_system_p95_minutes
    from (
      select
        e.location_id,
        e.local_date,
        extract(epoch from (e.completed_at - e.created_at)) as total_seconds
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.completed_at is not null
    ) totals
    group by location_id, local_date
  ),
  service_stats as (
    select
      location_id,
      local_date,
      avg(service_seconds) / 60 as service_avg_minutes,
      stddev_samp(service_seconds) / 60 as service_stddev_minutes
    from (
      select
        e.location_id,
        e.local_date,
        extract(epoch from (e.completed_at - e.served_at)) as service_seconds
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.completed_at is not null and e.served_at is not null
    ) services
    group by location_id, local_date
  )
  insert into public.queue_daily_stats (
    location_id,
    local_date,
    timezone,
    open_minutes,
    arrivals_total,
    arrivals_paying,
    arrivals_priority,
    arrivals_per_hour,
    interarrival_avg_seconds,
    interarrival_stddev_seconds,
    arrival_counts_by_hour,
    served_total,
    completed_total,
    cancelled_total,
    cancelled_before_served_total,
    completion_rate_paying,
    completion_rate_priority,
    wait_avg_minutes,
    wait_median_minutes,
    wait_p90_minutes,
    wait_p95_minutes,
    wait_avg_minutes_paying,
    wait_avg_minutes_priority,
    wait_max_minutes_paying,
    wait_max_minutes_priority,
    time_in_system_avg_minutes,
    time_in_system_median_minutes,
    time_in_system_p90_minutes,
    time_in_system_p95_minutes,
    service_avg_minutes,
    service_stddev_minutes,
    throughput_per_hour,
    sla_wait_over_20_rate
  )
  select
    a.location_id,
    a.local_date,
    a.timezone,
    oh.open_minutes,
    a.arrivals_total,
    a.arrivals_paying,
    a.arrivals_priority,
    case
      when oh.open_minutes is not null and oh.open_minutes > 0
        then a.arrivals_total::numeric / (oh.open_minutes / 60.0)
      else null
    end as arrivals_per_hour,
    i.interarrival_avg_seconds,
    i.interarrival_stddev_seconds,
    ah.arrival_counts_by_hour,
    a.served_total,
    a.completed_total,
    a.cancelled_total,
    a.cancelled_before_served_total,
    case
      when a.arrivals_paying > 0
        then a.completed_paying::numeric / a.arrivals_paying
      else null
    end as completion_rate_paying,
    case
      when a.arrivals_priority > 0
        then a.completed_priority::numeric / a.arrivals_priority
      else null
    end as completion_rate_priority,
    ws.wait_avg_minutes,
    ws.wait_median_minutes,
    ws.wait_p90_minutes,
    ws.wait_p95_minutes,
    wb.wait_avg_minutes_paying,
    wb.wait_avg_minutes_priority,
    wb.wait_max_minutes_paying,
    wb.wait_max_minutes_priority,
    tis.time_in_system_avg_minutes,
    tis.time_in_system_median_minutes,
    tis.time_in_system_p90_minutes,
    tis.time_in_system_p95_minutes,
    ss.service_avg_minutes,
    ss.service_stddev_minutes,
    case
      when oh.open_minutes is not null and oh.open_minutes > 0
        then a.completed_total::numeric / (oh.open_minutes / 60.0)
      else null
    end as throughput_per_hour,
    ws.sla_wait_over_20_rate
  from aggregates a
  left join open_hours oh
    on oh.location_id = a.location_id
   and oh.local_date = a.local_date
  left join interarrival i
    on i.location_id = a.location_id
   and i.local_date = a.local_date
  left join arrivals_by_hour ah
    on ah.location_id = a.location_id
   and ah.local_date = a.local_date
  left join wait_stats ws
    on ws.location_id = a.location_id
   and ws.local_date = a.local_date
  left join wait_by_class wb
    on wb.location_id = a.location_id
   and wb.local_date = a.local_date
  left join time_in_system tis
    on tis.location_id = a.location_id
   and tis.local_date = a.local_date
  left join service_stats ss
    on ss.location_id = a.location_id
   and ss.local_date = a.local_date
  on conflict (location_id, local_date) do nothing;

  delete from public.queue_entries qe
  using public.queues q
  join public.locations l on l.id = q.location_id
  where qe.queue_id = q.id
    and (qe.created_at at time zone l.timezone)::date < (p_reference at time zone l.timezone)::date;
end;
$$;

-- Run hourly to catch midnight transitions in each location timezone.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'queue_daily_rollup') then
    perform cron.unschedule('queue_daily_rollup');
  end if;
end $$;

select
  cron.schedule(
    'queue_daily_rollup',
    '5 * * * *',
    $$select public.rollup_queue_daily_stats();$$
  );

commit;
