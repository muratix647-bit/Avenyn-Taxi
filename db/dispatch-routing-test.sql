begin;
do $test$
declare u uuid:=gen_random_uuid();u2 uuid:=gen_random_uuid();d uuid;d2 uuid;b uuid;pre uuid;r bookings;pool jsonb;at_time timestamp:=(now() at time zone 'Europe/Stockholm');
begin
 insert into auth.users(id) values(u),(u2);
 insert into drivers(auth_user_id,full_name,approved,is_online,availability_status) values(u,'ROLLBACK nearest',true,true,'available') returning id into d;
 insert into drivers(auth_user_id,full_name,approved,is_online,availability_status) values(u2,'ROLLBACK next',true,true,'available') returning id into d2;
 insert into vehicles(name,driver_id) values('ROLLBACK car',d),('ROLLBACK next car',d2);
 insert into driver_locations(driver_id,latitude,longitude,updated_at) values(d,42,-30,now()),(d2,42.01,-30,now());
 insert into bookings(customer_name,pickup_address,booking_date,pickup_time,status,booking_number,pickup_point,price_breakdown) overriding system value values('ROLLBACK TEST','TEST pickup',at_time::date,at_time::time,'new',-900011,extensions.st_setsrid(extensions.st_makepoint(-30,42),4326)::extensions.geography,'{"dispatch_mode":"instant"}') returning id into b;
 select * into r from bookings where id=b;
 if r.driver_id is distinct from d or r.status<>'offered' then raise exception 'TEST FAIL nearest';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform driver_reject_my_booking(b);
 perform set_config('request.jwt.claim.sub','',true);
 r:=dispatch_auto_assign(b,'rollback_test');
 if r.driver_id is distinct from d2 or r.status<>'offered' then raise exception 'TEST FAIL next driver';end if;
 insert into bookings(customer_name,pickup_address,booking_date,pickup_time,status,booking_number,pickup_point,price_breakdown) overriding system value values('ROLLBACK TEST','TEST scheduled',at_time::date,(at_time+interval '10 minutes')::time,'new',-900012,extensions.st_setsrid(extensions.st_makepoint(-30,42),4326)::extensions.geography,'{"dispatch_mode":"prebooking"}') returning id into pre;
 select * into r from bookings where id=pre;
 if r.driver_id is not null or r.status<>'new' then raise exception 'TEST FAIL scheduled assigned to one';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 pool:=driver_prebooking_pool();
 if not exists(select 1 from jsonb_array_elements(pool) x where x->>'id'=pre::text) then raise exception 'TEST FAIL shared pool';end if;
 if exists(select 1 from jsonb_array_elements(pool) x where x->>'id'=b::text) then raise exception 'TEST FAIL instant in pool';end if;
end $test$;
rollback;
select 'PASS: nearest car, next after rejection, scheduled remains broadcast even 10 minutes before pickup; no test data or pushes committed' result;
