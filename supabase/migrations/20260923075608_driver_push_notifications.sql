create table if not exists public.driver_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_push_subscriptions_driver_idx
  on public.driver_push_subscriptions(driver_id);
create index if not exists driver_push_subscriptions_user_idx
  on public.driver_push_subscriptions(user_id);

alter table public.driver_push_subscriptions enable row level security;

create policy "drivers_read_own_push_subscriptions"
  on public.driver_push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "drivers_insert_own_push_subscriptions"
  on public.driver_push_subscriptions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.auth_user_id = (select auth.uid())
    )
  );

create policy "drivers_update_own_push_subscriptions"
  on public.driver_push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.auth_user_id = (select auth.uid())
    )
  );

create policy "drivers_delete_own_push_subscriptions"
  on public.driver_push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.driver_push_subscriptions to authenticated;
revoke all on public.driver_push_subscriptions from anon;
