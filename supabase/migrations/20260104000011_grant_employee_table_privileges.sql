begin;

grant select on public.customers to authenticated;
grant select on public.queue_entries to authenticated;
grant select on public.queue_events to authenticated;
grant select on public.queues to authenticated;
grant select on public.locations to authenticated;
grant select on public.location_hours to authenticated;

grant update on public.queue_entries to authenticated;
grant update on public.queues to authenticated;
grant insert on public.queue_events to authenticated;

commit;
