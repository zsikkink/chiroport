begin;

alter table public.sms_outbox
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz;

create index if not exists idx_sms_outbox_retry
  on public.sms_outbox (status, next_attempt_at);

create index if not exists idx_sms_outbox_locked
  on public.sms_outbox (status, locked_at);

create or replace function public.claim_sms_outbox(
  p_limit integer default 25,
  p_lock_minutes integer default 5,
  p_message_id uuid default null
)
returns setof public.sms_outbox
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select so.id
    from public.sms_outbox so
    where so.provider_message_id is null
      and (
        (so.status in ('queued', 'failed') and so.next_attempt_at <= now())
        or (
          so.status = 'sending'
          and so.locked_at is not null
          and so.locked_at <= now() - make_interval(mins => p_lock_minutes)
        )
      )
      and (p_message_id is null or so.id = p_message_id)
    order by so.next_attempt_at asc, so.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.sms_outbox so
  set status = 'sending',
      locked_at = now(),
      attempt_count = so.attempt_count + 1,
      last_error = null
  from candidates
  where so.id = candidates.id
  returning so.*;
end;
$$;

revoke execute on function public.claim_sms_outbox(integer, integer, uuid) from anon, authenticated;
grant execute on function public.claim_sms_outbox(integer, integer, uuid) to service_role;

commit;
