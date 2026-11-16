-- Guest bookings require a name and phone. Email is optional; privileges unchanged.
do $migration$
declare s text;
begin
 s:=pg_get_functiondef('public.customer_create_quoted_booking(uuid,jsonb,jsonb,text)'::regprocedure);
 s:=replace(s,$a$ or nullif(trim(p_booking->>'customerEmail'),'') is null$a$,'');
 s:=replace(s,$a$lower(trim(p_booking->>'customerEmail'))$a$,$a$lower(trim(coalesce(p_booking->>'customerEmail','')))$a$);
 execute s;
end $migration$;
