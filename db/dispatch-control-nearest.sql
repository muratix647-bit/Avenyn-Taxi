create or replace function public.dispatch_auto_assign(p_booking_id uuid,p_changed_by text default 'auto_dispatch')
returns public.bookings language plpgsql security definer set search_path=public,extensions as $$
declare b public.bookings; candidate record; old_status text; manual boolean := p_changed_by='dispatch_manual_auto' and public.is_dispatch_admin();
begin
 if auth.uid() is not null and not public.is_dispatch_admin() and pg_trigger_depth()=0 then raise exception 'Endast dispatch'; end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then return b; end if;
 if b.archived_at is not null or b.status in ('completed','cancelled') then return b; end if;
 if not manual and (b.assigned_partner_id is not null or b.status not in ('new','scheduled','confirmed','offered') or public.booking_is_prebooking(b) or b.price_breakdown->>'dispatch_pool'='all') then return b; end if;
 if not manual and b.created_at not between now()-interval '30 minutes' and now()+interval '1 minute' then return b; end if;
 if b.pickup_point is null then return b; end if;
 -- Child seats need dispatch confirmation until vehicle equipment is recorded.
 if coalesce(b.child_seats,0)>0 then return b; end if;
 if not manual and exists(select 1 from public.booking_driver_offers where booking_id=b.id and status='offered' and expires_at>now()) then return b; end if;
 perform pg_advisory_xact_lock(872031);


 select d.id driver_id,v.id vehicle_id into candidate
 from public.drivers d join public.driver_locations l on l.driver_id=d.id
 join public.vehicles v on v.driver_id=d.id and v.active
 where d.active and d.approved and d.is_online and d.availability_status='available' and d.archived_at is null
 and (b.pet_details is null or d.accepts_pets) and l.updated_at between now()-interval '3 minutes' and now()+interval '1 minute'
 and l.latitude between -85 and 85 and l.longitude between -180 and 180
 and coalesce(v.passenger_capacity,4)>=greatest(coalesce(b.passengers,1),case when b.car_type='large' then 5 else 1 end)
 and extensions.st_dwithin(b.pickup_point,extensions.st_setsrid(extensions.st_makepoint(l.longitude,l.latitude),4326)::extensions.geography,30000)
 and (manual or not exists(select 1 from public.booking_driver_offers o where o.booking_id=b.id and o.driver_id=d.id))
 and not exists(select 1 from public.bookings other where other.id<>b.id and other.archived_at is null and (other.driver_id=d.id or other.vehicle_id=v.id) and (other.status in ('en_route','arrived','passenger_onboard') or (other.status in ('offered','assigned','accepted') and abs(extract(epoch from ((other.booking_date+other.pickup_time)-(b.booking_date+b.pickup_time))))<3600)))
 order by extensions.st_distance(b.pickup_point,extensions.st_setsrid(extensions.st_makepoint(l.longitude,l.latitude),4326)::extensions.geography),l.updated_at desc,d.id
 limit 1 for update of d,v;
 if candidate.driver_id is null then
  if manual then raise exception 'Ingen lämplig ledig förare med aktuell GPS hittades. Välj förare manuellt eller lägg ut körningen i auktion.'; end if;
  if b.status='offered' and not manual then update public.bookings set driver_id=null,vehicle_id=null,status='new',dispatched_at=null where id=b.id returning * into b; end if;
  return b; end if;
 update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=b.id and status='offered';
 old_status:=b.status;
 update public.bookings set assigned_partner_id=null,driver_id=candidate.driver_id,vehicle_id=candidate.vehicle_id,status='offered',price_breakdown=coalesce(price_breakdown,'{}'::jsonb)-'dispatch_pool',dispatched_at=now(),updated_at=now() where id=b.id returning * into b;
 insert into public.booking_driver_offers(booking_id,driver_id,status,expires_at) values(b.id,candidate.driver_id,'offered',now()+interval '3 minutes');
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(b.id,old_status,'offered',p_changed_by,'Erbjudande till närmaste lediga lämpliga bil med färsk GPS');
 return b;
