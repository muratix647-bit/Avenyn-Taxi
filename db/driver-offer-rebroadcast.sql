-- Three-minute response window; existing cron runs every ten seconds.
create or replace function public.dispatch_release_to_all(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare b public.bookings; old_status text;
begin
 if auth.uid() is null or not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Bokningen hittades inte'; end if;
 if b.archived_at is not null or b.status not in ('new','scheduled','confirmed','offered','assigned') then raise exception 'Körningen är redan accepterad eller avslutad. Den släpps inte automatiskt.'; end if;
 old_status:=b.status;
 update public.bookings set driver_id=null,vehicle_id=null,assigned_partner_id=null,status='new',dispatched_at=null,updated_at=now(),price_breakdown=coalesce(price_breakdown,'{}'::jsonb)||jsonb_build_object('broadcast_reopened_at',clock_timestamp()) where id=b.id returning * into b;
 update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=b.id and status='offered';
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(b.id,old_status,'new',auth.uid()::text,'Trafikledningen släppte körningen till alla förare igen');
 insert into public.driver_action_log(booking_id,actor_id,action,details) values(b.id,auth.uid(),'broadcast_reopened',jsonb_build_object('note','Släppt till alla förare av trafikledningen'));
 return b;
end $$;
revoke all on function public.dispatch_release_to_all(uuid) from public,anon;
grant execute on function public.dispatch_release_to_all(uuid) to authenticated;

create or replace function public.process_expired_driver_offers()
returns void language plpgsql security definer set search_path=public as $$
declare b public.bookings;
begin
 for b in select * from public.bookings where archived_at is null and assigned_partner_id is null and driver_id is not null and status in ('new','scheduled','confirmed','offered','assigned') and coalesce(dispatched_at,updated_at,created_at)<=now()-interval '3 minutes' order by dispatched_at nulls first limit 200 for update skip locked loop
  update public.bookings set driver_id=null,vehicle_id=null,status='new',dispatched_at=null,updated_at=now(),price_breakdown=coalesce(price_breakdown,'{}'::jsonb)||jsonb_build_object('broadcast_reopened_at',clock_timestamp()) where id=b.id;
  update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=b.id and status='offered';
  insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(b.id,b.status,'new','offer_timeout','Ingen accept inom 3 minuter – åter till alla förare');
  insert into public.driver_action_log(booking_id,driver_id,action,details) values(b.id,b.driver_id,'broadcast_reopened',jsonb_build_object('note','Svarstiden 3 minuter gick ut – åter till alla förare'));
 end loop;
end $$;
revoke all on function public.process_expired_driver_offers() from public,anon,authenticated;
grant execute on function public.process_expired_driver_offers() to service_role;

-- Each explicit assignment starts a fresh response window, including reassignment.
do $patch$ declare definition text; begin
 select pg_get_functiondef('public.dispatch_assign_driver(uuid,uuid,text)'::regprocedure) into definition;
 definition:=replace(definition,'dispatched_at=coalesce(dispatched_at,now())','dispatched_at=now()');
 execute definition;
end $patch$;
