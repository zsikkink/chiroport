begin;

create table public.service_offerings (
  code text primary key,
  display_label text not null,
  customer_type customer_type not null,
  consent_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_offerings_code_format
    check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint service_offerings_label_not_blank
    check (length(trim(display_label)) > 0),
  constraint service_offerings_consent_key_known
    check (consent_key in (
      'queue_join_consent_bodywork',
      'queue_join_consent_chiropractic'
    ))
);

create trigger set_updated_at_service_offerings
  before update on public.service_offerings
  for each row execute function public.set_updated_at();

insert into public.service_offerings (
  code,
  display_label,
  customer_type,
  consent_key
)
values
  ('chiropractic', 'Chiropractor', 'paying', 'queue_join_consent_chiropractic'),
  ('priority_pass', 'Priority Pass', 'priority_pass', 'queue_join_consent_bodywork'),
  ('priority_pass_adjustments', 'Priority Pass + Adjustments', 'paying', 'queue_join_consent_bodywork'),
  ('massage_15', 'Massage: 15 minutes', 'paying', 'queue_join_consent_bodywork'),
  ('massage_20', 'Massage: 20 minutes', 'paying', 'queue_join_consent_bodywork'),
  ('massage_30', 'Massage: 30 minutes', 'paying', 'queue_join_consent_bodywork')
on conflict (code) do update
set display_label = excluded.display_label,
    customer_type = excluded.customer_type,
    consent_key = excluded.consent_key,
    is_active = true;

alter table public.service_offerings enable row level security;

create policy "Employees read service offerings"
  on public.service_offerings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_profiles ep
      where ep.user_id = (select auth.uid())
        and ep.is_open = true
    )
  );

grant select on public.service_offerings to authenticated;

alter table public.queue_entries
  add column if not exists offering_code text null
  references public.service_offerings(code);

update public.queue_entries qe
set offering_code = case lower(trim(coalesce(qe.service_label, '')))
  when 'paying' then 'chiropractic'
  when 'chiropractor' then 'chiropractic'
  when 'priority pass' then 'priority_pass'
  when 'priority pass + adjustments' then 'priority_pass_adjustments'
  when 'massage: 15 minutes' then 'massage_15'
  when 'massage: 20 minutes' then 'massage_20'
  when 'massage: 30 minutes' then 'massage_30'
  else null
end
where qe.offering_code is null;

create index if not exists idx_queue_entries_offering_code
  on public.queue_entries (offering_code);

alter table public.queue_entries_archive
  add column if not exists offering_code text null;

update public.queue_entries_archive qea
set offering_code = case lower(trim(coalesce(qea.service_label, '')))
  when 'paying' then 'chiropractic'
  when 'chiropractor' then 'chiropractic'
  when 'priority pass' then 'priority_pass'
  when 'priority pass + adjustments' then 'priority_pass_adjustments'
  when 'massage: 15 minutes' then 'massage_15'
  when 'massage: 20 minutes' then 'massage_20'
  when 'massage: 30 minutes' then 'massage_30'
  else null
end
where qea.offering_code is null;

create or replace view public.queue_entries_history
with (security_invoker = true)
as
select
  qe.id,
  qe.queue_id,
  q.location_id,
  l.timezone,
  (qe.created_at at time zone l.timezone)::date as local_date,
  qe.customer_id,
  qe.public_token,
  qe.customer_type,
  qe.status,
  qe.service_label,
  qe.created_at,
  qe.updated_at,
  qe.served_at,
  qe.completed_at,
  qe.cancelled_at,
  qe.no_show_at,
  qe.offering_code
from public.queue_entries qe
join public.queues q on q.id = qe.queue_id
join public.locations l on l.id = q.location_id
union all
select
  qea.id,
  qea.queue_id,
  qea.location_id,
  qea.timezone,
  qea.local_date,
  qea.customer_id,
  qea.public_token,
  qea.customer_type,
  qea.status,
  qea.service_label,
  qea.created_at,
  qea.updated_at,
  qea.served_at,
  qea.completed_at,
  qea.cancelled_at,
  qea.no_show_at,
  qea.offering_code
from public.queue_entries_archive qea;

