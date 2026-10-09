begin;

-- Future objects must be explicitly exposed. Supabase migrations run as postgres,
-- so set defaults for that owner as well as fixing every object that already exists.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- Application roles never mutate operational relations directly. Reads remain
-- governed by the existing explicit grants and RLS policies.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

-- Remove obsolete policies that advertised direct write paths. Administrative
-- data changes continue through service-role operations and forward migrations.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end;
$$;

-- Customer-class priority has one authoritative definition. A lower rank is
-- served first; sort_key and created_at order entries within the class.
create or replace function public.queue_customer_priority(
  p_customer_type public.customer_type
)
returns smallint
language sql
immutable
strict
set search_path = pg_catalog, public
as $$
  select case p_customer_type
    when 'paying'::public.customer_type then 0::smallint
    when 'priority_pass'::public.customer_type then 1::smallint
  end;
$$;

create or replace view public.employee_queue_waiting_view
with (security_invoker = true)
as
select
  qe.id as queue_entry_id,
  qe.queue_id,
  q.location_id,
  l.display_name as location_display_name,
  l.timezone as location_timezone,
  qe.customer_id,
  c.full_name,
  c.phone_e164,
  c.email,
  qe.customer_type,
  qe.service_label,
  qe.status,
  qe.created_at,
  qe.updated_at,
  qe.sort_key,
  so_confirm.status as confirm_sms_status,
  so_next.status as next_sms_status,
  so_serving.status as serving_sms_status,
  inbound.last_inbound_body,
  inbound.last_inbound_at,
  qe.offering_code,
  row_number() over (
    partition by qe.queue_id
    order by public.queue_customer_priority(qe.customer_type),
             qe.sort_key,
             qe.created_at,
             qe.id
  )::integer as queue_position,
  public.queue_customer_priority(qe.customer_type) as priority_rank
from public.queue_entries qe
join public.customers c on c.id = qe.customer_id
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
left join public.sms_outbox so_confirm
  on so_confirm.queue_entry_id = qe.id
 and so_confirm.message_type = 'confirm'
left join public.sms_outbox so_next
  on so_next.queue_entry_id = qe.id
 and so_next.message_type = 'next'
left join public.sms_outbox so_serving
  on so_serving.queue_entry_id = qe.id
 and so_serving.message_type = 'serving'
left join lateral (
  select si.body as last_inbound_body,
         si.received_at as last_inbound_at
  from public.sms_inbound si
  where si.queue_entry_id = qe.id
  order by si.received_at desc
  limit 1
) inbound on true
where qe.status = 'waiting';

