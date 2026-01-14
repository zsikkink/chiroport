begin;

create table if not exists public.api_rate_limits (
  bucket text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated, public;

create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
  v_reset timestamptz;
begin
  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'Rate limit bucket is required';
  end if;
  if p_limit is null or p_limit <= 0 then
    raise exception 'Rate limit must be positive';
  end if;
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'Rate limit window must be positive';
  end if;

  select arl.count, arl.reset_at
  into v_count, v_reset
  from public.api_rate_limits arl
  where arl.bucket = p_bucket
  for update;

  if v_reset is null or v_reset <= v_now then
    v_count := 1;
    v_reset := v_now + make_interval(secs => p_window_seconds);
    insert into public.api_rate_limits (bucket, count, reset_at, updated_at)
    values (p_bucket, v_count, v_reset, v_now)
    on conflict (bucket) do update
      set count = excluded.count,
          reset_at = excluded.reset_at,
          updated_at = excluded.updated_at;
  else
    v_count := v_count + 1;
    update public.api_rate_limits
    set count = v_count,
        updated_at = v_now
    where bucket = p_bucket;
  end if;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  reset_at := v_reset;
  return next;
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer)
  from anon, authenticated;

grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;

commit;
