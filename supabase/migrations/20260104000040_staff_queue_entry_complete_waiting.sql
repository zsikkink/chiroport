begin;

create or replace function public.staff_queue_entry_action(
  p_entry_id uuid,
  p_action text,
  p_target_location_id uuid default null,
  p_actor_user_id uuid default null
)
returns table (
  out_queue_entry_id uuid,
  out_status queue_status,
  out_queue_id uuid,
  out_customer_id uuid,
  out_customer_type customer_type
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry record;
  v_current_location_id uuid;
  v_current_airport text;
  v_target_airport text;
  v_target_queue_id uuid;
  v_next_sort_key bigint;
  v_new_status queue_status;
begin
  if p_entry_id is null or p_action is null then
    raise exception 'Entry id and action are required';
  end if;

  select id, queue_id, customer_id, customer_type, status
  into v_entry
  from public.queue_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'Queue entry not found';
  end if;

  if p_action = 'serving' then
    if v_entry.status <> 'waiting' then
      raise exception 'Queue entry is not in waiting status';
    end if;
    v_new_status := 'serving';
    update public.queue_entries
    set status = v_new_status,
        served_at = now(),
        completed_at = null,
        cancelled_at = null,
        no_show_at = null
    where id = v_entry.id;

    insert into public.queue_events
      (queue_entry_id, actor_user_id, event_type, payload)
    values
      (v_entry.id, p_actor_user_id, 'serving_by_staff', jsonb_build_object('source', 'staff_queue_entry_action'));
  elsif p_action = 'complete' then
    if v_entry.status not in ('serving', 'waiting') then
      raise exception 'Queue entry cannot be completed from this status';
    end if;
    v_new_status := 'completed';
    update public.queue_entries
    set status = v_new_status,
        served_at = coalesce(served_at, now()),
        completed_at = now(),
        cancelled_at = null,
        no_show_at = null
    where id = v_entry.id;

    insert into public.queue_events
      (queue_entry_id, actor_user_id, event_type, payload)
    values
      (v_entry.id, p_actor_user_id, 'completed_by_staff', jsonb_build_object('source', 'staff_queue_entry_action'));
  elsif p_action = 'cancel' then
    if v_entry.status not in ('waiting', 'serving') then
      raise exception 'Queue entry is not cancellable';
    end if;
    v_new_status := 'cancelled';
    update public.queue_entries
    set status = v_new_status,
        cancelled_at = now()
    where id = v_entry.id;

    insert into public.queue_events
      (queue_entry_id, actor_user_id, event_type, payload)
    values
      (v_entry.id, p_actor_user_id, 'cancelled_by_staff', jsonb_build_object('source', 'staff_queue_entry_action'));
  elsif p_action = 'return' then
    if v_entry.status = 'waiting' then
      raise exception 'Queue entry is already waiting';
    end if;
    v_new_status := 'waiting';
    update public.queue_entries
    set status = v_new_status,
        served_at = null,
        completed_at = null,
        cancelled_at = null,
        no_show_at = null
    where id = v_entry.id;

    insert into public.queue_events
      (queue_entry_id, actor_user_id, event_type, payload)
    values
      (v_entry.id, p_actor_user_id, 'returned_to_queue', jsonb_build_object('source', 'staff_queue_entry_action'));
  elsif p_action = 'move' then
    if p_target_location_id is null then
      raise exception 'Target location is required';
    end if;

    select location_id into v_current_location_id
    from public.queues
    where id = v_entry.queue_id;

    select airport_code into v_current_airport
    from public.locations
    where id = v_current_location_id;

    select airport_code into v_target_airport
    from public.locations
    where id = p_target_location_id;

    if v_current_airport is null or v_target_airport is null then
      raise exception 'Target location is invalid';
    end if;

    if v_current_airport <> v_target_airport then
      raise exception 'Can only move within the same airport';
    end if;

    select id into v_target_queue_id
    from public.queues
    where location_id = p_target_location_id
      and code = 'default'
      and is_open = true
    limit 1;

    if v_target_queue_id is null then
      raise exception 'Target queue is unavailable';
    end if;

    if v_target_queue_id = v_entry.queue_id then
      raise exception 'Target queue must be different';
    end if;

    v_next_sort_key := public.next_sort_key(v_target_queue_id, v_entry.customer_type);

    v_new_status := 'waiting';
    update public.queue_entries
    set queue_id = v_target_queue_id,
        status = v_new_status,
        sort_key = v_next_sort_key,
        served_at = null,
        completed_at = null,
        cancelled_at = null,
        no_show_at = null
    where id = v_entry.id;

    insert into public.queue_events
      (queue_entry_id, actor_user_id, event_type, payload)
    values
      (
        v_entry.id,
        p_actor_user_id,
        'moved_by_staff',
        jsonb_build_object('from_location_id', v_current_location_id, 'to_location_id', p_target_location_id)
      );
  elsif p_action = 'delete' then
    v_new_status := v_entry.status;
    delete from public.queue_entries
    where id = v_entry.id;
  else
    raise exception 'Action is invalid';
  end if;

  out_queue_entry_id := v_entry.id;
  out_status := v_new_status;
  out_queue_id := v_entry.queue_id;
  out_customer_id := v_entry.customer_id;
  out_customer_type := v_entry.customer_type;
  return next;
end;
$$;

revoke execute on function public.staff_queue_entry_action(uuid, text, uuid, uuid) from anon, authenticated;
grant execute on function public.staff_queue_entry_action(uuid, text, uuid, uuid) to service_role;

commit;
