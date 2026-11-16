-- All unassigned bookings share one pool. Preserve existing RPC names for app compatibility.
-- Row locks in driver_claim_prebooking serialize acceptance and prevent double assignment.
create or replace function public.dispatch_auto_assign(p_booking_id uuid,p_changed_by text default 'auto_dispatch')
returns public.bookings language plpgsql security definer set search_path=public,extensions as $$
declare b public.bookings;
begin
 if auth.uid() is not null and not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
 select * into b from public.bookings where id=p_booking_id for update;
 -- Never reserve a new booking for one driver before they choose to accept.
 return b;
end $$;
revoke all on function public.dispatch_auto_assign(uuid,text) from public,anon;
grant execute on function public.dispatch_auto_assign(uuid,text) to authenticated,service_role;

do $change$
declare definition text;
begin
 select pg_get_functiondef('public.driver_prebooking_pool()'::regprocedure) into definition;
 if position('public.booking_is_prebooking(bookings) and ' in definition)=0 then raise exception 'Unexpected pool definition'; end if;
 definition:=replace(definition,'public.booking_is_prebooking(bookings) and ','');
 definition:=replace(definition,')>now()',')>now()-interval ''30 minutes''');
 definition:=replace(definition,'and (pet_details is null or exists(select 1 from drivers where auth_user_id=auth.uid() and accepts_pets))','');
 execute definition;
 select pg_get_functiondef('public.driver_claim_prebooking(uuid)'::regprocedure) into definition;
 if position('not public.booking_is_prebooking(b) or ' in definition)=0 then raise exception 'Unexpected claim definition'; end if;
 definition:=replace(definition,'not public.booking_is_prebooking(b) or ','');
 definition:=replace(definition,')<=now()',')<=now()-interval ''30 minutes''');
 definition:=replace(definition,'Förbokningen är inte längre ledig.','Bokningen är inte längre ledig.');
 execute definition;
 select pg_get_functiondef('public.notify_prebooking_pool()'::regprocedure) into definition;
 if position('not public.booking_is_prebooking(new) or ' in definition)=0 then raise exception 'Unexpected push definition'; end if;
 definition:=replace(definition,'not public.booking_is_prebooking(new) or ','');
 execute definition;
end $change$;
-- Notify again when an assigned trip is explicitly returned to the shared pool.
drop trigger if exists booking_returned_to_pool_push on public.bookings;
create trigger booking_returned_to_pool_push after update of driver_id,status,assigned_partner_id on public.bookings
for each row when (
 new.driver_id is null and new.assigned_partner_id is null and new.archived_at is null
 and new.status in ('new','scheduled','confirmed')
 and (old.driver_id is not null or old.assigned_partner_id is not null or old.status not in ('new','scheduled','confirmed'))
) execute function public.notify_prebooking_pool();
