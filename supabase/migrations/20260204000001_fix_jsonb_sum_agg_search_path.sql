begin;

alter aggregate public.jsonb_sum_agg(jsonb)
  set (search_path = 'pg_catalog, public');

commit;
