create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount_sek numeric(10,2) not null check (amount_sek > 0),
  source text not null default 'customer' check (source in ('customer','driver','dispatch')),
  status text not null default 'creating' check (status in ('creating','pending','paid','expired','cancelled','refunded','failed')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_requests enable row level security;
revoke all on table public.payment_requests from anon, authenticated;
create index if not exists payment_requests_booking_id_idx on public.payment_requests(booking_id, created_at desc);
