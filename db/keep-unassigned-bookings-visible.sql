-- A passed pickup time must not silently hide a still-open booking.
-- UI explicitly marks overdue bookings and asks the driver to check the time.
do $change$
declare definition text; clause text;
begin
 select pg_get_functiondef('public.driver_prebooking_pool()'::regprocedure) into definition;
 clause:=' and ((booking_date+pickup_time) at time zone ''Europe/Stockholm'')>now()-interval ''30 minutes''';
 if position(clause in definition)=0 then raise exception 'Unexpected pool definition'; end if;
 execute replace(definition,clause,'');
 select pg_get_functiondef('public.driver_claim_prebooking(uuid)'::regprocedure) into definition;
 clause:=' or ((b.booking_date+b.pickup_time) at time zone ''Europe/Stockholm'')<=now()-interval ''30 minutes''';
 if position(clause in definition)=0 then raise exception 'Unexpected claim definition'; end if;
 execute replace(definition,clause,'');
end $change$;
