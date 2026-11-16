create table public.driver_action_log (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid references public.bookings(id) on delete cascade,
 actor_id uuid, driver_id uuid, action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.driver_action_log enable row level security;
revoke all on public.driver_action_log from anon,authenticated;
create index driver_action_log_booking_time on public.driver_action_log(booking_id,created_at);
create function public.audit_booking_driver_action() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status is distinct from old.status or new.driver_id is distinct from old.driver_id or new.driver_reported_at is distinct from old.driver_reported_at then
 insert into public.driver_action_log(booking_id,actor_id,driver_id,action,details) values(new.id,auth.uid(),coalesce(new.driver_id,old.driver_id),'saved',jsonb_build_object('from',old.status,'to',new.status,'previous_driver',old.driver_id,'driver',new.driver_id,'payment_updated',new.driver_reported_at is distinct from old.driver_reported_at));
 end if; return new;
end $$;
create trigger audit_driver_booking_update after update on public.bookings for each row execute function public.audit_booking_driver_action();
revoke all on function public.audit_booking_driver_action() from public;
create function public.driver_prebooking_pool() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from drivers where auth_user_id=auth.uid() and active and approved and archived_at is null) then raise exception 'Endast godkända förare'; end if;
 return coalesce((select jsonb_agg(x order by x.booking_date,x.pickup_time) from (
 select id,booking_number,booking_date,pickup_time,pickup_address,dropoff_address,passengers,car_type,child_seats,luggage_count,coalesce(fixed_price,estimated_price,0) price
 from bookings where driver_id is null and assigned_partner_id is null and archived_at is null and status in ('new','scheduled','confirmed') and ((booking_date+pickup_time) at time zone 'Europe/Stockholm')>now() order by booking_date,pickup_time limit 500
 ) x),'[]'::jsonb);
end $$;
create function public.driver_claim_prebooking(p_booking_id uuid) returns public.bookings language plpgsql security definer set search_path=public as $$
declare b bookings; d drivers; v vehicles;
begin
 select * into b from bookings where id=p_booking_id for update;
 select * into d from drivers where auth_user_id=auth.uid() and active and approved and archived_at is null for update;
 if d.id is null then raise exception 'Endast godkända förare'; end if;
 if b.driver_id=d.id and b.status='accepted' then return b; end if;
 if b.id is null or b.driver_id is not null or b.assigned_partner_id is not null or b.archived_at is not null or b.status not in ('new','scheduled','confirmed') or ((b.booking_date+b.pickup_time) at time zone 'Europe/Stockholm')<=now() then raise exception 'Förbokningen är inte längre ledig. Uppdatera listan.'; end if;
 select * into v from vehicles where driver_id=d.id and active and coalesce(passenger_capacity,4)>=greatest(coalesce(b.passengers,1),case when b.car_type='large' then 5 else 1 end) order by id limit 1 for update;
 if v.id is null then raise exception 'Du behöver en aktiv bil med tillräckligt många platser.'; end if;
 if exists(select 1 from bookings other where other.id<>b.id and other.archived_at is null and (other.driver_id=d.id or other.vehicle_id=v.id) and other.status in ('offered','assigned','accepted','en_route','arrived','passenger_onboard') and abs(extract(epoch from ((other.booking_date+other.pickup_time)-(b.booking_date+b.pickup_time))))<3600) then raise exception 'Du har redan en körning inom en timme från denna hämtning.'; end if;
 update bookings set driver_id=d.id,vehicle_id=v.id,status='accepted',confirmed_at=now(),dispatched_at=now(),updated_at=now() where id=b.id returning * into b;
 return b;
end $$;
revoke all on function public.driver_prebooking_pool(),public.driver_claim_prebooking(uuid) from public,anon;
grant execute on function public.driver_prebooking_pool(),public.driver_claim_prebooking(uuid) to authenticated;
