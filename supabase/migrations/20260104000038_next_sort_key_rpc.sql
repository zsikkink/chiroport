begin;

create or replace function public.next_sort_key(
  p_queue_id uuid,
  p_customer_type customer_type
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_max_sort_key bigint;
begin
  if p_queue_id is null or p_customer_type is null then
    raise exception 'queue_id and customer_type are required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_queue_id::text || ':' || p_customer_type::text));

  select qe.sort_key
  into v_max_sort_key
  from public.queue_entries qe
  where qe.queue_id = p_queue_id
    and qe.customer_type = p_customer_type
    and qe.status = 'waiting'
  order by qe.sort_key desc, qe.created_at desc
  limit 1
  for update;

  return coalesce(v_max_sort_key, 0) + 1;
end;
$$;

revoke execute on function public.next_sort_key(uuid, customer_type) from anon, authenticated;
grant execute on function public.next_sort_key(uuid, customer_type) to service_role;

commit;
