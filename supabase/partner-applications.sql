create table public.partner_applications (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 company text not null,
 org_number text not null unique,
 contact_name text not null,
 email text not null,
 phone text not null,
 permit_number text not null,
 vehicle_count integer not null check (vehicle_count between 1 and 5000),
 area text not null,
 message text not null default '',
 status text not null default 'new' check (status in ('new','contacted','approved','rejected')),
 admin_note text not null default '',
 submission_hash text not null
);
create index partner_applications_created_idx on public.partner_applications (created_at desc);
create index partner_applications_rate_idx on public.partner_applications (submission_hash, created_at);
alter table public.partner_applications enable row level security;
revoke all on public.partner_applications from anon, authenticated;
grant select, insert, update, delete on public.partner_applications to service_role;
