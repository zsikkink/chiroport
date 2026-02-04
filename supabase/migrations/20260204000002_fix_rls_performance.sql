begin;

-- Use initplan-friendly auth lookup for archive reads.
drop policy if exists "Admins read queue entries archive" on public.queue_entries_archive;
create policy "Admins read queue entries archive"
  on public.queue_entries_archive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

-- Consolidate sms_inbound select policies (ensure single permissive SELECT).
drop policy if exists "Admins manage sms inbound" on public.sms_inbound;
drop policy if exists "Staff read sms inbound" on public.sms_inbound;
drop policy if exists "Admins insert sms inbound" on public.sms_inbound;
drop policy if exists "Admins update sms inbound" on public.sms_inbound;
drop policy if exists "Admins delete sms inbound" on public.sms_inbound;

create policy "Staff read sms inbound"
  on public.sms_inbound
  for select
  to authenticated
  using (public.is_employee());

create policy "Admins insert sms inbound"
  on public.sms_inbound
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update sms inbound"
  on public.sms_inbound
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete sms inbound"
  on public.sms_inbound
  for delete
  to authenticated
  using (public.is_admin());

-- Consolidate sms_outbox select policies (ensure single permissive SELECT).
drop policy if exists "Admins manage sms outbox" on public.sms_outbox;
drop policy if exists "Staff read sms outbox" on public.sms_outbox;
drop policy if exists "Admins insert sms outbox" on public.sms_outbox;
drop policy if exists "Admins update sms outbox" on public.sms_outbox;
drop policy if exists "Admins delete sms outbox" on public.sms_outbox;

create policy "Staff read sms outbox"
  on public.sms_outbox
  for select
  to authenticated
  using (public.is_employee());

create policy "Admins insert sms outbox"
  on public.sms_outbox
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update sms outbox"
  on public.sms_outbox
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete sms outbox"
  on public.sms_outbox
  for delete
  to authenticated
  using (public.is_admin());

commit;
