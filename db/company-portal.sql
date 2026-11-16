-- Server-only membership requests. Browser input never grants company access.
create table public.billing_company_access(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 requester_email text not null,
 org_key text not null,
 application jsonb not null,
 state text not null default 'pending' check(state in ('pending','approved','rejected')),
 company_id uuid references public.billing_companies(id),
 reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz not null default now(),
 unique(user_id,org_key),unique(user_id,company_id),
 check(state<>'approved' or company_id is not null)
);
create index billing_company_access_company_idx on public.billing_company_access(company_id);
alter table public.billing_company_access enable row level security;
revoke all on public.billing_company_access from public,anon,authenticated;
grant select,insert,update,delete on public.billing_company_access to service_role;
create function public.billing_approve_company_access(p_access_id uuid,p_admin uuid,p_company_id uuid,p_company jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare a billing_company_access; c uuid;
begin
 select * into strict a from billing_company_access where id=p_access_id for update;
 if p_company_id is null then
  select id into c from billing_companies where upper(regexp_replace(org_number,'[\s-]','','g'))=a.org_key;
  if c is not null then raise exception 'Välj befintligt företag'; end if;
  if upper(regexp_replace(p_company->>'org_number','[\s-]','','g'))<>a.org_key then raise exception 'Organisationsnummer stämmer inte'; end if;
  insert into billing_companies(name,org_number,invoice_email,billing_address,payment_days,reference_required,approved,created_by,updated_by)
  values(p_company->>'name',p_company->>'org_number',p_company->>'invoice_email',p_company->>'billing_address',(p_company->>'payment_days')::int,(p_company->>'reference_required')::boolean,true,p_admin,p_admin) returning id into c;
 else
  select id into strict c from billing_companies where id=p_company_id and approved and upper(regexp_replace(org_number,'[\s-]','','g'))=a.org_key for share;
 end if;
 update billing_company_access set state='approved',company_id=c,reviewed_by=p_admin,reviewed_at=now() where id=p_access_id;
end $$;
revoke all on function public.billing_approve_company_access(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.billing_approve_company_access(uuid,uuid,uuid,jsonb) to service_role;

create function public.billing_create_quoted_booking(p_quote_id uuid,p_booking jsonb,p_quote jsonb,p_policy_version text,p_user_id uuid,p_company_id uuid,p_reference text)
returns table(id uuid,booking_number bigint,status text,tracking_token uuid,price numeric,zone_name text)
language plpgsql security invoker set search_path=public,pg_temp as $$
declare c billing_companies; existing uuid; result record;
begin
 select bc.* into c from billing_companies bc join billing_company_access a on a.company_id=bc.id
 where bc.id=p_company_id and bc.approved and a.user_id=p_user_id and a.state='approved' for share of bc,a;
 if not found then raise exception 'Företagsbehörighet saknas'; end if;
 if length(p_reference)>160 or (c.reference_required and trim(coalesce(p_reference,''))='') then raise exception 'Kundreferens krävs'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_quote_id::text,31));
 select b.id into existing from bookings b where b.price_quote_id=p_quote_id;
 if existing is not null and not exists(select 1 from billing_booking_links l where l.booking_id=existing and l.company_id=p_company_id and l.updated_by=p_user_id) then raise exception 'Prisförslaget har redan använts'; end if;
 select * into result from customer_create_quoted_booking(p_quote_id,p_booking||jsonb_build_object('paymentMethod','Faktura'),p_quote,p_policy_version);
 insert into billing_booking_links(booking_id,company_id,reference,updated_by) values(result.id,p_company_id,coalesce(p_reference,''),p_user_id) on conflict(booking_id) do nothing;
 return query select result.id::uuid,result.booking_number::bigint,result.status::text,result.tracking_token::uuid,result.price::numeric,result.zone_name::text;
end $$;
revoke all on function public.billing_create_quoted_booking(uuid,jsonb,jsonb,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.billing_create_quoted_booking(uuid,jsonb,jsonb,text,uuid,uuid,text) to service_role;
