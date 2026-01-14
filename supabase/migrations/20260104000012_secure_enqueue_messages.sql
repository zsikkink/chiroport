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

  if new.served_at is not null
    and old.served_at is null
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

drop trigger if exists queue_entries_enqueue_messages on public.queue_entries;

create trigger queue_entries_enqueue_messages
  after update on public.queue_entries
  for each row execute function public.enqueue_queue_messages();

commit;
