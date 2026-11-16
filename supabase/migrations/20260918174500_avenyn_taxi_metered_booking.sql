create or replace function public.customer_create_metered_booking(
 p_customer_name text,p_customer_phone text,p_customer_email text,
 p_pickup_address text,p_dropoff_address text,p_booking_date date,p_pickup_time time,
 p_passengers integer default 1,p_luggage_count integer default 0,p_car_type text default 'standard',
 p_payment_method text default 'Kort',p_child_seats integer default 0,p_notes text default null,
 p_pickup_lat double precision default null,p_pickup_lng double precision default null,
 p_dropoff_lat double precision default null,p_dropoff_lng double precision default null,
 p_pickup_place_id text default null,p_dropoff_place_id text default null,p_area_hint text default null,
 p_route_distance_km numeric default null,p_route_duration_minutes numeric default null,p_is_prebooked boolean default false)
returns table(id uuid,booking_number bigint,status text,tracking_token uuid,price numeric,zone_name text)
language plpgsql security definer set search_path=public,extensions as $$
declare v_id uuid; v_number bigint; v_status text; v_token uuid; v_quote record; v_settings public.fare_settings; v_straight_km numeric; v_route_price numeric; v_large numeric; v_child numeric; v_total numeric;
begin
 if nullif(trim(p_customer_name),'') is null or nullif(trim(p_customer_phone),'') is null or nullif(trim(p_customer_email),'') is null then raise exception 'Namn, mobilnummer och e-post krävs'; end if;
 if p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Ogiltig e-postadress'; end if;
 if nullif(trim(p_pickup_address),'') is null or nullif(trim(p_dropoff_address),'') is null then raise exception 'Hämtadress och destination krävs'; end if;
 if p_booking_date<current_date or p_passengers not between 1 and 7 or p_child_seats not between 0 and 3 then raise exception 'Kontrollera datum, passagerare och tillval'; end if;
 select * into v_quote from public.avenyn_quote(p_pickup_address,p_dropoff_address,p_pickup_lat,p_pickup_lng,p_dropoff_lat,p_dropoff_lng,p_pickup_place_id,p_dropoff_place_id,p_area_hint,p_car_type,p_child_seats);
 if v_quote.total_price is not null then raise exception 'Fastprisresor ska använda ordinarie bokningsflöde'; end if;
 if p_pickup_lat is null or p_pickup_lng is null or p_dropoff_lat is null or p_dropoff_lng is null then raise exception 'Koordinater saknas'; end if;
 v_straight_km:=extensions.st_distance(extensions.st_setsrid(extensions.st_makepoint(p_pickup_lng,p_pickup_lat),4326)::extensions.geography,extensions.st_setsrid(extensions.st_makepoint(p_dropoff_lng,p_dropoff_lat),4326)::extensions.geography)/1000;
 if p_route_distance_km is null or p_route_duration_minutes is null or p_route_distance_km<v_straight_km or p_route_distance_km>greatest(10,v_straight_km*3) or p_route_duration_minutes<p_route_distance_km/1.6667 or p_route_duration_minutes>p_route_distance_km*12 then raise exception 'Ogiltig vägsträcka eller körtid'; end if;
 select * into v_settings from public.fare_settings where fare_settings.id=true;
 v_route_price:=round((case when p_is_prebooked then 50 else 60 end)+p_route_distance_km*15+p_route_duration_minutes*(case when p_is_prebooked then 12 else 5 end));
 v_large:=case when lower(coalesce(p_car_type,'')) in ('large','storbil') then coalesce(v_settings.large_vehicle_surcharge,300) else 0 end;
 v_child:=p_child_seats*coalesce(v_settings.child_seat_surcharge,100);
 v_total:=v_route_price+v_large+v_child;
 insert into public.bookings(customer_name,customer_phone,customer_email,pickup_address,dropoff_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_point,dropoff_point,pickup_place_id,dropoff_place_id,booking_date,pickup_time,passengers,luggage_count,car_type,payment_method,estimated_price,fixed_price,status,source,child_seat,child_seats,notes,extra_message,booked_by,price_zone_code,price_breakdown)
 values(trim(p_customer_name),trim(p_customer_phone),lower(trim(p_customer_email)),trim(p_pickup_address),trim(p_dropoff_address),p_pickup_lat,p_pickup_lng,p_dropoff_lat,p_dropoff_lng,extensions.st_setsrid(extensions.st_makepoint(p_pickup_lng,p_pickup_lat),4326)::extensions.geography,extensions.st_setsrid(extensions.st_makepoint(p_dropoff_lng,p_dropoff_lat),4326)::extensions.geography,p_pickup_place_id,p_dropoff_place_id,p_booking_date,p_pickup_time,p_passengers,greatest(0,p_luggage_count),p_car_type,p_payment_method,v_total,v_total,'new','Website',p_child_seats>0,p_child_seats,p_notes,p_notes,'customer',null,jsonb_build_object('type',case when p_is_prebooked then 'prebooking' else 'instant' end,'base',case when p_is_prebooked then 50 else 60 end,'distance_km',p_route_distance_km,'price_per_km',15,'duration_minutes',p_route_duration_minutes,'price_per_minute',case when p_is_prebooked then 12 else 5 end,'large_vehicle',v_large,'child_seats',v_child))
 returning bookings.id,bookings.booking_number,bookings.status,bookings.tracking_token into v_id,v_number,v_status,v_token;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(v_id,null,v_status,'customer','Bokning skapad via kundsidan');
 return query select v_id,v_number,v_status,v_token,v_total,null::text;
end $$;

revoke all on function public.customer_create_metered_booking(text,text,text,text,text,date,time without time zone,integer,integer,text,text,integer,text,double precision,double precision,double precision,double precision,text,text,text,numeric,numeric,boolean) from public;
grant execute on function public.customer_create_metered_booking(text,text,text,text,text,date,time without time zone,integer,integer,text,text,integer,text,double precision,double precision,double precision,double precision,text,text,text,numeric,numeric,boolean) to anon,authenticated;
