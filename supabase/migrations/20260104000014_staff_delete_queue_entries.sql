begin;

drop policy if exists "Staff delete queue entries" on public.queue_entries;
drop policy if exists "Admins delete queue entries" on public.queue_entries;

create policy "Staff delete queue entries"
  on public.queue_entries
  for delete
  to authenticated
  using (public.is_employee());

commit;
