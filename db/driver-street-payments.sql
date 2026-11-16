create table public.driver_payments (
id uuid primary key,
driver_id uuid not null references public.drivers(id),
driver_name text not null,
amount_ore integer not null check(amount_ore between 300 and 1000000),
reference text not null default '' check(length(reference)<=120),
status text not null default 'creating' check(status in ('creating','pending','paid','expired')),
stripe_session_id text unique,
checkout_url text,
created_at timestamptz not null default now(),
paid_at timestamptz
);
alter table public.driver_payments enable row level security;
revoke all on public.driver_payments from anon, authenticated;
grant all on public.driver_payments to service_role;
create index driver_payments_driver_created on public.driver_payments(driver_id,created_at desc);
