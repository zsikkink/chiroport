begin;

-- Avoid recursive RLS by using SECURITY DEFINER role checks.
create or replace function public.is_employee()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.employee_profiles ep
    where ep.user_id = auth.uid()
      and ep.is_open = true
      and ep.role in ('employee', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.employee_profiles ep
    where ep.user_id = auth.uid()
      and ep.is_open = true
      and ep.role = 'admin'
  );
$$;

grant execute on function public.is_employee() to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Staff read employee profiles" on public.employee_profiles;
drop policy if exists "Admins insert employee profiles" on public.employee_profiles;
drop policy if exists "Admins update employee profiles" on public.employee_profiles;
drop policy if exists "Admins delete employee profiles" on public.employee_profiles;
drop policy if exists "Admins manage employee profiles" on public.employee_profiles;

create policy "Employees read own profile"
  on public.employee_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins manage employee profiles"
  on public.employee_profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
