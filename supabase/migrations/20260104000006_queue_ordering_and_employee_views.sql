begin;

-- Add stable ordering for employee reordering.
alter table public.queue_entries add column if not exists sort_key bigint;

with ordered as (
  select
    qe.id,
    row_number() over (
      partition by qe.queue_id, qe.customer_type
      order by qe.created_at asc, qe.id asc
    ) * 10 as new_sort_key
  from public.queue_entries qe
)
update public.queue_entries qe
set sort_key = ordered.new_sort_key
from ordered
where qe.id = ordered.id
  and qe.sort_key is null;

alter table public.queue_entries
  alter column sort_key set default ((extract(epoch from now()) * 1000000)::bigint);
alter table public.queue_entries
  alter column sort_key set not null;

create index if not exists idx_queue_entries_waiting_order
  on public.queue_entries (queue_id, status, customer_type, sort_key, created_at);

create index if not exists idx_queue_entries_serving
  on public.queue_entries (queue_id, status);

create index if not exists idx_queue_entries_waiting_reorder
  on public.queue_entries (queue_id, customer_type, sort_key)
  where status = 'waiting';

create index if not exists idx_queue_entries_history_end_ts
  on public.queue_entries (
    queue_id,
    (coalesce(completed_at, cancelled_at, no_show_at, served_at, updated_at, created_at)) desc
  )
  where status in ('completed', 'cancelled', 'no_show');

