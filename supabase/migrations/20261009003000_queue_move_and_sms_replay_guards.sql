begin;

create or replace function public.enqueue_queue_messages()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_phone text;
  v_location_display_name text;
  v_body text;
  v_rows integer;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.next_notified_at is not null
    and old.next_notified_at is null
    and new.status = 'waiting'
    and new.customer_type = 'paying' then
    select c.phone_e164, l.display_name
    into v_phone, v_location_display_name
    from public.customers c
    join public.queues q on q.id = new.queue_id
    join public.locations l on l.id = q.location_id
    where c.id = new.customer_id;

    if v_phone is not null then
      v_body := 'Chiroport Msg: You''re next in line at The Chiroport at ' || v_location_display_name ||
        ' - please start heading back!';

      insert into public.sms_outbox as existing (
        queue_entry_id,
        message_type,
        to_phone,
        body,
        status,
        idempotency_key
      ) values (
        new.id,
        'next',
        v_phone,
        v_body,
        'queued',
        'next:' || new.id::text
      )
      on conflict (queue_entry_id, message_type) do update
        set to_phone = excluded.to_phone,
            body = excluded.body,
            status = 'queued',
            locked_at = null,
            next_attempt_at = now(),
            last_error = null
        where existing.provider_message_id is null
          and existing.status = 'dead'
          and existing.last_error = 'superseded_queue_move';

      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        insert into public.queue_events (queue_entry_id, actor_user_id, event_type, payload)
        values (
          new.id,
          (select auth.uid()),
          'next_notified',
          jsonb_build_object('message_type', 'next', 'queue_id', new.queue_id)
        );
      end if;
    end if;
  end if;

  if new.status = 'serving' and old.status is distinct from new.status then
    select c.phone_e164
    into v_phone
    from public.customers c
    where c.id = new.customer_id;

    if v_phone is not null then
      v_body := 'Chiroport Msg: It''s your turn! Please come back to The Chiroport - we''re all ready for you!';

      insert into public.sms_outbox (
        queue_entry_id,
        message_type,
        to_phone,
        body,
        status,
        idempotency_key
      ) values (
        new.id,
        'serving',
        v_phone,
        v_body,
        'queued',
        'serving:' || new.id::text
      )
      on conflict (queue_entry_id, message_type) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.queue_entries_auto_next()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_queue_id uuid;
  v_queue_ids uuid[];
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_queue_ids := array[case when tg_op = 'DELETE' then old.queue_id else new.queue_id end];
  if tg_op = 'UPDATE' and old.queue_id is distinct from new.queue_id then
    v_queue_ids := array[old.queue_id, new.queue_id];
    -- Only unclaimed, unaccepted work can be safely replaced. An active send
    -- remains ambiguous and is checked again by the adapter before provider I/O.
    update public.sms_outbox
    set status = 'dead', last_error = 'superseded_queue_move', locked_at = null
    where queue_entry_id = new.id and message_type = 'next'
      and provider_message_id is null and status in ('queued', 'failed');
  end if;

  -- Notify the source's successor as well as the destination's current head.
  for v_queue_id in select distinct id from unnest(v_queue_ids) id where id is not null order by id
  loop
    begin
      perform * from public.mark_next_queue_entry(v_queue_id, null);
    exception when raise_exception then
      if sqlerrm <> 'No waiting entries' then raise; end if;
    end;
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Tie the effect to the durable provider receipt. A retried CANCEL must not
-- replay after a staff member deliberately returns the visitor to the queue.
create or replace function public.customer_cancel_queue_entry(
  p_entry_id uuid,
  p_source text,
  p_enqueue_ack boolean,
  p_inbound_id uuid
)
returns table (
  out_queue_entry_id uuid,
  out_status public.queue_status,
  out_cancelled_at timestamptz,
  out_outbox_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inbound public.sms_inbound%rowtype;
  v_result record;
  -- Match JavaScript trim(), as in the existing STOP/START resolver.
  v_trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  select * into v_inbound from public.sms_inbound where id = p_inbound_id for update;
  if not found or v_inbound.queue_entry_id is distinct from p_entry_id
    or p_source is distinct from 'twilio_webhook'
    or nullif(trim(v_inbound.provider_message_id), '') is null
    or lower(btrim(v_inbound.body, v_trim_chars)) <> 'cancel' then
    raise exception 'A matching cancellation receipt is required';
  end if;

  if exists (
    select 1 from public.queue_events
    where queue_entry_id = p_entry_id and event_type = 'sms_cancel_processed'
      and payload->>'inbound_id' = p_inbound_id::text
  ) then
    return query
      select qe.id, qe.status, qe.cancelled_at, so.id
      from public.queue_entries qe
      left join public.sms_outbox so on so.queue_entry_id = qe.id and so.message_type = 'cancel_ack'
      where qe.id = p_entry_id;
    return;
  end if;

  select * into strict v_result
  from public.customer_cancel_queue_entry(p_entry_id, p_source, p_enqueue_ack);
  insert into public.queue_events(queue_entry_id, event_type, payload)
  values (p_entry_id, 'sms_cancel_processed', jsonb_build_object('inbound_id', p_inbound_id));

  out_queue_entry_id := v_result.out_queue_entry_id;
  out_status := v_result.out_status;
  out_cancelled_at := v_result.out_cancelled_at;
  out_outbox_id := v_result.out_outbox_id;
  return next;
end;
$$;

revoke all privileges on function public.customer_cancel_queue_entry(uuid, text, boolean, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_cancel_queue_entry(uuid, text, boolean, uuid) to service_role;

commit;
