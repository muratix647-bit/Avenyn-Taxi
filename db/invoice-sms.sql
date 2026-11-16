create table public.dispatch_invoice_sms_plans (
 booking_id uuid primary key references public.bookings(id), invoice_id uuid not null unique,
 payload jsonb not null, recipient text not null, actor uuid not null,
 state text not null default 'waiting' check(state in ('waiting','processing','review','done')),
 note text, updated_at timestamptz not null default now()
);
create table public.dispatch_invoice_sms_links (
 attempt uuid primary key, invoice_id uuid not null references public.dispatch_customer_invoices(id),
 token_hash text not null unique, recipient text not null, requested_by uuid not null,
 state text not null default 'pending' check(state in ('pending','accepted','rejected','unknown')),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 provider_id text
);
create index on public.dispatch_invoice_sms_links(invoice_id,created_at desc);
alter table public.dispatch_invoice_sms_plans enable row level security;
alter table public.dispatch_invoice_sms_links enable row level security;
revoke all on public.dispatch_invoice_sms_plans,public.dispatch_invoice_sms_links from public,anon,authenticated;
grant select,insert,update,delete on public.dispatch_invoice_sms_plans to service_role;
grant select,insert,update on public.dispatch_invoice_sms_links to service_role;
