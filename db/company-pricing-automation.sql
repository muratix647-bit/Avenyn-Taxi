alter table public.billing_companies add column contract_rates jsonb not null default '[]',add column auto_invoice_since timestamptz,add column invoice_sender_address text not null default 'Stora Kronogårdsgatan 92, 422 44 Hisings Backa';
create table public.billing_auto_invoice_jobs(booking_id uuid primary key references public.bookings(id),company_id uuid not null references public.billing_companies(id),invoice_id uuid not null unique default gen_random_uuid(),state text not null default 'processing' check(state in ('processing','done','review')),note text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index billing_auto_jobs_company on public.billing_auto_invoice_jobs(company_id);
alter table public.billing_auto_invoice_jobs enable row level security;
revoke all on public.billing_auto_invoice_jobs from public,anon,authenticated;
grant select,insert,update on public.billing_auto_invoice_jobs to service_role;
create function public.billing_auto_candidates() returns table(booking_id uuid,company_id uuid) language sql security invoker set search_path=public,pg_temp as $$
 select b.id,c.id from bookings b join billing_booking_links l on l.booking_id=b.id join billing_companies c on c.id=l.company_id
 where c.approved and c.auto_invoice_since is not null and b.created_at>=c.auto_invoice_since and b.status='completed' and b.archived_at is null
 and not exists(select 1 from billing_auto_invoice_jobs j where j.booking_id=b.id)
 and not exists(select 1 from dispatch_customer_invoices i where i.booking_id=b.id)
 and not exists(select 1 from dispatch_invoice_sms_plans p where p.booking_id=b.id)
 order by b.created_at limit 20 $$;
revoke all on function public.billing_auto_candidates() from public,anon,authenticated;
grant execute on function public.billing_auto_candidates() to service_role;
create function public.billing_set_trip_extras(p_booking_id uuid,p_company_id uuid,p_extras jsonb) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare b bookings; base numeric; extra numeric; cp jsonb;
begin
 select * into strict b from bookings where id=p_booking_id for update;
 if not exists(select 1 from billing_booking_links where booking_id=b.id and company_id=p_company_id) then raise exception 'Företagskoppling saknas'; end if;
 if b.status in ('completed','cancelled') or b.archived_at is not null or b.driver_reported_paid or b.payment_status in ('paid','succeeded','refunded') or exists(select 1 from dispatch_customer_invoices where booking_id=b.id) then raise exception 'Resan är låst'; end if;
 if jsonb_typeof(p_extras)<>'array' or jsonb_array_length(p_extras)>10 then raise exception 'Ogiltiga tillägg'; end if;
 if exists(select 1 from jsonb_array_elements(p_extras) e where nullif(trim(e->>'description'),'') is null or length(e->>'description')>100 or (e->>'amount') is null or (e->>'amount')::numeric<=0 or (e->>'amount')::numeric>100000) then raise exception 'Ogiltiga tillägg'; end if;
 cp:=coalesce(b.price_breakdown->'company_pricing','{}');base:=coalesce((cp->>'base')::numeric,b.fixed_price);
 if base is null or base<=0 then raise exception 'Fastpris saknas'; end if;
 select coalesce(sum((e->>'amount')::numeric),0) into extra from jsonb_array_elements(p_extras) e;
 update bookings set fixed_price=base+extra,estimated_price=base+extra,actual_price=case when actual_price is null then null else base+extra end,driver_reported_amount=case when driver_reported_amount is null then null else base+extra end,
 price_breakdown=coalesce(price_breakdown,'{}')||jsonb_build_object('company_pricing',cp||jsonb_build_object('base',base,'extras',p_extras,'company_id',p_company_id,'total',base+extra)) where id=b.id;
end $$;
revoke all on function public.billing_set_trip_extras(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.billing_set_trip_extras(uuid,uuid,jsonb) to service_role;
