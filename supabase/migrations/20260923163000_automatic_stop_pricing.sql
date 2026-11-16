create or replace function public.customer_create_booking_with_stop(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_pickup_address text,
  p_stop_address text,
  p_dropoff_address text,
  p_booking_date date,
  p_pickup_time time without time zone,
  p_passengers integer default 1,
  p_luggage_count integer default 0,
  p_car_type text default 'standard',
  p_payment_method text default 'Kort',
  p_child_seats integer default 0,
  p_notes text default null,
  p_pickup_lat double precision default null,
  p_pickup_lng double precision default null,
  p_dropoff_lat double precision default null,
  p_dropoff_lng double precision default null,
  p_pickup_place_id text default null,
  p_dropoff_place_id text default null,
  p_area_hint text default null,
  p_direct_distance_km numeric default null,
  p_direct_duration_minutes numeric default null,
  p_via_distance_km numeric default null,
  p_via_duration_minutes numeric default null,
  p_is_prebooked boolean default false
)
returns table(id uuid,booking_number bigint,status text,tracking_token uuid,price numeric,zone_name text)
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_id uuid;
  v_number bigint;
  v_status text;
  v_token uuid;
  v_quote record;
  v_settings public.fare_settings;
  v_straight_km numeric;
  v_route_price numeric;
  v_large numeric;
  v_child numeric;
  v_total numeric;
  v_base numeric;
  v_per_km numeric;
  v_per_minute numeric;
  v_stop_extra_km numeric;
  v_stop_surcharge numeric;
  v_zone_code text;
  v_zone_name text;
  v_breakdown jsonb;
