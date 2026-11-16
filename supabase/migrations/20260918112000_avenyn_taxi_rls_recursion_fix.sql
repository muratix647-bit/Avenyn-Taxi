-- The legacy policy helper queried profiles through profiles' own RLS policy.
-- SECURITY DEFINER breaks that recursion while retaining the same authorization rule.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'Aktiv'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