end $$;
revoke all on function public.dispatch_auto_assign(uuid,text) from public,anon;
grant execute on function public.dispatch_auto_assign(uuid,text) to authenticated,service_role;
-- Adjust existing, access-controlled RPCs without changing their grants.
do $patch$
declare s text;
begin
 s:=pg_get_functiondef('public.dispatch_release_to_all(uuid)'::regprocedure);
 s:=replace(s,$x$b.status not in ('new','scheduled','confirmed','offered','assigned')$x$,$x$b.status in ('completed','cancelled')$x$);
 s:=replace(s,$x$jsonb_build_object('broadcast_reopened_at',clock_timestamp())$x$,$x$jsonb_build_object('broadcast_reopened_at',clock_timestamp(),'dispatch_pool','all')$x$);
 execute s;
 s:=pg_get_functiondef('public.driver_prebooking_pool()'::regprocedure);
 s:=replace(s,'from bookings where driver_id is null', $x$from bookings where (public.booking_is_prebooking(bookings) or price_breakdown->>'dispatch_pool'='all') and driver_id is null$x$);
 s:=replace(s,$x$jsonb_build_object('stop_address',$x$,$x$jsonb_build_object('broadcast_reopened_at',price_breakdown->'broadcast_reopened_at','stop_address',$x$);
 execute s;
 s:=pg_get_functiondef('public.driver_claim_prebooking(uuid)'::regprocedure);
 s:=replace(s,'if (b.pet_details', $x$if (not public.booking_is_prebooking(b) and coalesce(b.price_breakdown->>'dispatch_pool','')<>'all') or (b.pet_details$x$);
 execute s;
 s:=pg_get_functiondef('public.notify_prebooking_pool()'::regprocedure);
 s:=replace(s,'if new.driver_id', $x$if (not public.booking_is_prebooking(new) and coalesce(new.price_breakdown->>'dispatch_pool','')<>'all') or new.driver_id$x$);
 execute s;
 s:=pg_get_functiondef('public.dispatch_assign_driver(uuid,uuid,text)'::regprocedure);
 s:=replace(s,' update public.bookings set assigned_partner_id', $x$ update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=p_booking_id and status='offered';
 update public.bookings set price_breakdown=coalesce(price_breakdown,'{}'::jsonb)-'dispatch_pool',confirmed_at=null,completed_at=null,cancelled_at=null,assigned_partner_id$x$);
 execute s;
 s:=pg_get_functiondef('public.dispatch_set_booking_status(uuid,text,text,text)'::regprocedure);
 s:=replace(s,$x$'new','scheduled','offered'$x$,$x$'new','scheduled','confirmed','offered'$x$);
 s:=replace(s,'else completed_at end','else null end');
 s:=replace(s,'else cancelled_at end','else null end');
 s:=replace(s,' update public.bookings set status=p_status,', $x$ if p_status not in ('offered','assigned') then update public.booking_driver_offers set status=case when p_status in ('accepted','en_route','arrived','passenger_onboard','completed') then 'accepted' else 'expired' end,responded_at=now() where booking_id=p_booking_id and status='offered'; end if;
 update public.bookings set status=p_status,$x$);
 execute s;
 -- Preserve the established 3-minute timeout for manual/prebooking offers.
 s:=pg_get_functiondef('public.process_expired_driver_offers()'::regprocedure);
 s:=replace(s,'declare b public.bookings;', 'declare b public.bookings; r record;');
 s:=replace(s,$x$jsonb_build_object('broadcast_reopened_at',clock_timestamp())$x$,$x$jsonb_build_object('broadcast_reopened_at',clock_timestamp(),'dispatch_pool',case when public.booking_is_prebooking(b) then 'all' else 'nearest' end)$x$);
 s:=replace(s,E' end loop;\nend', $x$ end loop;
 for r in select id from public.bookings where archived_at is null and assigned_partner_id is null and status in ('new','scheduled','confirmed','offered') and not public.booking_is_prebooking(bookings) and coalesce(price_breakdown->>'dispatch_pool','')<>'all' and created_at between now()-interval '30 minutes' and now()+interval '1 minute' order by booking_date,pickup_time limit 100 loop
  perform public.dispatch_auto_assign(r.id,'auto_retry');
 end loop;
end$x$);
 execute s;
end $patch$;
