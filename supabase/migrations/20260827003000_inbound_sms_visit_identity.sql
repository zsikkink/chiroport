begin;

alter table public.sms_inbound
  add column if not exists queue_entry_id uuid null
  references public.queue_entries(id) on delete set null;

create index if not exists idx_sms_inbound_queue_entry_time
  on public.sms_inbound (queue_entry_id, received_at asc);

update public.sms_inbound si
set queue_entry_id = (
  select case
    when count(*) = 1 then min(candidate.queue_entry_id::text)::uuid
  end
  from (
    select qe.id as queue_entry_id
    from public.queue_entries qe
    join public.customers c on c.id = qe.customer_id
    where c.phone_e164 = si.from_phone
      and qe.created_at <= si.received_at
      and si.received_at <= coalesce(
        qe.completed_at,
        qe.cancelled_at,
        qe.no_show_at,
        now()
      )
  ) candidate
)
where si.queue_entry_id is null;

create or replace function public.record_sms_inbound(
  p_from_phone text,
  p_to_phone text,
  p_body text,
  p_provider_message_id text,
  p_raw jsonb
)
returns table (
  out_sms_inbound_id uuid,
  out_queue_entry_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_from_phone text;
  v_sms_inbound_id uuid;
  v_queue_entry_id uuid;
begin
  v_from_phone := nullif(trim(p_from_phone), '');
  if v_from_phone is null then
    raise exception 'Inbound phone number is required';
  end if;

  select case
    when count(*) = 1 then min(active_visit.queue_entry_id::text)::uuid
  end
  into v_queue_entry_id
  from (
    select qe.id as queue_entry_id
    from public.queue_entries qe
    join public.customers c on c.id = qe.customer_id
    where c.phone_e164 = v_from_phone
      and qe.status in ('waiting', 'serving')
  ) active_visit;

  insert into public.sms_inbound (
    queue_entry_id,
    from_phone,
    to_phone,
    body,
    provider_message_id,
    raw
  ) values (
    v_queue_entry_id,
    v_from_phone,
    coalesce(p_to_phone, ''),
    coalesce(p_body, ''),
    nullif(trim(p_provider_message_id), ''),
    p_raw
  )
  on conflict (provider_message_id) do nothing
  returning id, queue_entry_id
  into v_sms_inbound_id, v_queue_entry_id;

  if v_sms_inbound_id is null and nullif(trim(p_provider_message_id), '') is not null then
    select si.id, si.queue_entry_id
    into v_sms_inbound_id, v_queue_entry_id
    from public.sms_inbound si
    where si.provider_message_id = trim(p_provider_message_id);
  end if;

  out_sms_inbound_id := v_sms_inbound_id;
  out_queue_entry_id := v_queue_entry_id;
  return next;
end;
$$;

revoke all on function public.record_sms_inbound(
  text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_sms_inbound(
  text, text, text, text, jsonb
) to service_role;

drop view if exists public.employee_queue_waiting_view;
drop view if exists public.employee_queue_serving_view;
drop view if exists public.employee_queue_history_view;

create view public.employee_queue_waiting_view
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
    order by case qe.customer_type when 'paying' then 0 else 1 end,
             qe.sort_key asc,
             qe.created_at asc
  )::int as queue_position
from public.queue_entries qe
join public.customers c on c.id = qe.customer_id
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
left join public.sms_outbox so_confirm
  on so_confirm.queue_entry_id = qe.id and so_confirm.message_type = 'confirm'
left join public.sms_outbox so_next
  on so_next.queue_entry_id = qe.id and so_next.message_type = 'next'
left join public.sms_outbox so_serving
  on so_serving.queue_entry_id = qe.id and so_serving.message_type = 'serving'
left join lateral (
  select
    si.body as last_inbound_body,
    si.received_at as last_inbound_at
  from public.sms_inbound si
  where si.queue_entry_id = qe.id
  order by si.received_at desc
  limit 1
) inbound on true
where qe.status = 'waiting';

create view public.employee_queue_serving_view
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
  qe.served_at,
  qe.sort_key,
  so_confirm.status as confirm_sms_status,
  so_next.status as next_sms_status,
  so_serving.status as serving_sms_status,
  inbound.last_inbound_body,
  inbound.last_inbound_at,
  qe.offering_code
from public.queue_entries qe
join public.customers c on c.id = qe.customer_id
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
left join public.sms_outbox so_confirm
  on so_confirm.queue_entry_id = qe.id and so_confirm.message_type = 'confirm'
left join public.sms_outbox so_next
  on so_next.queue_entry_id = qe.id and so_next.message_type = 'next'
left join public.sms_outbox so_serving
  on so_serving.queue_entry_id = qe.id and so_serving.message_type = 'serving'
left join lateral (
  select
    si.body as last_inbound_body,
    si.received_at as last_inbound_at
  from public.sms_inbound si
  where si.queue_entry_id = qe.id
  order by si.received_at desc
  limit 1
) inbound on true
where qe.status = 'serving';

create view public.employee_queue_history_view
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
  coalesce(
    qe.completed_at,
    qe.cancelled_at,
    qe.no_show_at,
    qe.served_at,
    qe.updated_at,
    qe.created_at
  ) as end_ts
from public.queue_entries qe
join public.customers c on c.id = qe.customer_id
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
left join public.sms_outbox so_confirm
  on so_confirm.queue_entry_id = qe.id and so_confirm.message_type = 'confirm'
left join public.sms_outbox so_next
  on so_next.queue_entry_id = qe.id and so_next.message_type = 'next'
left join public.sms_outbox so_serving
  on so_serving.queue_entry_id = qe.id and so_serving.message_type = 'serving'
left join lateral (
  select
    si.body as last_inbound_body,
    si.received_at as last_inbound_at
  from public.sms_inbound si
  where si.queue_entry_id = qe.id
  order by si.received_at desc
  limit 1
) inbound on true
where qe.status in ('completed', 'cancelled', 'no_show');

revoke all on public.employee_queue_waiting_view from anon, authenticated;
revoke all on public.employee_queue_serving_view from anon, authenticated;
revoke all on public.employee_queue_history_view from anon, authenticated;
grant select on public.employee_queue_waiting_view to authenticated;
grant select on public.employee_queue_serving_view to authenticated;
grant select on public.employee_queue_history_view to authenticated;

commit;
