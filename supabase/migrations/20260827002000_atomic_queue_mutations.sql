begin;

create or replace function public.staff_edit_queue_entry(
  p_entry_id uuid,
  p_actor_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone_e164 text,
  p_offering_code text
)
returns table (
  out_queue_entry_id uuid,
  out_queue_id uuid,
  out_customer_id uuid,
  out_customer_type customer_type,
  out_service_label text,
  out_offering_code text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry record;
  v_offering public.service_offerings%rowtype;
  v_full_name text;
  v_email text;
  v_phone_e164 text;
  v_sort_key bigint;
begin
  if p_entry_id is null or p_actor_user_id is null then
    raise exception 'Entry id and actor user id are required';
  end if;

  v_full_name := nullif(trim(p_full_name), '');
  v_email := nullif(lower(trim(p_email)), '');
  v_phone_e164 := nullif(trim(p_phone_e164), '');

  if v_phone_e164 is null then
    raise exception 'Phone number is required';
  end if;

  select so.*
  into v_offering
  from public.service_offerings so
  where so.code = nullif(trim(p_offering_code), '')
    and so.is_active = true;

  if not found then
    raise exception 'Service offering is invalid or inactive';
  end if;

  select
    qe.id,
    qe.queue_id,
    qe.customer_id,
    qe.customer_type,
    qe.service_label,
    qe.offering_code,
    qe.status,
    c.full_name,
    c.email,
    c.phone_e164
  into v_entry
  from public.queue_entries qe
  join public.customers c on c.id = qe.customer_id
  where qe.id = p_entry_id
  for update of qe, c;

  if not found then
    raise exception 'Queue entry not found';
  end if;

  if v_entry.full_name is not distinct from v_full_name
    and v_entry.email is not distinct from v_email
    and v_entry.phone_e164 = v_phone_e164
    and v_entry.offering_code is not distinct from v_offering.code
    and v_entry.customer_type = v_offering.customer_type
    and v_entry.service_label = v_offering.display_label then
    raise exception 'No changes to apply';
  end if;

  update public.customers c
  set full_name = v_full_name,
      email = v_email,
      phone_e164 = v_phone_e164
  where c.id = v_entry.customer_id;

  v_sort_key := null;
  if v_entry.status = 'waiting'
    and v_entry.customer_type <> v_offering.customer_type then
    v_sort_key := public.next_sort_key(
      v_entry.queue_id,
      v_offering.customer_type
    );
  end if;

  update public.queue_entries qe
  set customer_type = v_offering.customer_type,
      service_label = v_offering.display_label,
      offering_code = v_offering.code,
      sort_key = coalesce(v_sort_key, qe.sort_key)
  where qe.id = v_entry.id;

  insert into public.queue_events (
    queue_entry_id,
    actor_user_id,
    event_type,
    payload
  ) values (
    v_entry.id,
    p_actor_user_id,
    'edited_by_staff',
    jsonb_build_object(
      'source', 'staff_edit_queue_entry',
      'previous', jsonb_build_object(
        'offering_code', v_entry.offering_code,
        'service_label', v_entry.service_label,
        'customer_type', v_entry.customer_type
      ),
      'current', jsonb_build_object(
        'offering_code', v_offering.code,
        'service_label', v_offering.display_label,
        'customer_type', v_offering.customer_type
      )
    )
  );

  out_queue_entry_id := v_entry.id;
  out_queue_id := v_entry.queue_id;
  out_customer_id := v_entry.customer_id;
  out_customer_type := v_offering.customer_type;
  out_service_label := v_offering.display_label;
  out_offering_code := v_offering.code;
  return next;
end;
$$;

revoke all on function public.staff_edit_queue_entry(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.staff_edit_queue_entry(
  uuid, uuid, text, text, text, text
) to service_role;

create or replace function public.customer_cancel_queue_entry(
  p_entry_id uuid,
  p_source text,
  p_enqueue_ack boolean default false
)
returns table (
  out_queue_entry_id uuid,
  out_status queue_status,
  out_cancelled_at timestamptz,
  out_outbox_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry record;
  v_cancelled_at timestamptz;
  v_outbox_id uuid;
begin
  if p_entry_id is null then
    raise exception 'Queue entry id is required';
  end if;

  if nullif(trim(p_source), '') is null then
    raise exception 'Cancellation source is required';
  end if;

  select qe.id, qe.status, qe.cancelled_at, c.phone_e164
  into v_entry
  from public.queue_entries qe
  join public.customers c on c.id = qe.customer_id
  where qe.id = p_entry_id
  for update of qe;

  if not found then
    raise exception 'Queue entry not found';
  end if;

  if v_entry.status = 'cancelled' then
    select so.id
    into v_outbox_id
    from public.sms_outbox so
    where so.queue_entry_id = v_entry.id
      and so.message_type = 'cancel_ack';

    out_queue_entry_id := v_entry.id;
    out_status := 'cancelled';
    out_cancelled_at := v_entry.cancelled_at;
    out_outbox_id := v_outbox_id;
    return next;
    return;
  end if;

  if v_entry.status not in ('waiting', 'serving') then
    raise exception 'Queue entry is not cancellable';
  end if;

  v_cancelled_at := now();
  update public.queue_entries qe
  set status = 'cancelled',
      cancelled_at = v_cancelled_at
  where qe.id = v_entry.id;

  insert into public.queue_events (
    queue_entry_id,
    actor_user_id,
    event_type,
    payload
  ) values (
    v_entry.id,
    null,
    'cancelled_by_customer',
    jsonb_build_object('source', trim(p_source))
  );

  if p_enqueue_ack then
    insert into public.sms_outbox (
      queue_entry_id,
      message_type,
      to_phone,
      body,
      status,
      idempotency_key
    ) values (
      v_entry.id,
      'cancel_ack',
      v_entry.phone_e164,
      'Chiroport Msg: You''ve removed yourself from The Chiroport queue. Thanks for letting us know.',
      'queued',
      'cancel_ack:' || v_entry.id::text
    )
    on conflict (queue_entry_id, message_type) do nothing
    returning id into v_outbox_id;

    if v_outbox_id is null then
      select so.id
      into v_outbox_id
      from public.sms_outbox so
      where so.queue_entry_id = v_entry.id
        and so.message_type = 'cancel_ack';
    end if;
  end if;

  out_queue_entry_id := v_entry.id;
  out_status := 'cancelled';
  out_cancelled_at := v_cancelled_at;
  out_outbox_id := v_outbox_id;
  return next;
end;
$$;

revoke all on function public.customer_cancel_queue_entry(
  uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.customer_cancel_queue_entry(
  uuid, text, boolean
) to service_role;

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
    and qe.status = 'waiting'
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

commit;
