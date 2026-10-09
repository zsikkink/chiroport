-- Synthetic-only, transaction-scoped fixture. The caller must guard its target.
begin;
insert into public.locations (id, airport_code, code, display_name, timezone)
values ('00000000-0000-4000-8000-000000009901', 'ATL', 'synthetic-rollup', 'Synthetic rollup fixture', 'UTC');
insert into public.queue_daily_stats (location_id, local_date, timezone, arrivals_total, arrivals_paying, served_total, completed_total, wait_avg_minutes, service_avg_minutes, service_completed, sla_wait_over_20_rate)
values
('00000000-0000-4000-8000-000000009901', (date_trunc('month', current_date) - interval '2 months')::date, 'UTC', 4, 4, 3, 2, 10, 20, '{"Chiropractor":2}', 1.0/3),
('00000000-0000-4000-8000-000000009901', (date_trunc('month', current_date) - interval '2 months' + interval '1 day')::date, 'UTC', 6, 6, 5, 4, 20, 30, '{"Chiropractor":4}', 2.0/5);
select public.rollup_queue_monthly_stats();
do $$
declare row public.queue_monthly_stats;
begin
  select * into strict row from public.queue_monthly_stats where location_id='00000000-0000-4000-8000-000000009901';
  if row.arrivals_total <> 10 or row.served_total <> 8 or row.completed_total <> 6
     or row.wait_count <> 8 or row.wait_avg_minutes is distinct from 16.25
     or row.service_count <> 6 or row.service_avg_minutes is null or abs(row.service_avg_minutes - 160.0/6) > 0.00001
     or row.service_completed is distinct from '{"Chiropractor":6}'::jsonb
     or row.sla_wait_over_20_rate is null or abs(row.sla_wait_over_20_rate - 3.0/8) > 0.00001 then
    raise exception 'Monthly conservation/weighted mean failure';
  end if;
  if (select arrivals_total from public.queue_monthly_stats where location_id is null and month_start=row.month_start)
     is distinct from (select sum(arrivals_total) from public.queue_daily_stats where date_trunc('month',local_date)::date=row.month_start) then
    raise exception 'Global monthly total does not conserve daily arrivals';
  end if;
  if (select sla_wait_over_20_rate from public.queue_monthly_stats where location_id is null and month_start=row.month_start)
     is distinct from (select case when count(*) filter (where served_total > 0 and sla_wait_over_20_rate is null) > 0 then null else sum(sla_wait_over_20_rate * served_total) / nullif(sum(served_total),0) end from public.queue_daily_stats where date_trunc('month',local_date)::date=row.month_start) then
    raise exception 'Global monthly rate disagrees with daily weighted fractions';
  end if;
end $$;
create temporary table expected_rollup as select to_jsonb(t) - 'id' - 'created_at' as metrics from public.queue_monthly_stats t where location_id='00000000-0000-4000-8000-000000009901';
drop table tmp_monthly_rollup, tmp_monthly_rollup_global;
select public.rollup_queue_monthly_stats();
do $$ begin
  if (select to_jsonb(t) - 'id' - 'created_at' from public.queue_monthly_stats t where location_id='00000000-0000-4000-8000-000000009901') is distinct from (select metrics from expected_rollup) then
    raise exception 'Monthly replay changed metrics';
  end if;
end $$;
select public.rebuild_queue_monthly_stats((date_trunc('month', current_date) - interval '2 months')::date, (date_trunc('month', current_date) - interval '2 months' + interval '1 day')::date);
do $$ begin
  if (select to_jsonb(t) - 'id' - 'created_at' from public.queue_monthly_stats t where location_id='00000000-0000-4000-8000-000000009901') is distinct from (select metrics from expected_rollup) then
    raise exception 'Rebuild differs: %', (select jsonb_object_agg(a.key, jsonb_build_array(a.value, e.metrics -> a.key)) from public.queue_monthly_stats t, expected_rollup e, lateral jsonb_each(to_jsonb(t) - 'id' - 'created_at') a where t.location_id='00000000-0000-4000-8000-000000009901' and a.value is distinct from e.metrics -> a.key);
  end if;
end $$;
-- A missing daily fraction is unknown, never silently counted as zero.
update public.queue_daily_stats set sla_wait_over_20_rate=null where location_id='00000000-0000-4000-8000-000000009901';
drop table tmp_monthly_rollup, tmp_monthly_rollup_global;
select public.rollup_queue_monthly_stats();
do $$ begin
  if (select sla_wait_over_20_rate from public.queue_monthly_stats where location_id='00000000-0000-4000-8000-000000009901') is not null then
    raise exception 'Missing daily rate must remain unknown';
  end if;
end $$;
rollback;
