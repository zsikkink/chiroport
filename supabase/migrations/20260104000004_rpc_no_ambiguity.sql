begin;

drop function if exists public.join_queue(
  text, text, text, text, text, customer_type, uuid
);

drop function if exists public.cancel_visit(uuid);

-- All table references must be aliased; OUT params use out_ prefix to avoid collisions.
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
  from public.consent_versions cv
  where cv.id = p_consent_version_id
    and cv.is_active = true
    and cv.key in ('queue_join_consent_bodywork', 'queue_join_consent_chiropractic', 'queue_join_consent');

  if not found then
    raise exception 'Consent version is invalid or inactive';
  end if;

  select l.id
  into v_location_id
  from public.locations l
  where l.airport_code = p_airport_code
    and l.code = p_location_code
    and l.is_open = true
  limit 1;

  if v_location_id is null then
    raise exception 'Location not found or closed';
  end if;

  select q.id
  into v_queue_id
  from public.queues q
  where q.location_id = v_location_id
    and q.code = 'default'
    and q.is_open = true
  limit 1;

  if v_queue_id is null then
    raise exception 'Queue not available';
  end if;

  insert into public.customers as c (full_name, phone_e164, email)
  values (
    nullif(trim(p_full_name), ''),
    trim(p_phone_e164),
    nullif(lower(trim(p_email)), '')
  )
  on conflict (phone_e164) do update
    set full_name = excluded.full_name,
        email = excluded.email
  returning c.id into v_customer_id;

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

  select ordered.position
  into v_position
  from (
    select qe.id,
           row_number() over (
             order by case qe.customer_type when 'paying' then 0 else 1 end,
                      qe.created_at asc
           ) as position
    from public.queue_entries qe
    where qe.queue_id = v_queue_id
      and qe.status = 'waiting'
  ) ordered
  where ordered.id = v_entry_id;

  out_queue_entry_id := v_entry_id;
  out_public_token := v_public_token;
  out_queue_id := v_queue_id;
  out_status := v_status;
  out_created_at := v_created_at;
  out_queue_position := v_position;

  return next;
end;
$$;

comment on function public.join_queue(
  text, text, text, text, text, customer_type, uuid
) is 'All table references must be aliased; OUT params use out_ prefix to avoid collisions.';

-- All table references must be aliased; OUT params use out_ prefix to avoid collisions.
create or replace function public.cancel_visit(p_public_token uuid)
returns table (
  out_queue_entry_id uuid,
  out_status queue_status,
  out_cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry_id uuid;
  v_status queue_status;
  v_cancelled_at timestamptz;
begin
  if p_public_token is null then
    raise exception 'Public token is required';
  end if;

  update public.queue_entries as qe
  set status = 'cancelled',
      cancelled_at = now()
  where qe.public_token = p_public_token
    and qe.status = 'waiting'
  returning qe.id, qe.status, qe.cancelled_at
  into v_entry_id, v_status, v_cancelled_at;

  if v_entry_id is null then
    raise exception 'Queue entry not found or not cancellable';
  end if;

  out_queue_entry_id := v_entry_id;
  out_status := v_status;
  out_cancelled_at := v_cancelled_at;

  return next;
end;
$$;

comment on function public.cancel_visit(uuid) is
  'All table references must be aliased; OUT params use out_ prefix to avoid collisions.';

grant execute on function public.join_queue(
  text, text, text, text, text, customer_type, uuid
) to anon, authenticated;

grant execute on function public.cancel_visit(uuid) to anon, authenticated;

commit;
