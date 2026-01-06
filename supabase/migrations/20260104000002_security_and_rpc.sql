begin;

-- Harden updated_at trigger function against search_path hijacking.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Ensure updated_at exists where required.
alter table public.queue_events
  add column if not exists updated_at timestamptz not null default now();

alter table public.sms_outbox
  add column if not exists updated_at timestamptz not null default now();

-- Consent versions (exact text + versioning).
create table if not exists public.consent_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  version text not null,
  text text not null,
  privacy_policy_url text null,
  terms_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed/refresh current consent text versions.
insert into public.consent_versions (key, version, text, privacy_policy_url, terms_url, is_active)
values
  (
    'queue_join_consent_bodywork',
    '2026-01-06_v1',
    'I consent to bodywork services from The Chiroport and release The Chiroport and its providers from liability for normal reactions except in cases of negligence. I agree to receive SMS updates about my visit. Msg & data rates may apply. Reply STOP to unsubscribe. I agree to the Privacy Policy and Terms & Conditions.',
    '/privacy-policy',
    '/terms-and-conditions',
    true
  ),
  (
    'queue_join_consent_chiropractic',
    '2026-01-06_v1',
    'I consent to receiving chiropractic care from The Chiroport. I understand that chiropractic adjustments are generally safe and effective, and I release The Chiroport and its providers from any liability for injuries or effects except those caused by gross negligence. I agree to receive SMS updates about my visit. Msg & data rates may apply. Reply STOP to unsubscribe. I agree to the Privacy Policy and Terms & Conditions.',
    '/privacy-policy',
    '/terms-and-conditions',
    true
  )
on conflict (key)
do update set
  version = excluded.version,
  text = excluded.text,
  privacy_policy_url = excluded.privacy_policy_url,
  terms_url = excluded.terms_url,
  is_active = excluded.is_active;

-- Queue entry consent tracking.
alter table public.queue_entries
  add column if not exists consent_version_id uuid,
  add column if not exists consent_accepted_at timestamptz not null default now();

update public.queue_entries
set consent_version_id = (
  select id from public.consent_versions where key = 'queue_join_consent_bodywork' limit 1
)
where consent_version_id is null;

update public.queue_entries
set consent_accepted_at = created_at
where consent_accepted_at is distinct from created_at;

alter table public.queue_entries
  alter column consent_version_id set not null;

alter table public.queue_entries
  add constraint queue_entries_consent_version_id_fkey
  foreign key (consent_version_id) references public.consent_versions(id);

-- Consent acceptance invariant: keep accepted_at aligned with created_at.
alter table public.queue_entries
  add constraint queue_entries_consent_time_matches_created
  check (consent_accepted_at = created_at);

comment on constraint queue_entries_consent_time_matches_created on public.queue_entries is
  'Consent is captured at join time; relax if consent timing is decoupled later.';

-- Recreate updated_at triggers deterministically.
drop trigger if exists set_updated_at_locations on public.locations;
drop trigger if exists set_updated_at_location_hours on public.location_hours;
drop trigger if exists set_updated_at_queues on public.queues;
drop trigger if exists set_updated_at_customers on public.customers;
drop trigger if exists set_updated_at_queue_entries on public.queue_entries;
drop trigger if exists set_updated_at_queue_events on public.queue_events;
drop trigger if exists set_updated_at_sms_outbox on public.sms_outbox;
drop trigger if exists set_updated_at_employee_profiles on public.employee_profiles;

create trigger set_updated_at_locations
  before update on public.locations
  for each row execute function public.set_updated_at();

create trigger set_updated_at_location_hours
  before update on public.location_hours
  for each row execute function public.set_updated_at();

create trigger set_updated_at_queues
  before update on public.queues
  for each row execute function public.set_updated_at();

create trigger set_updated_at_customers
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger set_updated_at_queue_entries
  before update on public.queue_entries
  for each row execute function public.set_updated_at();

create trigger set_updated_at_queue_events
  before update on public.queue_events
  for each row execute function public.set_updated_at();

create trigger set_updated_at_sms_outbox
  before update on public.sms_outbox
  for each row execute function public.set_updated_at();

create trigger set_updated_at_employee_profiles
  before update on public.employee_profiles
  for each row execute function public.set_updated_at();

-- RLS: enable on all tables (idempotent).
alter table public.consent_versions enable row level security;
alter table public.customers enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.location_hours enable row level security;
alter table public.locations enable row level security;
alter table public.queue_entries enable row level security;
alter table public.queue_events enable row level security;
alter table public.queues enable row level security;
alter table public.sms_inbound enable row level security;
alter table public.sms_outbox enable row level security;