begin
  if nullif(trim(p_customer_name),'') is null or nullif(trim(p_customer_phone),'') is null or nullif(trim(p_customer_email),'') is null then
    raise exception 'Namn, mobilnummer och e-post krävs';
  end if;
  if p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Ogiltig e-postadress';
  end if;
  if nullif(trim(p_pickup_address),'') is null or nullif(trim(p_stop_address),'') is null or nullif(trim(p_dropoff_address),'') is null then
    raise exception 'Hämtadress, stopp och destination krävs';
  end if;
  if p_booking_date<current_date or p_passengers not between 1 and 7 or p_child_seats not between 0 and 3 then
    raise exception 'Kontrollera datum, passagerare och tillval';
  end if;
  if p_pickup_lat is null or p_pickup_lng is null or p_dropoff_lat is null or p_dropoff_lng is null then
    raise exception 'Koordinater saknas';
  end if;

  v_straight_km:=extensions.st_distance(
    extensions.st_setsrid(extensions.st_makepoint(p_pickup_lng,p_pickup_lat),4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(p_dropoff_lng,p_dropoff_lat),4326)::extensions.geography
  )/1000;
  if p_direct_distance_km is null or p_direct_duration_minutes is null or
     p_via_distance_km is null or p_via_duration_minutes is null or
     p_direct_distance_km<v_straight_km or p_direct_distance_km>greatest(10,v_straight_km*3) or
     p_direct_duration_minutes<p_direct_distance_km/1.6667 or p_direct_duration_minutes>p_direct_distance_km*12 or
     p_via_distance_km<p_direct_distance_km or p_via_distance_km>p_direct_distance_km+500 or
     p_via_duration_minutes<p_via_distance_km/1.6667 or p_via_duration_minutes>p_via_distance_km*12 then
    raise exception 'Ogiltig vägsträcka eller körtid';
  end if;

  v_stop_extra_km:=greatest(0,p_via_distance_km-p_direct_distance_km);
  v_stop_surcharge:=round(v_stop_extra_km*35);
  select * into v_quote from public.avenyn_quote(
    p_pickup_address,p_dropoff_address,p_pickup_lat,p_pickup_lng,p_dropoff_lat,p_dropoff_lng,
    p_pickup_place_id,p_dropoff_place_id,p_area_hint,p_car_type,p_child_seats
  );

  if v_quote.total_price is not null then
    v_total:=v_quote.total_price+v_stop_surcharge;
    v_zone_code:=v_quote.zone_code;
    v_zone_name:=v_quote.zone_name;
    v_breakdown:=jsonb_build_object(
      'zone',v_quote.zone_name,'base',v_quote.base_price,'large_vehicle',v_quote.large_surcharge,
      'child_seats',v_quote.child_seat_surcharge,'stop_address',trim(p_stop_address),
      'stop_extra_km',v_stop_extra_km,'stop_rate_per_km',35,'stop_surcharge',v_stop_surcharge
    );
  else
    select * into v_settings from public.fare_settings where fare_settings.id=true;
    v_base:=case when p_is_prebooked then coalesce(v_settings.prebooked_start_fee,50) else coalesce(v_settings.instant_start_fee,60) end;
    v_per_km:=coalesce(v_settings.price_per_km,15);
    v_per_minute:=(case when p_is_prebooked then coalesce(v_settings.prebooked_price_per_hour,720) else coalesce(v_settings.instant_price_per_hour,300) end)/60;
    v_route_price:=round(v_base+p_direct_distance_km*v_per_km+p_direct_duration_minutes*v_per_minute);
    v_large:=case when lower(coalesce(p_car_type,'')) in ('large','storbil') then coalesce(v_settings.large_vehicle_surcharge,300) else 0 end;
    v_child:=p_child_seats*coalesce(v_settings.child_seat_surcharge,100);
    v_total:=v_route_price+v_large+v_child+v_stop_surcharge;
    v_zone_code:=null;
    v_zone_name:=null;
    v_breakdown:=jsonb_build_object(
      'type',case when p_is_prebooked then 'prebooking' else 'instant' end,
      'base',v_base,'distance_km',p_direct_distance_km,'price_per_km',v_per_km,
      'duration_minutes',p_direct_duration_minutes,'price_per_minute',v_per_minute,
      'large_vehicle',v_large,'child_seats',v_child,'stop_address',trim(p_stop_address),
      'stop_extra_km',v_stop_extra_km,'stop_rate_per_km',35,'stop_surcharge',v_stop_surcharge
    );
  end if;

  insert into public.bookings(
    customer_name,customer_phone,customer_email,pickup_address,dropoff_address,
    pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_point,dropoff_point,
    pickup_place_id,dropoff_place_id,booking_date,pickup_time,passengers,luggage_count,
    car_type,payment_method,estimated_price,fixed_price,status,source,child_seat,child_seats,
    notes,extra_message,booked_by,price_zone_code,price_breakdown
  ) values(
    trim(p_customer_name),trim(p_customer_phone),lower(trim(p_customer_email)),trim(p_pickup_address),trim(p_dropoff_address),
    p_pickup_lat,p_pickup_lng,p_dropoff_lat,p_dropoff_lng,
    extensions.st_setsrid(extensions.st_makepoint(p_pickup_lng,p_pickup_lat),4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(p_dropoff_lng,p_dropoff_lat),4326)::extensions.geography,
    p_pickup_place_id,p_dropoff_place_id,p_booking_date,p_pickup_time,p_passengers,greatest(0,p_luggage_count),
    p_car_type,p_payment_method,v_total,v_total,'new','Website',p_child_seats>0,p_child_seats,
    p_notes,p_notes,'customer',v_zone_code,v_breakdown
  ) returning bookings.id,bookings.booking_number,bookings.status,bookings.tracking_token
    into v_id,v_number,v_status,v_token;

  insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note)
  values(v_id,null,v_status,'customer','Bokning med stopp skapad via kundsidan');
  return query select v_id,v_number,v_status,v_token,v_total,v_zone_name;
end
$function$;

revoke all on function public.customer_create_booking_with_stop(text,text,text,text,text,text,date,time without time zone,integer,integer,text,text,integer,text,double precision,double precision,double precision,double precision,text,text,text,numeric,numeric,numeric,numeric,boolean) from public;
grant execute on function public.customer_create_booking_with_stop(text,text,text,text,text,text,date,time without time zone,integer,integer,text,text,integer,text,double precision,double precision,double precision,double precision,text,text,text,numeric,numeric,numeric,numeric,boolean) to anon,authenticated;
