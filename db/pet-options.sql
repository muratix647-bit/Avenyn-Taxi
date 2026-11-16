alter table public.drivers add column if not exists accepts_pets boolean not null default false;
alter table public.bookings add column if not exists pet_details jsonb;
create table if not exists public.pet_options(id text primary key check(id ~ '^[a-z0-9_-]{1,60}$'),label text not null check(length(label) between 1 and 80),archived_at timestamptz);
alter table public.pet_options enable row level security;
revoke all on public.pet_options from anon,authenticated;
grant all on public.pet_options to service_role;
insert into public.pet_options(id,label) values('dog','Hund'),('cat','Katt'),('other','Annat djur') on conflict(id) do nothing;
