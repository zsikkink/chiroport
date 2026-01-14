begin;

drop policy if exists "Employees read sms outbox" on public.sms_outbox;
drop policy if exists "Staff read sms outbox" on public.sms_outbox;
create policy "Staff read sms outbox"
  on public.sms_outbox
  for select
  to authenticated
  using (public.is_employee());

drop policy if exists "Employees read sms inbound" on public.sms_inbound;
drop policy if exists "Staff read sms inbound" on public.sms_inbound;
create policy "Staff read sms inbound"
  on public.sms_inbound
  for select
  to authenticated
  using (public.is_employee());

grant select on public.sms_outbox to authenticated;
grant select on public.sms_inbound to authenticated;

commit;
