create table public.taxi_partners (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null unique references public.partner_applications(id),
 auth_user_id uuid unique references auth.users(id),
 company text not null,
 email text not null,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.partner_drivers (
 driver_id uuid primary key references public.drivers(id),
 partner_id uuid not null references public.taxi_partners(id),
 created_at timestamptz not null default now()
);
create table public.partner_vehicles (
 vehicle_id uuid primary key references public.vehicles(id),
 partner_id uuid not null references public.taxi_partners(id),
 created_at timestamptz not null default now()
);
create table public.partner_invite_links (
 code text primary key,
 partner_id uuid not null references public.taxi_partners(id),
 token_hash text not null,
 verification_type text not null check (verification_type in ('invite','magiclink')),
 expires_at timestamptz not null,
 claimed_at timestamptz
);
create index partner_drivers_partner_idx on public.partner_drivers(partner_id);
create index partner_vehicles_partner_idx on public.partner_vehicles(partner_id);
create index partner_invites_partner_idx on public.partner_invite_links(partner_id);
alter table public.taxi_partners enable row level security;
alter table public.partner_drivers enable row level security;
alter table public.partner_vehicles enable row level security;
alter table public.partner_invite_links enable row level security;
revoke all on public.taxi_partners,public.partner_drivers,public.partner_vehicles,public.partner_invite_links from anon,authenticated;
grant select,insert,update,delete on public.taxi_partners,public.partner_drivers,public.partner_vehicles,public.partner_invite_links to service_role;
