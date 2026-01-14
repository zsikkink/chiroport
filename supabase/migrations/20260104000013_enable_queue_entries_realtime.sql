begin;

-- Ensure queue_entries emits realtime changes for the employee dashboard.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'queue_entries'
    ) then
      alter publication supabase_realtime add table public.queue_entries;
    end if;
  end if;
end
$$;

commit;
