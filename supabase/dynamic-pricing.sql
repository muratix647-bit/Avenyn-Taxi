create table if not exists public.dynamic_price_settings(id boolean primary key default true check(id),enabled boolean not null default true,time_percent integer not null default 10 check(time_percent between 0 and 100),demand_percent integer not null default 20 check(demand_percent between 0 and 100),max_percent integer not null default 25 check(max_percent between 0 and 100),minimum_waiting integer not null default 3 check(minimum_waiting between 1 and 100),updated_at timestamptz not null default now());
alter table public.dynamic_price_settings enable row level security;
revoke all on public.dynamic_price_settings from anon,authenticated;
grant all on public.dynamic_price_settings to service_role;
insert into public.dynamic_price_settings(id) values(true) on conflict do nothing;
alter table public.bookings add column if not exists price_quote_id uuid;
create unique index if not exists bookings_price_quote_id_idx on public.bookings(price_quote_id) where price_quote_id is not null;
create or replace function public.customer_create_quoted_booking(p_quote_id uuid,p_booking jsonb,p_quote jsonb,p_policy_version text)
returns table(id uuid,booking_number bigint,status text,tracking_token uuid,price numeric,zone_name text)
language plpgsql security invoker set search_path=public,extensions,pg_temp as $$
declare b public.bookings; total numeric; seats integer; pax integer; booked_date date; booked_time time; notes_text text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_quote_id::text,31));
 select * into b from public.bookings where price_quote_id=p_quote_id;
 if found then
  if b.customer_email is distinct from lower(trim(p_booking->>'customerEmail')) or b.customer_phone is distinct from p_booking->>'customerPhone' then raise exception 'Prisförslaget har redan använts'; end if;
  return query select b.id,b.booking_number,b.status,b.tracking_token,b.fixed_price,b.price_breakdown->>'zone_name'; return;
 end if;
 total:=(p_quote->>'total_price')::numeric;pax:=(p_booking->>'passengers')::integer;seats:=(p_booking->>'childSeats')::integer;
 booked_date:=left(p_booking->>'pickupTime',10)::date;booked_time:=substring(p_booking->>'pickupTime' from 12)::time;
 if total is null or total<=0 or total>100000 or pax not between 1 and 7 or seats not between 0 and 3 or booked_date<(now() at time zone 'Europe/Stockholm')::date then raise exception 'Kontrollera pris, datum och antal passagerare'; end if;
 if nullif(trim(p_booking->>'customerName'),'') is null or nullif(trim(p_booking->>'customerPhone'),'') is null or nullif(trim(p_booking->>'customerEmail'),'') is null then raise exception 'Kunduppgifter saknas'; end if;
 notes_text:=concat_ws(' · ',case when nullif(p_booking->>'flightNumber','') is not null then 'Flygnummer: '||(p_booking->>'flightNumber') end,case when nullif(p_booking->>'stop','') is not null then 'Extra stopp: '||(p_booking->>'stop') end,nullif(p_booking->>'extraMessage',''));
 insert into public.bookings(customer_name,customer_phone,customer_email,pickup_address,dropoff_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_place_id,dropoff_place_id,pickup_point,dropoff_point,booking_date,pickup_time,passengers,luggage_count,car_type,payment_method,estimated_price,fixed_price,status,source,child_seat,child_seats,notes,extra_message,booked_by,price_zone_code,price_breakdown,price_quote_id)
 values(trim(p_booking->>'customerName'),p_booking->>'customerPhone',lower(trim(p_booking->>'customerEmail')),p_booking->>'pickup',p_booking->>'destination',(p_booking->>'pickupLat')::numeric,(p_booking->>'pickupLng')::numeric,(p_booking->>'destinationLat')::numeric,(p_booking->>'destinationLng')::numeric,p_booking->>'pickupId',p_booking->>'destinationId',extensions.st_setsrid(extensions.st_makepoint((p_booking->>'pickupLng')::float,(p_booking->>'pickupLat')::float),4326)::extensions.geography,extensions.st_setsrid(extensions.st_makepoint((p_booking->>'destinationLng')::float,(p_booking->>'destinationLat')::float),4326)::extensions.geography,booked_date,booked_time,pax,greatest(0,coalesce((p_booking->>'luggageCount')::integer,0)),p_booking->>'vehicle',p_booking->>'paymentMethod',total,total,'new','Website',seats>0,seats,notes_text,notes_text,'customer',p_quote->>'zone_code',p_quote||jsonb_build_object('price_locked',true,'booking_policy',jsonb_build_object('version',p_policy_version,'accepted_at',now(),'accepted',true,'acceptance_method','booking_confirmation')),p_quote_id) returning * into b;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(b.id,null,'new','customer','Bokning skapad med kundens låsta prisförslag');
 return query select b.id,b.booking_number,b.status,b.tracking_token,b.fixed_price,p_quote->>'zone_name';
end $$;
revoke all on function public.customer_create_quoted_booking(uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.customer_create_quoted_booking(uuid,jsonb,jsonb,text) to service_role;
-- Booking creation now goes through the server-verified price quote.
do $$ declare f record; begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('customer_create_booking','customer_create_booking_with_stop','customer_create_metered_booking') loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;end $$;
