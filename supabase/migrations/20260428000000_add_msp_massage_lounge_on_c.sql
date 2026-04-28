begin;

insert into public.locations (airport_code, code, display_name, timezone)
values ('MSP', 'massage-lounge-on-c', 'MSP · Massage Lounge on C', 'America/Chicago')
on conflict (airport_code, code)
do update set
  display_name = excluded.display_name,
  timezone = excluded.timezone,
  is_open = true;

insert into public.queues (location_id, code, name)
select locations.id, 'default', 'Main Queue'
from public.locations
where locations.airport_code = 'MSP'
  and locations.code = 'massage-lounge-on-c'
on conflict (location_id, code)
do update set
  name = excluded.name,
  is_open = true;

insert into public.location_hours (location_id, day_of_week, opens_at, closes_at, is_closed)
select
  locations.id,
  series.day_of_week,
  '07:00'::time,
  '20:00'::time,
  false
from public.locations
cross join generate_series(0, 6) as series(day_of_week)
where locations.airport_code = 'MSP'
  and locations.code = 'massage-lounge-on-c'
on conflict (location_id, day_of_week)
do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_closed = false;

commit;
