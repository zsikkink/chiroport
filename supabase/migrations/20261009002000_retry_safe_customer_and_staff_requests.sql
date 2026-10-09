begin;

-- Keep token-based customer cancellation retryable after an ambiguous timeout.
create or replace function public.cancel_visit(p_public_token uuid)
returns table (
  out_queue_entry_id uuid,
  out_status queue_status,
  out_cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry_id uuid;
  v_cancel record;
begin
  if p_public_token is null then
    raise exception 'Public token is required';
  end if;

  select qe.id
  into v_entry_id
  from public.queue_entries qe
  where qe.public_token = p_public_token
    and qe.status in ('waiting', 'cancelled')
  for update;

  if v_entry_id is null then
    raise exception 'Queue entry not found or not cancellable';
  end if;

  select cancelled.*
  into v_cancel
  from public.customer_cancel_queue_entry(
    v_entry_id,
    'public_visit',
    false
  ) cancelled;

  out_queue_entry_id := v_cancel.out_queue_entry_id;
  out_status := v_cancel.out_status;
  out_cancelled_at := v_cancel.out_cancelled_at;
  return next;
end;
$$;

revoke all on function public.cancel_visit(uuid) from public;
grant execute on function public.cancel_visit(uuid) to anon, authenticated, service_role;

create or replace function public.cancel_visit_with_reason(
  p_public_token uuid,
  p_departure_reason text
)
returns table (
  out_queue_entry_id uuid,
  out_status public.queue_status,
  out_cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result record;
  v_entry public.queue_entries%rowtype;
begin
  if p_departure_reason not in (
    'priority_pass_declined', 'no_staff_available', 'wait_too_long',
    'plans_changed', 'other'
  ) or p_departure_reason is null then
    raise exception 'A departure reason is required';
  end if;
  select * into v_entry
  from public.queue_entries
  where public_token = p_public_token and status in ('waiting', 'cancelled')
  for update;
  if not found then
    raise exception 'Queue entry not found or not cancellable';
  end if;
  if p_departure_reason = 'priority_pass_declined'
    and v_entry.customer_type <> 'priority_pass' then
    raise exception 'Priority Pass decline is only valid for Priority Pass visits';
  end if;

  -- A lost acknowledgement must not make retry fail or rewrite the first reason.
  if v_entry.status = 'cancelled' then
    out_queue_entry_id := v_entry.id;
    out_status := v_entry.status;
    out_cancelled_at := v_entry.cancelled_at;
    return next;
    return;
  end if;

  select * into strict v_result from public.cancel_visit(p_public_token);
  update public.queue_entries
  set departure_reason = p_departure_reason
  where id = v_result.out_queue_entry_id;

  out_queue_entry_id := v_result.out_queue_entry_id;
  out_status := v_result.out_status;
  out_cancelled_at := v_result.out_cancelled_at;
  return next;
end;
$$;

revoke execute on function public.cancel_visit_with_reason(uuid, text) from public;
grant execute on function public.cancel_visit_with_reason(uuid, text)
  to anon, authenticated, service_role;

-- Existing outbox uniqueness owns staff request deduplication; no new table.
create or replace function public.staff_enqueue_message(
  p_entry_id uuid,
  p_actor_user_id uuid,
  p_body text,
  p_request_id uuid
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

  v_message_type := 'staff_' || p_actor_user_id::text || '_' || coalesce(p_request_id, gen_random_uuid())::text;

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
    'staff:' || p_entry_id::text || ':' || v_message_type
  )
  -- Both entry/type and idempotency_key are unique. Competing identical
  -- inserts can encounter either constraint; handle both before loading it.
  on conflict do nothing
  returning id into v_outbox_id;

  if v_outbox_id is null then
    select so.id into v_outbox_id
    from public.sms_outbox so
    where so.queue_entry_id = p_entry_id and so.message_type = v_message_type
      and so.body = v_body;
    if v_outbox_id is null then
      raise exception 'Message request id was reused with different content';
    end if;
    out_outbox_id := v_outbox_id;
    out_message_type := v_message_type;
    return next;
    return;
  end if;

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

-- Preserve the legacy three-argument API; callers without an operation ID
-- still create a new message on each call.
create or replace function public.staff_enqueue_message(
  p_entry_id uuid,
  p_actor_user_id uuid,
  p_body text
)
returns table (out_outbox_id uuid, out_message_type text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select * from public.staff_enqueue_message(p_entry_id, p_actor_user_id, p_body, null);
$$;

revoke all privileges on function public.staff_enqueue_message(uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_enqueue_message(uuid, uuid, text, uuid) to service_role;
revoke all privileges on function public.staff_enqueue_message(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_enqueue_message(uuid, uuid, text) to service_role;

commit;
