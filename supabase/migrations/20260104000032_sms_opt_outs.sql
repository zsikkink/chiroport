begin;

create table if not exists public.sms_opt_outs (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  opted_out_at timestamptz not null default now(),
  source text null,
  created_at timestamptz not null default now(),
  constraint sms_opt_outs_phone_unique unique (phone_e164)
);

create index if not exists idx_sms_opt_outs_phone
  on public.sms_opt_outs (phone_e164);

alter table public.sms_opt_outs enable row level security;

revoke all on public.sms_opt_outs from anon, authenticated, public;

commit;
