begin;

-- Dashboard comparison scopes are aggregated together. The route keeps the
-- existing rich primary analytics response, while location, segment, baseline,
-- and operational comparison work no longer fans out by location or pages raw
-- visit history into Node.
drop function if exists public.get_admin_dashboard_scopes(uuid, date, date, text);

create or replace function public.get_admin_dashboard_scopes(
  p_date_start date,
  p_date_end date,
  p_location_id uuid default null,
  p_customer_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer public.customer_type;
  v_window_days integer;
  v_baseline_start date;
  v_baseline_end date;
  v_average_baseline boolean;
  v_result jsonb;
begin
  if p_date_start is null or p_date_end is null or p_date_end < p_date_start then
    raise exception 'A valid analytics date range is required';
  end if;

  if p_customer_type in ('priority_pass', 'non_paying') then
    v_customer := 'priority_pass';
  elsif p_customer_type = 'paying' then
    v_customer := 'paying';
  else
    v_customer := null;
  end if;

  v_window_days := (p_date_end - p_date_start) + 1;
  v_average_baseline := p_date_start = p_date_end;
  v_baseline_end := p_date_start - 1;
  v_baseline_start := case
    when v_average_baseline then v_baseline_end - 29
    else p_date_start - v_window_days
  end;

  with
  analysis_locations as materialized (
    select l.id, l.display_name, l.airport_code, l.code, l.timezone, l.is_open
    from public.locations l
    where l.is_open = true or l.id = p_location_id
  ),
  open_locations as materialized (
    select l.id, l.display_name, l.airport_code, l.code, l.timezone
    from analysis_locations l
    where l.is_open = true
  ),
  base_entries as materialized (
    select h.*
    from public.queue_entries_history h
    join analysis_locations l on l.id = h.location_id
    where h.status in ('completed', 'cancelled', 'no_show')
      and h.local_date between v_baseline_start and p_date_end
  ),
  entry_contacts as materialized (
    select
      e.id,
      e.customer_id,
      e.created_at,
      coalesce(ccs.phone_e164, c.phone_e164) as phone_e164
    from base_entries e
    left join public.queue_entries_legal_archive qela
      on qela.queue_entry_id = e.id
    left join public.customer_contact_snapshots ccs
      on ccs.id = qela.contact_snapshot_id
    left join public.customers c on c.id = e.customer_id
  ),
  relevant_phones as materialized (
    select distinct ec.phone_e164
    from entry_contacts ec
    where ec.phone_e164 is not null
  ),
  all_relevant_visits as materialized (
    select
      qela.queue_entry_id as id,
      ccs.phone_e164,
      qela.queue_entry_created_at as created_at
    from public.queue_entries_legal_archive qela
    join public.customer_contact_snapshots ccs
      on ccs.id = qela.contact_snapshot_id
    join relevant_phones rp on rp.phone_e164 = ccs.phone_e164

    union all

    select h.id, c.phone_e164, h.created_at
    from public.queue_entries_history h
    join public.customers c on c.id = h.customer_id
    join relevant_phones rp on rp.phone_e164 = c.phone_e164
    where not exists (
      select 1
      from public.queue_entries_legal_archive qela
      where qela.queue_entry_id = h.id
    )
  ),
  visit_rank as materialized (
    select
      arv.id,
      row_number() over (
        partition by arv.phone_e164
        order by arv.created_at, arv.id
      ) as visit_number
    from all_relevant_visits arv
  ),
  enriched as materialized (
    select
      e.*,
      case
        when ec.phone_e164 is null or vr.visit_number is null then null
        when vr.visit_number = 1 then false
        else true
      end as is_repeat
    from base_entries e
    left join entry_contacts ec on ec.id = e.id
    left join visit_rank vr on vr.id = e.id
  ),
  period_entries as materialized (
    select
      case
        when e.local_date between p_date_start and p_date_end then 'current'
        else 'baseline'
      end as period,
      e.*
    from enriched e
    where e.local_date between v_baseline_start and p_date_end
      and (v_customer is null or e.customer_type = v_customer)
  ),
  scoped_entries as materialized (
    select
      'location'::text as scope_kind,
      pe.location_id as scope_id,
      null::public.customer_type as segment_type,
      pe.*
    from period_entries pe

    union all

    select
      'primary'::text,
      null::uuid,
      null::public.customer_type,
      pe.*
    from period_entries pe
    where p_location_id is null or pe.location_id = p_location_id

    union all

    select
      'segment'::text,
      null::uuid,
      pe.customer_type,
      pe.*
    from period_entries pe
    where pe.period = 'current'
      and v_customer is null
      and (p_location_id is null or pe.location_id = p_location_id)
  ),
  aggregates as (
    select
      se.period,
      se.scope_kind,
      se.scope_id,
      se.segment_type,
      count(*)::numeric as arrivals_total,
      count(*) filter (where se.customer_type = 'paying')::numeric as arrivals_paying,
      count(*) filter (where se.customer_type = 'priority_pass')::numeric as arrivals_non_paying,
      count(*) filter (where se.served_at is not null)::numeric as served_total,
      count(*) filter (where se.status = 'completed')::numeric as completed_total,
      sum(case
        when se.status = 'completed' and se.customer_type = 'priority_pass' then 0.25
        when se.status = 'completed' then 1.0
        else 0.0
      end)::numeric as adjusted_completed_total,
      count(*) filter (where se.status in ('cancelled', 'no_show'))::numeric as cancelled_total,
      count(*) filter (
        where se.status in ('cancelled', 'no_show') and se.served_at is null
      )::numeric as cancelled_before_served_total,
      avg(extract(epoch from (se.served_at - se.created_at)) / 60.0)
        filter (where se.served_at is not null) as wait_avg_minutes,
      avg(extract(epoch from (se.completed_at - se.created_at)) / 60.0)
        filter (where se.completed_at is not null) as time_in_system_avg_minutes,
      count(*) filter (where se.is_repeat = false)::numeric as new_customers_total,
      count(*) filter (where se.is_repeat = true)::numeric as repeat_customers_total,
      count(*) filter (where se.is_repeat is not null)::numeric as classified_customers_total
    from scoped_entries se
    group by se.period, se.scope_kind, se.scope_id, se.segment_type
  ),
  baseline_daily as (
    select
      se.scope_kind,
      se.scope_id,
      se.local_date,
      count(*)::numeric as arrivals_total,
      count(*) filter (where se.status = 'completed')::numeric as completed_total,
      sum(case
        when se.status = 'completed' and se.customer_type = 'priority_pass' then 0.25
        when se.status = 'completed' then 1.0
        else 0.0
      end)::numeric as adjusted_completed_total,
      count(*) filter (where se.status in ('cancelled', 'no_show'))::numeric as cancelled_total,
      count(*) filter (
        where se.status in ('cancelled', 'no_show') and se.served_at is null
      )::numeric as cancelled_before_served_total,
      count(*) filter (where se.status = 'completed')::numeric /
        nullif(count(*), 0) as completion_rate,
      count(*) filter (where se.status in ('cancelled', 'no_show'))::numeric /
        nullif(count(*), 0) as dropoff_rate,
      avg(extract(epoch from (se.served_at - se.created_at)) / 60.0)
        filter (where se.served_at is not null) as wait_avg_minutes
    from scoped_entries se
    where se.period = 'baseline'
      and se.scope_kind in ('primary', 'location')
    group by se.scope_kind, se.scope_id, se.local_date
  ),
  baseline_daily_averages as (
    select
      bd.scope_kind,
      bd.scope_id,
      coalesce(sum(bd.arrivals_total), 0) / 30.0 as arrivals_total,
      coalesce(sum(bd.completed_total), 0) / 30.0 as completed_total,
      coalesce(sum(bd.adjusted_completed_total), 0) / 30.0 as adjusted_completed_total,
      coalesce(sum(bd.cancelled_total), 0) / 30.0 as cancelled_total,
      coalesce(sum(bd.cancelled_before_served_total), 0) / 30.0 as cancelled_before_served_total,
      avg(bd.completion_rate) as completion_rate,
      avg(bd.dropoff_rate) as dropoff_rate,
      avg(bd.wait_avg_minutes) as wait_avg_minutes
    from baseline_daily bd
    group by bd.scope_kind, bd.scope_id
  ),
  periods as (
    select 'current'::text as period, p_date_start as date_start, p_date_end as date_end
    union all
    select 'baseline', v_baseline_start, v_baseline_end
  ),
  open_windows as materialized (
    select
      p.period,
      p.date_start,
      p.date_end,
      l.id as location_id,
      day.local_date,
      ((day.local_date + lh.opens_at) at time zone l.timezone) as opens_at,
      ((day.local_date + lh.closes_at) at time zone l.timezone) as closes_at
    from periods p
    cross join analysis_locations l
    cross join lateral generate_series(
      p.date_start::timestamp,
      p.date_end::timestamp,
      interval '1 day'
    ) generated
    cross join lateral (select generated::date as local_date) day
    join public.location_hours lh
      on lh.location_id = l.id
     and lh.day_of_week = extract(dow from day.local_date)::integer
     and lh.is_closed = false
     and lh.closes_at > lh.opens_at
  ),
  open_totals as (
    select
      ow.period,
      ow.location_id,
      sum(extract(epoch from (ow.closes_at - ow.opens_at)) / 60.0) as open_minutes
    from open_windows ow
    group by ow.period, ow.location_id
  ),
  waiting_totals as (
    select
      pe.period,
      pe.location_id,
      sum(
        extract(epoch from (
          least(
            coalesce(pe.served_at, pe.completed_at, pe.cancelled_at, pe.no_show_at),
            ow.closes_at
          ) - greatest(pe.created_at, ow.opens_at)
        )) / 60.0
      ) as waiting_minutes
    from period_entries pe
    join open_windows ow
      on ow.period = pe.period
     and ow.location_id = pe.location_id
     and pe.created_at < ow.closes_at
     and coalesce(pe.served_at, pe.completed_at, pe.cancelled_at, pe.no_show_at) > ow.opens_at
    where coalesce(pe.served_at, pe.completed_at, pe.cancelled_at, pe.no_show_at) is not null
    group by pe.period, pe.location_id
  ),
  service_intervals as (
    select
      pe.period,
      pe.location_id,
      ow.local_date,
      greatest(pe.served_at, ow.opens_at) as interval_start,
      least(
        coalesce(pe.completed_at, pe.cancelled_at, pe.no_show_at),
        ow.closes_at
      ) as interval_end
    from period_entries pe
    join open_windows ow
      on ow.period = pe.period
     and ow.location_id = pe.location_id
     and pe.served_at < ow.closes_at
     and coalesce(pe.completed_at, pe.cancelled_at, pe.no_show_at) > ow.opens_at
    where pe.served_at is not null
      and coalesce(pe.completed_at, pe.cancelled_at, pe.no_show_at) is not null
  ),
  service_with_previous_end as (
    select
      si.*,
      max(si.interval_end) over (
        partition by si.period, si.location_id, si.local_date
        order by si.interval_start, si.interval_end
        rows between unbounded preceding and 1 preceding
      ) as previous_max_end
    from service_intervals si
  ),
  service_islands as (
    select
      sp.*,
      sum(case
        when sp.previous_max_end is null or sp.interval_start > sp.previous_max_end then 1
        else 0
      end) over (
        partition by sp.period, sp.location_id, sp.local_date
        order by sp.interval_start, sp.interval_end
      ) as island_id
    from service_with_previous_end sp
  ),
  service_merged as (
    select
      si.period,
      si.location_id,
      si.local_date,
      si.island_id,
      min(si.interval_start) as interval_start,
      max(si.interval_end) as interval_end
    from service_islands si
    group by si.period, si.location_id, si.local_date, si.island_id
  ),
  service_totals as (
    select
      sm.period,
      sm.location_id,
      sum(extract(epoch from (sm.interval_end - sm.interval_start)) / 60.0) as service_minutes
    from service_merged sm
    group by sm.period, sm.location_id
  ),
  location_operations as (
    select
      ot.period,
      ot.location_id,
      coalesce(wt.waiting_minutes, 0) / nullif(ot.open_minutes, 0) as average_queue_length,
      coalesce(st.service_minutes, 0) / nullif(ot.open_minutes, 0) as utilization_rate
    from open_totals ot
    left join waiting_totals wt
      on wt.period = ot.period and wt.location_id = ot.location_id
    left join service_totals st
      on st.period = ot.period and st.location_id = ot.location_id
  ),
  primary_operations as (
    select
      lo.period,
      sum(coalesce(wt.waiting_minutes, 0)) / nullif(sum(ot.open_minutes), 0)
        as average_queue_length,
      sum(coalesce(st.service_minutes, 0)) / nullif(sum(ot.open_minutes), 0)
        as utilization_rate
    from location_operations lo
    join open_totals ot
      on ot.period = lo.period and ot.location_id = lo.location_id
    left join waiting_totals wt
      on wt.period = lo.period and wt.location_id = lo.location_id
    left join service_totals st
      on st.period = lo.period and st.location_id = lo.location_id
    where p_location_id is null or lo.location_id = p_location_id
    group by lo.period
  ),
  scope_operations as (
    select
      lo.period,
      'location'::text as scope_kind,
      lo.location_id as scope_id,
      lo.average_queue_length,
      lo.utilization_rate
    from location_operations lo
    union all
    select
      po.period,
      'primary',
      null::uuid,
      po.average_queue_length,
      po.utilization_rate
    from primary_operations po
  ),
  current_dimensions as (
    select 'primary'::text as scope_kind, null::uuid as scope_id, null::public.customer_type as segment_type
    union all
    select 'location', l.id, null::public.customer_type from open_locations l
    union all
    select 'segment', null::uuid, 'paying'::public.customer_type where v_customer is null
    union all
    select 'segment', null::uuid, 'priority_pass'::public.customer_type where v_customer is null
  ),
  current_kpis as (
    select
      d.scope_kind,
      d.scope_id,
      d.segment_type,
      jsonb_build_object(
        'arrivals_total', coalesce(a.arrivals_total, 0),
        'arrivals_paying', coalesce(a.arrivals_paying, 0),
        'arrivals_non_paying', coalesce(a.arrivals_non_paying, 0),
        'served_total', coalesce(a.served_total, 0),
        'completed_total', coalesce(a.completed_total, 0),
        'adjusted_completed_total', coalesce(a.adjusted_completed_total, 0),
        'cancelled_total', coalesce(a.cancelled_total, 0),
        'cancelled_before_served_total', coalesce(a.cancelled_before_served_total, 0),
        'completion_rate', a.completed_total / nullif(a.arrivals_total, 0),
        'dropoff_rate', a.cancelled_total / nullif(a.arrivals_total, 0),
        'average_queue_length', so.average_queue_length,
        'utilization_rate', so.utilization_rate,
        'wait_avg_minutes', a.wait_avg_minutes,
        'time_in_system_avg_minutes', a.time_in_system_avg_minutes,
        'new_customers_total', coalesce(a.new_customers_total, 0),
        'repeat_customers_total', coalesce(a.repeat_customers_total, 0),
        'classified_customers_total', coalesce(a.classified_customers_total, 0),
        'new_customers_rate', a.new_customers_total / nullif(a.classified_customers_total, 0),
        'repeat_customers_rate', a.repeat_customers_total / nullif(a.classified_customers_total, 0)
      ) as kpis
    from current_dimensions d
    left join aggregates a
      on a.period = 'current'
     and a.scope_kind = d.scope_kind
     and a.scope_id is not distinct from d.scope_id
     and a.segment_type is not distinct from d.segment_type
    left join scope_operations so
      on so.period = 'current'
     and so.scope_kind = d.scope_kind
     and so.scope_id is not distinct from d.scope_id
  ),
  baseline_dimensions as (
    select 'primary'::text as scope_kind, null::uuid as scope_id
    union all
    select 'location', l.id from open_locations l
  ),
  baseline_kpis as (
    select
      d.scope_kind,
      d.scope_id,
      jsonb_build_object(
        'arrivals_total', case when v_average_baseline
          then coalesce(bda.arrivals_total, 0)
          else coalesce(a.arrivals_total, 0)
        end,
        'completed_total', case when v_average_baseline
          then coalesce(bda.completed_total, 0)
          else coalesce(a.completed_total, 0)
        end,
        'adjusted_completed_total', case when v_average_baseline
          then coalesce(bda.adjusted_completed_total, 0)
          else coalesce(a.adjusted_completed_total, 0)
        end,
        'cancelled_total', case when v_average_baseline
          then coalesce(bda.cancelled_total, 0)
          else coalesce(a.cancelled_total, 0)
        end,
        'completion_rate', case when v_average_baseline
          then bda.completion_rate
          else a.completed_total / nullif(a.arrivals_total, 0)
        end,
        'dropoff_rate', case when v_average_baseline
          then bda.dropoff_rate
          else a.cancelled_total / nullif(a.arrivals_total, 0)
        end,
        'average_queue_length', so.average_queue_length,
        'utilization_rate', so.utilization_rate,
        'wait_avg_minutes', case when v_average_baseline
          then bda.wait_avg_minutes
          else a.wait_avg_minutes
        end
      ) as kpis
    from baseline_dimensions d
    left join aggregates a
      on a.period = 'baseline'
     and a.scope_kind = d.scope_kind
     and a.scope_id is not distinct from d.scope_id
     and a.segment_type is null
    left join baseline_daily_averages bda
      on bda.scope_kind = d.scope_kind
     and bda.scope_id is not distinct from d.scope_id
    left join scope_operations so
      on so.period = 'baseline'
     and so.scope_kind = d.scope_kind
     and so.scope_id is not distinct from d.scope_id
  )
  select jsonb_build_object(
    'date_start', p_date_start,
    'date_end', p_date_end,
    'baseline_date_start', v_baseline_start,
    'baseline_date_end', v_baseline_end,
    'baseline_mode', case when v_average_baseline then 'trailing_daily_average' else 'previous_period' end,
    'primary_current_kpis', (
      select ck.kpis from current_kpis ck where ck.scope_kind = 'primary'
    ),
    'primary_baseline_kpis', (
      select bk.kpis from baseline_kpis bk where bk.scope_kind = 'primary'
    ),
    'locations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'location', jsonb_build_object(
            'id', l.id,
            'display_name', l.display_name,
            'airport_code', l.airport_code,
            'code', l.code
          ),
          'current_kpis', ck.kpis,
          'baseline_kpis', bk.kpis
        )
        order by l.airport_code, l.code
      )
      from open_locations l
      join current_kpis ck
        on ck.scope_kind = 'location' and ck.scope_id = l.id
      join baseline_kpis bk
        on bk.scope_kind = 'location' and bk.scope_id = l.id
    ), '[]'::jsonb),
    'segments', case when v_customer is null then jsonb_build_object(
      'paying', (
        select ck.kpis from current_kpis ck
        where ck.scope_kind = 'segment' and ck.segment_type = 'paying'
      ),
      'priority_pass', (
        select ck.kpis from current_kpis ck
        where ck.scope_kind = 'segment' and ck.segment_type = 'priority_pass'
      )
    ) else null end
  ) into v_result;

  return v_result;
end;
$$;

revoke all privileges on function public.get_admin_dashboard_scopes(date, date, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_admin_dashboard_scopes(date, date, uuid, text)
  to service_role;

commit;