create or replace function public.join_queue(
  p_airport_code text,
  p_location_code text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_customer_type public.customer_type,
  p_consent_version_id uuid,
  p_service_label text
)
returns table (
  out_queue_entry_id uuid,
  out_public_token uuid,
  out_queue_id uuid,
  out_status public.queue_status,
  out_created_at timestamptz,
  out_queue_position integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_location_id uuid;
  v_queue_id uuid;
  v_customer_id uuid;
  v_entry_id uuid;
  v_public_token uuid;
  v_status public.queue_status;
  v_created_at timestamptz;
  v_position integer;
  v_max_sort_key bigint;
  v_next_sort_key bigint;
  v_service_label text;
begin
  if p_airport_code is null or p_location_code is null then
    raise exception 'Location is required';
  end if;

  if p_phone_e164 is null or length(trim(p_phone_e164)) = 0 then
    raise exception 'Phone number is required';
  end if;

  if p_customer_type is null then
    raise exception 'Customer type is required';
  end if;

  perform 1
  from public.consent_versions cv
  where cv.id = p_consent_version_id
    and cv.is_active = true
    and cv.key in (
      'queue_join_consent_bodywork',
      'queue_join_consent_chiropractic',
      'queue_join_consent'
    );

  if not found then
    raise exception 'Consent version is invalid or inactive';
  end if;

  v_service_label := nullif(trim(p_service_label), '');
  if v_service_label is null then
    v_service_label := case
      when p_customer_type = 'priority_pass' then 'Priority Pass'
      else 'Paying'
    end;
  end if;

  select l.id
  into v_location_id
  from public.locations l
  where l.airport_code = p_airport_code
    and l.code = p_location_code
    and l.is_open = true
  limit 1;

  if v_location_id is null then
    raise exception 'Location not found or closed';
  end if;

  select q.id
  into v_queue_id
  from public.queues q
  where q.location_id = v_location_id
    and q.code = 'default'
    and q.is_open = true
  limit 1
  for update;

  if v_queue_id is null then
    raise exception 'Queue not available';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_queue_id::text || ':' || p_customer_type::text)
  );

  select qe.sort_key
  into v_max_sort_key
  from public.queue_entries qe
  where qe.queue_id = v_queue_id
    and qe.customer_type = p_customer_type
    and qe.status = 'waiting'
  order by qe.sort_key desc, qe.created_at desc
  limit 1
  for update;

  v_next_sort_key := coalesce(v_max_sort_key, 0) + 1;

  insert into public.customers as c (full_name, phone_e164, email)
  values (
    nullif(trim(p_full_name), ''),
    trim(p_phone_e164),
    nullif(lower(trim(p_email)), '')
  )
  on conflict (phone_e164) do update
    set full_name = excluded.full_name,
        email = excluded.email
  returning c.id into v_customer_id;

  select qe.id, qe.public_token, qe.status, qe.created_at
  into v_entry_id, v_public_token, v_status, v_created_at
  from public.queue_entries qe
  where qe.queue_id = v_queue_id
    and qe.customer_id = v_customer_id
    and qe.status in ('waiting', 'serving')
  order by qe.created_at desc
  limit 1;

  if v_entry_id is null then
    insert into public.queue_entries as qe (
      queue_id,
      customer_id,
      customer_type,
      consent_version_id,
      sort_key,
      service_label
    )
    values (
      v_queue_id,
      v_customer_id,
      p_customer_type,
      p_consent_version_id,
      v_next_sort_key,
      v_service_label
    )
    on conflict (queue_id, customer_id) where status in ('waiting', 'serving')
      do nothing
    returning qe.id, qe.public_token, qe.status, qe.created_at
    into v_entry_id, v_public_token, v_status, v_created_at;

    if v_entry_id is null then
      select qe.id, qe.public_token, qe.status, qe.created_at
      into v_entry_id, v_public_token, v_status, v_created_at
      from public.queue_entries qe
      where qe.queue_id = v_queue_id
        and qe.customer_id = v_customer_id
        and qe.status in ('waiting', 'serving')
      order by qe.created_at desc
      limit 1;
    end if;
  end if;

  if v_entry_id is null then
    raise exception 'Queue entry could not be created';
  end if;

  if v_status = 'waiting' then
    select ordered.position
    into v_position
    from (
      select
        qe.id,
        row_number() over (
          order by public.queue_customer_priority(qe.customer_type),
                   qe.sort_key,
                   qe.created_at,
                   qe.id
        )::integer as position
      from public.queue_entries qe
      where qe.queue_id = v_queue_id
        and qe.status = 'waiting'
    ) ordered
    where ordered.id = v_entry_id;
  else
    v_position := null;
  end if;

  out_queue_entry_id := v_entry_id;
  out_public_token := v_public_token;
  out_queue_id := v_queue_id;
  out_status := v_status;
  out_created_at := v_created_at;
  out_queue_position := v_position;
  return next;
end;
$$;

