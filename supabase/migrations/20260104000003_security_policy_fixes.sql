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

-- Helper predicates for policies (inline with SELECT to avoid per-row auth.uid() evaluation).
-- Staff means employee or admin with an active profile.
-- Admin means active profile with role admin.

-- Reset policies to avoid overlapping SELECT policies and reduce auth.uid() re-evaluation.
drop policy if exists "Public read open locations" on public.locations;
drop policy if exists "Public read location hours" on public.location_hours;
drop policy if exists "Public read open queues" on public.queues;
drop policy if exists "Public read active consent versions" on public.consent_versions;
drop policy if exists "Employees read locations" on public.locations;
drop policy if exists "Employees read location hours" on public.location_hours;
drop policy if exists "Employees read queues" on public.queues;
drop policy if exists "Employees update queues" on public.queues;
drop policy if exists "Employees read customers" on public.customers;
drop policy if exists "Employees read queue entries" on public.queue_entries;
drop policy if exists "Employees update queue entries" on public.queue_entries;
drop policy if exists "Employees read queue events" on public.queue_events;
drop policy if exists "Employees insert queue events" on public.queue_events;
drop policy if exists "Employees read employee profiles" on public.employee_profiles;
drop policy if exists "Employees read consent versions" on public.consent_versions;
drop policy if exists "Admins manage locations" on public.locations;
drop policy if exists "Admins manage location hours" on public.location_hours;
drop policy if exists "Admins manage queues" on public.queues;
drop policy if exists "Admins manage customers" on public.customers;
drop policy if exists "Admins manage queue entries" on public.queue_entries;
drop policy if exists "Admins manage queue events" on public.queue_events;
drop policy if exists "Admins manage consent versions" on public.consent_versions;
drop policy if exists "Admins manage employee profiles" on public.employee_profiles;
drop policy if exists "Admins manage sms outbox" on public.sms_outbox;
drop policy if exists "Admins manage sms inbound" on public.sms_inbound;

-- Public + staff read for non-PII tables (single SELECT policy per table).
create policy "Read locations (public open + staff all)"
  on public.locations
  for select
  to anon, authenticated
  using (
    is_open = true
    or exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Read location hours"
  on public.location_hours
  for select
  to anon, authenticated
  using (true);

create policy "Read queues (public open + staff all)"
  on public.queues
  for select
  to anon, authenticated
  using (
    is_open = true
    or exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Read consent versions (public active + staff all)"
  on public.consent_versions
  for select
  to anon, authenticated
  using (
    is_active = true
    or exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

-- Staff read for PII and operational tables.
create policy "Staff read customers"
  on public.customers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Staff read queue entries"
  on public.queue_entries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Staff read queue events"
  on public.queue_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Staff read employee profiles"
  on public.employee_profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

-- Staff updates for operational tables.
create policy "Staff update queues"
  on public.queues
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Staff update queue entries"
  on public.queue_entries
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

create policy "Staff insert queue events"
  on public.queue_events
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role in ('employee', 'admin')
    )
  );

-- Admin-only write access (full privileges without overlapping SELECT policies).
create policy "Admins insert locations"
  on public.locations
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins update locations"
  on public.locations
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete locations"
  on public.locations
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins insert location hours"
  on public.location_hours
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins update location hours"
  on public.location_hours
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete location hours"
  on public.location_hours
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins insert queues"
  on public.queues
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete queues"
  on public.queues
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins insert customers"
  on public.customers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins update customers"
  on public.customers
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete customers"
  on public.customers
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins insert queue entries"
  on public.queue_entries
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete queue entries"
  on public.queue_entries
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins update queue events"
  on public.queue_events
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete queue events"
  on public.queue_events
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins insert consent versions"
  on public.consent_versions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins update consent versions"
  on public.consent_versions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete consent versions"
  on public.consent_versions
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins insert employee profiles"
  on public.employee_profiles
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins update employee profiles"
  on public.employee_profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins delete employee profiles"
  on public.employee_profiles
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins manage sms outbox"
  on public.sms_outbox
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

create policy "Admins manage sms inbound"
  on public.sms_inbound
  for all
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
        and ep.role = 'admin'
    )
  );

-- SECURITY DEFINER RPCs are required because RLS blocks direct public access.
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

  insert into public.queue_entries as qe (
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
  returning qe.id, qe.public_token, qe.status, qe.created_at
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

commit;
