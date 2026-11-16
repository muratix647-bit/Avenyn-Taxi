-- Add Blipp to the existing accounting functions without changing their ownership checks or audit logging.
alter table public.bookings drop constraint bookings_driver_reported_payment_method_check;
alter table public.bookings add constraint bookings_driver_reported_payment_method_check check (driver_reported_payment_method is null or driver_reported_payment_method in ('app','blipp','card','swish','paypal','cash','invoice','other')) not valid;
do $migration$
declare fn record; definition text;
begin
 for fn in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('driver_complete_my_booking','driver_update_my_completed_booking') loop
  definition := pg_get_functiondef(fn.oid);
  if position('''app'', ''card'', ''swish'', ''paypal'', ''cash'', ''invoice'', ''other''' in definition)=0 then raise exception 'Expected accounting validation missing'; end if;
  execute replace(definition,'''app'', ''card'', ''swish'', ''paypal'', ''cash'', ''invoice'', ''other''','''app'', ''blipp'', ''card'', ''swish'', ''paypal'', ''cash'', ''invoice'', ''other''');
 end loop;
end;
$migration$;
