begin;

drop policy if exists "Admins delete employee profiles" on public.employee_profiles;
drop policy if exists "Admins insert employee profiles" on public.employee_profiles;
drop policy if exists "Admins update employee profiles" on public.employee_profiles;
drop policy if exists "Employee profiles read" on public.employee_profiles;
drop policy if exists "Employees read own profile" on public.employee_profiles;
drop policy if exists "Employees read employee profiles" on public.employee_profiles;

grant select on public.employee_profiles to authenticated;

create policy "Employee profiles read"
  on public.employee_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

commit;
