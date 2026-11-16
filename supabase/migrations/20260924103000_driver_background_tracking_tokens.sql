create table if not exists public.driver_tracking_tokens (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  revoked_at timestamptz
);

comment on table public.driver_tracking_tokens is
  'Server-only device tokens for the native driver background-location service.';

alter table public.driver_tracking_tokens enable row level security;

revoke all on table public.driver_tracking_tokens from anon, authenticated;

create index if not exists driver_tracking_tokens_active_hash_idx
  on public.driver_tracking_tokens (token_hash)
  where revoked_at is null;
