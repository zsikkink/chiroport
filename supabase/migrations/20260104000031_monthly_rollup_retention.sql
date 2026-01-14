begin;

create table if not exists public.queue_monthly_stats (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete cascade,
  month_start date not null,
  timezone text not null,
  days_covered integer not null default 0,
  open_minutes_total numeric null,
  arrivals_total integer not null default 0,
  arrivals_paying integer not null default 0,
  arrivals_priority integer not null default 0,
  arrivals_per_hour numeric null,
  interarrival_avg_seconds numeric null,
  interarrival_stddev_seconds numeric null,
  interarrival_count integer not null default 0,
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
  wait_count integer not null default 0,
  time_in_system_avg_minutes numeric null,
  time_in_system_median_minutes numeric null,
  time_in_system_p90_minutes numeric null,
  time_in_system_p95_minutes numeric null,
  time_in_system_count integer not null default 0,
  service_avg_minutes numeric null,
  service_stddev_minutes numeric null,
  service_count integer not null default 0,
  throughput_per_hour numeric null,
  sla_wait_over_20_rate numeric null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_queue_monthly_stats_location_month
  on public.queue_monthly_stats (location_id, month_start);

create unique index if not exists idx_queue_monthly_stats_global_month
  on public.queue_monthly_stats (month_start)
  where location_id is null;

alter table public.queue_monthly_stats enable row level security;

drop policy if exists "Admins read queue monthly stats" on public.queue_monthly_stats;
create policy "Admins read queue monthly stats"
  on public.queue_monthly_stats
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

create or replace function public.jsonb_sum(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(key, total)
      from (
        select key, sum(value)::numeric as total
        from (
          select key, value::numeric
          from jsonb_each_text(coalesce(a, '{}'::jsonb))
          union all
          select key, value::numeric
          from jsonb_each_text(coalesce(b, '{}'::jsonb))
        ) merged
        group by key
      ) totals
    ),
    '{}'::jsonb
  );
