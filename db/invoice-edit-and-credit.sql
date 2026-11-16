create table public.dispatch_invoice_drafts (
 id uuid primary key, revision integer not null default 1, payload jsonb not null,
 updated_at timestamptz not null default now(), updated_by uuid not null
);
create table public.dispatch_invoice_credits (
 invoice_id uuid primary key references public.dispatch_customer_invoices(id), credited_by uuid not null,
 credited_on date not null default ((now() at time zone 'Europe/Stockholm')::date)
);
alter table public.dispatch_invoice_drafts enable row level security;
alter table public.dispatch_invoice_credits enable row level security;
revoke all on public.dispatch_invoice_drafts,public.dispatch_invoice_credits from public,anon,authenticated;
grant select,insert,update,delete on public.dispatch_invoice_drafts to service_role;
grant select on public.dispatch_invoice_credits to service_role;
alter table public.dispatch_customer_invoices add column credited boolean not null default false;
alter table public.dispatch_customer_invoices drop constraint dispatch_customer_invoices_booking_id_key;
create unique index dispatch_active_booked_invoice on public.dispatch_customer_invoices(booking_id) where not credited;
create function public.dispatch_credit_invoice(p_id uuid,p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.dispatch_customer_invoices where id=p_id for update;
 if not found then raise exception 'Fakturan hittades inte';end if;
 if exists(select from public.dispatch_invoice_delivery where invoice_id=p_id and state='pending') then raise exception 'Ett utskick väntar på bekräftelse';end if;
 insert into public.dispatch_invoice_credits(invoice_id,credited_by) values(p_id,p_actor) on conflict do nothing;
 update public.dispatch_customer_invoices set credited=true where id=p_id and not credited;
end $$;
revoke all on function public.dispatch_credit_invoice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dispatch_credit_invoice(uuid,uuid) to service_role;
create function public.dispatch_block_credited_send() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='pending' and (select credited from public.dispatch_customer_invoices where id=new.invoice_id for share) then raise exception 'Fakturan är krediterad';end if;
 return new;
end $$;
create trigger dispatch_verify_original before insert or update on public.dispatch_invoice_delivery for each row execute function public.dispatch_block_credited_send();
create function public.dispatch_consume_invoice_draft() returns trigger language plpgsql set search_path='' as $$
begin
 if new.document ? 'draftRevision' then
   delete from public.dispatch_invoice_drafts where id=new.id and revision=(new.document->>'draftRevision')::integer;
   if not found then raise exception 'Utkastet har ändrats eller raderats' using errcode='40001';end if;
 end if;return new;
end $$;
create trigger dispatch_issue_saved_draft before insert on public.dispatch_customer_invoices for each row execute function public.dispatch_consume_invoice_draft();

revoke all on function public.dispatch_block_credited_send(),public.dispatch_consume_invoice_draft() from public,anon,authenticated;
