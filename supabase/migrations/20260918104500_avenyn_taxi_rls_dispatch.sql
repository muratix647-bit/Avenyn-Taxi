-- Harden the existing taxi tables around Supabase Auth roles.

drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_dispatch_all on public.bookings for all to authenticated using(public.is_dispatch_admin()) with check(public.is_dispatch_admin());
drop policy if exists drivers_admin_all on public.drivers;
create policy drivers_dispatch_all on public.drivers for all to authenticated using(public.is_dispatch_admin()) with check(public.is_dispatch_admin());
drop policy if exists vehicles_admin_all on public.vehicles;
create policy vehicles_dispatch_all on public.vehicles for all to authenticated using(public.is_dispatch_admin()) with check(public.is_dispatch_admin());
drop policy if exists booking_status_history_admin_all on public.booking_status_history;
create policy booking_status_history_dispatch_all on public.booking_status_history for all to authenticated using(public.is_dispatch_admin()) with check(public.is_dispatch_admin());

drop policy if exists driver_locations_dispatch_read on public.driver_locations;
drop policy if exists driver_locations_driver_read on public.driver_locations;
create policy driver_locations_dispatch_read on public.driver_locations for select to authenticated using(public.is_dispatch_admin());
create policy driver_locations_driver_read on public.driver_locations for select to authenticated using(driver_id=(select public.my_driver_id()));

drop policy if exists booking_offers_dispatch_all on public.booking_driver_offers;
drop policy if exists booking_offers_driver_read on public.booking_driver_offers;
create policy booking_offers_dispatch_all on public.booking_driver_offers for all to authenticated using(public.is_dispatch_admin()) with check(public.is_dispatch_admin());
create policy booking_offers_driver_read on public.booking_driver_offers for select to authenticated using(driver_id=(select public.my_driver_id()));

create or replace function public.public_online_drivers()
returns table(latitude double precision,longitude double precision,heading double precision,updated_at timestamptz)
language sql security definer set search_path=public as $$
 select round(l.latitude::numeric,2)::double precision,round(l.longitude::numeric,2)::double precision,l.heading,l.updated_at
 from public.driver_locations l join public.drivers d on d.id=l.driver_id
 where d.active and d.approved and d.is_online and d.archived_at is null and l.updated_at>now()-interval '5 minutes'
$$;

create or replace function public.dispatch_assign_driver(p_booking_id uuid,p_driver_id uuid,p_changed_by text default 'dispatch')
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_booking public.bookings; v_old text;
begin
 if not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
 select status into v_old from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Bokningen hittades inte'; end if;
 if not exists(select 1 from public.drivers where id=p_driver_id and active and approved and archived_at is null) then raise exception 'Föraren är inte tillgänglig'; end if;
 update public.bookings set driver_id=p_driver_id,status='assigned',dispatched_at=coalesce(dispatched_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(p_booking_id,v_old,'assigned',p_changed_by,'Förare tilldelad manuellt'); return v_booking;
end $$;

create or replace function public.dispatch_set_booking_status(p_booking_id uuid,p_status text,p_changed_by text default 'dispatch',p_note text default null)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_booking public.bookings; v_old text;
begin
 if not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
 if p_status not in ('new','scheduled','offered','assigned','accepted','en_route','arrived','passenger_onboard','completed','cancelled') then raise exception 'Ogiltig status'; end if;
 select status into v_old from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Bokningen hittades inte'; end if;
 update public.bookings set status=p_status,completed_at=case when p_status='completed' then coalesce(completed_at,now()) else completed_at end,cancelled_at=case when p_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end,updated_at=now() where id=p_booking_id returning * into v_booking;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(p_booking_id,v_old,p_status,p_changed_by,p_note); return v_booking;
end $$;

create or replace function public.dispatch_archive_booking(p_booking_id uuid,p_restore boolean default false)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_booking public.bookings;
begin
 if not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
 update public.bookings set archived_at=case when p_restore then null else now() end,archived_by=case when p_restore then null else coalesce((select email from auth.users where id=(select auth.uid())), 'dispatch') end,updated_at=now() where id=p_booking_id returning * into v_booking; return v_booking;
end $$;

revoke all on function public.public_online_drivers() from public;
grant execute on function public.public_online_drivers() to anon,authenticated;
revoke all on function public.dispatch_assign_driver(uuid,uuid,text) from public;
grant execute on function public.dispatch_assign_driver(uuid,uuid,text) to authenticated;
revoke all on function public.dispatch_set_booking_status(uuid,text,text,text) from public;
grant execute on function public.dispatch_set_booking_status(uuid,text,text,text) to authenticated;
revoke all on function public.dispatch_archive_booking(uuid,boolean) from public;
grant execute on function public.dispatch_archive_booking(uuid,boolean) to authenticated;
revoke all on function public.is_dispatch_admin() from anon;
grant execute on function public.is_dispatch_admin() to authenticated;
