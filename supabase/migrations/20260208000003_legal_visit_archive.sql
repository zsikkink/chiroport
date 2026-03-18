begin;

-- Deduplicated immutable contact snapshots keep the legal archive compact.
create table if not exists public.customer_contact_snapshots (
  id bigint generated always as identity primary key,
  full_name text not null default '',
  phone_e164 text not null,
  email text not null default '',
  snapshot_key text generated always as (
    md5(full_name || '|' || phone_e164 || '|' || email)
  ) stored,
  created_at timestamptz not null default now(),
  constraint customer_contact_snapshots_phone_not_blank
    check (length(trim(phone_e164)) > 0),
  constraint customer_contact_snapshots_snapshot_key_unique
    unique (snapshot_key)
);

-- Long-term legal archive: never purged by rollups/retention jobs.
create table if not exists public.queue_entries_legal_archive (
  queue_entry_id uuid primary key,
  queue_id uuid not null,
  customer_id uuid not null,
  contact_snapshot_id bigint not null references public.customer_contact_snapshots(id),
  consent_version_id uuid null,
  consent_key text null,
  consent_version text null,
  consent_accepted_at timestamptz not null,
  queue_entry_created_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

comment on table public.queue_entries_legal_archive is
  'Immutable legal archive for queue visits; rows must never be deleted.';

create index if not exists idx_queue_entries_legal_archive_consent_at_brin
  on public.queue_entries_legal_archive using brin (consent_accepted_at);
create index if not exists idx_customer_contact_snapshots_phone
  on public.customer_contact_snapshots (phone_e164);
create index if not exists idx_queue_entries_legal_archive_contact_created
  on public.queue_entries_legal_archive (contact_snapshot_id, queue_entry_created_at, queue_entry_id);

-- Read model with denormalized contact fields for legal/audit retrieval.
create or replace view public.queue_entries_legal_history
with (security_invoker = true)
as
select
  qela.queue_entry_id,
  qela.queue_id,
  qela.customer_id,
  nullif(ccs.full_name, '') as full_name,
  ccs.phone_e164,
  nullif(ccs.email, '') as email,
  qela.consent_version_id,
  qela.consent_key,
  qela.consent_version,
  qela.consent_accepted_at,
  qela.queue_entry_created_at,
  qela.recorded_at
from public.queue_entries_legal_archive qela
join public.customer_contact_snapshots ccs
  on ccs.id = qela.contact_snapshot_id;

-- Enforce immutability: legal records cannot be changed or deleted.
create or replace function public.prevent_queue_entries_legal_archive_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'queue_entries_legal_archive is immutable and cannot be %', tg_op;
end;
$$;

drop trigger if exists queue_entries_legal_archive_immutable on public.queue_entries_legal_archive;
create trigger queue_entries_legal_archive_immutable
  before update or delete on public.queue_entries_legal_archive
  for each row execute function public.prevent_queue_entries_legal_archive_mutation();

-- Capture legal snapshot as each queue entry is created.
create or replace function public.capture_queue_entry_legal_archive()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_full_name text;
  v_phone_e164 text;
  v_email text;
  v_consent_key text;
  v_consent_version text;
  v_contact_snapshot_id bigint;
begin
  select
    coalesce(c.full_name, ''),
    c.phone_e164,
    coalesce(c.email, '')
  into
    v_full_name,
    v_phone_e164,
    v_email
  from public.customers c
  where c.id = new.customer_id;

  if v_phone_e164 is null or length(trim(v_phone_e164)) = 0 then
    raise exception 'Customer phone is required to capture a legal archive record.';
  end if;

  insert into public.customer_contact_snapshots (full_name, phone_e164, email)
  values (v_full_name, v_phone_e164, v_email)
  on conflict (snapshot_key) do update
    set full_name = public.customer_contact_snapshots.full_name
  returning id into v_contact_snapshot_id;

  select cv.key, cv.version
  into v_consent_key, v_consent_version
  from public.consent_versions cv
  where cv.id = new.consent_version_id;

  insert into public.queue_entries_legal_archive (
    queue_entry_id,
    queue_id,
    customer_id,
    contact_snapshot_id,
    consent_version_id,
    consent_key,
    consent_version,
    consent_accepted_at,
    queue_entry_created_at
  )
  values (
    new.id,
    new.queue_id,
    new.customer_id,
    v_contact_snapshot_id,
    new.consent_version_id,
    v_consent_key,
    v_consent_version,
    new.consent_accepted_at,
    new.created_at
  )
  on conflict (queue_entry_id) do nothing;

  return new;
end;
$$;

drop trigger if exists capture_queue_entry_legal_archive on public.queue_entries;
create trigger capture_queue_entry_legal_archive
  after insert on public.queue_entries
  for each row execute function public.capture_queue_entry_legal_archive();

-- Backfill from active queue entries first (authoritative consent metadata).
with source_rows as (
  select
    qe.id as queue_entry_id,
    qe.queue_id,
    qe.customer_id,
    coalesce(c.full_name, '') as full_name,
    c.phone_e164,
    coalesce(c.email, '') as email,
    qe.consent_version_id,
    cv.key as consent_key,
    cv.version as consent_version,
    qe.consent_accepted_at,
    qe.created_at as queue_entry_created_at,
    1 as source_rank
  from public.queue_entries qe
  join public.customers c on c.id = qe.customer_id
  left join public.consent_versions cv on cv.id = qe.consent_version_id

  union all

  -- Archived rows do not currently retain consent metadata, so we best-effort backfill.
  select
    qea.id as queue_entry_id,
    qea.queue_id,
    qea.customer_id,
    coalesce(c.full_name, '') as full_name,
    c.phone_e164,
    coalesce(c.email, '') as email,
    null::uuid as consent_version_id,
    null::text as consent_key,
    null::text as consent_version,
    qea.created_at as consent_accepted_at,
    qea.created_at as queue_entry_created_at,
    2 as source_rank
  from public.queue_entries_archive qea
  join public.customers c on c.id = qea.customer_id
),
deduped_rows as (
  select distinct on (queue_entry_id)
    queue_entry_id,
    queue_id,
    customer_id,
    full_name,
    phone_e164,
    email,
    consent_version_id,
    consent_key,
    consent_version,
    consent_accepted_at,
    queue_entry_created_at
  from source_rows
  order by queue_entry_id, source_rank
)
insert into public.customer_contact_snapshots (full_name, phone_e164, email)
select distinct
  d.full_name,
  d.phone_e164,
  d.email
from deduped_rows d
on conflict (snapshot_key) do nothing;

with source_rows as (
  select
    qe.id as queue_entry_id,
    qe.queue_id,
    qe.customer_id,
    coalesce(c.full_name, '') as full_name,
    c.phone_e164,
    coalesce(c.email, '') as email,
    qe.consent_version_id,
    cv.key as consent_key,
    cv.version as consent_version,
    qe.consent_accepted_at,
    qe.created_at as queue_entry_created_at,
    1 as source_rank
  from public.queue_entries qe
  join public.customers c on c.id = qe.customer_id
  left join public.consent_versions cv on cv.id = qe.consent_version_id

  union all

  select
    qea.id as queue_entry_id,
    qea.queue_id,
    qea.customer_id,
    coalesce(c.full_name, '') as full_name,
    c.phone_e164,
    coalesce(c.email, '') as email,
    null::uuid as consent_version_id,
    null::text as consent_key,
    null::text as consent_version,
    qea.created_at as consent_accepted_at,
    qea.created_at as queue_entry_created_at,
    2 as source_rank
  from public.queue_entries_archive qea
  join public.customers c on c.id = qea.customer_id
),
deduped_rows as (
  select distinct on (queue_entry_id)
    queue_entry_id,
    queue_id,
    customer_id,
    full_name,
    phone_e164,
    email,
    consent_version_id,
    consent_key,
    consent_version,
    consent_accepted_at,
    queue_entry_created_at
  from source_rows
  order by queue_entry_id, source_rank
)
insert into public.queue_entries_legal_archive (
  queue_entry_id,
  queue_id,
  customer_id,
  contact_snapshot_id,
  consent_version_id,
  consent_key,
  consent_version,
  consent_accepted_at,
  queue_entry_created_at
)
select
  d.queue_entry_id,
  d.queue_id,
  d.customer_id,
  ccs.id as contact_snapshot_id,
  d.consent_version_id,
  d.consent_key,
  d.consent_version,
  d.consent_accepted_at,
  d.queue_entry_created_at
from deduped_rows d
join public.customer_contact_snapshots ccs
  on ccs.snapshot_key = md5(d.full_name || '|' || d.phone_e164 || '|' || d.email)
on conflict (queue_entry_id) do nothing;

alter table public.customer_contact_snapshots enable row level security;
alter table public.queue_entries_legal_archive enable row level security;

drop policy if exists "Admins read customer contact snapshots" on public.customer_contact_snapshots;
create policy "Admins read customer contact snapshots"
  on public.customer_contact_snapshots
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins read queue entries legal archive" on public.queue_entries_legal_archive;
create policy "Admins read queue entries legal archive"
  on public.queue_entries_legal_archive
  for select
  to authenticated
  using (public.is_admin());

revoke all on public.queue_entries_legal_history from anon, authenticated;
grant select on public.queue_entries_legal_history to authenticated;

commit;
