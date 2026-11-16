alter table public.vehicles add column if not exists vehicle_number text;
alter table public.vehicles add column if not exists registration_number text;
alter table public.vehicles add column if not exists make text;
alter table public.vehicles add column if not exists model text;
alter table public.vehicles add column if not exists color text;
alter table public.vehicles add column if not exists passenger_capacity integer not null default 4 check (passenger_capacity between 1 and 9);
alter table public.vehicles add column if not exists vehicle_class text not null default 'Standard';
alter table public.vehicles add column if not exists active boolean not null default true;
alter table public.vehicles add column if not exists updated_at timestamptz not null default now();

update public.vehicles
set vehicle_number=coalesce(vehicle_number,name),
    registration_number=coalesce(registration_number,reg),
    active=case when lower(status)='inaktiv' then false else active end,
    updated_at=now()
where vehicle_number is null or registration_number is null;

create unique index if not exists vehicles_registration_number_uidx
on public.vehicles(upper(registration_number))
where registration_number is not null;
