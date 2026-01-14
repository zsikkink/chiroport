begin;

-- Ensure sms_outbox and sms_inbound emit realtime changes for dashboard chat.
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
        and tablename = 'sms_outbox'
    ) then
      alter publication supabase_realtime add table public.sms_outbox;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'sms_inbound'
    ) then
      alter publication supabase_realtime add table public.sms_inbound;
    end if;
  end if;
end
$$;

commit;
