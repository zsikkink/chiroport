begin;

drop policy if exists "Staff update queue entries" on public.queue_entries;
drop policy if exists "Staff delete queue entries" on public.queue_entries;

create policy "Staff update queue entries"
  on public.queue_entries
  for update
  to authenticated
  using (public.is_employee())
  with check (public.is_employee());

create policy "Staff delete queue entries"
  on public.queue_entries
  for delete
  to authenticated
  using (public.is_employee());

commit;