create or replace function public.get_visit(p_public_token uuid)
returns table (
  queue_entry_id uuid,
  status public.queue_status,
  created_at timestamptz,
  served_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  no_show_at timestamptz,
  location_display_name text,
  location_timezone text,
  queue_position integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_queue_id uuid;
begin
  if p_public_token is null then
    raise exception 'Public token is required';
  end if;

  select qe.queue_id
  into v_queue_id
  from public.queue_entries qe
  where qe.public_token = p_public_token
  limit 1;

  if v_queue_id is null then
    raise exception 'Queue entry not found';
  end if;

  return query
  with ordered as (
    select
      qe.id,
      row_number() over (
        order by public.queue_customer_priority(qe.customer_type),
                 qe.sort_key,
                 qe.created_at,
                 qe.id
      )::integer as position
    from public.queue_entries qe
    where qe.queue_id = v_queue_id
      and qe.status = 'waiting'
  )
  select
    qe.id,
    qe.status,
    qe.created_at,
    qe.served_at,
    qe.completed_at,
    qe.cancelled_at,
    qe.no_show_at,
    l.display_name,
    l.timezone,
    case when qe.status = 'waiting' then ordered.position else null end
  from public.queue_entries qe
  join public.queues q on q.id = qe.queue_id
  join public.locations l on l.id = q.location_id
  left join ordered on ordered.id = qe.id
  where qe.public_token = p_public_token
  limit 1;
end;
$$;

-- Both the automatic trigger and the legacy advance_queue compatibility RPC
-- delegate to this single ordering/notification command.
create or replace function public.mark_next_queue_entry(
  p_queue_id uuid,
  p_actor_user_id uuid default null
)
returns table (
  out_queue_entry_id uuid,
  out_status public.queue_status,
  out_next_notified_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry_id uuid;
  v_status public.queue_status;
  v_customer_type public.customer_type;
  v_next_notified_at timestamptz;
begin
  if p_queue_id is null then
    raise exception 'Queue id is required';
  end if;

  select qe.id, qe.status, qe.customer_type, qe.next_notified_at
  into v_entry_id, v_status, v_customer_type, v_next_notified_at
  from public.queue_entries qe
  where qe.queue_id = p_queue_id
    and qe.status = 'waiting'
  order by public.queue_customer_priority(qe.customer_type),
           qe.sort_key,
           qe.created_at,
           qe.id
  limit 1
  for update;

  if v_entry_id is null then
    raise exception 'No waiting entries';
  end if;

  if v_customer_type = 'paying' and v_next_notified_at is null then
    update public.queue_entries qe
    set next_notified_at = now()
    where qe.id = v_entry_id
      and qe.status = 'waiting'
      and qe.next_notified_at is null
    returning qe.status, qe.next_notified_at
    into v_status, v_next_notified_at;
  end if;

  out_queue_entry_id := v_entry_id;
  out_status := v_status;
  out_next_notified_at := v_next_notified_at;
  return next;
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
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_queue_id := case when tg_op = 'DELETE' then old.queue_id else new.queue_id end;
  if v_queue_id is not null then
    begin
      perform * from public.mark_next_queue_entry(v_queue_id, null);
    exception
      when raise_exception then
        if sqlerrm <> 'No waiting entries' then
          raise;
        end if;
    end;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.advance_queue(p_queue_id uuid)
returns table (
  out_queue_entry_id uuid,
  out_new_status public.queue_status,
  out_served_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select
    next_entry.out_queue_entry_id,
    next_entry.out_status,
    next_entry.out_next_notified_at
  from public.mark_next_queue_entry(p_queue_id, null) next_entry;
end;
$$;

-- Start from no API execution at all, including PostgreSQL's implicit PUBLIC
-- grant, then establish the complete reviewed allowlist below.
do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated, service_role',
      v_function.signature
    );
  end loop;
end;
$$;

-- Public token capabilities. These are the only anonymous database commands.
grant execute on function public.get_visit(uuid)
  to anon, authenticated, service_role;
grant execute on function public.cancel_visit(uuid)
  to anon, authenticated, service_role;

-- Authenticated-only RLS predicates. They are not mutation commands.
grant execute on function public.is_employee() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.queue_customer_priority(public.customer_type)
  to authenticated, service_role;

-- Service-role application commands invoked behind authenticated/internal
-- HTTP boundaries.
grant execute on function public.join_queue_with_offering(
  text, text, text, text, text, text
) to service_role;
grant execute on function public.staff_queue_entry_action(uuid, text, uuid, uuid)
  to service_role;
grant execute on function public.staff_edit_queue_entry(
  uuid, uuid, text, text, text, text
) to service_role;
grant execute on function public.customer_cancel_queue_entry(uuid, text, boolean)
  to service_role;
grant execute on function public.record_sms_inbound(text, text, text, text, jsonb)
  to service_role;
grant execute on function public.claim_sms_outbox(integer, integer, uuid)
  to service_role;
grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;
grant execute on function public.check_rate_limits(jsonb)
  to service_role;
grant execute on function public.get_admin_analytics(uuid, date, date, text)
  to service_role;
grant execute on function public.get_admin_daily_repeat_share(uuid, date, date)
  to service_role;

-- Secured compatibility/operational commands. No browser role can invoke them.
grant execute on function public.advance_queue(uuid) to service_role;
grant execute on function public.reorder_entry(uuid, uuid, uuid) to service_role;
grant execute on function public.rollup_queue_daily_stats(timestamptz)
  to service_role;
grant execute on function public.rollup_queue_monthly_stats() to service_role;
grant execute on function public.backfill_queue_daily_stats(date, date)
  to service_role;
grant execute on function public.backfill_queue_rollups(date, date)
  to service_role;
grant execute on function public.rebuild_queue_monthly_stats(date, date)
  to service_role;
grant execute on function public.queue_rollup_sanity_check(date)
  to service_role;

-- All unlisted functions are owner-only implementation details: trigger
-- functions, aggregates, low-level join overloads, priority helpers, and legal
-- archive helpers. Absence from this allowlist is intentional.

commit;
