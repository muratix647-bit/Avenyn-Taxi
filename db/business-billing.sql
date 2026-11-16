-- Phase 1: admin-managed customers and live preparation, not issued invoices.
create table public.billing_companies (
 id uuid primary key default gen_random_uuid(), name text not null,
 org_number text not null unique, invoice_email text not null, billing_address text not null,
 payment_days integer not null default 30 check(payment_days between 1 and 90),
 reference_required boolean not null default false, approved boolean not null default false,
 created_by uuid not null, updated_by uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.billing_booking_links (
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 company_id uuid not null references public.billing_companies(id) on delete restrict,
 reference text not null default '', updated_by uuid not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index billing_booking_links_company_idx on public.billing_booking_links(company_id);
alter table public.billing_companies enable row level security;
alter table public.billing_booking_links enable row level security;
revoke all on public.billing_companies, public.billing_booking_links from public,anon,authenticated;
grant select,insert,update on public.billing_companies, public.billing_booking_links to service_role;
comment on table public.billing_companies is 'Server-only access after active dispatch-admin authorization.';
comment on table public.billing_booking_links is 'One customer per booking. Preparation only; no invoices issued or sent.';
