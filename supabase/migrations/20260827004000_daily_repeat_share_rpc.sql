begin;

create or replace function public.get_admin_daily_repeat_share(
  p_location_id uuid default null,
  p_date_start date default null,
  p_date_end date default null
)
returns table (
  local_date date,
  arrivals_total bigint,
  repeat_total bigint,
  classified_total bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with filtered as (
    select qeh.*
    from public.queue_entries_history qeh
    where (p_location_id is null or qeh.location_id = p_location_id)
      and (
        p_location_id is not null
        or exists (
          select 1
          from public.locations l
          where l.id = qeh.location_id
            and l.is_open = true
        )
      )
      and (p_date_start is null or qeh.local_date >= p_date_start)
      and (p_date_end is null or qeh.local_date <= p_date_end)
      and qeh.status in ('completed', 'cancelled', 'no_show')
  ),
  filtered_with_phone as (
    select
      f.id as queue_entry_id,
      f.local_date,
      coalesce(ccs.phone_e164, c.phone_e164) as phone_e164
    from filtered f
    left join public.queue_entries_legal_archive qela
      on qela.queue_entry_id = f.id
    left join public.customer_contact_snapshots ccs
      on ccs.id = qela.contact_snapshot_id
    left join public.customers c
      on c.id = f.customer_id
  ),
  filtered_phones as (
    select distinct fwp.phone_e164
    from filtered_with_phone fwp
    where fwp.phone_e164 is not null
  ),
  repeat_history as (
    select
      qela.queue_entry_id,
      ccs.phone_e164,
      qela.queue_entry_created_at as created_at
    from public.queue_entries_legal_archive qela
    join public.customer_contact_snapshots ccs
      on ccs.id = qela.contact_snapshot_id
    join filtered_phones fp on fp.phone_e164 = ccs.phone_e164

    union all

    select
      qeh.id,
      c.phone_e164,
      qeh.created_at
    from public.queue_entries_history qeh
    join public.customers c on c.id = qeh.customer_id
    join filtered_phones fp on fp.phone_e164 = c.phone_e164
    where not exists (
      select 1
      from public.queue_entries_legal_archive qela
      where qela.queue_entry_id = qeh.id
    )
  ),
  repeat_ranked as (
    select
      rh.queue_entry_id,
      row_number() over (
        partition by rh.phone_e164
        order by rh.created_at asc, rh.queue_entry_id asc
      ) as visit_number
    from repeat_history rh
  ),
  classified as (
    select
      fwp.local_date,
      case
        when rr.visit_number is null then null
        when rr.visit_number = 1 then false
        else true
      end as is_repeat
    from filtered_with_phone fwp
    left join repeat_ranked rr on rr.queue_entry_id = fwp.queue_entry_id
  )
  select
    c.local_date,
    count(*) as arrivals_total,
    count(*) filter (where c.is_repeat = true) as repeat_total,
    count(*) filter (where c.is_repeat is not null) as classified_total
  from classified c
  group by c.local_date
  order by c.local_date;
$$;

revoke all on function public.get_admin_daily_repeat_share(
  uuid, date, date
) from public, anon, authenticated;
grant execute on function public.get_admin_daily_repeat_share(
  uuid, date, date
) to service_role;

commit;
