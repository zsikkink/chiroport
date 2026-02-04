begin;

create or replace function public.check_rate_limits(p_rules jsonb)
returns table (
  bucket text,
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  limit_count integer,
  window_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rule jsonb;
  v_bucket text;
  v_limit integer;
  v_window integer;
  v_now timestamptz := now();
  v_count integer;
  v_reset timestamptz;
begin
  if p_rules is null
     or jsonb_typeof(p_rules) <> 'array'
     or jsonb_array_length(p_rules) = 0 then
    raise exception 'Rate limit rules are required';
  end if;

  for v_rule in select value from jsonb_array_elements(p_rules) loop
    v_bucket := nullif(trim(v_rule->>'bucket'), '');
    v_limit := (v_rule->>'limit')::integer;
    v_window := (v_rule->>'window_seconds')::integer;

    if v_bucket is null then
      raise exception 'Rate limit bucket is required';
    end if;
    if v_limit is null or v_limit <= 0 then
      raise exception 'Rate limit must be positive';
    end if;
    if v_window is null or v_window <= 0 then
      raise exception 'Rate limit window must be positive';
    end if;

    insert into public.api_rate_limits (bucket, count, reset_at, updated_at)
    values (v_bucket, 0, v_now, v_now)
    on conflict (bucket) do nothing;

    select arl.count, arl.reset_at
      into v_count, v_reset
      from public.api_rate_limits arl
      where arl.bucket = v_bucket
      for update;

    if v_reset is null or v_reset <= v_now then
      v_count := 1;
      v_reset := v_now + make_interval(secs => v_window);
      update public.api_rate_limits
        set count = v_count,
            reset_at = v_reset,
            updated_at = v_now
        where bucket = v_bucket;
    else
      v_count := v_count + 1;
      update public.api_rate_limits
        set count = v_count,
            updated_at = v_now
        where bucket = v_bucket;
    end if;

    bucket := v_bucket;
    limit_count := v_limit;
    window_seconds := v_window;
    allowed := v_count <= v_limit;
    remaining := greatest(v_limit - v_count, 0);
    reset_at := v_reset;
    return next;
  end loop;
end;
$$;

revoke execute on function public.check_rate_limits(jsonb) from anon, authenticated;
grant execute on function public.check_rate_limits(jsonb) to service_role;

commit;
