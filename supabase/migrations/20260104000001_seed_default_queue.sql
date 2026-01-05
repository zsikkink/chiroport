begin;

insert into public.locations (airport_code, code, display_name, timezone)
select 'ATL', 'concourse-a', 'Concourse A', 'America/New_York'
where not exists (select 1 from public.locations);

insert into public.queues (location_id, code, name)
select locations.id, 'default', 'Main Queue'
from public.locations
where not exists (
  select 1
  from public.queues
  where queues.location_id = locations.id
    and queues.code = 'default'
);

commit;
