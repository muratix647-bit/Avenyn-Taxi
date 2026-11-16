-- Preserve booking intent; proximity to pickup must not convert a prebooking.
create or replace function public.booking_is_prebooking(b public.bookings)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select case b.price_breakdown->>'dispatch_mode'
 when 'instant' then false when 'prebooking' then true
 else ((b.booking_date+b.pickup_time) at time zone 'Europe/Stockholm') > b.created_at+interval '15 minutes' end
$$;
revoke all on function public.booking_is_prebooking(public.bookings) from public,anon;
grant execute on function public.booking_is_prebooking(public.bookings) to authenticated,service_role;
do $$ declare s text; begin
 s:=pg_get_functiondef('public.customer_create_quoted_booking(uuid,jsonb,jsonb,text)'::regprocedure);
 if position('''dispatch_mode''' in s)=0 then
  if position('''price_locked'',true' in s)=0 then raise exception 'Unexpected quoted booking function'; end if;
  s:=replace(s,'''price_locked'',true','''dispatch_mode'',coalesce(p_booking->>''dispatchMode'',case when ((booked_date+booked_time) at time zone ''Europe/Stockholm'')>now()+interval ''15 minutes'' then ''prebooking'' else ''instant'' end),''price_locked'',true');
  s:=replace(s,'price_breakdown,price_quote_id)','price_breakdown,price_quote_id,pet_details)');
  s:=replace(s,',p_quote_id) returning',',p_quote_id,nullif(p_booking->''petDetails'',''null''::jsonb)) returning');
  execute s;
 end if;
 s:=pg_get_functiondef('public.dispatch_auto_assign(uuid,text)'::regprocedure);
 if position('booking_is_prebooking' in s)=0 then
  s:=replace(s,'if b.pickup_point is null then return b; end if;','if b.pickup_point is null or public.booking_is_prebooking(b) then return b; end if;');
  s:=replace(s,'and l.updated_at between','and (b.pet_details is null or d.accepts_pets) and l.updated_at between');
  execute s;
 end if;
 s:=pg_get_functiondef('public.driver_prebooking_pool()'::regprocedure);
 if position('booking_is_prebooking' in s)=0 then
  s:=replace(s,'from bookings where driver_id is null','from bookings where public.booking_is_prebooking(bookings) and driver_id is null');execute s;
 end if;
 s:=pg_get_functiondef('public.driver_claim_prebooking(uuid)'::regprocedure);
 if position('booking_is_prebooking' in s)=0 then
  s:=replace(s,'if b.id is null or b.driver_id','if not public.booking_is_prebooking(b) or (b.pet_details is not null and not d.accepts_pets) or b.id is null or b.driver_id');execute s;
 end if;
 s:=pg_get_functiondef('public.driver_reject_my_booking(uuid)'::regprocedure);
 s:=replace(s,'set driver_id=null,status=''new''' ,'set driver_id=null,vehicle_id=null,status=''new''' );
 execute s;
end $$;
-- Notify every approved driver with push enabled; assignment still happens atomically on claim.
create or replace function public.notify_prebooking_pool() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare endpoint text; secret text;
begin
 if not public.booking_is_prebooking(new) or new.driver_id is not null or new.assigned_partner_id is not null or new.archived_at is not null or new.status not in ('new','scheduled','confirmed') then return new; end if;
 select replace(decrypted_secret,'/api/flight-monitor','/api/dispatch-push') into endpoint from vault.decrypted_secrets where name='avenyn_flight_monitor_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='avenyn_flight_monitor_secret';
 if endpoint is not null and secret is not null then perform net.http_post(url:=endpoint,headers:=jsonb_build_object('content-type','application/json','authorization','Bearer '||secret),body:=jsonb_build_object('prebookingId',new.id),timeout_milliseconds:=10000); end if;
 return new;
exception when others then raise warning 'Prebooking push could not be queued';return new;
end $$;
revoke all on function public.notify_prebooking_pool() from public,anon,authenticated;
drop trigger if exists prebooking_pool_push on public.bookings;
create trigger prebooking_pool_push after insert on public.bookings for each row execute function public.notify_prebooking_pool();