create or replace function public.join_queue_with_offering(
  p_airport_code text,
  p_location_code text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_offering_code text
)
returns table (
  out_queue_entry_id uuid,
  out_public_token uuid,
  out_queue_id uuid,
  out_status queue_status,
  out_created_at timestamptz,
  out_queue_position integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_offering public.service_offerings%rowtype;
  v_consent_version_id uuid;
  v_join record;
  v_entry_customer_type public.customer_type;
  v_entry_service_label text;
  v_entry_offering_code text;
  v_location_display_name text;
  v_people_ahead integer;
  v_confirmation_body text;
begin
  select so.*
  into v_offering
  from public.service_offerings so
  where so.code = nullif(trim(p_offering_code), '')
    and so.is_active = true;

  if not found then
    raise exception 'Service offering is invalid or inactive';
  end if;

  select cv.id
  into v_consent_version_id
  from public.consent_versions cv
  where cv.key = v_offering.consent_key
    and cv.is_active = true
  order by cv.created_at desc
  limit 1;

  if v_consent_version_id is null then
    raise exception 'Required consent version is unavailable';
  end if;

  select jq.*
  into v_join
  from public.join_queue(
    p_airport_code,
    p_location_code,
    p_full_name,
    p_phone_e164,
    p_email,
    v_offering.customer_type,
    v_consent_version_id,
    v_offering.display_label
  ) jq;

  select qe.customer_type, qe.service_label, qe.offering_code
  into v_entry_customer_type, v_entry_service_label, v_entry_offering_code
  from public.queue_entries qe
  where qe.id = v_join.out_queue_entry_id
  for update;

  if v_entry_offering_code is null
    and v_entry_customer_type = v_offering.customer_type
    and (
      v_entry_service_label = v_offering.display_label
      or (
        v_offering.code = 'chiropractic'
        and lower(trim(coalesce(v_entry_service_label, ''))) = 'paying'
      )
    ) then
    update public.queue_entries qe
    set offering_code = v_offering.code
    where qe.id = v_join.out_queue_entry_id;
    v_entry_offering_code := v_offering.code;
  end if;

  insert into public.queue_events (
    queue_entry_id,
    actor_user_id,
    event_type,
    payload
  )
  select
    v_join.out_queue_entry_id,
    null,
    'joined',
    jsonb_build_object(
      'customer_type', v_entry_customer_type,
      'offering_code', v_entry_offering_code,
      'source', 'join_queue_with_offering'
    )
  where not exists (
    select 1
    from public.queue_events qe
    where qe.queue_entry_id = v_join.out_queue_entry_id
      and qe.event_type = 'joined'
  );

  select l.display_name
  into v_location_display_name
  from public.queues q
  join public.locations l on l.id = q.location_id
  where q.id = v_join.out_queue_id;

  if v_entry_customer_type = 'paying' then
    v_people_ahead := greatest(coalesce(v_join.out_queue_position, 1) - 1, 0);
    v_confirmation_body :=
      'Chiroport Msg: Hi ' || trim(p_full_name) ||
      '! You''ve joined the queue at The Chiroport at ' ||
      v_location_display_name || E'.\n\nThere ' ||
      case when v_people_ahead = 1 then 'is ' else 'are ' end ||
      v_people_ahead::text ||
      case when v_people_ahead = 1 then ' person' else ' people' end ||
      E' ahead of you. We will text you when you are next.\n\n' ||
      E'Change in plans? Text CANCEL to exit the queue. You may reply here to communicate with our staff.\n\n' ||
      'Wait times may vary.';
  else
    v_confirmation_body :=
      'Chiroport Msg: Hi ' || trim(p_full_name) ||
      '! You''ve joined the queue at The Chiroport at ' ||
      v_location_display_name || E'.\n\nWe''ll text you when it''s your turn to be served.\n\n' ||
      E'We recommend that you confirm The Chiroport is an included benefit in your Priority Pass travel program.\n\n' ||
      E'Change in plans? Reply here to reach our staff, or text CANCEL to exit the queue.\n\n' ||
      'Wait times may vary.';
  end if;

  insert into public.sms_outbox (
    queue_entry_id,
    message_type,
    to_phone,
    body,
    status,
    idempotency_key
  ) values (
    v_join.out_queue_entry_id,
    'confirm',
    trim(p_phone_e164),
    v_confirmation_body,
    'queued',
    'confirm:' || v_join.out_queue_entry_id::text
  )
  on conflict (queue_entry_id, message_type) do nothing;

  out_queue_entry_id := v_join.out_queue_entry_id;
  out_public_token := v_join.out_public_token;
  out_queue_id := v_join.out_queue_id;
  out_status := v_join.out_status;
  out_created_at := v_join.out_created_at;
  out_queue_position := v_join.out_queue_position;
  return next;
end;
$$;

revoke all on function public.join_queue_with_offering(
  text, text, text, text, text, text
) from public;
grant execute on function public.join_queue_with_offering(
  text, text, text, text, text, text
) to anon, authenticated, service_role;

commit;
