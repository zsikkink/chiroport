begin;

-- Mark the next-in-line entry without changing its status.
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

  select qe.id, qe.status, qe.served_at
  into v_entry_id, v_status, v_served_at
  from public.queue_entries qe
  where qe.queue_id = p_queue_id
    and qe.status = 'waiting'
  order by case qe.customer_type when 'paying' then 0 else 1 end,
           qe.sort_key asc,
           qe.created_at asc
  limit 1
  for update;

  if v_entry_id is null then
    raise exception 'No waiting entries';
  end if;

  if v_served_at is null then
    update public.queue_entries qe
    set served_at = now()
    where qe.id = v_entry_id
      and qe.status = 'waiting'
      and qe.served_at is null
    returning qe.status, qe.served_at
    into v_status, v_served_at;

    insert into public.queue_events (queue_entry_id, actor_user_id, event_type, payload)
    values (
      v_entry_id,
      (select auth.uid()),
      'next',
      jsonb_build_object('from', 'waiting', 'to', 'waiting')
    );
  end if;

  out_queue_entry_id := v_entry_id;
  out_new_status := v_status;
  out_served_at := v_served_at;

  return next;
end;
$$;

revoke execute on function public.advance_queue(uuid) from anon;
grant execute on function public.advance_queue(uuid) to authenticated;

commit;