$$;

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

  with daily_roll as (
    select
      d.*,
      date_trunc('month', d.local_date)::date as month_start
    from public.queue_daily_stats d
    where d.local_date < (p_reference at time zone d.timezone)::date - interval '7 days'
  ),
  arrival_hour as (
    select
      location_id,
      month_start,
      jsonb_object_agg(hour::text, count order by hour) as arrival_counts_by_hour
    from (
      select
        location_id,
        month_start,
        key::int as hour,
        sum(value::numeric) as count
      from daily_roll
      left join lateral jsonb_each_text(coalesce(arrival_counts_by_hour, '{}'::jsonb)) as kv(key, value)
        on true
      group by location_id, month_start, key
    ) hourly
    group by location_id, month_start
  ),
  monthly_rollup as (
    select
      location_id,
      min(timezone) as timezone,
      month_start,
      count(*) as days_covered,
      sum(coalesce(open_minutes, 0)) as open_minutes_total,
      sum(arrivals_total) as arrivals_total,
      sum(arrivals_paying) as arrivals_paying,
      sum(arrivals_priority) as arrivals_priority,
      sum(served_total) as served_total,
      sum(completed_total) as completed_total,
      sum(cancelled_total) as cancelled_total,
      sum(cancelled_before_served_total) as cancelled_before_served_total,
      sum(greatest(arrivals_total - 1, 0)) as interarrival_count,
      sum(coalesce(interarrival_avg_seconds, 0) * greatest(arrivals_total - 1, 0)) as interarrival_avg_weighted,
      sum(coalesce(interarrival_stddev_seconds, 0) * greatest(arrivals_total - 1, 0)) as interarrival_stddev_weighted,
      sum(coalesce(wait_avg_minutes, 0) * served_total) as wait_avg_weighted,
      sum(coalesce(wait_median_minutes, 0) * served_total) as wait_median_weighted,
      sum(coalesce(wait_p90_minutes, 0) * served_total) as wait_p90_weighted,
      sum(coalesce(wait_p95_minutes, 0) * served_total) as wait_p95_weighted,
      sum(coalesce(wait_avg_minutes_paying, 0) * arrivals_paying) as wait_paying_weighted,
      sum(coalesce(wait_avg_minutes_priority, 0) * arrivals_priority) as wait_priority_weighted,
      max(wait_max_minutes_paying) as wait_max_minutes_paying,
      max(wait_max_minutes_priority) as wait_max_minutes_priority,
      sum(coalesce(time_in_system_avg_minutes, 0) * completed_total) as time_avg_weighted,
      sum(coalesce(time_in_system_median_minutes, 0) * completed_total) as time_median_weighted,
      sum(coalesce(time_in_system_p90_minutes, 0) * completed_total) as time_p90_weighted,
      sum(coalesce(time_in_system_p95_minutes, 0) * completed_total) as time_p95_weighted,
      sum(coalesce(service_avg_minutes, 0) * completed_total) as service_avg_weighted,
      sum(coalesce(service_stddev_minutes, 0) * completed_total) as service_stddev_weighted,
      sum(coalesce(completion_rate_paying, 0) * arrivals_paying) as completion_rate_paying_weighted,
      sum(coalesce(completion_rate_priority, 0) * arrivals_priority) as completion_rate_priority_weighted,
      sum(coalesce(sla_wait_over_20_rate, 0) * served_total) as sla_weighted
    from daily_roll
    group by location_id, month_start
  ),
  arrival_hour_global as (
    select
      month_start,
      jsonb_object_agg(hour::text, count order by hour) as arrival_counts_by_hour
    from (
      select
        month_start,
        key::int as hour,
        sum(value::numeric) as count
      from daily_roll
      left join lateral jsonb_each_text(coalesce(arrival_counts_by_hour, '{}'::jsonb)) as kv(key, value)
        on true
      group by month_start, key
    ) hourly
    group by month_start
  ),
  monthly_rollup_global as (
    select
      month_start,
      count(*) as days_covered,
      sum(coalesce(open_minutes, 0)) as open_minutes_total,
      sum(arrivals_total) as arrivals_total,
      sum(arrivals_paying) as arrivals_paying,
      sum(arrivals_priority) as arrivals_priority,
      sum(served_total) as served_total,
      sum(completed_total) as completed_total,
      sum(cancelled_total) as cancelled_total,
      sum(cancelled_before_served_total) as cancelled_before_served_total,
      sum(greatest(arrivals_total - 1, 0)) as interarrival_count,
      sum(coalesce(interarrival_avg_seconds, 0) * greatest(arrivals_total - 1, 0)) as interarrival_avg_weighted,
      sum(coalesce(interarrival_stddev_seconds, 0) * greatest(arrivals_total - 1, 0)) as interarrival_stddev_weighted,
      sum(coalesce(wait_avg_minutes, 0) * served_total) as wait_avg_weighted,
      sum(coalesce(wait_median_minutes, 0) * served_total) as wait_median_weighted,
      sum(coalesce(wait_p90_minutes, 0) * served_total) as wait_p90_weighted,
      sum(coalesce(wait_p95_minutes, 0) * served_total) as wait_p95_weighted,
      sum(coalesce(wait_avg_minutes_paying, 0) * arrivals_paying) as wait_paying_weighted,
      sum(coalesce(wait_avg_minutes_priority, 0) * arrivals_priority) as wait_priority_weighted,
      max(wait_max_minutes_paying) as wait_max_minutes_paying,
      max(wait_max_minutes_priority) as wait_max_minutes_priority,
      sum(coalesce(time_in_system_avg_minutes, 0) * completed_total) as time_avg_weighted,
      sum(coalesce(time_in_system_median_minutes, 0) * completed_total) as time_median_weighted,
      sum(coalesce(time_in_system_p90_minutes, 0) * completed_total) as time_p90_weighted,
      sum(coalesce(time_in_system_p95_minutes, 0) * completed_total) as time_p95_weighted,
      sum(coalesce(service_avg_minutes, 0) * completed_total) as service_avg_weighted,
      sum(coalesce(service_stddev_minutes, 0) * completed_total) as service_stddev_weighted,
      sum(coalesce(completion_rate_paying, 0) * arrivals_paying) as completion_rate_paying_weighted,
      sum(coalesce(completion_rate_priority, 0) * arrivals_priority) as completion_rate_priority_weighted,
      sum(coalesce(sla_wait_over_20_rate, 0) * served_total) as sla_weighted
    from daily_roll
    group by month_start
  )
  insert into public.queue_monthly_stats (
    location_id,
    month_start,
    timezone,
    days_covered,
    open_minutes_total,
    arrivals_total,
    arrivals_paying,
    arrivals_priority,
    arrivals_per_hour,
    interarrival_avg_seconds,
    interarrival_stddev_seconds,
    interarrival_count,
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
    wait_count,
    time_in_system_avg_minutes,
    time_in_system_median_minutes,
    time_in_system_p90_minutes,
    time_in_system_p95_minutes,
    time_in_system_count,
    service_avg_minutes,
    service_stddev_minutes,
    service_count,
    throughput_per_hour,
    sla_wait_over_20_rate
  )
  select
    mr.location_id,
    mr.month_start,
    mr.timezone,
    mr.days_covered,
    mr.open_minutes_total,
    mr.arrivals_total,
    mr.arrivals_paying,
    mr.arrivals_priority,
    case
      when mr.open_minutes_total > 0
        then mr.arrivals_total::numeric / (mr.open_minutes_total / 60.0)
      else null
    end as arrivals_per_hour,
    case
      when mr.interarrival_count > 0
        then mr.interarrival_avg_weighted / mr.interarrival_count
      else null
    end as interarrival_avg_seconds,
    case
      when mr.interarrival_count > 0
        then mr.interarrival_stddev_weighted / mr.interarrival_count
      else null
    end as interarrival_stddev_seconds,
    mr.interarrival_count,
    ah.arrival_counts_by_hour,
    mr.served_total,
    mr.completed_total,
    mr.cancelled_total,
    mr.cancelled_before_served_total,
    case
      when mr.arrivals_paying > 0
        then mr.completion_rate_paying_weighted / mr.arrivals_paying
      else null
    end as completion_rate_paying,
    case
      when mr.arrivals_priority > 0
        then mr.completion_rate_priority_weighted / mr.arrivals_priority
      else null
    end as completion_rate_priority,
    case
      when mr.served_total > 0
        then mr.wait_avg_weighted / mr.served_total
      else null
    end as wait_avg_minutes,
    case
      when mr.served_total > 0
        then mr.wait_median_weighted / mr.served_total
      else null
    end as wait_median_minutes,
    case
      when mr.served_total > 0
        then mr.wait_p90_weighted / mr.served_total
      else null
    end as wait_p90_minutes,
    case
      when mr.served_total > 0
        then mr.wait_p95_weighted / mr.served_total
      else null
    end as wait_p95_minutes,
    case
      when mr.arrivals_paying > 0
        then mr.wait_paying_weighted / mr.arrivals_paying
      else null
    end as wait_avg_minutes_paying,
    case
      when mr.arrivals_priority > 0
        then mr.wait_priority_weighted / mr.arrivals_priority
      else null
    end as wait_avg_minutes_priority,
    mr.wait_max_minutes_paying,
    mr.wait_max_minutes_priority,
    mr.served_total as wait_count,
    case
      when mr.completed_total > 0
        then mr.time_avg_weighted / mr.completed_total
      else null
    end as time_in_system_avg_minutes,
    case
      when mr.completed_total > 0
        then mr.time_median_weighted / mr.completed_total
      else null
    end as time_in_system_median_minutes,
    case
      when mr.completed_total > 0
        then mr.time_p90_weighted / mr.completed_total
      else null
    end as time_in_system_p90_minutes,
    case
      when mr.completed_total > 0
        then mr.time_p95_weighted / mr.completed_total
      else null
    end as time_in_system_p95_minutes,
    mr.completed_total as time_in_system_count,
    case
      when mr.completed_total > 0
        then mr.service_avg_weighted / mr.completed_total
      else null
    end as service_avg_minutes,
    case
      when mr.completed_total > 0
        then mr.service_stddev_weighted / mr.completed_total
      else null
    end as service_stddev_minutes,
    mr.completed_total as service_count,
    case
      when mr.open_minutes_total > 0
        then mr.completed_total::numeric / (mr.open_minutes_total / 60.0)
      else null
    end as throughput_per_hour,
    case
      when mr.served_total > 0
        then mr.sla_weighted / mr.served_total
      else null
    end as sla_wait_over_20_rate
  from monthly_rollup mr
  left join arrival_hour ah
    on ah.location_id = mr.location_id
   and ah.month_start = mr.month_start
  on conflict (location_id, month_start) do update
    set days_covered = public.queue_monthly_stats.days_covered + excluded.days_covered,
        open_minutes_total = coalesce(public.queue_monthly_stats.open_minutes_total, 0)
          + coalesce(excluded.open_minutes_total, 0),
        arrivals_total = public.queue_monthly_stats.arrivals_total + excluded.arrivals_total,
        arrivals_paying = public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying,
        arrivals_priority = public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority,
        arrivals_per_hour = case
          when (coalesce(public.queue_monthly_stats.open_minutes_total, 0)
            + coalesce(excluded.open_minutes_total, 0)) > 0
            then (public.queue_monthly_stats.arrivals_total + excluded.arrivals_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + coalesce(excluded.open_minutes_total, 0)) / 60.0)
          else null
        end,
        interarrival_count = public.queue_monthly_stats.interarrival_count + excluded.interarrival_count,
        interarrival_avg_seconds = case
          when (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count) > 0
            then (
              coalesce(public.queue_monthly_stats.interarrival_avg_seconds, 0)
                * public.queue_monthly_stats.interarrival_count
              + coalesce(excluded.interarrival_avg_seconds, 0)
                * excluded.interarrival_count
            ) / (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count)
          else null
        end,
        interarrival_stddev_seconds = case
          when (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count) > 0
            then (
              coalesce(public.queue_monthly_stats.interarrival_stddev_seconds, 0)
                * public.queue_monthly_stats.interarrival_count
              + coalesce(excluded.interarrival_stddev_seconds, 0)
                * excluded.interarrival_count
            ) / (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count)
          else null
        end,
        arrival_counts_by_hour = public.jsonb_sum(
          public.queue_monthly_stats.arrival_counts_by_hour,
          excluded.arrival_counts_by_hour
        ),
        served_total = public.queue_monthly_stats.served_total + excluded.served_total,
        completed_total = public.queue_monthly_stats.completed_total + excluded.completed_total,
        cancelled_total = public.queue_monthly_stats.cancelled_total + excluded.cancelled_total,
        cancelled_before_served_total =
          public.queue_monthly_stats.cancelled_before_served_total
          + excluded.cancelled_before_served_total,
        completion_rate_paying = case
          when (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying) > 0
            then (
              coalesce(public.queue_monthly_stats.completion_rate_paying, 0)
                * public.queue_monthly_stats.arrivals_paying
              + coalesce(excluded.completion_rate_paying, 0)
                * excluded.arrivals_paying
            ) / (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying)
          else null
        end,
        completion_rate_priority = case
          when (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority) > 0
            then (
              coalesce(public.queue_monthly_stats.completion_rate_priority, 0)
                * public.queue_monthly_stats.arrivals_priority
              + coalesce(excluded.completion_rate_priority, 0)
                * excluded.arrivals_priority
            ) / (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority)
          else null
        end,
        wait_count = public.queue_monthly_stats.wait_count + excluded.wait_count,
        wait_avg_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_avg_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_avg_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_median_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_median_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_median_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_p90_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_p90_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_p90_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_p95_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_p95_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_p95_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_avg_minutes_paying = case
          when (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_avg_minutes_paying, 0)
                * public.queue_monthly_stats.arrivals_paying
              + coalesce(excluded.wait_avg_minutes_paying, 0)
                * excluded.arrivals_paying
            ) / (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying)
          else null
        end,
        wait_avg_minutes_priority = case
          when (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_avg_minutes_priority, 0)
                * public.queue_monthly_stats.arrivals_priority
              + coalesce(excluded.wait_avg_minutes_priority, 0)
                * excluded.arrivals_priority
            ) / (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority)
          else null
        end,
        wait_max_minutes_paying = case
          when public.queue_monthly_stats.wait_max_minutes_paying is null
            then excluded.wait_max_minutes_paying
          when excluded.wait_max_minutes_paying is null
            then public.queue_monthly_stats.wait_max_minutes_paying
          else greatest(public.queue_monthly_stats.wait_max_minutes_paying, excluded.wait_max_minutes_paying)
        end,
        wait_max_minutes_priority = case
          when public.queue_monthly_stats.wait_max_minutes_priority is null
            then excluded.wait_max_minutes_priority
          when excluded.wait_max_minutes_priority is null
            then public.queue_monthly_stats.wait_max_minutes_priority
          else greatest(public.queue_monthly_stats.wait_max_minutes_priority, excluded.wait_max_minutes_priority)
        end,
        time_in_system_count =
          public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count,
        time_in_system_avg_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_avg_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_avg_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        time_in_system_median_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_median_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_median_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        time_in_system_p90_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_p90_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_p90_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        time_in_system_p95_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_p95_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_p95_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        service_count = public.queue_monthly_stats.service_count + excluded.service_count,
        service_avg_minutes = case
          when (public.queue_monthly_stats.service_count + excluded.service_count) > 0
            then (
              coalesce(public.queue_monthly_stats.service_avg_minutes, 0)
                * public.queue_monthly_stats.service_count
              + coalesce(excluded.service_avg_minutes, 0)
                * excluded.service_count
            ) / (public.queue_monthly_stats.service_count + excluded.service_count)
          else null
        end,
        service_stddev_minutes = case
          when (public.queue_monthly_stats.service_count + excluded.service_count) > 0
            then (
              coalesce(public.queue_monthly_stats.service_stddev_minutes, 0)
                * public.queue_monthly_stats.service_count
              + coalesce(excluded.service_stddev_minutes, 0)
                * excluded.service_count
            ) / (public.queue_monthly_stats.service_count + excluded.service_count)
          else null
        end,
        throughput_per_hour = case
          when (coalesce(public.queue_monthly_stats.open_minutes_total, 0)
            + coalesce(excluded.open_minutes_total, 0)) > 0
            then (public.queue_monthly_stats.completed_total + excluded.completed_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + coalesce(excluded.open_minutes_total, 0)) / 60.0)
          else null
        end,
        sla_wait_over_20_rate = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.sla_wait_over_20_rate, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.sla_wait_over_20_rate, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end;

  insert into public.queue_monthly_stats (
    location_id,
    month_start,
    timezone,
    days_covered,
    open_minutes_total,
    arrivals_total,
    arrivals_paying,
    arrivals_priority,
    arrivals_per_hour,
    interarrival_avg_seconds,
    interarrival_stddev_seconds,
    interarrival_count,
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
    wait_count,
    time_in_system_avg_minutes,
    time_in_system_median_minutes,
    time_in_system_p90_minutes,
    time_in_system_p95_minutes,
    time_in_system_count,
    service_avg_minutes,
    service_stddev_minutes,
    service_count,
    throughput_per_hour,
    sla_wait_over_20_rate
  )
  select
    null::uuid as location_id,
    mg.month_start,
    'UTC' as timezone,
    mg.days_covered,
    mg.open_minutes_total,
    mg.arrivals_total,
    mg.arrivals_paying,
    mg.arrivals_priority,
    case
      when mg.open_minutes_total > 0
        then mg.arrivals_total::numeric / (mg.open_minutes_total / 60.0)
      else null
    end as arrivals_per_hour,
    case
      when mg.interarrival_count > 0
        then mg.interarrival_avg_weighted / mg.interarrival_count
      else null
    end as interarrival_avg_seconds,
    case
      when mg.interarrival_count > 0
        then mg.interarrival_stddev_weighted / mg.interarrival_count
      else null
    end as interarrival_stddev_seconds,
    mg.interarrival_count,
    ahg.arrival_counts_by_hour,
    mg.served_total,
    mg.completed_total,
    mg.cancelled_total,
    mg.cancelled_before_served_total,
    case
      when mg.arrivals_paying > 0
        then mg.completion_rate_paying_weighted / mg.arrivals_paying
      else null
    end as completion_rate_paying,
    case
      when mg.arrivals_priority > 0
        then mg.completion_rate_priority_weighted / mg.arrivals_priority
      else null
    end as completion_rate_priority,
    case
      when mg.served_total > 0
        then mg.wait_avg_weighted / mg.served_total
      else null
    end as wait_avg_minutes,
    case
      when mg.served_total > 0
        then mg.wait_median_weighted / mg.served_total
      else null
    end as wait_median_minutes,
    case
      when mg.served_total > 0
        then mg.wait_p90_weighted / mg.served_total
      else null
    end as wait_p90_minutes,
    case
      when mg.served_total > 0
        then mg.wait_p95_weighted / mg.served_total
      else null
    end as wait_p95_minutes,
    case
      when mg.arrivals_paying > 0
        then mg.wait_paying_weighted / mg.arrivals_paying
      else null
    end as wait_avg_minutes_paying,
    case
      when mg.arrivals_priority > 0
        then mg.wait_priority_weighted / mg.arrivals_priority
      else null
    end as wait_avg_minutes_priority,
    mg.wait_max_minutes_paying,
    mg.wait_max_minutes_priority,
    mg.served_total as wait_count,
    case
      when mg.completed_total > 0
        then mg.time_avg_weighted / mg.completed_total
      else null
    end as time_in_system_avg_minutes,
    case
      when mg.completed_total > 0
        then mg.time_median_weighted / mg.completed_total
      else null
    end as time_in_system_median_minutes,
    case
      when mg.completed_total > 0
        then mg.time_p90_weighted / mg.completed_total
      else null
    end as time_in_system_p90_minutes,
    case
      when mg.completed_total > 0
        then mg.time_p95_weighted / mg.completed_total
      else null
    end as time_in_system_p95_minutes,
    mg.completed_total as time_in_system_count,
    case
      when mg.completed_total > 0
        then mg.service_avg_weighted / mg.completed_total
      else null
    end as service_avg_minutes,
    case
      when mg.completed_total > 0
        then mg.service_stddev_weighted / mg.completed_total
      else null
    end as service_stddev_minutes,
    mg.completed_total as service_count,
    case
      when mg.open_minutes_total > 0
        then mg.completed_total::numeric / (mg.open_minutes_total / 60.0)
      else null
    end as throughput_per_hour,
    case
      when mg.served_total > 0
        then mg.sla_weighted / mg.served_total
      else null
    end as sla_wait_over_20_rate
  from monthly_rollup_global mg
  left join arrival_hour_global ahg
    on ahg.month_start = mg.month_start
  on conflict (month_start) where location_id is null do update
    set days_covered = public.queue_monthly_stats.days_covered + excluded.days_covered,
        open_minutes_total = coalesce(public.queue_monthly_stats.open_minutes_total, 0)
          + coalesce(excluded.open_minutes_total, 0),
        arrivals_total = public.queue_monthly_stats.arrivals_total + excluded.arrivals_total,
        arrivals_paying = public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying,
        arrivals_priority = public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority,
        arrivals_per_hour = case
          when (coalesce(public.queue_monthly_stats.open_minutes_total, 0)
            + coalesce(excluded.open_minutes_total, 0)) > 0
            then (public.queue_monthly_stats.arrivals_total + excluded.arrivals_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + coalesce(excluded.open_minutes_total, 0)) / 60.0)
          else null
        end,
        interarrival_count = public.queue_monthly_stats.interarrival_count + excluded.interarrival_count,
        interarrival_avg_seconds = case
          when (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count) > 0
            then (
              coalesce(public.queue_monthly_stats.interarrival_avg_seconds, 0)
                * public.queue_monthly_stats.interarrival_count
              + coalesce(excluded.interarrival_avg_seconds, 0)
                * excluded.interarrival_count
            ) / (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count)
          else null
        end,
        interarrival_stddev_seconds = case
          when (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count) > 0
            then (
              coalesce(public.queue_monthly_stats.interarrival_stddev_seconds, 0)
                * public.queue_monthly_stats.interarrival_count
              + coalesce(excluded.interarrival_stddev_seconds, 0)
                * excluded.interarrival_count
            ) / (public.queue_monthly_stats.interarrival_count + excluded.interarrival_count)
          else null
        end,
        arrival_counts_by_hour = public.jsonb_sum(
          public.queue_monthly_stats.arrival_counts_by_hour,
          excluded.arrival_counts_by_hour
        ),
        served_total = public.queue_monthly_stats.served_total + excluded.served_total,
        completed_total = public.queue_monthly_stats.completed_total + excluded.completed_total,
        cancelled_total = public.queue_monthly_stats.cancelled_total + excluded.cancelled_total,
        cancelled_before_served_total =
          public.queue_monthly_stats.cancelled_before_served_total
          + excluded.cancelled_before_served_total,
        completion_rate_paying = case
          when (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying) > 0
            then (
              coalesce(public.queue_monthly_stats.completion_rate_paying, 0)
                * public.queue_monthly_stats.arrivals_paying
              + coalesce(excluded.completion_rate_paying, 0)
                * excluded.arrivals_paying
            ) / (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying)
          else null
        end,
        completion_rate_priority = case
          when (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority) > 0
            then (
              coalesce(public.queue_monthly_stats.completion_rate_priority, 0)
                * public.queue_monthly_stats.arrivals_priority
              + coalesce(excluded.completion_rate_priority, 0)
                * excluded.arrivals_priority
            ) / (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority)
          else null
        end,
        wait_count = public.queue_monthly_stats.wait_count + excluded.wait_count,
        wait_avg_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_avg_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_avg_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_median_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_median_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_median_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_p90_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_p90_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_p90_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_p95_minutes = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_p95_minutes, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.wait_p95_minutes, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end,
        wait_avg_minutes_paying = case
          when (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_avg_minutes_paying, 0)
                * public.queue_monthly_stats.arrivals_paying
              + coalesce(excluded.wait_avg_minutes_paying, 0)
                * excluded.arrivals_paying
            ) / (public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying)
          else null
        end,
        wait_avg_minutes_priority = case
          when (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority) > 0
            then (
              coalesce(public.queue_monthly_stats.wait_avg_minutes_priority, 0)
                * public.queue_monthly_stats.arrivals_priority
              + coalesce(excluded.wait_avg_minutes_priority, 0)
                * excluded.arrivals_priority
            ) / (public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority)
          else null
        end,
        wait_max_minutes_paying = case
          when public.queue_monthly_stats.wait_max_minutes_paying is null
            then excluded.wait_max_minutes_paying
          when excluded.wait_max_minutes_paying is null
            then public.queue_monthly_stats.wait_max_minutes_paying
          else greatest(public.queue_monthly_stats.wait_max_minutes_paying, excluded.wait_max_minutes_paying)
        end,
        wait_max_minutes_priority = case
          when public.queue_monthly_stats.wait_max_minutes_priority is null
            then excluded.wait_max_minutes_priority
          when excluded.wait_max_minutes_priority is null
            then public.queue_monthly_stats.wait_max_minutes_priority
          else greatest(public.queue_monthly_stats.wait_max_minutes_priority, excluded.wait_max_minutes_priority)
        end,
        time_in_system_count =
          public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count,
        time_in_system_avg_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_avg_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_avg_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        time_in_system_median_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_median_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_median_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        time_in_system_p90_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_p90_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_p90_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        time_in_system_p95_minutes = case
          when (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count) > 0
            then (
              coalesce(public.queue_monthly_stats.time_in_system_p95_minutes, 0)
                * public.queue_monthly_stats.time_in_system_count
              + coalesce(excluded.time_in_system_p95_minutes, 0)
                * excluded.time_in_system_count
            ) / (public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count)
          else null
        end,
        service_count = public.queue_monthly_stats.service_count + excluded.service_count,
        service_avg_minutes = case
          when (public.queue_monthly_stats.service_count + excluded.service_count) > 0
            then (
              coalesce(public.queue_monthly_stats.service_avg_minutes, 0)
                * public.queue_monthly_stats.service_count
              + coalesce(excluded.service_avg_minutes, 0)
                * excluded.service_count
            ) / (public.queue_monthly_stats.service_count + excluded.service_count)
          else null
        end,
        service_stddev_minutes = case
          when (public.queue_monthly_stats.service_count + excluded.service_count) > 0
            then (
              coalesce(public.queue_monthly_stats.service_stddev_minutes, 0)
                * public.queue_monthly_stats.service_count
              + coalesce(excluded.service_stddev_minutes, 0)
                * excluded.service_count
            ) / (public.queue_monthly_stats.service_count + excluded.service_count)
          else null
        end,
        throughput_per_hour = case
          when (coalesce(public.queue_monthly_stats.open_minutes_total, 0)
            + coalesce(excluded.open_minutes_total, 0)) > 0
            then (public.queue_monthly_stats.completed_total + excluded.completed_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + coalesce(excluded.open_minutes_total, 0)) / 60.0)
          else null
        end,
        sla_wait_over_20_rate = case
          when (public.queue_monthly_stats.wait_count + excluded.wait_count) > 0
            then (
              coalesce(public.queue_monthly_stats.sla_wait_over_20_rate, 0)
                * public.queue_monthly_stats.wait_count
              + coalesce(excluded.sla_wait_over_20_rate, 0)
                * excluded.wait_count
            ) / (public.queue_monthly_stats.wait_count + excluded.wait_count)
          else null
        end;

  delete from public.queue_daily_stats d
  where d.local_date < (p_reference at time zone d.timezone)::date - interval '7 days';

  delete from public.queue_entries qe
  using public.queues q
  join public.locations l on l.id = q.location_id
  where qe.queue_id = q.id
    and (qe.created_at at time zone l.timezone)::date < (p_reference at time zone l.timezone)::date;
end;
$$;

commit;
