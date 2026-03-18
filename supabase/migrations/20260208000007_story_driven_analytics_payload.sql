begin;

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
  v_prev_start date;
  v_prev_end date;
  v_window_days integer;
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
       and (v_customer is null or customer_type = v_customer::public.customer_type)
       and status in ('completed', 'cancelled', 'no_show');
    v_end := v_start;
  else
    v_start := p_date_start;
    v_end := p_date_end;
  end if;

  if v_start is not null and v_end is not null then
    v_window_days := greatest(1, (v_end - v_start) + 1);
    v_prev_end := v_start - 1;
    v_prev_start := v_start - v_window_days;
  else
    v_prev_end := null;
    v_prev_start := null;
  end if;

  with filtered as (
    select *
      from public.queue_entries_history
     where (p_location_id is null or location_id = p_location_id)
       and (v_customer is null or customer_type = v_customer::public.customer_type)
       and (v_start is null or local_date >= v_start)
       and (v_end is null or local_date <= v_end)
       and status in ('completed', 'cancelled', 'no_show')
  ),
  filtered_entries as (
    select
      f.id as queue_entry_id,
      f.customer_id,
      f.created_at,
      f.local_date
    from filtered f
  ),
  filtered_with_phone as (
    select
      fe.queue_entry_id,
      fe.created_at,
      fe.local_date,
      coalesce(ccs.phone_e164, c.phone_e164) as phone_e164
    from filtered_entries fe
    left join public.queue_entries_legal_archive qela
      on qela.queue_entry_id = fe.queue_entry_id
    left join public.customer_contact_snapshots ccs
      on ccs.id = qela.contact_snapshot_id
    left join public.customers c
      on c.id = fe.customer_id
  ),
  filtered_phones as (
    select distinct phone_e164
    from filtered_with_phone
    where phone_e164 is not null
  ),
  repeat_history as (
    select
      qela.queue_entry_id,
      ccs.phone_e164,
      qela.queue_entry_created_at as created_at
    from public.queue_entries_legal_archive qela
    join public.customer_contact_snapshots ccs
      on ccs.id = qela.contact_snapshot_id
    join filtered_phones fp
      on fp.phone_e164 = ccs.phone_e164

    union all

    select
      qeh.id as queue_entry_id,
      c.phone_e164,
      qeh.created_at
    from public.queue_entries_history qeh
    join public.customers c
      on c.id = qeh.customer_id
    join filtered_phones fp
      on fp.phone_e164 = c.phone_e164
    where not exists (
      select 1
      from public.queue_entries_legal_archive qela
      where qela.queue_entry_id = qeh.id
    )
  ),
  repeat_ranked as (
    select
      rh.queue_entry_id,
      row_number() over (
        partition by rh.phone_e164
        order by rh.created_at asc, rh.queue_entry_id asc
      ) as visit_number
    from repeat_history rh
  ),
  repeat_flags as (
    select
      fwp.queue_entry_id,
      case
        when rr.visit_number is null then null
        when rr.visit_number = 1 then false
        else true
      end as is_repeat
    from filtered_with_phone fwp
    left join repeat_ranked rr
      on rr.queue_entry_id = fwp.queue_entry_id
  ),
  repeat_totals as (
    select
      count(*) filter (where is_repeat = false) as new_customers_total,
      count(*) filter (where is_repeat = true) as repeat_customers_total,
      count(*) filter (where is_repeat is not null) as classified_customers_total
    from repeat_flags
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
          then count(*) filter (where status in ('cancelled', 'no_show'))::numeric / count(*)
        else null
      end as dropoff_rate,
      avg(extract(epoch from (served_at - created_at)) / 60.0)
        filter (where served_at is not null) as wait_avg_minutes,
      avg(extract(epoch from (completed_at - created_at)) / 60.0)
        filter (where completed_at is not null) as time_in_system_avg_minutes,
      max(rt.new_customers_total) as new_customers_total,
      max(rt.repeat_customers_total) as repeat_customers_total,
      max(rt.classified_customers_total) as classified_customers_total,
      case
        when max(rt.classified_customers_total) > 0
          then max(rt.new_customers_total)::numeric / max(rt.classified_customers_total)
        else null
      end as new_customers_rate,
      case
        when max(rt.classified_customers_total) > 0
          then max(rt.repeat_customers_total)::numeric / max(rt.classified_customers_total)
        else null
      end as repeat_customers_rate
    from filtered
    cross join repeat_totals rt
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
          then count(*) filter (where status in ('cancelled', 'no_show'))::numeric / count(*)
        else null
      end as dropoff_rate,
      avg(extract(epoch from (served_at - created_at)) / 60.0)
        filter (where served_at is not null) as wait_avg_minutes,
      avg(extract(epoch from (completed_at - created_at)) / 60.0)
        filter (where completed_at is not null) as time_in_system_avg_minutes
    from filtered
    group by local_date
    order by local_date
  ),
  hourly as (
    with hours as (
      select generate_series(0, 23)::int as hour_of_day
    ),
    arrivals_by_hour as (
      select
        extract(hour from (f.created_at at time zone f.timezone))::int as hour_of_day,
        count(*) as arrivals_total
      from filtered f
      group by 1
    ),
    served_by_hour as (
      select
        extract(hour from (f.served_at at time zone f.timezone))::int as hour_of_day,
        count(*) as served_total
      from filtered f
      where f.served_at is not null
      group by 1
    ),
    wait_by_hour as (
      select
        extract(hour from (f.created_at at time zone f.timezone))::int as hour_of_day,
        avg(extract(epoch from (f.served_at - f.created_at)) / 60.0) as wait_avg_minutes
      from filtered f
      where f.served_at is not null
      group by 1
    )
    select
      h.hour_of_day,
      coalesce(a.arrivals_total, 0) as arrivals_total,
      coalesce(s.served_total, 0) as served_total,
      w.wait_avg_minutes
    from hours h
    left join arrivals_by_hour a on a.hour_of_day = h.hour_of_day
    left join served_by_hour s on s.hour_of_day = h.hour_of_day
    left join wait_by_hour w on w.hour_of_day = h.hour_of_day
    order by h.hour_of_day
  ),
  previous_filtered as (
    select *
      from public.queue_entries_history
     where v_prev_start is not null
       and v_prev_end is not null
       and (p_location_id is null or location_id = p_location_id)
       and (v_customer is null or customer_type = v_customer::public.customer_type)
       and local_date >= v_prev_start
       and local_date <= v_prev_end
       and status in ('completed', 'cancelled', 'no_show')
  ),
  previous_kpis as (
    select
      count(*) as arrivals_total,
      count(*) filter (where status = 'completed') as completed_total,
      count(*) filter (where status in ('cancelled', 'no_show')) as cancelled_total,
      case
        when count(*) > 0
          then count(*) filter (where status = 'completed')::numeric / count(*)
        else null
      end as completion_rate,
      case
        when count(*) > 0
          then count(*) filter (where status in ('cancelled', 'no_show'))::numeric / count(*)
        else null
      end as dropoff_rate,
      avg(extract(epoch from (served_at - created_at)) / 60.0)
        filter (where served_at is not null) as wait_avg_minutes
    from previous_filtered
  )
  select jsonb_build_object(
    'filters', jsonb_build_object(
      'location_id', p_location_id,
      'date_start', v_start,
      'date_end', v_end,
      'customer_type', v_customer
    ),
    'kpis', (select to_jsonb(kpis) from kpis),
    'hourly_series', coalesce(
      (select jsonb_agg(to_jsonb(hourly) order by hourly.hour_of_day) from hourly),
      '[]'::jsonb
    ),
    'previous_period', case
      when v_prev_start is null or v_prev_end is null then null
      else jsonb_build_object(
        'date_start', v_prev_start,
        'date_end', v_prev_end,
        'kpis', (select to_jsonb(previous_kpis) from previous_kpis)
      )
    end,
    'series', coalesce(
      (select jsonb_agg(to_jsonb(series) order by series.local_date) from series),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$$;

commit;
