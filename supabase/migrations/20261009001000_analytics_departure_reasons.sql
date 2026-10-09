begin;

alter table public.queue_entries
  add column if not exists served_by_user_id uuid,
  add column if not exists departure_reason text;
alter table public.queue_entries_archive
  add column if not exists served_by_user_id uuid,
  add column if not exists departure_reason text;

alter table public.queue_entries
  add constraint queue_entries_departure_reason_known
  check (departure_reason in (
    'priority_pass_declined', 'no_staff_available', 'customer_left',
    'wait_too_long', 'plans_changed', 'other'
  ));
alter table public.queue_entries_archive
  add constraint queue_entries_archive_departure_reason_known
  check (departure_reason in (
    'priority_pass_declined', 'no_staff_available', 'customer_left',
    'wait_too_long', 'plans_changed', 'other'
  ));

-- The existing rollup inserts the archive row before deleting the live row.
-- Copy annotations at that boundary without replacing the rollup function.
create or replace function public.copy_queue_outcome_to_archive()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.queue_entries_archive
  set served_by_user_id = old.served_by_user_id,
      departure_reason = old.departure_reason
  where id = old.id;
  return old;
end;
$$;

revoke execute on function public.copy_queue_outcome_to_archive()
  from public, anon, authenticated;

create trigger copy_queue_outcome_to_archive_on_delete
  before delete on public.queue_entries
  for each row execute function public.copy_queue_outcome_to_archive();

create or replace view public.queue_entries_history
with (security_invoker = true)
as
select
  qe.id, qe.queue_id, q.location_id, l.timezone,
  (qe.created_at at time zone l.timezone)::date as local_date,
  qe.customer_id, qe.public_token, qe.customer_type, qe.status,
  qe.service_label, qe.created_at, qe.updated_at, qe.served_at,
  qe.completed_at, qe.cancelled_at, qe.no_show_at, qe.offering_code,
  qe.served_by_user_id, qe.departure_reason
from public.queue_entries qe
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
union all
select
  qea.id, qea.queue_id, qea.location_id, qea.timezone, qea.local_date,
  qea.customer_id, qea.public_token, qea.customer_type, qea.status,
  qea.service_label, qea.created_at, qea.updated_at, qea.served_at,
  qea.completed_at, qea.cancelled_at, qea.no_show_at, qea.offering_code,
  qea.served_by_user_id, qea.departure_reason
from public.queue_entries_archive qea;

