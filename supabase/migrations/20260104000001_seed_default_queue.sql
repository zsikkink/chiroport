begin;

with seed_locations as (
  select *
  from (
    values
      ('ATL', 'concourse-a', 'ATL Concourse A', 'America/New_York', '07:00', '19:00'),
      ('DFW', 'concourse-a', 'DFW Concourse A', 'America/Chicago', '07:00', '19:00'),
      ('HOU', 'west-concourse', 'HOU West Concourse', 'America/Chicago', '08:00', '18:00'),
      ('LAS', 'concourse-b', 'LAS Concourse B', 'America/Los_Angeles', '08:00', '18:00'),
      ('LAS', 'concourse-c', 'LAS Concourse C', 'America/Los_Angeles', '08:00', '18:00'),
      ('MSP', 'concourse-c', 'MSP Concourse C', 'America/Chicago', '07:00', '20:00'),
      ('MSP', 'concourse-f', 'MSP Concourse F', 'America/Chicago', '07:00', '19:00'),
      ('MSP', 'concourse-g', 'MSP Concourse G', 'America/Chicago', '07:00', '19:00')
  ) as seeded(airport_code, code, display_name, timezone, opens_at, closes_at)
)
insert into public.locations (airport_code, code, display_name, timezone)
select airport_code, code, display_name, timezone
from seed_locations
on conflict (airport_code, code)
do update set
  display_name = excluded.display_name,
  timezone = excluded.timezone,
  is_open = true;

insert into public.queues (location_id, code, name)
select locations.id, 'default', 'Main Queue'
from public.locations
on conflict (location_id, code)
do update set
  name = excluded.name,
  is_open = true;

with seed_locations as (
  select *
  from (
    values
      ('ATL', 'concourse-a', 'ATL Concourse A', 'America/New_York', '07:00', '19:00'),
      ('DFW', 'concourse-a', 'DFW Concourse A', 'America/Chicago', '07:00', '19:00'),
      ('HOU', 'west-concourse', 'HOU West Concourse', 'America/Chicago', '08:00', '18:00'),
      ('LAS', 'concourse-b', 'LAS Concourse B', 'America/Los_Angeles', '08:00', '18:00'),
      ('LAS', 'concourse-c', 'LAS Concourse C', 'America/Los_Angeles', '08:00', '18:00'),
      ('MSP', 'concourse-c', 'MSP Concourse C', 'America/Chicago', '07:00', '20:00'),
      ('MSP', 'concourse-f', 'MSP Concourse F', 'America/Chicago', '07:00', '19:00'),
      ('MSP', 'concourse-g', 'MSP Concourse G', 'America/Chicago', '07:00', '19:00')
  ) as seeded(airport_code, code, display_name, timezone, opens_at, closes_at)
),
location_map as (
  select
    locations.id as location_id,
    seed.opens_at::time as opens_at,
    seed.closes_at::time as closes_at
  from seed_locations seed
  join public.locations
    on locations.airport_code = seed.airport_code
   and locations.code = seed.code
)
insert into public.location_hours (location_id, day_of_week, opens_at, closes_at, is_closed)
select
  location_map.location_id,
  series.day_of_week,
  location_map.opens_at,
  location_map.closes_at,
  false
from location_map
cross join generate_series(0, 6) as series(day_of_week)
on conflict (location_id, day_of_week)
do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_closed = false;

commit;
