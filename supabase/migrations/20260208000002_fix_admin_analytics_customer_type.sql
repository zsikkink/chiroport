create or replace function public.get_admin_analytics(
  p_location_id uuid default null,
  p_date_start date default null,
  p_date_end date default null,
  p_customer_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_start date;
  v_end date;
  v_customer text;
  result jsonb;
begin
  v_customer := null;
  if p_customer_type is not null then
    if p_customer_type in ('non_paying', 'priority_pass') then
      v_customer := 'priority_pass';
    elsif p_customer_type = 'paying' then
      v_customer := 'paying';
    end if;
  end if;

  if p_date_start is null or p_date_end is null then
    select max(local_date)
      into v_start
      from public.queue_entries_history
     where (p_location_id is null or location_id = p_location_id)
       and (v_customer is null or customer_type = v_customer::public.customer_type);
    v_end := v_start;
  else
    v_start := p_date_start;
    v_end := p_date_end;
  end if;

  with filtered as (
    select *
      from public.queue_entries_history
     where (p_location_id is null or location_id = p_location_id)
       and (v_customer is null or customer_type = v_customer::public.customer_type)
       and (v_start is null or local_date >= v_start)
       and (v_end is null or local_date <= v_end)
  ),
  kpis as (
    select
      count(*) as arrivals_total,
      count(*) filter (where customer_type = 'paying') as arrivals_paying,
      count(*) filter (where customer_type = 'priority_pass') as arrivals_non_paying,
      count(*) filter (where served_at is not null) as served_total,
      count(*) filter (where status = 'completed') as completed_total,
      count(*) filter (where status in ('cancelled', 'no_show')) as cancelled_total,
      count(*) filter (
        where status in ('cancelled', 'no_show') and served_at is null
      ) as cancelled_before_served_total,
      case
        when count(*) > 0
          then count(*) filter (where status = 'completed')::numeric / count(*)
        else null
      end as completion_rate,
      case
        when count(*) > 0
          then count(*) filter (
            where status in ('cancelled', 'no_show') and served_at is null
          )::numeric / count(*)
        else null
      end as dropoff_rate,
      avg(extract(epoch from (served_at - created_at)) / 60.0)
        filter (where served_at is not null) as wait_avg_minutes,
      avg(extract(epoch from (completed_at - created_at)) / 60.0)
        filter (where completed_at is not null) as time_in_system_avg_minutes
    from filtered
  ),
  series as (
    select
      local_date,
      count(*) as arrivals_total,
      count(*) filter (where customer_type = 'paying') as arrivals_paying,
      count(*) filter (where customer_type = 'priority_pass') as arrivals_non_paying,
      count(*) filter (where served_at is not null) as served_total,
      count(*) filter (where status = 'completed') as completed_total,
      count(*) filter (where status in ('cancelled', 'no_show')) as cancelled_total,
      count(*) filter (
        where status in ('cancelled', 'no_show') and served_at is null
      ) as cancelled_before_served_total,
      case
        when count(*) > 0
          then count(*) filter (where status = 'completed')::numeric / count(*)
        else null
      end as completion_rate,
      case
        when count(*) > 0
          then count(*) filter (
            where status in ('cancelled', 'no_show') and served_at is null
          )::numeric / count(*)
        else null
      end as dropoff_rate,
      avg(extract(epoch from (served_at - created_at)) / 60.0)
        filter (where served_at is not null) as wait_avg_minutes,
      avg(extract(epoch from (completed_at - created_at)) / 60.0)
        filter (where completed_at is not null) as time_in_system_avg_minutes
    from filtered
    group by local_date
    order by local_date
  )
  select jsonb_build_object(
    'filters', jsonb_build_object(
      'location_id', p_location_id,
      'date_start', v_start,
      'date_end', v_end,
      'customer_type', v_customer
    ),
    'kpis', (select to_jsonb(kpis) from kpis),
    'series', coalesce(
      (select jsonb_agg(to_jsonb(series) order by series.local_date) from series),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$$;
