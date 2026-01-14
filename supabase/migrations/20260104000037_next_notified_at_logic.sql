begin;

-- Queue next notifications should key off next_notified_at instead of served_at.
create or replace function public.enqueue_queue_messages()
returns trigger
language plpgsql
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
      v_body := 'You''re next in line at The Chiroport at ' || v_location_display_name ||
        ' - please start heading back!';

      insert into public.sms_outbox (
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
      on conflict (queue_entry_id, message_type) do nothing;

      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        insert into public.queue_events (queue_entry_id, actor_user_id, event_type, payload)
        values (
          new.id,
          (select auth.uid()),
          'next_notified',
          jsonb_build_object('message_type', 'next')
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
      v_body := 'It''s your turn! Please come back to The Chiroport - we''re all ready for you!';

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

      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        insert into public.queue_events (queue_entry_id, actor_user_id, event_type, payload)
        values (
          new.id,
          (select auth.uid()),
          'serving_notified',
          jsonb_build_object('message_type', 'serving')
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Auto-next should mark next_notified_at (not served_at).
create or replace function public.queue_entries_auto_next()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_queue_id uuid;
  v_entry_id uuid;
  v_customer_type customer_type;
  v_next_notified_at timestamptz;
  v_updated integer;
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_queue_id := old.queue_id;
  else
    v_queue_id := new.queue_id;
  end if;

  if v_queue_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select qe.id, qe.customer_type, qe.next_notified_at
  into v_entry_id, v_customer_type, v_next_notified_at
  from public.queue_entries qe
  where qe.queue_id = v_queue_id
    and qe.status = 'waiting'
  order by case qe.customer_type when 'paying' then 0 else 1 end,
           qe.sort_key asc,
           qe.created_at asc
  limit 1
  for update;

  if v_entry_id is null or v_customer_type <> 'paying' or v_next_notified_at is not null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  update public.queue_entries qe
  set next_notified_at = now()
  where qe.id = v_entry_id
    and qe.status = 'waiting'
    and qe.next_notified_at is null;

  get diagnostics v_updated = row_count;
  if v_updated > 0 then
    begin
      perform net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
          || '/functions/v1/send_sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'send_sms_secret')
        ),
        body := '{}'::jsonb
      );
    exception when others then
      -- Best-effort immediate send; scheduled worker will retry.
    end;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

commit;
