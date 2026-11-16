create or replace function public.driver_register_self(p_full_name text,p_phone text)
returns public.drivers language plpgsql security definer set search_path=public as $$
declare v_driver public.drivers; v_email text;
begin
 if (select auth.uid()) is null then raise exception 'Logga in'; end if;
 v_email:=(select email from auth.users where id=(select auth.uid()));
 select * into v_driver from public.drivers where auth_user_id=(select auth.uid()) or (auth_user_id is null and lower(email)=lower(v_email)) order by auth_user_id nulls last limit 1 for update;
 if found then update public.drivers set auth_user_id=(select auth.uid()),full_name=coalesce(nullif(trim(p_full_name),''),full_name),phone=coalesce(nullif(trim(p_phone),''),phone),updated_at=now() where id=v_driver.id returning * into v_driver;
 else insert into public.drivers(auth_user_id,full_name,email,phone,active,approved,is_online,status,availability_status) values((select auth.uid()),trim(p_full_name),v_email,trim(p_phone),true,false,false,'active','offline') returning * into v_driver;
 end if;
 return v_driver;
end $$;

create or replace function public.driver_progress_my_booking(p_booking_id uuid,p_status text)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_driver_id uuid; v_booking public.bookings; v_old text;
begin
 if p_status not in ('accepted','en_route','arrived','passenger_onboard','completed') then raise exception 'Ogiltig status'; end if;
 select id into v_driver_id from public.drivers where auth_user_id=(select auth.uid()) and active and approved and archived_at is null;
 select status into v_old from public.bookings where id=p_booking_id and driver_id=v_driver_id for update;
 if not found then raise exception 'Körningen tillhör inte föraren'; end if;
 if p_status='accepted' and v_old not in ('assigned','offered') then raise exception 'Körningen kan inte accepteras'; end if;
 update public.bookings set status=p_status,confirmed_at=case when p_status='accepted' then coalesce(confirmed_at,now()) else confirmed_at end,picked_up_at=case when p_status='passenger_onboard' then coalesce(picked_up_at,now()) else picked_up_at end,completed_at=case when p_status='completed' then coalesce(completed_at,now()) else completed_at end,updated_at=now() where id=p_booking_id returning * into v_booking;
 update public.drivers set availability_status=case when p_status='completed' then 'available' else 'busy' end where id=v_driver_id;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(p_booking_id,v_old,p_status,'driver','Status ändrad i förarappen'); return v_booking;
end $$;

create or replace function public.driver_reject_my_booking(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_driver_id uuid; v_booking public.bookings; v_old text;
begin
 select id into v_driver_id from public.drivers where auth_user_id=(select auth.uid()) and active and approved and archived_at is null;
 select status into v_old from public.bookings where id=p_booking_id and driver_id=v_driver_id for update;
 if not found or v_old not in ('assigned','offered') then raise exception 'Körningen kan inte avvisas'; end if;
 update public.booking_driver_offers set status='declined',responded_at=now() where booking_id=p_booking_id and driver_id=v_driver_id and status='offered';
 update public.bookings set driver_id=null,status='new',dispatched_at=null,updated_at=now() where id=p_booking_id returning * into v_booking;
 update public.drivers set availability_status='available' where id=v_driver_id;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(p_booking_id,v_old,'new','driver','Föraren tackade nej'); return v_booking;
end $$;

create or replace function public.log_avenyn_price_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.fixed_price is distinct from new.fixed_price then insert into public.price_change_log(price_zone_id,setting_name,old_value,new_value,changed_by) values(new.id,'fixed_price',old.fixed_price,new.fixed_price,(select auth.uid())); end if;
 return new;
end $$;
drop trigger if exists trg_avenyn_price_change on public.price_zones;
create trigger trg_avenyn_price_change after update of fixed_price on public.price_zones for each row execute function public.log_avenyn_price_change();

revoke all on function public.driver_register_self(text,text) from public;
grant execute on function public.driver_register_self(text,text) to authenticated;
revoke all on function public.driver_reject_my_booking(uuid) from public;
grant execute on function public.driver_reject_my_booking(uuid) to authenticated;
revoke all on function public.dispatch_auto_assign(uuid,text) from public;
grant execute on function public.dispatch_auto_assign(uuid,text) to authenticated;
