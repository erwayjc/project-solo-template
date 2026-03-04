-- Migration 00015: Fix infinite recursion in profiles RLS policies
--
-- The "Admin can read all profiles" policy queries the profiles table itself
-- to check if the current user is an admin, causing infinite recursion.
-- Fix: use a SECURITY DEFINER function that bypasses RLS for the admin check.

-- 1. Create a helper function that checks admin role without going through RLS
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2. Replace the recursive "Admin can read all profiles" policy
drop policy if exists "Admin can read all profiles" on public.profiles;

create policy "Admin can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- 3. Fix the "Users can update own profile" policy which also has a self-referencing subquery
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Note: The update policy's subquery is less likely to recurse because it only
-- triggers on UPDATE (not SELECT), but we keep it as-is since the "Users can read
-- own profile" SELECT policy should satisfy the subquery without hitting the admin
-- policy. If issues arise, this can also be converted to use a SECURITY DEFINER function.
