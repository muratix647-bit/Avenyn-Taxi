alter table public.driver_push_subscriptions
  add column if not exists provider text not null default 'webpush',
  add column if not exists device_token text,
  add column if not exists platform text;

alter table public.driver_push_subscriptions
  alter column endpoint drop not null,
  alter column p256dh drop not null,
  alter column auth drop not null;

alter table public.driver_push_subscriptions
  drop constraint if exists driver_push_subscriptions_provider_check;

alter table public.driver_push_subscriptions
  add constraint driver_push_subscriptions_provider_check check (
    (
      provider = 'webpush'
      and endpoint is not null
      and p256dh is not null
      and auth is not null
    )
    or
    (
      provider = 'fcm'
      and device_token is not null
      and platform in ('android', 'ios')
    )
  );

create unique index if not exists driver_push_subscriptions_device_token_idx
  on public.driver_push_subscriptions(device_token);

create index if not exists driver_push_subscriptions_provider_idx
  on public.driver_push_subscriptions(provider);

grant select, insert, update, delete
  on public.driver_push_subscriptions to authenticated;
