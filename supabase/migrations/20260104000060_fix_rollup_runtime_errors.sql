begin;

create or replace function public.rollup_queue_daily_stats(
  p_reference timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_daily_retention_days integer;
  v_archive_retention_days integer;
begin
  select
    coalesce(
      (select daily_stats_retention_days
       from public.queue_rollup_settings
       limit 1),
      90
    ),
    coalesce(
      (select archive_retention_days
       from public.queue_rollup_settings
       limit 1),
      365
    )
  into v_daily_retention_days, v_archive_retention_days;

  with entries as (
    select
      qe.*,
      q.location_id,
      l.timezone,
      (qe.created_at at time zone l.timezone)::date as local_date,
      coalesce(qe.service_label, 'Unknown') as service_label_group
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
      count(*) filter (where e.status = 'completed' and e.customer_type = 'paying')
        as completed_paying,
      count(*) filter (
        where e.status = 'completed' and e.customer_type = 'priority_pass'
      ) as completed_priority,
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
      percentile_cont(0.5) within group (order by wait_seconds) / 60
        as wait_median_minutes,
      percentile_cont(0.9) within group (order by wait_seconds) / 60
        as wait_p90_minutes,
      percentile_cont(0.95) within group (order by wait_seconds) / 60
        as wait_p95_minutes,
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
  ),
  service_arrivals as (
    select
      location_id,
      local_date,
      jsonb_object_agg(service_label_group, arrivals) as service_arrivals
    from (
      select
        e.location_id,
        e.local_date,
        e.service_label_group,
        count(*) as arrivals
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      group by e.location_id, e.local_date, e.service_label_group
    ) s
    group by location_id, local_date
  ),
  service_completed as (
    select
      location_id,
      local_date,
      jsonb_object_agg(service_label_group, completed) as service_completed
    from (
      select
        e.location_id,
        e.local_date,
        e.service_label_group,
        count(*) as completed
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.status = 'completed'
      group by e.location_id, e.local_date, e.service_label_group
    ) s
    group by location_id, local_date
  ),
  service_cancelled as (
    select
      location_id,
      local_date,
      jsonb_object_agg(service_label_group, cancelled) as service_cancelled
    from (
      select
        e.location_id,
        e.local_date,
        e.service_label_group,
        count(*) as cancelled
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.status in ('cancelled', 'no_show')
      group by e.location_id, e.local_date, e.service_label_group
    ) s
    group by location_id, local_date
  ),
  service_wait as (
    select
      location_id,
      local_date,
      jsonb_object_agg(service_label_group, wait_total_minutes)
        as service_wait_total_minutes,
      jsonb_object_agg(service_label_group, wait_count)
        as service_wait_count
    from (
      select
        e.location_id,
        e.local_date,
        e.service_label_group,
        sum(extract(epoch from (e.served_at - e.created_at)) / 60) as wait_total_minutes,
        count(*) as wait_count
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.served_at is not null
      group by e.location_id, e.local_date, e.service_label_group
    ) s
    group by location_id, local_date
  ),
  service_time_in_system as (
    select
      location_id,
      local_date,
      jsonb_object_agg(service_label_group, total_minutes)
        as service_time_in_system_total_minutes,
      jsonb_object_agg(service_label_group, total_count)
        as service_time_in_system_count
    from (
      select
        e.location_id,
        e.local_date,
        e.service_label_group,
        sum(extract(epoch from (e.completed_at - e.created_at)) / 60) as total_minutes,
        count(*) as total_count
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.completed_at is not null
      group by e.location_id, e.local_date, e.service_label_group
    ) s
    group by location_id, local_date
  ),
  service_service as (
    select
      location_id,
      local_date,
      jsonb_object_agg(service_label_group, total_minutes)
        as service_service_total_minutes,
      jsonb_object_agg(service_label_group, total_count)
        as service_service_count
    from (
      select
        e.location_id,
        e.local_date,
        e.service_label_group,
        sum(extract(epoch from (e.completed_at - e.served_at)) / 60) as total_minutes,
        count(*) as total_count
      from entries e
      join pending_dates pd
        on pd.location_id = e.location_id
       and pd.local_date = e.local_date
      where e.completed_at is not null and e.served_at is not null
      group by e.location_id, e.local_date, e.service_label_group
    ) s
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
    ws.sla_wait_over_20_rate,
    sa.service_arrivals,
    sc.service_completed,
    scc.service_cancelled,
    sw.service_wait_total_minutes,
    sw.service_wait_count,
    st.service_time_in_system_total_minutes,
    st.service_time_in_system_count,
    ssx.service_service_total_minutes,
    ssx.service_service_count
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
  left join service_arrivals sa
    on sa.location_id = a.location_id
   and sa.local_date = a.local_date
  left join service_completed sc
    on sc.location_id = a.location_id
   and sc.local_date = a.local_date
  left join service_cancelled scc
    on scc.location_id = a.location_id
   and scc.local_date = a.local_date
  left join service_wait sw
    on sw.location_id = a.location_id
   and sw.local_date = a.local_date
  left join service_time_in_system st
    on st.location_id = a.location_id
   and st.local_date = a.local_date
  left join service_service ssx
    on ssx.location_id = a.location_id
   and ssx.local_date = a.local_date
  on conflict (location_id, local_date) do nothing;


  with entries as (
    select
      qe.*,
      q.location_id,
      l.timezone,
      (qe.created_at at time zone l.timezone)::date as local_date,
      coalesce(qe.service_label, 'Unknown') as service_label_group
    from public.queue_entries qe
    join public.queues q on q.id = qe.queue_id
    join public.locations l on l.id = q.location_id
  )
  insert into public.queue_entries_archive (
    id,
    queue_id,
    location_id,
    customer_id,
    public_token,
    customer_type,
    status,
    service_label,
    created_at,
    updated_at,
    served_at,
    completed_at,
    cancelled_at,
    no_show_at,
    timezone,
    local_date
  )
  select
    e.id,
    e.queue_id,
    e.location_id,
    e.customer_id,
    e.public_token,
    e.customer_type,
    e.status,
    e.service_label_group as service_label,
    e.created_at,
    e.updated_at,
    e.served_at,
    e.completed_at,
    e.cancelled_at,
    e.no_show_at,
    e.timezone,
    e.local_date
  from entries e
  where e.local_date < (p_reference at time zone e.timezone)::date
  on conflict (id) do nothing;

  delete from public.queue_entries qe
  using public.queues q
  join public.locations l on l.id = q.location_id
  where qe.queue_id = q.id
    and (qe.created_at at time zone l.timezone)::date < (p_reference at time zone l.timezone)::date;

  perform public.rollup_queue_monthly_stats();

  delete from public.queue_daily_stats d
  where d.local_date < (current_date - make_interval(days => v_daily_retention_days))::date;

  delete from public.queue_entries_archive a
  where a.local_date < (current_date - make_interval(days => v_archive_retention_days))::date;
end;
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
    public.jsonb_sum_agg(arrival_counts_by_hour) as arrival_counts_by_hour,
    public.jsonb_sum_agg(service_arrivals) as service_arrivals,
    public.jsonb_sum_agg(service_completed) as service_completed,
    public.jsonb_sum_agg(service_cancelled) as service_cancelled,
    public.jsonb_sum_agg(service_wait_total_minutes) as service_wait_total_minutes,
    public.jsonb_sum_agg(service_wait_count) as service_wait_count,
    public.jsonb_sum_agg(service_time_in_system_total_minutes) as service_time_in_system_total_minutes,
    public.jsonb_sum_agg(service_time_in_system_count) as service_time_in_system_count,
    public.jsonb_sum_agg(service_service_total_minutes) as service_service_total_minutes,
    public.jsonb_sum_agg(service_service_count) as service_service_count
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
    public.jsonb_sum_agg(arrival_counts_by_hour) as arrival_counts_by_hour,
    public.jsonb_sum_agg(service_arrivals) as service_arrivals,
    public.jsonb_sum_agg(service_completed) as service_completed,
    public.jsonb_sum_agg(service_cancelled) as service_cancelled,
    public.jsonb_sum_agg(service_wait_total_minutes) as service_wait_total_minutes,
    public.jsonb_sum_agg(service_wait_count) as service_wait_count,
    public.jsonb_sum_agg(service_time_in_system_total_minutes) as service_time_in_system_total_minutes,
    public.jsonb_sum_agg(service_time_in_system_count) as service_time_in_system_count,
    public.jsonb_sum_agg(service_service_total_minutes) as service_service_total_minutes,
    public.jsonb_sum_agg(service_service_count) as service_service_count
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
    service_stddev_minutes,
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
        then mr.interarrival_total_seconds / mr.interarrival_count
      else null
    end as interarrival_avg_seconds,
    case
      when mr.interarrival_count > 0
        then mr.interarrival_stddev_total_seconds / mr.interarrival_count
      else null
    end as interarrival_stddev_seconds,
    mr.interarrival_count,
    mr.arrival_counts_by_hour,
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
      when mr.served_total > 0 then mr.wait_total_minutes / mr.served_total else null
    end as wait_avg_minutes,
    null::numeric as wait_median_minutes,
    case
      when mr.served_total > 0 then mr.wait_p90_total_minutes / mr.served_total else null
    end as wait_p90_minutes,
    case
      when mr.served_total > 0 then mr.wait_p95_total_minutes / mr.served_total else null
    end as wait_p95_minutes,
    case
      when mr.arrivals_paying > 0 then mr.wait_total_minutes_paying / mr.arrivals_paying else null
    end as wait_avg_minutes_paying,
    case
      when mr.arrivals_priority > 0 then mr.wait_total_minutes_priority / mr.arrivals_priority else null
    end as wait_avg_minutes_priority,
    mr.wait_max_minutes_paying,
    mr.wait_max_minutes_priority,
    mr.served_total as wait_count,
    case
      when mr.completed_total > 0 then mr.time_in_system_total_minutes / mr.completed_total else null
    end as time_in_system_avg_minutes,
    null::numeric as time_in_system_median_minutes,
    case
      when mr.completed_total > 0 then mr.time_in_system_p90_total_minutes / mr.completed_total else null
    end as time_in_system_p90_minutes,
    case
      when mr.completed_total > 0 then mr.time_in_system_p95_total_minutes / mr.completed_total else null
    end as time_in_system_p95_minutes,
    mr.completed_total as time_in_system_count,
    case
      when mr.completed_total > 0 then mr.service_total_minutes / mr.completed_total else null
    end as service_avg_minutes,
    null::numeric as service_stddev_minutes,
    mr.completed_total as service_count,
    case
      when mr.open_minutes_total > 0
        then mr.completed_total::numeric / (mr.open_minutes_total / 60.0)
      else null
    end as throughput_per_hour,
    null::numeric as sla_wait_over_20_rate,
    mr.service_arrivals,
    mr.service_completed,
    mr.service_cancelled,
    mr.service_wait_total_minutes,
    mr.service_wait_count,
    mr.service_time_in_system_total_minutes,
    mr.service_time_in_system_count,
    mr.service_service_total_minutes,
    mr.service_service_count
  from tmp_monthly_rollup mr
  on conflict (location_id, month_start) do update
    set timezone = excluded.timezone,
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
        service_stddev_minutes = excluded.service_stddev_minutes,
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
    mg.location_id,
    mg.month_start,
    mg.timezone,
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
        then mg.interarrival_total_seconds / mg.interarrival_count
      else null
    end as interarrival_avg_seconds,
    case
      when mg.interarrival_count > 0
        then mg.interarrival_stddev_total_seconds / mg.interarrival_count
      else null
    end as interarrival_stddev_seconds,
    mg.interarrival_count,
    mg.arrival_counts_by_hour,
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
      when mg.served_total > 0 then mg.wait_total_minutes / mg.served_total else null
    end as wait_avg_minutes,
    null::numeric as wait_median_minutes,
    case
      when mg.served_total > 0 then mg.wait_p90_total_minutes / mg.served_total else null
    end as wait_p90_minutes,
    case
      when mg.served_total > 0 then mg.wait_p95_total_minutes / mg.served_total else null
    end as wait_p95_minutes,
    case
      when mg.arrivals_paying > 0 then mg.wait_total_minutes_paying / mg.arrivals_paying else null
    end as wait_avg_minutes_paying,
    case
      when mg.arrivals_priority > 0 then mg.wait_total_minutes_priority / mg.arrivals_priority else null
    end as wait_avg_minutes_priority,
    mg.wait_max_minutes_paying,
    mg.wait_max_minutes_priority,
    mg.served_total as wait_count,
    case
      when mg.completed_total > 0 then mg.time_in_system_total_minutes / mg.completed_total else null
    end as time_in_system_avg_minutes,
    null::numeric as time_in_system_median_minutes,
    case
      when mg.completed_total > 0 then mg.time_in_system_p90_total_minutes / mg.completed_total else null
    end as time_in_system_p90_minutes,
    case
      when mg.completed_total > 0 then mg.time_in_system_p95_total_minutes / mg.completed_total else null
    end as time_in_system_p95_minutes,
    mg.completed_total as time_in_system_count,
    case
      when mg.completed_total > 0 then mg.service_total_minutes / mg.completed_total else null
    end as service_avg_minutes,
    null::numeric as service_stddev_minutes,
    mg.completed_total as service_count,
    case
      when mg.open_minutes_total > 0
        then mg.completed_total::numeric / (mg.open_minutes_total / 60.0)
      else null
    end as throughput_per_hour,
    null::numeric as sla_wait_over_20_rate,
    mg.service_arrivals,
    mg.service_completed,
    mg.service_cancelled,
    mg.service_wait_total_minutes,
    mg.service_wait_count,
    mg.service_time_in_system_total_minutes,
    mg.service_time_in_system_count,
    mg.service_service_total_minutes,
    mg.service_service_count
  from tmp_monthly_rollup_global mg
  on conflict (month_start) where location_id is null do update
    set timezone = excluded.timezone,
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
        service_stddev_minutes = excluded.service_stddev_minutes,
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
