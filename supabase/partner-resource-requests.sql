create table public.partner_resource_requests (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references public.taxi_partners(id),
 kind text not null check (kind in ('driver','vehicle')),
 details jsonb not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 resource_id uuid,
 review_note text not null default '',
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create index partner_resource_requests_partner_idx on public.partner_resource_requests(partner_id,created_at desc);
create unique index partner_resource_requests_driver_pending_idx on public.partner_resource_requests(lower(details->>'email')) where kind='driver' and status='pending';
create unique index partner_resource_requests_vehicle_pending_idx on public.partner_resource_requests((details->>'registration_number')) where kind='vehicle' and status='pending';
alter table public.partner_resource_requests enable row level security;
revoke all on public.partner_resource_requests from anon,authenticated;
grant select,insert,update,delete on public.partner_resource_requests to service_role;

create function public.review_partner_resource(p_id uuid,p_approve boolean,p_note text default '') returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.partner_resource_requests%rowtype; new_id uuid;
begin
 select * into r from public.partner_resource_requests where id=p_id for update;
 if not found then raise exception 'Registreringen finns inte.'; end if;
 if r.status='approved' and p_approve then return r.resource_id; end if;
 if r.status<>'pending' then raise exception 'Registreringen är redan behandlad.'; end if;
 if not p_approve then
  update public.partner_resource_requests set status='rejected',review_note=left(p_note,1000),reviewed_at=now() where id=p_id;
  return null;
 end if;
 if not exists(select 1 from public.taxi_partners t join public.partner_applications a on a.id=t.application_id where t.id=r.partner_id and t.active and a.status='approved') then raise exception 'Åkeriet är inte aktivt och godkänt.'; end if;
 if r.kind='driver' then
  perform pg_advisory_xact_lock(hashtext('partner-driver:'||lower(r.details->>'email')));
  if exists(select 1 from public.drivers where lower(email)=lower(r.details->>'email') or taxi_driver_license_number=r.details->>'license_number') then raise exception 'Föraren finns redan registrerad. Kontrollera befintliga förare i Admin.'; end if;
  insert into public.drivers(full_name,email,phone,taxi_driver_license_number,approved,active,is_online,availability_status,status)
  values(r.details->>'full_name',r.details->>'email',r.details->>'phone',r.details->>'license_number',true,true,false,'offline','active') returning id into new_id;
  insert into public.partner_drivers(driver_id,partner_id) values(new_id,r.partner_id);
 else
  perform pg_advisory_xact_lock(hashtext('partner-vehicle:'||(r.details->>'registration_number')));
  if exists(select 1 from public.vehicles where upper(registration_number)=r.details->>'registration_number' or upper(reg)=r.details->>'registration_number') then raise exception 'Bilen finns redan registrerad. Kontrollera befintliga bilar i Admin.'; end if;
  insert into public.vehicles(name,vehicle_number,reg,registration_number,make,model,passenger_capacity,active,status)
  values(r.details->>'registration_number',r.details->>'registration_number',r.details->>'registration_number',r.details->>'registration_number',r.details->>'make',r.details->>'model',(r.details->>'passenger_capacity')::integer,true,'Aktiv') returning id into new_id;
  insert into public.partner_vehicles(vehicle_id,partner_id) values(new_id,r.partner_id);
 end if;
 update public.partner_resource_requests set status='approved',resource_id=new_id,review_note=left(p_note,1000),reviewed_at=now() where id=p_id;
 return new_id;
end;
$$;
revoke all on function public.review_partner_resource(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.review_partner_resource(uuid,boolean,text) to service_role;
