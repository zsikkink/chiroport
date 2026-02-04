begin;

create temporary table tmp_rebuild_monthly_rollup on commit drop as
with daily_rows as (
  select
    d.*,
    date_trunc('month', d.local_date)::date as month_start
  from public.queue_daily_stats d
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
group by location_id, month_start;

create temporary table tmp_rebuild_monthly_rollup_global on commit drop as
with daily_rows as (
  select
    d.*,
    date_trunc('month', d.local_date)::date as month_start
  from public.queue_daily_stats d
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
group by month_start;

delete from public.queue_monthly_stats m
using tmp_rebuild_monthly_rollup mr
where m.location_id = mr.location_id
  and m.month_start = mr.month_start;

delete from public.queue_monthly_stats m
using tmp_rebuild_monthly_rollup_global mg
where m.location_id is null
  and m.month_start = mg.month_start;

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
from tmp_rebuild_monthly_rollup mr;

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
from tmp_rebuild_monthly_rollup_global mg;

commit;
