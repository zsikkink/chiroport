begin;

-- Fix get_visit queue_position type mismatch by casting row_number() to int.
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

comment on function public.get_visit(uuid) is
  'Cast row_number() to int to match queue_position return type.';

-- Ensure anon can read locations/queues without employee_profiles dependency.
drop policy if exists "Read locations (public open + staff all)" on public.locations;
drop policy if exists "Read queues (public open + staff all)" on public.queues;
drop policy if exists "Read location hours" on public.location_hours;

create policy "Public read locations"
  on public.locations
  for select
  to anon, authenticated
  using (true);

create policy "Public read queues"
  on public.queues
  for select
  to anon, authenticated
  using (true);

create policy "Public read location hours"
  on public.location_hours
  for select
  to anon, authenticated
  using (true);

grant select on public.locations, public.queues, public.location_hours to anon, authenticated;

commit;
