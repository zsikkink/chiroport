begin;

drop function if exists public.rollup_queue_monthly_stats();
drop aggregate if exists public.jsonb_sum_agg(jsonb);

create or replace function public.jsonb_sum_agg(values jsonb[])
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select jsonb_object_agg(key, total)
      from (
        select key, sum(value)::numeric as total
        from (
          select key, value::numeric
          from unnest(coalesce(values, array[]::jsonb[])) as v(elem)
          cross join lateral jsonb_each_text(coalesce(elem, '{}'::jsonb))
        ) merged
        group by key
      ) totals
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.rollup_queue_monthly_stats()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_monthly_lag_days integer;
  v_daily_retention_days integer;
  v_retention_cutoff date;
  v_min_month_start date;
  v_include_boundary boolean;
begin
  select
    coalesce(
      (select monthly_rollup_lag_days
       from public.queue_rollup_settings
       limit 1),
      7
    ),
    coalesce(
      (select daily_stats_retention_days
       from public.queue_rollup_settings
       limit 1),
      90
    )
  into v_monthly_lag_days, v_daily_retention_days;

  v_retention_cutoff := (current_date - make_interval(days => v_daily_retention_days))::date;
  v_min_month_start := date_trunc('month', v_retention_cutoff)::date;
  v_include_boundary := (v_retention_cutoff = v_min_month_start);

  create temporary table tmp_monthly_rollup on commit drop as
  with daily_rows as (
    select
      d.*,
      date_trunc('month', d.local_date)::date as month_start
    from public.queue_daily_stats d
    where d.local_date < (current_date - make_interval(days => v_monthly_lag_days))::date
  )
  select
    location_id,
    month_start,
    min(timezone) as timezone,
    count(*) as days_covered,
    sum(coalesce(open_minutes, 0)) as open_minutes_total,
    sum(arrivals_total) as arrivals_total,
    sum(arrivals_paying) as arrivals_paying,
    sum(arrivals_priority) as arrivals_priority,
    sum(served_total) as served_total,
    sum(completed_total) as completed_total,
    sum(cancelled_total) as cancelled_total,
    sum(cancelled_before_served_total) as cancelled_before_served_total,
    sum(coalesce(completion_rate_paying, 0) * arrivals_paying)::numeric
      as completion_rate_paying_weighted,
    sum(coalesce(completion_rate_priority, 0) * arrivals_priority)::numeric
      as completion_rate_priority_weighted,
    sum(time_in_system_avg_minutes * completed_total)::numeric as time_in_system_total_minutes,
    sum(service_avg_minutes * completed_total)::numeric as service_total_minutes,
    sum(wait_avg_minutes * served_total)::numeric as wait_total_minutes,
    sum(wait_avg_minutes_paying * arrivals_paying)::numeric as wait_total_minutes_paying,
    sum(wait_avg_minutes_priority * arrivals_priority)::numeric as wait_total_minutes_priority,
    sum(wait_max_minutes_paying) as wait_max_minutes_paying,
    sum(wait_max_minutes_priority) as wait_max_minutes_priority,
    sum(interarrival_avg_seconds * arrivals_total)::numeric as interarrival_total_seconds,
    sum(interarrival_stddev_seconds * arrivals_total)::numeric as interarrival_stddev_total_seconds,
    sum(arrivals_total) as interarrival_count,
    sum(wait_p90_minutes * served_total)::numeric as wait_p90_total_minutes,
    sum(wait_p95_minutes * served_total)::numeric as wait_p95_total_minutes,
    sum(time_in_system_p90_minutes * completed_total)::numeric as time_in_system_p90_total_minutes,
    sum(time_in_system_p95_minutes * completed_total)::numeric as time_in_system_p95_total_minutes,
    public.jsonb_sum_agg(array_agg(arrival_counts_by_hour)) as arrival_counts_by_hour,
    public.jsonb_sum_agg(array_agg(service_arrivals)) as service_arrivals,
    public.jsonb_sum_agg(array_agg(service_completed)) as service_completed,
    public.jsonb_sum_agg(array_agg(service_cancelled)) as service_cancelled,
    public.jsonb_sum_agg(array_agg(service_wait_total_minutes)) as service_wait_total_minutes,
    public.jsonb_sum_agg(array_agg(service_wait_count)) as service_wait_count,
    public.jsonb_sum_agg(array_agg(service_time_in_system_total_minutes)) as service_time_in_system_total_minutes,
    public.jsonb_sum_agg(array_agg(service_time_in_system_count)) as service_time_in_system_count,
    public.jsonb_sum_agg(array_agg(service_service_total_minutes)) as service_service_total_minutes,
    public.jsonb_sum_agg(array_agg(service_service_count)) as service_service_count
  from daily_rows d
  where d.month_start > v_min_month_start
    or (v_include_boundary and d.month_start = v_min_month_start)
  group by location_id, month_start;

  create temporary table tmp_monthly_rollup_global on commit drop as
  with daily_rows as (
    select
      d.*,
      date_trunc('month', d.local_date)::date as month_start
    from public.queue_daily_stats d
    where d.local_date < (current_date - make_interval(days => v_monthly_lag_days))::date
  )
  select
    null::uuid as location_id,
    month_start,
    'UTC'::text as timezone,
    count(*) as days_covered,
    sum(coalesce(open_minutes, 0)) as open_minutes_total,
    sum(arrivals_total) as arrivals_total,
    sum(arrivals_paying) as arrivals_paying,
    sum(arrivals_priority) as arrivals_priority,
    sum(served_total) as served_total,
    sum(completed_total) as completed_total,
    sum(cancelled_total) as cancelled_total,
    sum(cancelled_before_served_total) as cancelled_before_served_total,
    sum(coalesce(completion_rate_paying, 0) * arrivals_paying)::numeric
      as completion_rate_paying_weighted,
    sum(coalesce(completion_rate_priority, 0) * arrivals_priority)::numeric
      as completion_rate_priority_weighted,
    sum(time_in_system_avg_minutes * completed_total)::numeric as time_in_system_total_minutes,
    sum(service_avg_minutes * completed_total)::numeric as service_total_minutes,
    sum(wait_avg_minutes * served_total)::numeric as wait_total_minutes,
    sum(wait_avg_minutes_paying * arrivals_paying)::numeric as wait_total_minutes_paying,
    sum(wait_avg_minutes_priority * arrivals_priority)::numeric as wait_total_minutes_priority,
    sum(wait_max_minutes_paying) as wait_max_minutes_paying,
    sum(wait_max_minutes_priority) as wait_max_minutes_priority,
    sum(interarrival_avg_seconds * arrivals_total)::numeric as interarrival_total_seconds,
    sum(interarrival_stddev_seconds * arrivals_total)::numeric as interarrival_stddev_total_seconds,
    sum(arrivals_total) as interarrival_count,
    sum(wait_p90_minutes * served_total)::numeric as wait_p90_total_minutes,
    sum(wait_p95_minutes * served_total)::numeric as wait_p95_total_minutes,
    sum(time_in_system_p90_minutes * completed_total)::numeric as time_in_system_p90_total_minutes,
    sum(time_in_system_p95_minutes * completed_total)::numeric as time_in_system_p95_total_minutes,
    public.jsonb_sum_agg(array_agg(arrival_counts_by_hour)) as arrival_counts_by_hour,
    public.jsonb_sum_agg(array_agg(service_arrivals)) as service_arrivals,
    public.jsonb_sum_agg(array_agg(service_completed)) as service_completed,
    public.jsonb_sum_agg(array_agg(service_cancelled)) as service_cancelled,
    public.jsonb_sum_agg(array_agg(service_wait_total_minutes)) as service_wait_total_minutes,
    public.jsonb_sum_agg(array_agg(service_wait_count)) as service_wait_count,
    public.jsonb_sum_agg(array_agg(service_time_in_system_total_minutes)) as service_time_in_system_total_minutes,
    public.jsonb_sum_agg(array_agg(service_time_in_system_count)) as service_time_in_system_count,
    public.jsonb_sum_agg(array_agg(service_service_total_minutes)) as service_service_total_minutes,
    public.jsonb_sum_agg(array_agg(service_service_count)) as service_service_count
  from daily_rows d
  where d.month_start > v_min_month_start
    or (v_include_boundary and d.month_start = v_min_month_start)
  group by month_start;

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
    service_median_minutes,
    service_p90_minutes,
    service_p95_minutes,
    service_count,
    throughput_per_hour,
    sla_wait_over_20_rate,
    service_arrivals,
    service_completed,
    service_cancelled,
    service_wait_total_minutes,
    service_wait_count,
    service_time_in_system_total_minutes,
    service_time_in_system_count,
    service_service_total_minutes,
    service_service_count
  )
  select
    location_id,
    month_start,
    timezone,
    days_covered,
    open_minutes_total,
    arrivals_total,
    arrivals_paying,
    arrivals_priority,
    case
      when open_minutes_total is null or open_minutes_total = 0 then null
      else arrivals_total::numeric / (open_minutes_total / 60)
    end as arrivals_per_hour,
    case
      when interarrival_count is null or interarrival_count = 0 then null
      else interarrival_total_seconds / interarrival_count
    end as interarrival_avg_seconds,
    case
      when interarrival_count is null or interarrival_count = 0 then null
      else interarrival_stddev_total_seconds / interarrival_count
    end as interarrival_stddev_seconds,
    interarrival_count,
    arrival_counts_by_hour,
    served_total,
    completed_total,
    cancelled_total,
    cancelled_before_served_total,
    case
      when arrivals_paying is null or arrivals_paying = 0 then null
      else completion_rate_paying_weighted / arrivals_paying
    end as completion_rate_paying,
    case
      when arrivals_priority is null or arrivals_priority = 0 then null
      else completion_rate_priority_weighted / arrivals_priority
    end as completion_rate_priority,
    case
      when served_total is null or served_total = 0 then null
      else wait_total_minutes / served_total
    end as wait_avg_minutes,
    null::numeric as wait_median_minutes,
    case
      when served_total is null or served_total = 0 then null
      else wait_p90_total_minutes / served_total
    end as wait_p90_minutes,
    case
      when served_total is null or served_total = 0 then null
      else wait_p95_total_minutes / served_total
    end as wait_p95_minutes,
    case
      when arrivals_paying is null or arrivals_paying = 0 then null
      else wait_total_minutes_paying / arrivals_paying
    end as wait_avg_minutes_paying,
    case
      when arrivals_priority is null or arrivals_priority = 0 then null
      else wait_total_minutes_priority / arrivals_priority
    end as wait_avg_minutes_priority,
    wait_max_minutes_paying,
    wait_max_minutes_priority,
    served_total as wait_count,
    case
      when completed_total is null or completed_total = 0 then null
      else time_in_system_total_minutes / completed_total
    end as time_in_system_avg_minutes,
    null::numeric as time_in_system_median_minutes,
    case
      when completed_total is null or completed_total = 0 then null
      else time_in_system_p90_total_minutes / completed_total
    end as time_in_system_p90_minutes,
    case
      when completed_total is null or completed_total = 0 then null
      else time_in_system_p95_total_minutes / completed_total
    end as time_in_system_p95_minutes,
    completed_total as time_in_system_count,
    case
      when completed_total is null or completed_total = 0 then null
      else service_total_minutes / completed_total
    end as service_avg_minutes,
    null::numeric as service_median_minutes,
    null::numeric as service_p90_minutes,
    null::numeric as service_p95_minutes,
    completed_total as service_count,
    case
      when open_minutes_total is null or open_minutes_total = 0 then null
      else completed_total::numeric / (open_minutes_total / 60)
    end as throughput_per_hour,
    case
      when served_total is null or served_total = 0 then null
      else (wait_total_minutes - (served_total * 20)) / served_total
    end as sla_wait_over_20_rate,
    service_arrivals,
    service_completed,
    service_cancelled,
    service_wait_total_minutes,
    service_wait_count,
    service_time_in_system_total_minutes,
    service_time_in_system_count,
    service_service_total_minutes,
    service_service_count
  from tmp_monthly_rollup
  where month_start is not null

  union all

  select
    location_id,
    month_start,
    timezone,
    days_covered,
    open_minutes_total,
    arrivals_total,
    arrivals_paying,
    arrivals_priority,
    case
      when open_minutes_total is null or open_minutes_total = 0 then null
      else arrivals_total::numeric / (open_minutes_total / 60)
    end as arrivals_per_hour,
    case
      when interarrival_count is null or interarrival_count = 0 then null
      else interarrival_total_seconds / interarrival_count
    end as interarrival_avg_seconds,
    case
      when interarrival_count is null or interarrival_count = 0 then null
      else interarrival_stddev_total_seconds / interarrival_count
    end as interarrival_stddev_seconds,
    interarrival_count,
    arrival_counts_by_hour,
    served_total,
    completed_total,
    cancelled_total,
    cancelled_before_served_total,
    case
      when arrivals_paying is null or arrivals_paying = 0 then null
      else completion_rate_paying_weighted / arrivals_paying
    end as completion_rate_paying,
    case
      when arrivals_priority is null or arrivals_priority = 0 then null
      else completion_rate_priority_weighted / arrivals_priority
    end as completion_rate_priority,
    case
      when served_total is null or served_total = 0 then null
      else wait_total_minutes / served_total
    end as wait_avg_minutes,
    null::numeric as wait_median_minutes,
    case
      when served_total is null or served_total = 0 then null
      else wait_p90_total_minutes / served_total
    end as wait_p90_minutes,
    case
      when served_total is null or served_total = 0 then null
      else wait_p95_total_minutes / served_total
    end as wait_p95_minutes,
    case
      when arrivals_paying is null or arrivals_paying = 0 then null
      else wait_total_minutes_paying / arrivals_paying
    end as wait_avg_minutes_paying,
    case
      when arrivals_priority is null or arrivals_priority = 0 then null
      else wait_total_minutes_priority / arrivals_priority
    end as wait_avg_minutes_priority,
    wait_max_minutes_paying,
    wait_max_minutes_priority,
    served_total as wait_count,
    case
      when completed_total is null or completed_total = 0 then null
      else time_in_system_total_minutes / completed_total
    end as time_in_system_avg_minutes,
    null::numeric as time_in_system_median_minutes,
    case
      when completed_total is null or completed_total = 0 then null
      else time_in_system_p90_total_minutes / completed_total
    end as time_in_system_p90_minutes,
    case
      when completed_total is null or completed_total = 0 then null
      else time_in_system_p95_total_minutes / completed_total
    end as time_in_system_p95_minutes,
    completed_total as time_in_system_count,
    case
      when completed_total is null or completed_total = 0 then null
      else service_total_minutes / completed_total
    end as service_avg_minutes,
    null::numeric as service_median_minutes,
    null::numeric as service_p90_minutes,
    null::numeric as service_p95_minutes,
    completed_total as service_count,
    case
      when open_minutes_total is null or open_minutes_total = 0 then null
      else completed_total::numeric / (open_minutes_total / 60)
    end as throughput_per_hour,
    case
      when served_total is null or served_total = 0 then null
      else (wait_total_minutes - (served_total * 20)) / served_total
    end as sla_wait_over_20_rate,
    service_arrivals,
    service_completed,
    service_cancelled,
    service_wait_total_minutes,
    service_wait_count,
    service_time_in_system_total_minutes,
    service_time_in_system_count,
    service_service_total_minutes,
    service_service_count
  from tmp_monthly_rollup_global
  where month_start is not null
  on conflict (location_id, month_start) do update
  set
    timezone = excluded.timezone,
    days_covered = excluded.days_covered,
    open_minutes_total = excluded.open_minutes_total,
    arrivals_total = excluded.arrivals_total,
    arrivals_paying = excluded.arrivals_paying,
    arrivals_priority = excluded.arrivals_priority,
    arrivals_per_hour = excluded.arrivals_per_hour,
    interarrival_avg_seconds = excluded.interarrival_avg_seconds,
    interarrival_stddev_seconds = excluded.interarrival_stddev_seconds,
    interarrival_count = excluded.interarrival_count,
    arrival_counts_by_hour = excluded.arrival_counts_by_hour,
    served_total = excluded.served_total,
    completed_total = excluded.completed_total,
    cancelled_total = excluded.cancelled_total,
    cancelled_before_served_total = excluded.cancelled_before_served_total,
    completion_rate_paying = excluded.completion_rate_paying,
    completion_rate_priority = excluded.completion_rate_priority,
    wait_avg_minutes = excluded.wait_avg_minutes,
    wait_median_minutes = excluded.wait_median_minutes,
    wait_p90_minutes = excluded.wait_p90_minutes,
    wait_p95_minutes = excluded.wait_p95_minutes,
    wait_avg_minutes_paying = excluded.wait_avg_minutes_paying,
    wait_avg_minutes_priority = excluded.wait_avg_minutes_priority,
    wait_max_minutes_paying = excluded.wait_max_minutes_paying,
    wait_max_minutes_priority = excluded.wait_max_minutes_priority,
    wait_count = excluded.wait_count,
    time_in_system_avg_minutes = excluded.time_in_system_avg_minutes,
    time_in_system_median_minutes = excluded.time_in_system_median_minutes,
    time_in_system_p90_minutes = excluded.time_in_system_p90_minutes,
    time_in_system_p95_minutes = excluded.time_in_system_p95_minutes,
    time_in_system_count = excluded.time_in_system_count,
    service_avg_minutes = excluded.service_avg_minutes,
    service_median_minutes = excluded.service_median_minutes,
    service_p90_minutes = excluded.service_p90_minutes,
    service_p95_minutes = excluded.service_p95_minutes,
    service_count = excluded.service_count,
    throughput_per_hour = excluded.throughput_per_hour,
    sla_wait_over_20_rate = excluded.sla_wait_over_20_rate,
    service_arrivals = excluded.service_arrivals,
    service_completed = excluded.service_completed,
    service_cancelled = excluded.service_cancelled,
    service_wait_total_minutes = excluded.service_wait_total_minutes,
    service_wait_count = excluded.service_wait_count,
    service_time_in_system_total_minutes = excluded.service_time_in_system_total_minutes,
    service_time_in_system_count = excluded.service_time_in_system_count,
    service_service_total_minutes = excluded.service_service_total_minutes,
    service_service_count = excluded.service_service_count;
end;
$$;

commit;
