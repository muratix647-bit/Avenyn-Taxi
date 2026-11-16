create table if not exists public.booking_prebooking_alerts (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 pickup_at timestamptz not null,
 stage integer not null check(stage in (15,30,60)),
 state text not null check(state in ('sending','sent','failed','cancelled')),
 created_at timestamptz not null default now(),
 sent_at timestamptz, provider_id text, error text,
 unique(booking_id,pickup_at,stage)
);
alter table public.booking_prebooking_alerts enable row level security;
revoke all on public.booking_prebooking_alerts from anon,authenticated;
grant all on public.booking_prebooking_alerts to service_role;
