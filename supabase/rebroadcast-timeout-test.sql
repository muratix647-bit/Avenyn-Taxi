do $test$
declare u uuid:=gen_random_uuid(); d uuid; expired uuid; fresh uuid; accepted uuid;
begin
 insert into auth.users(id) values(u);
 insert into public.drivers(auth_user_id,full_name,approved) values(u,'ROLLBACK timeout driver',true) returning id into d;
 insert into public.bookings(customer_name,pickup_address,booking_date,pickup_time,status,driver_id,dispatched_at,booking_number) overriding system value values('ROLLBACK TEST','TEST',current_date+30,'12:00','assigned',d,now()-interval '4 minutes',-900011) returning id into expired;
 insert into public.bookings(customer_name,pickup_address,booking_date,pickup_time,status,driver_id,dispatched_at,booking_number) overriding system value values('ROLLBACK TEST','TEST',current_date+30,'13:00','assigned',d,now()-interval '2 minutes',-900012) returning id into fresh;
 insert into public.bookings(customer_name,pickup_address,booking_date,pickup_time,status,driver_id,dispatched_at,booking_number) overriding system value values('ROLLBACK TEST','TEST',current_date+30,'14:00','accepted',d,now()-interval '4 minutes',-900013) returning id into accepted;
 perform public.process_expired_driver_offers();
 if not exists(select 1 from bookings where id=expired and driver_id is null and status='new' and price_breakdown ? 'broadcast_reopened_at') then raise exception 'Expired offer not released'; end if;
 if not exists(select 1 from bookings where id=fresh and driver_id=d and status='assigned') then raise exception 'Fresh offer released early'; end if;
 if not exists(select 1 from bookings where id=accepted and driver_id=d and status='accepted') then raise exception 'Accepted trip was released'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin
  perform public.dispatch_release_to_all(fresh);
  raise exception 'Non-admin release allowed';
 exception when others then
  if sqlerrm='Non-admin release allowed' then raise; end if;
 end;
 if has_function_privilege('authenticated','public.process_expired_driver_offers()','execute') then raise exception 'Driver can run global timeout'; end if;
end $test$;
