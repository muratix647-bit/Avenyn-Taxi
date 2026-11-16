create or replace function public.dispatch_auto_assign(p_booking_id uuid,p_changed_by text default 'auto_dispatch')
returns public.bookings language plpgsql security definer set search_path=public,extensions as $$
declare b public.bookings; candidate record; old_status text;
begin
 if auth.uid() is not null and not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then return b; end if;
 if b.archived_at is not null or b.assigned_partner_id is not null or b.status not in ('new','scheduled','offered') then return b; end if;
 if ((b.booking_date+b.pickup_time) at time zone 'Europe/Stockholm') not between now()-interval '30 minutes' and now()+interval '15 minutes' then return b; end if;
 if b.pickup_point is null then return b; end if;
 -- Child seats need dispatch confirmation until vehicle equipment is recorded.
 if coalesce(b.child_seats,0)>0 then return b; end if;
 if exists(select 1 from public.booking_driver_offers where booking_id=b.id and status='offered' and expires_at>now()) then return b; end if;
 perform pg_advisory_xact_lock(872031);
 update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=b.id and status='offered';
 if b.status='offered' then update public.bookings set driver_id=null,vehicle_id=null,status='new' where id=b.id returning * into b; end if;
 select d.id driver_id,v.id vehicle_id into candidate
 from public.drivers d join public.driver_locations l on l.driver_id=d.id
 join public.vehicles v on v.driver_id=d.id and v.active
 where d.active and d.approved and d.is_online and d.availability_status='available' and d.archived_at is null
 and l.updated_at between now()-interval '3 minutes' and now()+interval '1 minute'
 and l.latitude between -85 and 85 and l.longitude between -180 and 180
 and coalesce(v.passenger_capacity,4)>=greatest(coalesce(b.passengers,1),case when b.car_type='large' then 5 else 1 end)
 and extensions.st_dwithin(b.pickup_point,extensions.st_setsrid(extensions.st_makepoint(l.longitude,l.latitude),4326)::extensions.geography,30000)
 and not exists(select 1 from public.booking_driver_offers o where o.booking_id=b.id and o.driver_id=d.id)
 and not exists(select 1 from public.bookings other where other.id<>b.id and other.archived_at is null and (other.driver_id=d.id or other.vehicle_id=v.id) and (other.status in ('en_route','arrived','passenger_onboard') or (other.status in ('offered','assigned','accepted') and abs(extract(epoch from ((other.booking_date+other.pickup_time)-(b.booking_date+b.pickup_time))))<3600)))
 order by extensions.st_distance(b.pickup_point,extensions.st_setsrid(extensions.st_makepoint(l.longitude,l.latitude),4326)::extensions.geography),l.updated_at desc,d.id
 limit 1 for update of d,v;
 if candidate.driver_id is null then return b; end if;
 old_status:=b.status;
 update public.bookings set driver_id=candidate.driver_id,vehicle_id=candidate.vehicle_id,status='offered',dispatched_at=coalesce(dispatched_at,now()),updated_at=now() where id=b.id returning * into b;
 insert into public.booking_driver_offers(booking_id,driver_id,status,expires_at) values(b.id,candidate.driver_id,'offered',now()+interval '45 seconds');
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(b.id,old_status,'offered',p_changed_by,'Erbjudande till närmaste lediga lämpliga bil med färsk GPS');
 return b;
end $$;
revoke all on function public.dispatch_auto_assign(uuid,text) from public,anon;
grant execute on function public.dispatch_auto_assign(uuid,text) to authenticated,service_role;
create or replace function public.process_expired_driver_offers() returns void language plpgsql security definer set search_path=public,extensions as $$
declare r record;
begin
 for r in select id from public.bookings where archived_at is null and assigned_partner_id is null and status in ('new','scheduled','offered') and ((booking_date+pickup_time) at time zone 'Europe/Stockholm') between now()-interval '30 minutes' and now()+interval '15 minutes' order by booking_date,pickup_time limit 100 loop
  perform public.dispatch_auto_assign(r.id,'auto_retry');
 end loop;
 -- Accepted trips must never be reassigned by an old offer timeout.
 update public.booking_driver_offers o set status='expired',responded_at=now() where o.status='offered' and o.expires_at<=now() and exists(select 1 from public.bookings b where b.id=o.booking_id and b.status not in ('new','scheduled','offered'));
end $$;
revoke all on function public.process_expired_driver_offers() from public,anon,authenticated;
grant execute on function public.process_expired_driver_offers() to service_role;
select cron.alter_job(jobid,schedule:='10 seconds') from cron.job where jobname='avenyn-driver-offer-timeout';
create or replace function public.notify_auto_driver_offer() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare endpoint text; secret text;
begin
 select replace(decrypted_secret,'/api/flight-monitor','/api/dispatch-push') into endpoint from vault.decrypted_secrets where name='avenyn_flight_monitor_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='avenyn_flight_monitor_secret';
 if endpoint is not null and secret is not null then perform net.http_post(url:=endpoint,headers:=jsonb_build_object('content-type','application/json','authorization','Bearer '||secret),body:=jsonb_build_object('offerId',new.id),timeout_milliseconds:=10000); end if;
 return new;
exception when others then raise warning 'Offer push could not be queued'; return new;
end $$;
revoke all on function public.notify_auto_driver_offer() from public,anon,authenticated;
drop trigger if exists automatic_offer_push on public.booking_driver_offers;
create trigger automatic_offer_push after insert on public.booking_driver_offers for each row when(new.status='offered') execute function public.notify_auto_driver_offer();
do $$ declare definition text; begin
 select pg_get_functiondef('public.driver_progress_my_booking(uuid,text)'::regprocedure) into definition;
 definition:=replace(definition,' update public.bookings set status=p_status,', E' if p_status=\'accepted\' and v_old=\'offered\' and not exists(select 1 from public.booking_driver_offers where booking_id=p_booking_id and driver_id=v_driver_id and status=\'offered\' and expires_at>now()) then raise exception \'Erbjudandet har gått ut\'; end if;\n if p_status=\'accepted\' then update public.booking_driver_offers set status=\'accepted\',responded_at=now() where booking_id=p_booking_id and driver_id=v_driver_id and status=\'offered\'; end if;\n update public.bookings set status=p_status,');
 execute definition;
end $$;