-- Revoke broad table privileges; rely on RLS + RPC.
revoke all on table
  public.consent_versions,
  public.customers,
  public.employee_profiles,
  public.location_hours,
  public.locations,
  public.queue_entries,
  public.queue_events,
  public.queues,
  public.sms_inbound,
  public.sms_outbox
from anon, authenticated, public;

-- Public read access (non-PII).
drop policy if exists "Public read open locations" on public.locations;
create policy "Public read open locations"
  on public.locations
  for select
  to anon, authenticated
  using (is_open = true);

drop policy if exists "Public read location hours" on public.location_hours;
create policy "Public read location hours"
  on public.location_hours
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read open queues" on public.queues;
create policy "Public read open queues"
  on public.queues
  for select
  to anon, authenticated
  using (is_open = true);

drop policy if exists "Public read active consent versions" on public.consent_versions;
create policy "Public read active consent versions"
  on public.consent_versions
  for select
  to anon, authenticated
  using (is_active = true);

grant select on public.locations, public.location_hours, public.queues, public.consent_versions to anon, authenticated;

-- Employee policies (global access, no location scoping).
drop policy if exists "Employees read locations" on public.locations;
create policy "Employees read locations"
  on public.locations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees read location hours" on public.location_hours;
create policy "Employees read location hours"
  on public.location_hours
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees read queues" on public.queues;
create policy "Employees read queues"
  on public.queues
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees update queues" on public.queues;
create policy "Employees update queues"
  on public.queues
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees read customers" on public.customers;
create policy "Employees read customers"
  on public.customers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees read queue entries" on public.queue_entries;
create policy "Employees read queue entries"
  on public.queue_entries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees update queue entries" on public.queue_entries;
create policy "Employees update queue entries"
  on public.queue_entries
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees read queue events" on public.queue_events;
create policy "Employees read queue events"
  on public.queue_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees insert queue events" on public.queue_events;
create policy "Employees insert queue events"
  on public.queue_events
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees read employee profiles" on public.employee_profiles;
create policy "Employees read employee profiles"
  on public.employee_profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

drop policy if exists "Employees read consent versions" on public.consent_versions;
create policy "Employees read consent versions"
  on public.consent_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

-- Admin policies (full access).
drop policy if exists "Admins manage locations" on public.locations;
create policy "Admins manage locations"
  on public.locations
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage location hours" on public.location_hours;
create policy "Admins manage location hours"
  on public.location_hours
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage queues" on public.queues;
create policy "Admins manage queues"
  on public.queues
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage customers" on public.customers;
create policy "Admins manage customers"
  on public.customers
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage queue entries" on public.queue_entries;
create policy "Admins manage queue entries"
  on public.queue_entries
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage queue events" on public.queue_events;
create policy "Admins manage queue events"
  on public.queue_events
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage consent versions" on public.consent_versions;
create policy "Admins manage consent versions"
  on public.consent_versions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage employee profiles" on public.employee_profiles;
create policy "Admins manage employee profiles"
  on public.employee_profiles
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

-- Server-only by default; admins only.
drop policy if exists "Admins manage sms outbox" on public.sms_outbox;
create policy "Admins manage sms outbox"
  on public.sms_outbox
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

drop policy if exists "Admins manage sms inbound" on public.sms_inbound;
create policy "Admins manage sms inbound"
  on public.sms_inbound
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = auth.uid()
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

