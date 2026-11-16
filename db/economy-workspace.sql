-- Isolated admin workspace. No change to existing trips or payroll tables.
create table public.economy_payroll (
 id uuid primary key,
 driver_id uuid not null references public.drivers(id),
 employee_name text not null,
 period text not null check (period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 payment_date date not null,
 details jsonb not null check (jsonb_typeof(details)='object'),
 status text not null default 'draft' check (status in ('draft','approved','paid')),
 revision integer not null default 1,
 created_by uuid not null,
 updated_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 approved_at timestamptz,
 paid_at timestamptz,
 archived_at timestamptz,
 unique(driver_id,period)
);
create table public.economy_receipts (
 id uuid primary key,
 expense_date date not null,
 supplier text not null,
 category text not null,
 amount_ore bigint not null check(amount_ore>0 and amount_ore<=100000000),
 vat_ore bigint not null check(vat_ore>=0 and vat_ore<=amount_ore),
 deductible_vat_ore bigint not null check(deductible_vat_ore>=0 and deductible_vat_ore<=vat_ore),
 note text not null default '',
 file_path text not null unique,
 file_name text not null,
 mime_type text not null,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 archived_at timestamptz
);
create table public.economy_audit (
 id bigint generated always as identity primary key,
 payroll_id uuid not null references public.economy_payroll(id),
 actor_id uuid not null,
 action text not null,
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index economy_payroll_payment_date_idx on public.economy_payroll(payment_date);
create index economy_receipts_date_idx on public.economy_receipts(expense_date);
create index economy_audit_payroll_idx on public.economy_audit(payroll_id);
alter table public.economy_payroll enable row level security;
alter table public.economy_receipts enable row level security;
alter table public.economy_audit enable row level security;
revoke all on public.economy_payroll, public.economy_receipts, public.economy_audit from public, anon, authenticated;
grant all on public.economy_payroll, public.economy_receipts, public.economy_audit to service_role;
grant usage, select on sequence public.economy_audit_id_seq to service_role;
create function public.economy_record_payroll_change() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.economy_audit(payroll_id,actor_id,action,snapshot)
 values(new.id,new.updated_by,case when TG_OP='INSERT' then 'created' else new.status end,to_jsonb(new));
 return new;
end;
$$;
revoke all on function public.economy_record_payroll_change() from public, anon, authenticated;
create trigger economy_payroll_audit after insert or update on public.economy_payroll for each row execute function public.economy_record_payroll_change();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('economy-receipts','economy-receipts',false,10485760,array['image/jpeg','image/png','application/pdf']);
-- No browser role policies: upload and download require admin-authorized server routes.
