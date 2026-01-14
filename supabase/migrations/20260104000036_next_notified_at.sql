begin;

alter table public.queue_entries
  add column if not exists next_notified_at timestamptz null;

commit;
