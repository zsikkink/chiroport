begin;

-- Keep existing visits and reporting history, but stop new check-ins.
update public.queues q
set is_open = false
from public.locations l
where q.location_id = l.id
  and (
    (l.airport_code = 'ATL' and l.code = 'concourse-a')
    or (l.airport_code = 'LAS' and l.code = 'concourse-b')
  );

-- The employee dashboard lists open locations only. Do not hide active visits.
do $$
begin
  if exists (
    select 1
    from public.queue_entries qe
    join public.queues q on q.id = qe.queue_id
    join public.locations l on l.id = q.location_id
    where qe.status in ('waiting', 'serving')
      and (
        (l.airport_code = 'ATL' and l.code = 'concourse-a')
        or (l.airport_code = 'LAS' and l.code = 'concourse-b')
      )
  ) then
    raise exception 'Cannot close ATL Concourse A or LAS Concourse B with active visits';
  end if;
end;
$$;

update public.locations
set is_open = false
where (airport_code = 'ATL' and code = 'concourse-a')
   or (airport_code = 'LAS' and code = 'concourse-b');

commit;
