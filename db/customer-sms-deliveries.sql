create table public.customer_sms_deliveries (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 kind text not null check(kind in ('pickup_reminder','flight_alert')),
 event_key text not null,
 state text not null check(state in ('sending','sent','failed')),
 provider_id text,error text,
 created_at timestamptz not null default now(),sent_at timestamptz,
 unique(booking_id,kind,event_key)
);
alter table public.customer_sms_deliveries enable row level security;
revoke all on public.customer_sms_deliveries from public,anon,authenticated;
grant select,insert,update on public.customer_sms_deliveries to service_role;
