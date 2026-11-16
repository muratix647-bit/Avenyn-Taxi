create table public.dispatch_invoice_delivery (
 invoice_id uuid primary key references public.dispatch_customer_invoices(id),
 recipient text not null,
 state text not null check(state in ('pending','accepted','rejected')),
 attempt uuid not null unique,
 requested_by uuid not null,
 requested_at timestamptz not null default now(),
 accepted_at timestamptz,
 provider_id text
);
alter table public.dispatch_invoice_delivery enable row level security;
revoke all on public.dispatch_invoice_delivery from public,anon,authenticated;
grant select,insert,update on public.dispatch_invoice_delivery to service_role;
