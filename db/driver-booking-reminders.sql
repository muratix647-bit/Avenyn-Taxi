-- Service-only delivery ledger. One reminder per assigned driver, pickup time and stage.
create table if not exists public.driver_booking_reminders (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 driver_id uuid not null references public.drivers(id) on delete cascade,
 pickup_at timestamptz not null,
 stage integer not null check (stage in (30,15)),
 state text not null check (state in ('sending','sent','failed','cancelled')),
 sent_count integer not null default 0,
 error text,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 unique(booking_id,driver_id,pickup_at,stage)
);
alter table public.driver_booking_reminders enable row level security;
revoke all on public.driver_booking_reminders from public,anon,authenticated;
grant select,insert,update,delete on public.driver_booking_reminders to service_role;
