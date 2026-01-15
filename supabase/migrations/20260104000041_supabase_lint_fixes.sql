begin;

create schema if not exists extensions;

-- Move pg_net out of public schema (drop + recreate; SET SCHEMA not supported).
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_net'
      and n.nspname = 'public'
  ) then
    drop extension pg_net cascade;
  end if;
end $$;

create extension if not exists pg_net with schema extensions;

-- Recreate auto-next trigger in case pg_net drop removed it.
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

drop trigger if exists queue_entries_auto_next on public.queue_entries;
create trigger queue_entries_auto_next
after insert or update or delete on public.queue_entries
for each row execute function public.queue_entries_auto_next();

-- Fix search_path for helper functions.
create or replace function public.jsonb_sum(a jsonb, b jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select jsonb_object_agg(key, total)
      from (
        select key, sum(value)::numeric as total
        from (
          select key, value::numeric
          from jsonb_each_text(coalesce(a, '{}'::jsonb))
          union all
          select key, value::numeric
          from jsonb_each_text(coalesce(b, '{}'::jsonb))
        ) merged
        group by key
      ) totals
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.enqueue_queue_messages()
returns trigger
language plpgsql
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
    end if;
  end if;

  return new;
end;
$$;

-- Explicit deny policies for RLS-enabled system tables.
drop policy if exists "Deny api rate limit access" on public.api_rate_limits;
create policy "Deny api rate limit access"
  on public.api_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "Deny sms opt outs access" on public.sms_opt_outs;
create policy "Deny sms opt outs access"
  on public.sms_opt_outs
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Employee profile policies: single SELECT policy + admin-only writes.
drop policy if exists "Employees read own profile" on public.employee_profiles;
drop policy if exists "Employees read employee profiles" on public.employee_profiles;
drop policy if exists "Admins manage employee profiles" on public.employee_profiles;
drop policy if exists "Admins insert employee profiles" on public.employee_profiles;
drop policy if exists "Admins update employee profiles" on public.employee_profiles;
drop policy if exists "Admins delete employee profiles" on public.employee_profiles;

drop policy if exists "Employee profiles read" on public.employee_profiles;
create policy "Employee profiles read"
  on public.employee_profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
  );

-- Admin-only stats read with auth initplan optimization.
drop policy if exists "Admins read queue daily stats" on public.queue_daily_stats;
create policy "Admins read queue daily stats"
  on public.queue_daily_stats
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins read queue monthly stats" on public.queue_monthly_stats;
create policy "Admins read queue monthly stats"
  on public.queue_monthly_stats
  for select
  to authenticated
  using (public.is_admin());

-- Consolidate sms_inbound policies (single SELECT policy).
drop policy if exists "Employees read sms inbound" on public.sms_inbound;
drop policy if exists "Staff read sms inbound" on public.sms_inbound;
drop policy if exists "Admins manage sms inbound" on public.sms_inbound;
drop policy if exists "Admins insert sms inbound" on public.sms_inbound;
drop policy if exists "Admins update sms inbound" on public.sms_inbound;
drop policy if exists "Admins delete sms inbound" on public.sms_inbound;

create policy "Staff read sms inbound"
  on public.sms_inbound
  for select
  to authenticated
  using (public.is_employee());

create policy "Admins insert sms inbound"
  on public.sms_inbound
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update sms inbound"
  on public.sms_inbound
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete sms inbound"
  on public.sms_inbound
  for delete
  to authenticated
  using (public.is_admin());

-- Consolidate sms_outbox policies (single SELECT policy).
drop policy if exists "Employees read sms outbox" on public.sms_outbox;
drop policy if exists "Staff read sms outbox" on public.sms_outbox;
drop policy if exists "Admins manage sms outbox" on public.sms_outbox;
drop policy if exists "Admins insert sms outbox" on public.sms_outbox;
drop policy if exists "Admins update sms outbox" on public.sms_outbox;
drop policy if exists "Admins delete sms outbox" on public.sms_outbox;

create policy "Staff read sms outbox"
  on public.sms_outbox
  for select
  to authenticated
  using (public.is_employee());

create policy "Admins insert sms outbox"
  on public.sms_outbox
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update sms outbox"
  on public.sms_outbox
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete sms outbox"
  on public.sms_outbox
  for delete
  to authenticated
  using (public.is_admin());

commit;
