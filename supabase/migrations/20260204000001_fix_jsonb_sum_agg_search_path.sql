begin;

update pg_proc
set proconfig = coalesce(
  array_append(
    array_remove(proconfig, 'search_path=pg_catalog,public'),
    'search_path=pg_catalog,public'
  ),
  array['search_path=pg_catalog,public']
)
where proname = 'jsonb_sum_agg'
  and pronamespace = (select oid from pg_namespace where nspname = 'public');

commit;