-- Update join_queue to assign sort_key safely and use sort_key ordering for position.
create or replace function public.join_queue(
  p_airport_code text,
  p_location_code text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_customer_type customer_type,
  p_consent_version_id uuid
)
returns table (
  out_queue_entry_id uuid,
  out_public_token uuid,
  out_queue_id uuid,
  out_status queue_status,
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
  v_status queue_status;
  v_created_at timestamptz;
  v_position integer;
  v_max_sort_key bigint;
  v_next_sort_key bigint;
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
    and cv.key in ('queue_join_consent_bodywork', 'queue_join_consent_chiropractic', 'queue_join_consent');

  if not found then
    raise exception 'Consent version is invalid or inactive';
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

  insert into public.queue_entries as qe (
    queue_id,
    customer_id,
    customer_type,
    consent_version_id,
    sort_key
  )
  values (
    v_queue_id,
    v_customer_id,
    p_customer_type,
    p_consent_version_id,
    v_next_sort_key
  )
  returning qe.id, qe.public_token, qe.status, qe.created_at
  into v_entry_id, v_public_token, v_status, v_created_at;

  select ordered.position
  into v_position
  from (
    select qe.id,
           row_number() over (
             order by case qe.customer_type when 'paying' then 0 else 1 end,
                      qe.sort_key asc,
                      qe.created_at asc
           )::int as position
    from public.queue_entries qe
    where qe.queue_id = v_queue_id
      and qe.status = 'waiting'
  ) ordered
  where ordered.id = v_entry_id;

  out_queue_entry_id := v_entry_id;
  out_public_token := v_public_token;
  out_queue_id := v_queue_id;
  out_status := v_status;
  out_created_at := v_created_at;
  out_queue_position := v_position;

  return next;
end;
$$;

grant execute on function public.join_queue(
  text, text, text, text, text, customer_type, uuid
) to anon, authenticated;

-- Keep customer position aligned with sort_key ordering.
create or replace function public.get_visit(p_public_token uuid)
returns table (
  queue_entry_id uuid,
  status queue_status,
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
        order by case qe.customer_type when 'paying' then 0 else 1 end,
                 qe.sort_key asc,
                 qe.created_at asc
      )::int as position
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

-- Employee-facing views (PII allowed, RLS enforced via security_invoker).
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
  qe.status,
  qe.created_at,
  qe.updated_at,
  qe.sort_key,
  row_number() over (
    partition by qe.queue_id
    order by case qe.customer_type when 'paying' then 0 else 1 end,
             qe.sort_key asc,
             qe.created_at asc
  )::int as queue_position
from public.queue_entries qe
join public.customers c on c.id = qe.customer_id
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
where qe.status = 'waiting';

create or replace view public.employee_queue_serving_view
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
  qe.status,
  qe.created_at,
  qe.updated_at,
  qe.sort_key
from public.queue_entries qe
join public.customers c on c.id = qe.customer_id
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
where qe.status = 'serving';

create or replace view public.employee_queue_history_view
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
  qe.status,
  qe.created_at,
  qe.updated_at,
  qe.sort_key,
  coalesce(qe.completed_at, qe.cancelled_at, qe.no_show_at, qe.served_at, qe.updated_at, qe.created_at) as end_ts
from public.queue_entries qe
join public.customers c on c.id = qe.customer_id
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
where qe.status in ('completed', 'cancelled', 'no_show');

revoke all on public.employee_queue_waiting_view from anon, authenticated;
revoke all on public.employee_queue_serving_view from anon, authenticated;
revoke all on public.employee_queue_history_view from anon, authenticated;
grant select on public.employee_queue_waiting_view to authenticated;
grant select on public.employee_queue_serving_view to authenticated;
grant select on public.employee_queue_history_view to authenticated;

-- Advance queue (employee-only).
create or replace function public.advance_queue(p_queue_id uuid)
returns table (
  out_queue_entry_id uuid,
  out_new_status queue_status,
  out_served_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry_id uuid;
  v_status queue_status;
  v_served_at timestamptz;
begin
  if p_queue_id is null then
    raise exception 'Queue id is required';
  end if;

  if not exists (
    select 1
    from public.employee_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.is_open = true
      and ep.role in ('employee', 'admin')
  ) then
    raise exception 'Not authorized';
  end if;

  select qe.id
  into v_entry_id
  from public.queue_entries qe
  where qe.queue_id = p_queue_id
    and qe.status = 'waiting'
  order by case qe.customer_type when 'paying' then 0 else 1 end,
           qe.sort_key asc,
           qe.created_at asc
  limit 1
  for update skip locked;

  if v_entry_id is null then
    raise exception 'No waiting entries';
  end if;

  update public.queue_entries qe
  set status = 'serving',
      served_at = now()
  where qe.id = v_entry_id
    and qe.status = 'waiting'
  returning qe.id, qe.status, qe.served_at
  into v_entry_id, v_status, v_served_at;

  insert into public.queue_events (queue_entry_id, actor_user_id, event_type, payload)
  values (
    v_entry_id,
    (select auth.uid()),
    'advance',
    jsonb_build_object('from', 'waiting', 'to', v_status)
  );

  out_queue_entry_id := v_entry_id;
  out_new_status := v_status;
  out_served_at := v_served_at;

  return next;
end;
$$;

revoke execute on function public.advance_queue(uuid) from anon;
grant execute on function public.advance_queue(uuid) to authenticated;

-- Reorder within same queue + customer_type (employee-only).
create or replace function public.reorder_entry(
  p_queue_entry_id uuid,
  p_before_entry_id uuid default null,
  p_after_entry_id uuid default null
)
returns table (
  out_queue_entry_id uuid,
  out_sort_key bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_queue_id uuid;
  v_customer_type customer_type;
  v_before_sort_key bigint;
  v_after_sort_key bigint;
  v_new_sort_key bigint;
  v_gap bigint := 10;
  v_need_renormalize boolean := false;
begin
  if not exists (
    select 1
    from public.employee_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.is_open = true
      and ep.role in ('employee', 'admin')
  ) then
    raise exception 'Not authorized';
  end if;

  if p_queue_entry_id is null then
    raise exception 'Queue entry is required';
  end if;

  if p_before_entry_id is null and p_after_entry_id is null then
    raise exception 'before or after entry is required';
  end if;

  select qe.queue_id, qe.customer_type
  into v_queue_id, v_customer_type
  from public.queue_entries qe
  where qe.id = p_queue_entry_id
    and qe.status = 'waiting'
  for update;

  if v_queue_id is null then
    raise exception 'Queue entry not found or not waiting';
  end if;

  if p_before_entry_id is not null then
    if p_before_entry_id = p_queue_entry_id then
      raise exception 'before entry cannot be the target entry';
    end if;

    select qe.sort_key
    into v_before_sort_key
    from public.queue_entries qe
    where qe.id = p_before_entry_id
      and qe.queue_id = v_queue_id
      and qe.customer_type = v_customer_type
      and qe.status = 'waiting'
    for update;

    if v_before_sort_key is null then
      raise exception 'before entry invalid';
    end if;
  end if;

  if p_after_entry_id is not null then
    if p_after_entry_id = p_queue_entry_id then
      raise exception 'after entry cannot be the target entry';
    end if;

    select qe.sort_key
    into v_after_sort_key
    from public.queue_entries qe
    where qe.id = p_after_entry_id
      and qe.queue_id = v_queue_id
      and qe.customer_type = v_customer_type
      and qe.status = 'waiting'
    for update;

    if v_after_sort_key is null then
      raise exception 'after entry invalid';
    end if;
  end if;

  if v_before_sort_key is not null and v_after_sort_key is not null then
    if v_after_sort_key <= v_before_sort_key then
      raise exception 'after entry must be after before entry';
    end if;

    v_new_sort_key := (v_before_sort_key + v_after_sort_key) / 2;
    if v_new_sort_key = v_before_sort_key or v_new_sort_key = v_after_sort_key then
      v_need_renormalize := true;
    end if;
  elsif v_before_sort_key is not null then
    v_new_sort_key := v_before_sort_key + 1;
    if exists (
      select 1
      from public.queue_entries qe
      where qe.queue_id = v_queue_id
        and qe.customer_type = v_customer_type
        and qe.status = 'waiting'
        and qe.sort_key = v_new_sort_key
        and qe.id <> p_queue_entry_id
    ) then
      v_need_renormalize := true;
    end if;
  else
    v_new_sort_key := v_after_sort_key - 1;
    if v_new_sort_key <= 0 or exists (
      select 1
      from public.queue_entries qe
      where qe.queue_id = v_queue_id
        and qe.customer_type = v_customer_type
        and qe.status = 'waiting'
        and qe.sort_key = v_new_sort_key
        and qe.id <> p_queue_entry_id
    ) then
      v_need_renormalize := true;
    end if;
  end if;

  if v_need_renormalize then
    with ordered as (
      select qe.id,
             row_number() over (
               order by qe.sort_key asc, qe.created_at asc, qe.id asc
             ) * v_gap as new_sort_key
      from public.queue_entries qe
      where qe.queue_id = v_queue_id
        and qe.customer_type = v_customer_type
        and qe.status = 'waiting'
    )
    update public.queue_entries qe
    set sort_key = ordered.new_sort_key
    from ordered
    where qe.id = ordered.id;

    if p_before_entry_id is not null then
      select qe.sort_key
      into v_before_sort_key
      from public.queue_entries qe
      where qe.id = p_before_entry_id;
    end if;

    if p_after_entry_id is not null then
      select qe.sort_key
      into v_after_sort_key
      from public.queue_entries qe
      where qe.id = p_after_entry_id;
    end if;

    if v_before_sort_key is not null and v_after_sort_key is not null then
      v_new_sort_key := (v_before_sort_key + v_after_sort_key) / 2;
    elsif v_before_sort_key is not null then
      v_new_sort_key := v_before_sort_key + (v_gap / 2);
    else
      v_new_sort_key := v_after_sort_key - (v_gap / 2);
    end if;
  end if;

  if v_new_sort_key is null then
    raise exception 'Unable to compute new sort key';
  end if;

  update public.queue_entries qe
  set sort_key = v_new_sort_key
  where qe.id = p_queue_entry_id
    and qe.status = 'waiting'
  returning qe.id, qe.sort_key
  into out_queue_entry_id, out_sort_key;

  if out_queue_entry_id is null then
    raise exception 'Queue entry not found or not waiting';
  end if;

  insert into public.queue_events (queue_entry_id, actor_user_id, event_type, payload)
  values (
    out_queue_entry_id,
    (select auth.uid()),
    'reorder',
    jsonb_build_object(
      'before_entry_id', p_before_entry_id,
      'after_entry_id', p_after_entry_id,
      'new_sort_key', out_sort_key
    )
  );

  return next;
end;
$$;

revoke execute on function public.reorder_entry(uuid, uuid, uuid) from anon;
grant execute on function public.reorder_entry(uuid, uuid, uuid) to authenticated;

commit;
