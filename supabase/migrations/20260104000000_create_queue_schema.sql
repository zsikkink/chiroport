begin;

create extension if not exists "pgcrypto";

do $$ begin
  create type customer_type as enum ('paying', 'priority_pass');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type queue_status as enum ('waiting', 'serving', 'completed', 'cancelled', 'no_show');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type employee_role as enum ('employee', 'admin');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  airport_code text not null,
  code text not null,
  display_name text not null,
  timezone text not null,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_airport_code_code_unique unique (airport_code, code)
);

create table public.location_hours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  day_of_week smallint not null,
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_hours_location_id_day_of_week_unique unique (location_id, day_of_week),
  constraint location_hours_day_of_week_range check (day_of_week between 0 and 6),
  constraint location_hours_open_before_close check ((is_closed = true) or (opens_at < closes_at))
);

create table public.queues (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  code text not null default 'default',
  name text not null default 'Main Queue',
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint queues_location_id_code_unique unique (location_id, code)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text null,
  phone_e164 text not null,
  email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_phone_e164_unique unique (phone_e164)
);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  public_token uuid not null default gen_random_uuid(),
  customer_type customer_type not null,
  status queue_status not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  served_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  no_show_at timestamptz null,
  constraint queue_entries_public_token_unique unique (public_token),
  constraint queue_entries_served_at_required check (
    status not in ('serving', 'completed') or served_at is not null
  ),
  constraint queue_entries_completed_at_required check (
    status <> 'completed' or completed_at is not null
  ),
  constraint queue_entries_completed_after_served check (
    completed_at is null or served_at is null or completed_at >= served_at
  )
);

create table public.queue_events (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid not null references public.queue_entries(id) on delete cascade,
  actor_user_id uuid null references auth.users(id),
  event_type text not null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create table public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid not null references public.queue_entries(id) on delete cascade,
  message_type text not null,
  to_phone text not null,
  body text not null,
  status text not null default 'queued',
  provider_message_id text null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  constraint sms_outbox_idempotency_key_unique unique (idempotency_key)
);

create table public.sms_inbound (
  id uuid primary key default gen_random_uuid(),
  from_phone text not null,
  to_phone text not null,
  body text not null,
  provider_message_id text null,
  received_at timestamptz not null default now(),
  raw jsonb null,
  constraint sms_inbound_provider_message_id_unique unique (provider_message_id)
);

create table public.employee_profiles (
  user_id uuid primary key references auth.users(id),
  role employee_role not null default 'employee',
  location_id uuid null references public.locations(id),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_location_hours_location_day on public.location_hours (location_id, day_of_week);
create index idx_queues_location_open on public.queues (location_id, is_open);
create index idx_customers_phone_e164 on public.customers (phone_e164);
create unique index uniq_active_entry_per_customer_per_queue
  on public.queue_entries (queue_id, customer_id)
  where status in ('waiting', 'serving');
create index idx_queue_entries_next
  on public.queue_entries (queue_id, status, customer_type, created_at);
create index idx_queue_events_entry_time
  on public.queue_events (queue_entry_id, created_at desc);
create index idx_sms_outbox_entry_status
  on public.sms_outbox (queue_entry_id, status);
create index idx_sms_inbound_from_time
  on public.sms_inbound (from_phone, received_at desc);
create index idx_employee_profiles_location_open
  on public.employee_profiles (location_id, is_open);

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

create trigger set_updated_at_employee_profiles
  before update on public.employee_profiles
  for each row execute function public.set_updated_at();

alter table public.locations enable row level security;
alter table public.location_hours enable row level security;
alter table public.queues enable row level security;
alter table public.customers enable row level security;
alter table public.queue_entries enable row level security;
alter table public.queue_events enable row level security;
alter table public.sms_outbox enable row level security;
alter table public.sms_inbound enable row level security;
alter table public.employee_profiles enable row level security;

create policy "Public read open locations"
  on public.locations
  for select
  to anon, authenticated
  using (is_open = true);

create policy "Public read open queues"
  on public.queues
  for select
  to anon, authenticated
  using (is_open = true);

commit;
