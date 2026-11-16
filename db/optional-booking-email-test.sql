begin;
do $test$
declare q uuid:=gen_random_uuid();b jsonb;created record;again record;failed boolean:=false;
begin
 b:=jsonb_build_object('customerName','ROLLBACK guest','customerPhone','+46700000000','pickup','TEST','destination','TEST','pickupLat',42,'pickupLng',-30,'destinationLat',42.01,'destinationLng',-30,'pickupTime',to_char((now() at time zone 'Europe/Stockholm')+interval '1 day','YYYY-MM-DD"T"HH24:MI:SS'),'passengers',1,'childSeats',0,'vehicle','standard','paymentMethod','Kort','dispatchMode','prebooking');
 select * into created from customer_create_quoted_booking(q,b,'{"total_price":505,"zone_name":"TEST"}','2026-10-02-booking-confirmation');
 if created.id is null or not exists(select 1 from bookings where id=created.id and customer_email='' and customer_phone='+46700000000') then raise exception 'Guest creation failed';end if;
 select * into again from customer_create_quoted_booking(q,b||'{"customerEmail":""}','{"total_price":505}','2026-10-02-booking-confirmation');
 if again.id<>created.id then raise exception 'Duplicate guest booking';end if;
 begin
 perform customer_create_quoted_booking(gen_random_uuid(),b||'{"customerPhone":""}','{"total_price":505}','2026-10-02-booking-confirmation');
 exception when others then failed:=true;
 end;
 if not failed then raise exception 'Missing phone accepted';end if;
end $test$;
rollback;
select 'PASS: guest without email, blank-email retry idempotent, phone required; no bookings or notifications committed' result;
