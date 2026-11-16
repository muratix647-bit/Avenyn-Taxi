create table public.dispatch_customer_invoices (
  id uuid primary key,
  serial_no bigint generated always as identity unique,
  issued_on date not null default ((now() at time zone 'Europe/Stockholm')::date),
  booking_id uuid unique references public.bookings(id),
  document jsonb not null check(jsonb_typeof(document)='object'),
  gross_ore bigint not null check(gross_ore between 1 and 100000000),
  vat_ore bigint not null check(vat_ore between 0 and gross_ore),
  created_by uuid not null
);
alter table public.dispatch_customer_invoices enable row level security;
revoke all on public.dispatch_customer_invoices from public, anon, authenticated, service_role;
grant select,insert on public.dispatch_customer_invoices to service_role;
grant usage on sequence public.dispatch_customer_invoices_serial_no_seq to service_role;

create function public.dispatch_invoice_guard() returns trigger
language plpgsql set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  if new.booking_id is null then return new; end if;
  select * into strict b from public.bookings where id=new.booking_id for update;
  if b.status is distinct from 'completed' or b.archived_at is not null
     or b.driver_reported_paid is true or coalesce(b.payment_status,'') in ('paid','succeeded')
     or lower(trim(coalesce(nullif(b.driver_reported_payment_method,''),b.payment_method,''))) not in ('invoice','faktura')
     or round(100*coalesce(b.driver_reported_amount,b.actual_price,b.fixed_price)) is distinct from new.gross_ore
     or b.booking_date::text is distinct from (new.document->>'serviceDate') then
    raise exception 'Resans underlag har ändrats' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.dispatch_invoice_guard() from public, anon,authenticated;
create trigger dispatch_invoice_check_booking before insert on public.dispatch_customer_invoices
for each row execute function public.dispatch_invoice_guard();
