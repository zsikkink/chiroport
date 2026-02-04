begin;

-- Ensure view runs with invoker privileges to satisfy linter.
alter view public.queue_entries_history
  set (security_invoker = true);

-- Enable RLS on rollup tables and restrict to admins.
alter table public.queue_rollup_settings enable row level security;
drop policy if exists "Admins read queue rollup settings" on public.queue_rollup_settings;
create policy "Admins read queue rollup settings"
  on public.queue_rollup_settings
  for select
  to authenticated
  using (public.is_admin());

alter table public.queue_rollup_anomalies enable row level security;
drop policy if exists "Admins read queue rollup anomalies" on public.queue_rollup_anomalies;
create policy "Admins read queue rollup anomalies"
  on public.queue_rollup_anomalies
  for select
  to authenticated
  using (public.is_admin());

commit;