-- Keep the four-argument queue action API available for existing callers.
create or replace function public.staff_queue_entry_action(
  p_entry_id uuid,
  p_action text,
  p_target_location_id uuid,
  p_actor_user_id uuid,
  p_departure_reason text
)
returns table (
  out_queue_entry_id uuid,
  out_status public.queue_status,
  out_queue_id uuid,
  out_customer_id uuid,
  out_customer_type public.customer_type
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result record;
begin
  if p_action = 'cancel' and p_departure_reason is not null
    and p_departure_reason not in (
      'priority_pass_declined', 'no_staff_available', 'customer_left', 'other'
    ) then
    raise exception 'Cancellation reason is invalid';
  end if;
  if p_action <> 'cancel' and p_departure_reason is not null then
    raise exception 'Cancellation reason is only valid for cancel';
  end if;

  select * into strict v_result
  from public.staff_queue_entry_action(
    p_entry_id, p_action, p_target_location_id, p_actor_user_id
  );

  if p_action = 'cancel' then
    if p_departure_reason = 'priority_pass_declined'
      and v_result.out_customer_type <> 'priority_pass' then
      raise exception 'Priority Pass decline is only valid for Priority Pass visits';
    end if;
    update public.queue_entries
    set departure_reason = p_departure_reason
    where id = p_entry_id;
  elsif p_action = 'serving' then
    update public.queue_entries
    set served_by_user_id = p_actor_user_id,
        departure_reason = null
    where id = p_entry_id;
  elsif p_action = 'complete' then
    update public.queue_entries
    set served_by_user_id = coalesce(served_by_user_id, p_actor_user_id),
        departure_reason = null
    where id = p_entry_id;
  elsif p_action = 'return' then
    update public.queue_entries
    set served_by_user_id = null,
        departure_reason = null
    where id = p_entry_id;
  end if;

  out_queue_entry_id := v_result.out_queue_entry_id;
  out_status := v_result.out_status;
  out_queue_id := v_result.out_queue_id;
  out_customer_id := v_result.out_customer_id;
  out_customer_type := v_result.out_customer_type;
  return next;
end;
$$;

revoke execute on function public.staff_queue_entry_action(uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.staff_queue_entry_action(uuid, text, uuid, uuid, text)
  to service_role;

-- The public token is already the credential for customer cancellation. The
-- reasoned variant keeps that existing flow and records the choice atomically.
create or replace function public.cancel_visit_with_reason(
  p_public_token uuid,
  p_departure_reason text
)
returns table (
  out_queue_entry_id uuid,
  out_status public.queue_status,
  out_cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result record;
  v_customer_type public.customer_type;
begin
  if p_departure_reason not in (
    'priority_pass_declined', 'no_staff_available', 'wait_too_long',
    'plans_changed', 'other'
  ) or p_departure_reason is null then
    raise exception 'A departure reason is required';
  end if;
  select customer_type into v_customer_type
  from public.queue_entries
  where public_token = p_public_token and status = 'waiting'
  for update;
  if v_customer_type is null then
    raise exception 'Queue entry not found or not cancellable';
  end if;
  if p_departure_reason = 'priority_pass_declined'
    and v_customer_type <> 'priority_pass' then
    raise exception 'Priority Pass decline is only valid for Priority Pass visits';
  end if;

  select * into strict v_result from public.cancel_visit(p_public_token);
  update public.queue_entries
  set departure_reason = p_departure_reason
  where id = v_result.out_queue_entry_id;

  out_queue_entry_id := v_result.out_queue_entry_id;
  out_status := v_result.out_status;
  out_cancelled_at := v_result.out_cancelled_at;
  return next;
end;
$$;

revoke execute on function public.cancel_visit_with_reason(uuid, text) from public;
grant execute on function public.cancel_visit_with_reason(uuid, text)
  to anon, authenticated, service_role;

-- A reply to the cancellation text fills in an initially unknown reason.
create or replace function public.record_customer_cancel_reason(
  p_phone_e164 text,
  p_departure_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry_id uuid;
begin
  if p_departure_reason not in (
    'priority_pass_declined', 'no_staff_available', 'wait_too_long',
    'plans_changed', 'other'
  ) or p_departure_reason is null then
    raise exception 'Cancellation reason is invalid';
  end if;

  select qe.id into v_entry_id
  from public.queue_entries qe
  join public.customers c on c.id = qe.customer_id
  where c.phone_e164 = p_phone_e164
    and qe.status = 'cancelled'
    and qe.cancelled_at >= now() - interval '24 hours'
    and qe.departure_reason is null
    and (p_departure_reason <> 'priority_pass_declined'
      or qe.customer_type = 'priority_pass')
    and exists (
      select 1 from public.queue_events ev
      where ev.queue_entry_id = qe.id
        and ev.event_type = 'cancelled_by_customer'
        and ev.payload->>'source' = 'twilio_webhook'
    )
  order by qe.cancelled_at desc
  limit 1
  for update of qe;

  if v_entry_id is not null then
    update public.queue_entries
    set departure_reason = p_departure_reason
    where id = v_entry_id;
    return true;
  end if;

  -- A visit can move to the archive at the next local day boundary. The
  -- cancellation text is the only path that asks for this numeric reply.
  select qea.id into v_entry_id
  from public.queue_entries_archive qea
  join public.customers c on c.id = qea.customer_id
  where c.phone_e164 = p_phone_e164
    and qea.status = 'cancelled'
    and qea.cancelled_at >= now() - interval '24 hours'
    and qea.departure_reason is null
    and (p_departure_reason <> 'priority_pass_declined'
      or qea.customer_type = 'priority_pass')
  order by qea.cancelled_at desc
  limit 1
  for update of qea;

  if v_entry_id is null then return false; end if;
  update public.queue_entries_archive
  set departure_reason = p_departure_reason
  where id = v_entry_id;
  return true;
end;
$$;

revoke execute on function public.record_customer_cancel_reason(text, text)
  from public, anon, authenticated;
grant execute on function public.record_customer_cancel_reason(text, text)
  to service_role;

-- Keep the existing confirmation-first delivery rule for the follow-up text.
create or replace function public.claim_sms_outbox(
  p_limit integer default 25,
  p_lock_minutes integer default 5,
  p_message_id uuid default null
)
returns setof public.sms_outbox
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select so.id
    from public.sms_outbox so
    where so.provider_message_id is null
      and (
        (so.status in ('queued', 'failed') and so.next_attempt_at <= now())
        or (
          so.status = 'sending'
          and so.locked_at is not null
          and so.locked_at <= now() - make_interval(mins => p_lock_minutes)
        )
      )
      and (p_message_id is null or so.id = p_message_id)
      and (
        so.message_type = 'confirm'
        or so.message_type like 'staff_%'
        or (
          so.message_type in ('next', 'serving', 'cancel_ack', 'cancel_reason_prompt')
          and exists (
            select 1
            from public.sms_outbox confirm_msg
            where confirm_msg.queue_entry_id = so.queue_entry_id
              and confirm_msg.message_type = 'confirm'
              and confirm_msg.status = 'sent'
          )
        )
      )
    order by so.next_attempt_at asc, so.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.sms_outbox so
  set status = 'sending',
      locked_at = now(),
      attempt_count = so.attempt_count + 1,
      last_error = null
  from candidates
  where so.id = candidates.id
  returning so.*;
end;
$$;

create or replace function public.get_admin_workforce_analytics(
  p_date_start date,
  p_date_end date,
  p_location_id uuid default null,
  p_customer_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  if p_date_start is null or p_date_end is null or p_date_end < p_date_start then
    raise exception 'A valid analytics date range is required';
  end if;

  with visits as materialized (
    select h.*
    from public.queue_entries_history h
    join public.locations l on l.id = h.location_id
    where h.local_date between p_date_start and p_date_end
      and h.status in ('completed', 'cancelled', 'no_show')
      and (p_location_id is null and l.is_open or h.location_id = p_location_id)
      and (p_customer_type is null or h.customer_type::text = p_customer_type)
  ),
  totals as (
    select
      count(*) filter (where customer_type = 'priority_pass') as priority_settled,
      count(*) filter (where customer_type = 'priority_pass' and served_at is not null) as priority_served,
      count(*) filter (where customer_type = 'priority_pass' and status in ('cancelled', 'no_show') and served_at is null) as priority_unserved,
      count(*) filter (where customer_type = 'paying' and status in ('cancelled', 'no_show') and served_at is null) as paying_unserved,
      count(*) filter (where customer_type = 'priority_pass' and status in ('cancelled', 'no_show') and served_at is null and departure_reason = 'priority_pass_declined') as priority_declined,
      count(*) filter (where customer_type = 'priority_pass' and status in ('cancelled', 'no_show') and served_at is null and departure_reason = 'no_staff_available') as priority_no_staff_available,
      count(*) filter (where customer_type = 'priority_pass' and status in ('cancelled', 'no_show') and served_at is null and departure_reason is null) as priority_unknown_reason,
      count(*) filter (where status in ('cancelled', 'no_show') and served_at is null and departure_reason = 'no_staff_available') as no_staff_available,
      count(*) filter (where status in ('cancelled', 'no_show') and served_at is null and departure_reason = 'customer_left') as customer_left,
      count(*) filter (where status in ('cancelled', 'no_show') and served_at is null and departure_reason = 'wait_too_long') as wait_too_long,
      count(*) filter (where status in ('cancelled', 'no_show') and served_at is null and departure_reason = 'plans_changed') as plans_changed,
      count(*) filter (where status in ('cancelled', 'no_show') and served_at is null and departure_reason = 'other') as other_reason,
      count(*) filter (where status in ('cancelled', 'no_show') and served_at is null and departure_reason is null) as unknown_reason
    from visits
  ),
  employees as (
    select
      v.served_by_user_id as user_id,
      coalesce(u.email, 'Former employee') as employee,
      count(*) as started_total,
      count(*) filter (where v.status = 'completed') as completed_total
    from visits v
    left join auth.users u on u.id = v.served_by_user_id
    where v.served_by_user_id is not null
    group by v.served_by_user_id, u.email
  )
  select jsonb_build_object(
    'priority_settled_total', t.priority_settled,
    'priority_served_total', t.priority_served,
    'priority_unserved_total', t.priority_unserved,
    'paying_unserved_total', t.paying_unserved,
    'priority_declined_total', t.priority_declined,
    'priority_no_staff_available_total', t.priority_no_staff_available,
    'priority_unknown_reason_total', t.priority_unknown_reason,
    'no_staff_available_total', t.no_staff_available,
    'customer_left_total', t.customer_left,
    'wait_too_long_total', t.wait_too_long,
    'plans_changed_total', t.plans_changed,
    'other_reason_total', t.other_reason,
    'unknown_reason_total', t.unknown_reason,
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', e.user_id,
        'employee', e.employee,
        'started_total', e.started_total,
        'completed_total', e.completed_total
      ) order by e.completed_total desc, e.employee)
      from employees e
    ), '[]'::jsonb)
  ) into v_result
  from totals t;

  return v_result;
end;
$$;

revoke execute on function public.get_admin_workforce_analytics(date, date, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_admin_workforce_analytics(date, date, uuid, text)
  to service_role;

commit;
