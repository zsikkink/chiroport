begin;

-- Manual staff messages get the same transaction guarantee as automated
-- messages: the durable row and the truthful "queued" audit event commit
-- together. Provider delivery remains a separate, retryable outbox concern.
create or replace function public.staff_enqueue_message(
  p_entry_id uuid,
  p_actor_user_id uuid,
  p_body text
)
returns table (
  out_outbox_id uuid,
  out_message_type text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_phone text;
  v_outbox_id uuid;
  v_message_type text;
  v_body text;
begin
  if p_entry_id is null or p_actor_user_id is null then
    raise exception 'Queue entry and actor are required';
  end if;

  v_body := nullif(trim(p_body), '');
  if v_body is null then
    raise exception 'Message body is required';
  end if;

  select c.phone_e164
  into v_phone
  from public.queue_entries qe
  join public.customers c on c.id = qe.customer_id
  where qe.id = p_entry_id
  for share of qe;

  if v_phone is null then
    raise exception 'Queue entry or customer phone number is missing';
  end if;

  v_message_type := 'staff_' || gen_random_uuid()::text;

  insert into public.sms_outbox (
    queue_entry_id,
    message_type,
    to_phone,
    body,
    status,
    idempotency_key
  ) values (
    p_entry_id,
    v_message_type,
    v_phone,
    v_body,
    'queued',
    'staff:' || p_entry_id::text || ':' || gen_random_uuid()::text
  )
  returning id into v_outbox_id;

  insert into public.queue_events (
    queue_entry_id,
    actor_user_id,
    event_type,
    payload
  ) values (
    p_entry_id,
    p_actor_user_id,
    'staff_message_queued',
    jsonb_build_object('outbox_id', v_outbox_id)
  );

  out_outbox_id := v_outbox_id;
  out_message_type := v_message_type;
  return next;
end;
$$;

revoke all privileges on function public.staff_enqueue_message(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_enqueue_message(uuid, uuid, text)
  to service_role;

commit;
