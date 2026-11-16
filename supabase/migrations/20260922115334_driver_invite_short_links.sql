create table if not exists public.driver_invite_links (
  code text primary key,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  token_hash text not null,
  verification_type text not null check (verification_type in ('invite', 'recovery')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint driver_invite_links_code_format check (code ~ '^[A-Za-z0-9_-]{20,32}$')
);

alter table public.driver_invite_links enable row level security;

revoke all on table public.driver_invite_links from anon, authenticated;

create index if not exists driver_invite_links_expires_at_idx
  on public.driver_invite_links (expires_at);

comment on table public.driver_invite_links is
  'Server-only temporary lookup for branded driver password links sent by SMS or email.';
