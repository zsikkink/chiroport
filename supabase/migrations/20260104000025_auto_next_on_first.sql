begin;

-- Automatically mark the first paying customer as "next" when they reach the top
-- of the waiting list, then attempt an immediate send via the outbox worker.
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
  v_served_at timestamptz;
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

  select qe.id, qe.customer_type, qe.served_at
  into v_entry_id, v_customer_type, v_served_at
  from public.queue_entries qe
  where qe.queue_id = v_queue_id
    and qe.status = 'waiting'
  order by case qe.customer_type when 'paying' then 0 else 1 end,
           qe.sort_key asc,
           qe.created_at asc
  limit 1
  for update;

  if v_entry_id is null or v_customer_type <> 'paying' or v_served_at is not null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  update public.queue_entries qe
  set served_at = now()
  where qe.id = v_entry_id
    and qe.status = 'waiting'
    and qe.served_at is null;

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

drop trigger if exists queue_entries_auto_next on public.queue_entries;
create trigger queue_entries_auto_next
  after insert or update or delete on public.queue_entries
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.queue_entries_auto_next();

commit;
