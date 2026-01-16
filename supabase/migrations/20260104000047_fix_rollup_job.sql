begin;

-- Replace rollup functions to fix missing monthly_rollup_global and include service-group stats.
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
      jsonb_object_agg(service_label_group, wait_total_minutes) as service_wait_total_minutes,
      jsonb_object_agg(service_label_group, wait_count) as service_wait_count
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
      jsonb_object_agg(service_label_group, total_minutes) as service_time_in_system_total_minutes,
      jsonb_object_agg(service_label_group, total_count) as service_time_in_system_count
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
      jsonb_object_agg(service_label_group, total_minutes) as service_service_total_minutes,
      jsonb_object_agg(service_label_group, total_count) as service_service_count
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

  delete from public.queue_entries qe
  using public.queues q
  join public.locations l on l.id = q.location_id
  where qe.queue_id = q.id
    and (qe.created_at at time zone l.timezone)::date < (p_reference at time zone l.timezone)::date;

  delete from public.queue_daily_stats d
  where d.local_date < (now() - interval '7 days')::date;

  perform public.rollup_queue_monthly_stats();
end;
$$;

create or replace function public.rollup_queue_monthly_stats()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  with daily_rows as (
    select
      d.*,
      date_trunc('month', d.local_date)::date as month_start
    from public.queue_daily_stats d
  ),
  monthly_rollup as (
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
      sum(completed_total)::numeric / nullif(sum(arrivals_total), 0) as completion_rate_total,
      sum(completed_total) filter (where arrivals_total is not null) as completed_for_throughput,
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
      public.jsonb_sum(null::jsonb, arrival_counts_by_hour) as arrival_counts_by_hour,
      public.jsonb_sum(null::jsonb, service_arrivals) as service_arrivals,
      public.jsonb_sum(null::jsonb, service_completed) as service_completed,
      public.jsonb_sum(null::jsonb, service_cancelled) as service_cancelled,
      public.jsonb_sum(null::jsonb, service_wait_total_minutes) as service_wait_total_minutes,
      public.jsonb_sum(null::jsonb, service_wait_count) as service_wait_count,
      public.jsonb_sum(null::jsonb, service_time_in_system_total_minutes) as service_time_in_system_total_minutes,
      public.jsonb_sum(null::jsonb, service_time_in_system_count) as service_time_in_system_count,
      public.jsonb_sum(null::jsonb, service_service_total_minutes) as service_service_total_minutes,
      public.jsonb_sum(null::jsonb, service_service_count) as service_service_count
    from daily_rows d
    group by location_id, month_start
  ),
  monthly_rollup_global as (
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
      sum(completed_total)::numeric / nullif(sum(arrivals_total), 0) as completion_rate_total,
      sum(completed_total) filter (where arrivals_total is not null) as completed_for_throughput,
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
      public.jsonb_sum(null::jsonb, arrival_counts_by_hour) as arrival_counts_by_hour,
      public.jsonb_sum(null::jsonb, service_arrivals) as service_arrivals,
      public.jsonb_sum(null::jsonb, service_completed) as service_completed,
      public.jsonb_sum(null::jsonb, service_cancelled) as service_cancelled,
      public.jsonb_sum(null::jsonb, service_wait_total_minutes) as service_wait_total_minutes,
      public.jsonb_sum(null::jsonb, service_wait_count) as service_wait_count,
      public.jsonb_sum(null::jsonb, service_time_in_system_total_minutes) as service_time_in_system_total_minutes,
      public.jsonb_sum(null::jsonb, service_time_in_system_count) as service_time_in_system_count,
      public.jsonb_sum(null::jsonb, service_service_total_minutes) as service_service_total_minutes,
      public.jsonb_sum(null::jsonb, service_service_count) as service_service_count
    from daily_rows d
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
    mr.arrival_counts_by_hour,
    mr.served_total,
    mr.completed_total,
    mr.cancelled_total,
    mr.cancelled_before_served_total,
    case
      when mr.arrivals_paying > 0
        then (select sum(completed_total) from daily_rows d where d.location_id = mr.location_id and d.month_start = mr.month_start and d.arrivals_paying > 0)::numeric / mr.arrivals_paying
      else null
    end as completion_rate_paying,
    case
      when mr.arrivals_priority > 0
        then (select sum(completed_total) from daily_rows d where d.location_id = mr.location_id and d.month_start = mr.month_start and d.arrivals_priority > 0)::numeric / mr.arrivals_priority
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
    case
      when mr.completed_total > 0 then mr.service_total_minutes / mr.completed_total else null
    end as service_avg_minutes,
    null::numeric as service_stddev_minutes,
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
  from monthly_rollup mr
  on conflict (location_id, month_start) do update
    set days_covered = public.queue_monthly_stats.days_covered + excluded.days_covered,
        open_minutes_total = coalesce(public.queue_monthly_stats.open_minutes_total, 0)
          + excluded.open_minutes_total,
        arrivals_total = public.queue_monthly_stats.arrivals_total + excluded.arrivals_total,
        arrivals_paying = public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying,
        arrivals_priority = public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority,
        arrivals_per_hour = case
          when (coalesce(public.queue_monthly_stats.open_minutes_total, 0)
            + excluded.open_minutes_total) > 0
            then (public.queue_monthly_stats.arrivals_total + excluded.arrivals_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + excluded.open_minutes_total) / 60.0)
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
          else greatest(public.queue_monthly_stats.wait_max_minutes_paying, excluded.wait_max_minutes_paying)
        end,
        wait_max_minutes_priority = case
          when public.queue_monthly_stats.wait_max_minutes_priority is null
            then excluded.wait_max_minutes_priority
          else greatest(public.queue_monthly_stats.wait_max_minutes_priority, excluded.wait_max_minutes_priority)
        end,
        time_in_system_count = public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count,
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
            + excluded.open_minutes_total) > 0
            then (public.queue_monthly_stats.completed_total + excluded.completed_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + excluded.open_minutes_total) / 60.0)
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
        end,
        service_arrivals = public.jsonb_sum(
          public.queue_monthly_stats.service_arrivals,
          excluded.service_arrivals
        ),
        service_completed = public.jsonb_sum(
          public.queue_monthly_stats.service_completed,
          excluded.service_completed
        ),
        service_cancelled = public.jsonb_sum(
          public.queue_monthly_stats.service_cancelled,
          excluded.service_cancelled
        ),
        service_wait_total_minutes = public.jsonb_sum(
          public.queue_monthly_stats.service_wait_total_minutes,
          excluded.service_wait_total_minutes
        ),
        service_wait_count = public.jsonb_sum(
          public.queue_monthly_stats.service_wait_count,
          excluded.service_wait_count
        ),
        service_time_in_system_total_minutes = public.jsonb_sum(
          public.queue_monthly_stats.service_time_in_system_total_minutes,
          excluded.service_time_in_system_total_minutes
        ),
        service_time_in_system_count = public.jsonb_sum(
          public.queue_monthly_stats.service_time_in_system_count,
          excluded.service_time_in_system_count
        ),
        service_service_total_minutes = public.jsonb_sum(
          public.queue_monthly_stats.service_service_total_minutes,
          excluded.service_service_total_minutes
        ),
        service_service_count = public.jsonb_sum(
          public.queue_monthly_stats.service_service_count,
          excluded.service_service_count
        );

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
    mg.arrival_counts_by_hour,
    mg.served_total,
    mg.completed_total,
    mg.cancelled_total,
    mg.cancelled_before_served_total,
    case
      when mg.arrivals_paying > 0
        then mg.completed_total::numeric / mg.arrivals_paying
      else null
    end as completion_rate_paying,
    case
      when mg.arrivals_priority > 0
        then mg.completed_total::numeric / mg.arrivals_priority
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
    case
      when mg.completed_total > 0 then mg.service_total_minutes / mg.completed_total else null
    end as service_avg_minutes,
    null::numeric as service_stddev_minutes,
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
  from monthly_rollup_global mg
  on conflict (month_start) do update
    set days_covered = public.queue_monthly_stats.days_covered + excluded.days_covered,
        open_minutes_total = coalesce(public.queue_monthly_stats.open_minutes_total, 0)
          + excluded.open_minutes_total,
        arrivals_total = public.queue_monthly_stats.arrivals_total + excluded.arrivals_total,
        arrivals_paying = public.queue_monthly_stats.arrivals_paying + excluded.arrivals_paying,
        arrivals_priority = public.queue_monthly_stats.arrivals_priority + excluded.arrivals_priority,
        arrivals_per_hour = case
          when (coalesce(public.queue_monthly_stats.open_minutes_total, 0)
            + excluded.open_minutes_total) > 0
            then (public.queue_monthly_stats.arrivals_total + excluded.arrivals_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + excluded.open_minutes_total) / 60.0)
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
          else greatest(public.queue_monthly_stats.wait_max_minutes_paying, excluded.wait_max_minutes_paying)
        end,
        wait_max_minutes_priority = case
          when public.queue_monthly_stats.wait_max_minutes_priority is null
            then excluded.wait_max_minutes_priority
          else greatest(public.queue_monthly_stats.wait_max_minutes_priority, excluded.wait_max_minutes_priority)
        end,
        time_in_system_count = public.queue_monthly_stats.time_in_system_count + excluded.time_in_system_count,
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
            + excluded.open_minutes_total) > 0
            then (public.queue_monthly_stats.completed_total + excluded.completed_total)::numeric
              / ((coalesce(public.queue_monthly_stats.open_minutes_total, 0)
                + excluded.open_minutes_total) / 60.0)
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
        end,
        service_arrivals = public.jsonb_sum(
          public.queue_monthly_stats.service_arrivals,
          excluded.service_arrivals
        ),
        service_completed = public.jsonb_sum(
          public.queue_monthly_stats.service_completed,
          excluded.service_completed
        ),
        service_cancelled = public.jsonb_sum(
          public.queue_monthly_stats.service_cancelled,
          excluded.service_cancelled
        ),
        service_wait_total_minutes = public.jsonb_sum(
          public.queue_monthly_stats.service_wait_total_minutes,
          excluded.service_wait_total_minutes
        ),
        service_wait_count = public.jsonb_sum(
          public.queue_monthly_stats.service_wait_count,
          excluded.service_wait_count
        ),
        service_time_in_system_total_minutes = public.jsonb_sum(
          public.queue_monthly_stats.service_time_in_system_total_minutes,
          excluded.service_time_in_system_total_minutes
        ),
        service_time_in_system_count = public.jsonb_sum(
          public.queue_monthly_stats.service_time_in_system_count,
          excluded.service_time_in_system_count
        ),
        service_service_total_minutes = public.jsonb_sum(
          public.queue_monthly_stats.service_service_total_minutes,
          excluded.service_service_total_minutes
        ),
        service_service_count = public.jsonb_sum(
          public.queue_monthly_stats.service_service_count,
          excluded.service_service_count
        );
end;
$$;

commit;
