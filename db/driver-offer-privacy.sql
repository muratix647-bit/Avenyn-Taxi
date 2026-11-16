create or replace function public.driver_my_bookings()
returns setof public.bookings language sql security definer set search_path=public as $$
 select case when b.status in ('accepted','en_route','arrived','passenger_onboard','completed') then b
 else jsonb_populate_record(null::public.bookings,
 (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(b)) where key=any(array['id','booking_number','booking_date','pickup_time','pickup_address','dropoff_address','pickup_lat','pickup_lng','dropoff_lat','dropoff_lng','pickup_place_id','dropoff_place_id','passengers','car_type','child_seats','child_seat','luggage_count','estimated_price','fixed_price','actual_price','status','driver_id','vehicle_id','pet_details','payment_status','payment_method','created_at','updated_at'])) ||
 jsonb_build_object('price_breakdown',jsonb_build_object('stop_address',b.price_breakdown->'stop_address','stop_lat',b.price_breakdown->'stop_lat','stop_lng',b.price_breakdown->'stop_lng')))
 end
 from public.bookings b join public.drivers d on d.id=b.driver_id
 where d.auth_user_id=(select auth.uid()) and d.active and d.approved and d.archived_at is null and b.archived_at is null order by b.booking_date,b.pickup_time
$$;
alter policy bookings_driver_can_read_own on public.bookings using(
 (driver_id=(select public.my_driver_id()) and status in ('accepted','en_route','arrived','passenger_onboard','completed')) or (select public.is_admin())
);
create or replace function public.driver_prebooking_pool()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from drivers where auth_user_id=auth.uid() and active and approved and archived_at is null) then raise exception 'Endast godkända förare'; end if;
 return coalesce((select jsonb_agg(x order by x.booking_date,x.pickup_time) from (
 select id,booking_number,booking_date,pickup_time,pickup_address,dropoff_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,passengers,car_type,child_seats,luggage_count,pet_details,coalesce(fixed_price,estimated_price,0) price,
 jsonb_build_object('stop_address',price_breakdown->'stop_address','stop_lat',price_breakdown->'stop_lat','stop_lng',price_breakdown->'stop_lng') price_breakdown
 from bookings where driver_id is null and assigned_partner_id is null and archived_at is null and status in ('new','scheduled','confirmed') and ((booking_date+pickup_time) at time zone 'Europe/Stockholm')>now()
 and (pet_details is null or exists(select 1 from drivers where auth_user_id=auth.uid() and accepts_pets)) order by booking_date,pickup_time limit 500
 ) x),'[]'::jsonb);
end $$;
