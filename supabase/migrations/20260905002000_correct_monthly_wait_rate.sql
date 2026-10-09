begin;

-- Patch only the reviewed projections in the two existing long rollup bodies.
-- Exact occurrence checks fail on prerequisite drift. CREATE OR REPLACE keeps
-- signatures, owners and ACLs; unrelated metrics and history are untouched.
do $$
declare
  signature text;
  definition text;
  old_aggregate constant text := 'sum(wait_avg_minutes * served_total)::numeric as wait_total_minutes,';
  new_aggregate constant text := 'sum(wait_avg_minutes * served_total)::numeric as wait_total_minutes,
    sum(sla_wait_over_20_rate * served_total)::numeric as sla_over_20_count,
    count(*) filter (where served_total > 0 and sla_wait_over_20_rate is null) as sla_missing_days,';
  old_projection text;
  new_projection text;
begin
  foreach signature in array array['public.rollup_queue_monthly_stats()', 'public.rebuild_queue_monthly_stats(date,date)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if (length(definition)-length(replace(definition, old_aggregate, ''))) / length(old_aggregate) <> 2 then
      raise exception 'Unexpected rollup aggregate prerequisite: %', signature;
    end if;
    definition := replace(definition, old_aggregate, new_aggregate);
    if signature='public.rollup_queue_monthly_stats()' then
      old_projection := '(wait_total_minutes - (served_total * 20)) / served_total';
      new_projection := 'case when sla_missing_days > 0 then null else sla_over_20_count / served_total end';
    else
      old_projection := 'null::numeric as sla_wait_over_20_rate';
      new_projection := 'case when served_total > 0 and sla_missing_days = 0 then sla_over_20_count / served_total else null end as sla_wait_over_20_rate';
    end if;
    if (length(definition)-length(replace(definition, old_projection, ''))) / length(old_projection) <> 2 then
      raise exception 'Unexpected rollup rate prerequisite: %', signature;
    end if;
    execute replace(definition, old_projection, new_projection);
  end loop;
end;
$$;

-- No automatic historical rewrite: months with expired daily inputs cannot
-- be reconstructed honestly. A reviewed backfill uses retained complete days.
commit;
