begin;

-- Ensure "next" messages are never sent before a successful confirm message.
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
    left join public.sms_outbox confirm_msg
      on confirm_msg.queue_entry_id = so.queue_entry_id
      and confirm_msg.message_type = 'confirm'
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
      and (
        so.message_type <> 'next'
        or confirm_msg.status = 'sent'
      )
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

commit;

