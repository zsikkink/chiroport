begin;

create index if not exists idx_queue_entries_legal_archive_consent_at_brin
  on public.queue_entries_legal_archive using brin (consent_accepted_at);

create index if not exists idx_customer_contact_snapshots_phone
  on public.customer_contact_snapshots (phone_e164);

create index if not exists idx_queue_entries_legal_archive_contact_created
  on public.queue_entries_legal_archive (contact_snapshot_id, queue_entry_created_at, queue_entry_id);

commit;
