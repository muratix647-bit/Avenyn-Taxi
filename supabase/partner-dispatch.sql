alter table public.bookings add column if not exists assigned_partner_id uuid references public.taxi_partners(id);
create index if not exists bookings_assigned_partner_idx on public.bookings(assigned_partner_id) where assigned_partner_id is not null;
create or replace function public.admin_delegate_partner_booking(p_booking_id uuid,p_partner_id uuid,p_expected_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 if not found or b.archived_at is not null then raise exception 'Körningen finns inte'; end if;
 if b.updated_at is distinct from p_expected_updated_at then raise exception 'Körningen har ändrats. Uppdatera först.'; end if;
 if b.status not in ('new','scheduled','offered','assigned','accepted') then raise exception 'En påbörjad eller avslutad körning kan inte flyttas.'; end if;
 if p_partner_id is not null and not exists(select 1 from public.taxi_partners p join public.partner_applications a on a.id=p.application_id where p.id=p_partner_id and p.active and a.status='approved') then raise exception 'Åkeriet är inte aktivt och godkänt'; end if;
 update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=b.id and status='offered';
 update public.bookings set assigned_partner_id=p_partner_id,driver_id=null,vehicle_id=null,status=case when p_partner_id is null then 'new' else 'assigned' end,updated_at=now() where id=b.id;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(b.id,b.status,case when p_partner_id is null then 'new' else 'assigned' end,'Admin',case when p_partner_id is null then 'Återtagen från åkeri' else 'Tilldelad åkeri '||p_partner_id::text end);
 return b.id;
end $$;
revoke all on function public.admin_delegate_partner_booking(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_delegate_partner_booking(uuid,uuid,timestamptz) to service_role;
create or replace function public.partner_allocate_booking(p_partner_id uuid,p_booking_id uuid,p_driver_id uuid,p_vehicle_id uuid,p_expected_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.bookings; v public.vehicles;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 if not found or b.archived_at is not null or b.assigned_partner_id is distinct from p_partner_id then raise exception 'Körningen tillhör inte ditt åkeri'; end if;
 if not exists(select 1 from public.taxi_partners p join public.partner_applications a on a.id=p.application_id where p.id=p_partner_id and p.active and a.status='approved') then raise exception 'Åkeriet är inte godkänt'; end if;
 if b.updated_at is distinct from p_expected_updated_at then raise exception 'Körningen har ändrats. Uppdatera först.'; end if;
 if b.status not in ('new','scheduled','offered','assigned','accepted') then raise exception 'Körningen har påbörjats eller avslutats'; end if;
 -- Serialize vehicle/driver allocations to avoid two simultaneous assignments.
 perform pg_advisory_xact_lock(872031);
 perform 1 from public.drivers d join public.partner_drivers pd on pd.driver_id=d.id where d.id=p_driver_id and pd.partner_id=p_partner_id and d.active and d.approved and d.archived_at is null for update of d;
 if not found then raise exception 'Välj en aktiv, godkänd förare från ditt åkeri'; end if;
 select x.* into v from public.vehicles x join public.partner_vehicles pv on pv.vehicle_id=x.id where x.id=p_vehicle_id and pv.partner_id=p_partner_id and x.active for update of x;
 if not found then raise exception 'Välj en aktiv bil från ditt åkeri'; end if;
 if coalesce(v.passenger_capacity,4)<b.passengers then raise exception 'Bilen har för få passagerarplatser'; end if;
 if exists(select 1 from public.bookings other where other.id<>b.id and other.archived_at is null and (other.driver_id=p_driver_id or other.vehicle_id=p_vehicle_id) and (other.status in ('en_route','arrived','passenger_onboard') or (other.status in ('assigned','accepted','offered') and abs(extract(epoch from ((other.booking_date+other.pickup_time)-(b.booking_date+b.pickup_time))))<3600))) then raise exception 'Föraren eller bilen har en annan körning nära denna tid'; end if;
 update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=b.id and status='offered';
 update public.bookings set driver_id=p_driver_id,vehicle_id=p_vehicle_id,status='assigned',dispatched_at=coalesce(dispatched_at,now()),updated_at=now() where id=b.id;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(b.id,b.status,'assigned','Åkeri '||p_partner_id::text,'Åkeriet valde förare och bil');
 return b.id;
end $$;
revoke all on function public.partner_allocate_booking(uuid,uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.partner_allocate_booking(uuid,uuid,uuid,uuid,timestamptz) to service_role;
-- Explicit admin driver assignment takes control back from the partner.
do $$ declare definition text; begin
 select pg_get_functiondef('public.dispatch_assign_driver(uuid,uuid,text)'::regprocedure) into definition;
 definition:=replace(definition,'set driver_id=p_driver_id,status=', 'set assigned_partner_id=null,vehicle_id=null,driver_id=p_driver_id,status=');
 execute definition;
 -- Auto dispatch must never take a job away from its assigned partner.
 select pg_get_functiondef('public.dispatch_auto_assign(uuid,text)'::regprocedure) into definition;
 definition:=replace(definition,'if not found or exists(select 1 from public.booking_driver_offers', 'if v_booking.assigned_partner_id is not null then return v_booking; end if;'||chr(10)||' if not found or exists(select 1 from public.booking_driver_offers');
 execute definition;
end $$;