-- Customer RPCs (SECURITY DEFINER with safe search_path).
create or replace function public.join_queue(
  p_airport_code text,
  p_location_code text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_customer_type customer_type,
  p_consent_version_id uuid
)
returns table (
  queue_entry_id uuid,
  public_token uuid,
  queue_id uuid,
  status queue_status,
  created_at timestamptz,
  queue_position integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_location_id uuid;
  v_queue_id uuid;
  v_customer_id uuid;
  v_entry_id uuid;
  v_public_token uuid;
  v_status queue_status;
  v_created_at timestamptz;
  v_position integer;
begin
  if p_airport_code is null or p_location_code is null then
    raise exception 'Location is required';
  end if;

  if p_phone_e164 is null or length(trim(p_phone_e164)) = 0 then
    raise exception 'Phone number is required';
  end if;

  if p_customer_type is null then
    raise exception 'Customer type is required';
  end if;

  perform 1
  from public.consent_versions
  where id = p_consent_version_id
    and is_active = true
    and key in ('queue_join_consent_bodywork', 'queue_join_consent_chiropractic', 'queue_join_consent');

  if not found then
    raise exception 'Consent version is invalid or inactive';
  end if;

  select id
  into v_location_id
  from public.locations
  where airport_code = p_airport_code
    and code = p_location_code
    and is_open = true
  limit 1;

  if v_location_id is null then
    raise exception 'Location not found or closed';
  end if;

  select id
  into v_queue_id
  from public.queues
  where location_id = v_location_id
    and code = 'default'
    and is_open = true
  limit 1;

  if v_queue_id is null then
    raise exception 'Queue not available';
  end if;

  insert into public.customers (full_name, phone_e164, email)
  values (
    nullif(trim(p_full_name), ''),
    trim(p_phone_e164),
    nullif(lower(trim(p_email)), '')
  )
  on conflict (phone_e164) do update
    set full_name = excluded.full_name,
        email = excluded.email
  returning id into v_customer_id;

  insert into public.queue_entries (
    queue_id,
    customer_id,
    customer_type,
    consent_version_id
  )
  values (
    v_queue_id,
    v_customer_id,
    p_customer_type,
    p_consent_version_id
  )
  returning id, public_token, status, created_at
  into v_entry_id, v_public_token, v_status, v_created_at;

  select position into v_position
  from (
    select id,
           row_number() over (
             order by case customer_type when 'paying' then 0 else 1 end,
                      created_at asc
           ) as position
    from public.queue_entries
    where queue_id = v_queue_id
      and status = 'waiting'
  ) ordered
  where ordered.id = v_entry_id;

  queue_entry_id := v_entry_id;
  public_token := v_public_token;
  queue_id := v_queue_id;
  status := v_status;
  created_at := v_created_at;
  queue_position := v_position;

  return next;
end;
$$;

create or replace function public.cancel_visit(p_public_token uuid)
returns table (
  queue_entry_id uuid,
  status queue_status,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_public_token is null then
    raise exception 'Public token is required';
  end if;

  update public.queue_entries
  set status = 'cancelled',
      cancelled_at = now()
  where public_token = p_public_token
    and status = 'waiting'
  returning id, status, cancelled_at
  into queue_entry_id, status, cancelled_at;

  if queue_entry_id is null then
    raise exception 'Queue entry not found or not cancellable';
  end if;

  return next;
end;
$$;

create or replace function public.get_visit(p_public_token uuid)
returns table (
  queue_entry_id uuid,
  status queue_status,
  created_at timestamptz,
  served_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  no_show_at timestamptz,
  location_display_name text,
  location_timezone text,
  queue_position integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_queue_id uuid;
begin
  if p_public_token is null then
    raise exception 'Public token is required';
  end if;

  select qe.queue_id into v_queue_id
  from public.queue_entries qe
  where qe.public_token = p_public_token
  limit 1;

  if v_queue_id is null then
    raise exception 'Queue entry not found';
  end if;

  return query
  with ordered as (
    select
      qe.id,
      row_number() over (
        order by case qe.customer_type when 'paying' then 0 else 1 end,
                 qe.created_at asc
      ) as position
    from public.queue_entries qe
    where qe.queue_id = v_queue_id
      and qe.status = 'waiting'
  )
  select
    qe.id,
    qe.status,
    qe.created_at,
    qe.served_at,
    qe.completed_at,
    qe.cancelled_at,
    qe.no_show_at,
    l.display_name,
    l.timezone,
    case when qe.status = 'waiting' then ordered.position else null end
  from public.queue_entries qe
  join public.queues q on q.id = qe.queue_id
  join public.locations l on l.id = q.location_id
  left join ordered on ordered.id = qe.id
  where qe.public_token = p_public_token
  limit 1;
end;
$$;

revoke all on function public.join_queue(
  text,
  text,
  text,
  text,
  text,
  customer_type,
  uuid
) from public;

revoke all on function public.cancel_visit(uuid) from public;
revoke all on function public.get_visit(uuid) from public;

grant execute on function public.join_queue(
  text,
  text,
  text,
  text,
  text,
  customer_type,
  uuid
) to anon, authenticated;

grant execute on function public.cancel_visit(uuid) to anon, authenticated;
grant execute on function public.get_visit(uuid) to anon, authenticated;

commit;
