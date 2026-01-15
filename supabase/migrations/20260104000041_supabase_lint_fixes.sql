begin;

create schema if not exists extensions;

-- Move pg_net out of public schema.
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_net'
      and n.nspname = 'public'
  ) then
    alter extension pg_net set schema extensions;
  end if;
end $$;

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
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins insert employee profiles"
  on public.employee_profiles
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins update employee profiles"
  on public.employee_profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete employee profiles"
  on public.employee_profiles
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

-- Admin-only stats read with auth initplan optimization.
drop policy if exists "Admins read queue daily stats" on public.queue_daily_stats;
create policy "Admins read queue daily stats"
  on public.queue_daily_stats
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins read queue monthly stats" on public.queue_monthly_stats;
create policy "Admins read queue monthly stats"
  on public.queue_monthly_stats
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

-- Consolidate sms_inbound policies (single SELECT policy).
drop policy if exists "Employees read sms inbound" on public.sms_inbound;
drop policy if exists "Staff read sms inbound" on public.sms_inbound;
drop policy if exists "Admins manage sms inbound" on public.sms_inbound;

create policy "Staff read sms inbound"
  on public.sms_inbound
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Admins manage sms inbound"
  on public.sms_inbound
  for insert, update, delete
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

-- Consolidate sms_outbox policies (single SELECT policy).
drop policy if exists "Employees read sms outbox" on public.sms_outbox;
drop policy if exists "Staff read sms outbox" on public.sms_outbox;
drop policy if exists "Admins manage sms outbox" on public.sms_outbox;

create policy "Staff read sms outbox"
  on public.sms_outbox
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Admins manage sms outbox"
  on public.sms_outbox
  for insert, update, delete
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

commit;
