begin;

update public.locations
set display_name = 'MSP · Massage Lounge on F'
where airport_code = 'MSP'
  and code = 'concourse-f';

commit;
