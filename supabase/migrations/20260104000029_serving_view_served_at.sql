begin;

drop view if exists public.employee_queue_serving_view;

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
  qe.served_at,
  qe.updated_at,
  qe.sort_key,
  so_confirm.status as confirm_sms_status,
  so_next.status as next_sms_status,
  so_serving.status as serving_sms_status,
  inbound.last_inbound_body,
  inbound.last_inbound_at
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
  where si.from_phone = c.phone_e164
    and si.received_at >= qe.created_at
  order by si.received_at desc
  limit 1
) inbound on true
where qe.status = 'serving';

revoke all on public.employee_queue_serving_view from anon, authenticated;
grant select on public.employee_queue_serving_view to authenticated;

commit;
