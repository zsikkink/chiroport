begin;

-- The current rollup function writes these service duration fields, but the
-- table predates them. Keep the historical table additive and nullable because
-- older daily rows cannot provide exact percentiles.
alter table public.queue_monthly_stats
  add column if not exists service_median_minutes numeric,
  add column if not exists service_p90_minutes numeric,
  add column if not exists service_p95_minutes numeric;

-- rebuild_queue_monthly_stats still uses the row-wise aggregate while the
-- scheduled rollup uses the jsonb[] helper with the same overloaded name. A
-- later search_path hardening migration unintentionally dropped this overload.
drop aggregate if exists public.jsonb_sum_agg(jsonb);
create aggregate public.jsonb_sum_agg(jsonb) (
  sfunc = public.jsonb_sum,
  stype = jsonb,
  initcond = '{}'
);

commit;
