-- Avenyn Taxi unified production backend.
-- Architecture adapted from OpenRide (Apache-2.0), © OpenRide contributors.
-- This migration is additive and preserves all existing production data.

create extension if not exists postgis with schema extensions;

alter table public.drivers add column if not exists legacy_external_id text;
alter table public.drivers add column if not exists approved boolean not null default false;
alter table public.drivers add column if not exists availability_status text not null default 'offline';
alter table public.drivers add column if not exists archived_at timestamptz;
create unique index if not exists drivers_legacy_external_id_uidx on public.drivers(legacy_external_id) where legacy_external_id is not null;
create index if not exists drivers_dispatch_idx on public.drivers(active, approved, is_online, availability_status);

alter table public.bookings add column if not exists legacy_d1_id bigint;
alter table public.bookings add column if not exists pickup_place_id text;
alter table public.bookings add column if not exists dropoff_place_id text;
alter table public.bookings add column if not exists pickup_point extensions.geography(Point,4326);
alter table public.bookings add column if not exists dropoff_point extensions.geography(Point,4326);
alter table public.bookings add column if not exists child_seats integer not null default 0;
alter table public.bookings add column if not exists extra_message text;
alter table public.bookings add column if not exists price_zone_code text;
alter table public.bookings add column if not exists price_breakdown jsonb not null default '{}'::jsonb;
alter table public.bookings add column if not exists archived_at timestamptz;
alter table public.bookings add column if not exists archived_by text;
alter table public.bookings add column if not exists payment_status text not null default 'unpaid';
create unique index if not exists bookings_legacy_d1_id_uidx on public.bookings(legacy_d1_id) where legacy_d1_id is not null;
create index if not exists bookings_dispatch_queue_idx on public.bookings(status, booking_date, pickup_time) where archived_at is null;
create index if not exists bookings_pickup_point_gix on public.bookings using gist(pickup_point);

do $$
declare c_name text;
begin
  select conname into c_name from pg_constraint
  where conrelid='public.bookings'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%status%';
  if c_name is not null then execute format('alter table public.bookings drop constraint %I',c_name); end if;
end $$;
alter table public.bookings add constraint bookings_status_unified_check check (status in ('new','scheduled','offered','assigned','accepted','en_route','arrived','passenger_onboard','completed','cancelled','Ny','Bekräftad','Tilldelad','På väg','Hämtad','Slutförd','Avbokad','Ej utförd')) not valid;

create table if not exists public.fare_settings (
  id boolean primary key default true,
  child_seat_surcharge numeric(10,2) not null default 100,
  large_vehicle_surcharge numeric(10,2) not null default 300,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.fare_settings(id,child_seat_surcharge,large_vehicle_surcharge)
values(true,100,300) on conflict(id) do nothing;

create table if not exists public.price_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  region text not null default 'Västra Götaland',
  destination_code text not null default 'se-got-landvetter-airport',
  fixed_price numeric(10,2) not null check(fixed_price >= 0),
  aliases text[] not null default '{}',
  boundary extensions.geometry(MultiPolygon,4326),
  active boolean not null default true,
  source_url text not null default 'https://www.avenyntaxi.se/pricing',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists price_zones_boundary_gix on public.price_zones using gist(boundary);
create index if not exists price_zones_active_destination_idx on public.price_zones(active,destination_code);

create table if not exists public.price_change_log (
  id uuid primary key default gen_random_uuid(),
  price_zone_id uuid references public.price_zones(id) on delete set null,
  setting_name text,
  old_value numeric,
  new_value numeric,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);
create index if not exists price_change_log_changed_at_idx on public.price_change_log(changed_at desc);

with prices(name,price) as (values
('Agnesberg',575),('Almedal',430),('Andalen',760),('Angered C',570),('Annedal',450),('Arendal',655),('Aröds ind. Omr',520),('Askim',610),
('Avenyn',430),('Backa',505),('Backaplan',475),('Backatorp',530),('Bagaregården',455),('Balltorp',515),('Bergsjön',470),('Bifrost',450),
('Billdal',710),('Biskopsgården',570),('Bjurslätt',530),('Björkekärr',455),('Björlanda',665),('Bohus',725),('Brunnsbo',470),('Bräcke',525),
('Bäckebol',515),('Bö',430),('Centralen',430),('Ekebäck',570),('Eklanda',530),('Eriksberg',530),('Eriksbo',565),('Fiskebäck',625),
('Flatås',575),('Floda',775),('Fredriksdal',430),('Frölunda',580),('Furulund',430),('Gamlestan',440),('Gerrebacka',625),('Grimmered',595),
('Grimbo ind.',535),('Gråbo',680),('Gulbergsvass',430),('Guldheden',430),('Gunnilse',530),('Gårda',430),('Gårdsten',625),('Haga',450),
('Hagen',625),('Hammarkullen',580),('Heden',430),('Helenevik',430),('Helgered',565),('Hjuvik',805),('Hjällbo',530),('Hovås',610),
('Härlanda',440),('Inom Vallgraven',430),('Jakobsdal',430),('Johanneberg',430),('Jonsered',440),('Jungfruplatsen',450),('Järnbrott',545),('Järntorget',480),
('Kallebäck',430),('Kaverös',595),('Kikås',430),('Korsvägen',430),('Kortedala',520),('Krokslätt',430),('Kungsbacka',750),('Kungshöjd',430),
('Kungsten',565),('Kungälv',750),('Kullavik',750),('Kvarnby',430),('Kviberg',475),('Kvillebäcken',475),('Kyrkbyn',530),('Kållered',550),
('Kålltorp',470),('Kärra',600),('Kärrdalen',540),('Lackarebäck',430),('Landala',430),('Landvetter',375),('Lerum',645),('Lilla Varholmen',815),
('Lillhagen',515),('Lilleby',780),('Lindome',600),('Lindholmen',530),('Linnarhult',535),('Linné',460),('Lundby',530),('Lunden',440),
('Långedrag',635),('Låssby',710),('Länsmansgården',585),('Lövgärdet',655),('Majorna',530),('Marstrand',1215),('Masthugget',485),('Munkebäck',455),
('Mölnlycke',400),('Mölndal C',455),('Nol',855),('Nordstan',430),('Nya varvet',585),('Näset',640),('Nödinge',820),('Olofstorp',645),
('Olskroken',440),('Onsala',915),('Partille',430),('Pixbo',430),('Påvelund',625),('Ramberget',500),('Rannebergen',665),('Redbergslid',440),
('Ringön',485),('Rävekärr',475),('Saltholmen',665),('Sannegården',530),('Sandarna',540),('Sisjö ind',530),('Skintebo',665),('Skogome',575),
('Skår',430),('Solängen',450),('Stampen',430),('Stenkullen',680),('Stensjön',430),('Storås ind',580),('Surte',655),('Svartedalen',545),
('Svingeln',430),('Särö',840),('Säve',665),('Sävedalen',460),('Sävenäs ind',460),('Tagene',530),('Tolered',530),('Toltorpsdalen',450),
('Torslanda C',730),('Tumlehed',760),('Tuve',545),('Tynnered',595),('Utby',460),('Vasastan',430),('Volvo Lundby',530),('Volvo Torslanda',655),
('Volvo Tuve',625),('Wieselgren',500),('Åby',470),('Åbro ind.',470),('Änggården',500),('Öjersjö',430)
)
insert into public.price_zones(code,name,fixed_price,aliases)
select lower(regexp_replace(translate(name,'ÅÄÖåäö .','AAOaao--'),'[^a-zA-Z0-9-]+','','g')),name,price,array[lower(name)] from prices
on conflict(code) do update set name=excluded.name,fixed_price=excluded.fixed_price,active=true,source_url=excluded.source_url,updated_at=now();

update public.price_zones set
 aliases=array['backa','hisings backa','bällskär','backa göteborg'],
 boundary=extensions.st_multi(extensions.st_geomfromtext('POLYGON((11.955 57.720,12.015 57.720,12.015 57.775,11.955 57.775,11.955 57.720))',4326))
where name='Backa';
update public.price_zones set aliases=array['göteborg central','göteborg centralstation','göteborg c','centralstationen','centralen'] where name='Centralen';
update public.price_zones set aliases=array['avenyn','kungsportsavenyen','avenyn göteborg'] where name='Avenyn';
update public.price_zones set aliases=array['frölunda','frölunda torg','västra frölunda'] where name='Frölunda';
update public.price_zones set aliases=array['mölndal c','mölndal centrum'] where name='Mölndal C';

create or replace function public.avenyn_is_landvetter(p_address text,p_place_id text default null)
returns boolean language sql immutable as $$
 select coalesce(p_place_id,'')='se-got-landvetter-airport' or coalesce(p_address,'') ~* '(landvetter[[:space:]]+(airport|flygplats)|(airport|flygplats)[[:space:]]+landvetter|flygplatsvägen.*438[[:space:]]*80|438[[:space:]]*80.*(landvetter|härryda))'
$$;

create or replace function public.avenyn_quote(
 p_pickup_address text,p_dropoff_address text,
 p_pickup_lat double precision,p_pickup_lng double precision,
 p_dropoff_lat double precision,p_dropoff_lng double precision,
 p_pickup_place_id text default null,p_dropoff_place_id text default null,
 p_area_hint text default null,p_car_type text default 'standard',p_child_seats integer default 0)
returns table(zone_code text,zone_name text,base_price numeric,large_surcharge numeric,child_seat_surcharge numeric,total_price numeric,reason text)
language plpgsql security definer set search_path=public,extensions as $$
declare v_airport_from boolean; v_airport_to boolean; v_lat double precision; v_lng double precision; v_zone public.price_zones; v_settings public.fare_settings; v_large numeric; v_child numeric;
begin
 v_airport_from:=public.avenyn_is_landvetter(p_pickup_address,p_pickup_place_id);
 v_airport_to:=public.avenyn_is_landvetter(p_dropoff_address,p_dropoff_place_id);
 if v_airport_from=v_airport_to then return query select null::text,null::text,null::numeric,0::numeric,0::numeric,null::numeric,'not_landvetter_route'::text; return; end if;
 v_lat:=case when v_airport_to then p_pickup_lat else p_dropoff_lat end;
 v_lng:=case when v_airport_to then p_pickup_lng else p_dropoff_lng end;
 if v_lat is null or v_lng is null or v_lat not between 54 and 70 or v_lng not between 8 and 25 then return query select null::text,null::text,null::numeric,0::numeric,0::numeric,null::numeric,'missing_coordinates'::text; return; end if;
 select * into v_zone from public.price_zones z where z.active and z.destination_code='se-got-landvetter-airport' and z.boundary is not null and extensions.st_covers(z.boundary,extensions.st_setsrid(extensions.st_makepoint(v_lng,v_lat),4326)) order by extensions.st_area(z.boundary) limit 1;
 if v_zone.id is null and nullif(trim(coalesce(p_area_hint,'')),'') is not null then
   select * into v_zone from public.price_zones z where z.active and (lower(z.name)=lower(trim(p_area_hint)) or lower(trim(p_area_hint))=any(z.aliases)) limit 1;
 end if;
 if v_zone.id is null then return query select null::text,null::text,null::numeric,0::numeric,0::numeric,null::numeric,'manual_quote_required'::text; return; end if;
 select * into v_settings from public.fare_settings where id=true;
 v_large:=case when lower(coalesce(p_car_type,'')) in ('large','storbil') then coalesce(v_settings.large_vehicle_surcharge,300) else 0 end;
 v_child:=greatest(0,least(3,coalesce(p_child_seats,0)))*coalesce(v_settings.child_seat_surcharge,100);
 return query select v_zone.code,v_zone.name,v_zone.fixed_price,v_large,v_child,v_zone.fixed_price+v_large+v_child,'fixed_landvetter'::text;
end $$;

create or replace function public.customer_create_booking(
 p_customer_name text,p_customer_phone text,p_customer_email text,
 p_pickup_address text,p_dropoff_address text,p_booking_date date,p_pickup_time time,
 p_passengers integer default 1,p_luggage_count integer default 0,p_car_type text default 'standard',
 p_payment_method text default 'Kort',p_child_seats integer default 0,p_notes text default null,
 p_pickup_lat double precision default null,p_pickup_lng double precision default null,
 p_dropoff_lat double precision default null,p_dropoff_lng double precision default null,
 p_pickup_place_id text default null,p_dropoff_place_id text default null,p_area_hint text default null)
returns table(id uuid,booking_number bigint,status text,tracking_token uuid,price numeric,zone_name text)
language plpgsql security definer set search_path=public,extensions as $$
declare v_id uuid; v_number bigint; v_status text; v_token uuid; v_quote record;
begin
 if nullif(trim(p_customer_name),'') is null or nullif(trim(p_customer_phone),'') is null or nullif(trim(p_customer_email),'') is null then raise exception 'Namn, mobilnummer och e-post krävs'; end if;
 if p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Ogiltig e-postadress'; end if;
 if nullif(trim(p_pickup_address),'') is null or nullif(trim(p_dropoff_address),'') is null then raise exception 'Hämtadress och destination krävs'; end if;
 if p_booking_date<current_date or p_passengers not between 1 and 7 or p_child_seats not between 0 and 3 then raise exception 'Kontrollera datum, passagerare och tillval'; end if;
 select * into v_quote from public.avenyn_quote(p_pickup_address,p_dropoff_address,p_pickup_lat,p_pickup_lng,p_dropoff_lat,p_dropoff_lng,p_pickup_place_id,p_dropoff_place_id,p_area_hint,p_car_type,p_child_seats);
 if v_quote.total_price is null then raise exception 'Kontakta oss för fast pris'; end if;
 insert into public.bookings(customer_name,customer_phone,customer_email,pickup_address,dropoff_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_point,dropoff_point,pickup_place_id,dropoff_place_id,booking_date,pickup_time,passengers,luggage_count,car_type,payment_method,estimated_price,fixed_price,status,source,child_seat,child_seats,notes,extra_message,booked_by,price_zone_code,price_breakdown)
 values(trim(p_customer_name),trim(p_customer_phone),lower(trim(p_customer_email)),trim(p_pickup_address),trim(p_dropoff_address),p_pickup_lat,p_pickup_lng,p_dropoff_lat,p_dropoff_lng,
 case when p_pickup_lat is null or p_pickup_lng is null then null else extensions.st_setsrid(extensions.st_makepoint(p_pickup_lng,p_pickup_lat),4326)::extensions.geography end,
 case when p_dropoff_lat is null or p_dropoff_lng is null then null else extensions.st_setsrid(extensions.st_makepoint(p_dropoff_lng,p_dropoff_lat),4326)::extensions.geography end,
 p_pickup_place_id,p_dropoff_place_id,p_booking_date,p_pickup_time,p_passengers,greatest(0,p_luggage_count),p_car_type,p_payment_method,v_quote.total_price,v_quote.total_price,'new','Website',p_child_seats>0,p_child_seats,p_notes,p_notes,'customer',v_quote.zone_code,jsonb_build_object('zone',v_quote.zone_name,'base',v_quote.base_price,'large_vehicle',v_quote.large_surcharge,'child_seats',v_quote.child_seat_surcharge))
 returning bookings.id,bookings.booking_number,bookings.status,bookings.tracking_token into v_id,v_number,v_status,v_token;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(v_id,null,v_status,'customer','Bokning skapad via kundsidan');
 return query select v_id,v_number,v_status,v_token,v_quote.total_price,v_quote.zone_name;
end $$;

drop function if exists public.customer_tracking(uuid);
create or replace function public.customer_tracking(p_tracking_token uuid)
returns table(booking_number bigint,booking_date date,pickup_time time,pickup_address text,dropoff_address text,status text,price numeric,driver_name text,vehicle_number text,vehicle_model text,registration_number text,driver_latitude double precision,driver_longitude double precision,location_updated_at timestamptz)
language sql security definer set search_path=public as $$
 select b.booking_number,b.booking_date,b.pickup_time,b.pickup_address,b.dropoff_address,b.status,coalesce(b.actual_price,b.fixed_price,b.estimated_price),split_part(coalesce(d.full_name,''),' ',1),d.vehicle_number,d.vehicle_model,d.registration_number,dl.latitude,dl.longitude,dl.updated_at
 from public.bookings b left join public.drivers d on d.id=b.driver_id left join public.driver_locations dl on dl.driver_id=b.driver_id
 where b.tracking_token=p_tracking_token limit 1
$$;

create or replace function public.driver_update_my_location(p_latitude double precision,p_longitude double precision,p_heading double precision default null,p_speed_kmh double precision default null)
returns public.driver_locations language plpgsql security definer set search_path=public as $$
declare v_driver_id uuid; v_location public.driver_locations;
begin
 select id into v_driver_id from public.drivers where auth_user_id=(select auth.uid()) and active and approved and archived_at is null;
 if v_driver_id is null then raise exception 'Aktivt förarkonto saknas'; end if;
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Ogiltig GPS-position'; end if;
 insert into public.driver_locations(driver_id,latitude,longitude,heading,speed_kmh,updated_at) values(v_driver_id,p_latitude,p_longitude,p_heading,p_speed_kmh,now())
 on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,heading=excluded.heading,speed_kmh=excluded.speed_kmh,updated_at=now() returning * into v_location;
 update public.drivers set is_online=true,availability_status=case when availability_status='offline' then 'available' else availability_status end,updated_at=now() where id=v_driver_id;
 return v_location;
end $$;

create or replace function public.driver_set_my_online(p_online boolean,p_status text default null)
returns public.drivers language plpgsql security definer set search_path=public as $$
declare v_driver public.drivers;
begin
 update public.drivers set is_online=p_online,availability_status=case when not p_online then 'offline' when p_status in ('available','busy','paused') then p_status else 'available' end,updated_at=now()
 where auth_user_id=(select auth.uid()) and active and approved and archived_at is null returning * into v_driver;
 if not found then raise exception 'Aktivt förarkonto saknas'; end if; return v_driver;
end $$;

create or replace function public.driver_my_bookings()
returns setof public.bookings language sql security definer set search_path=public as $$
 select b.* from public.bookings b join public.drivers d on d.id=b.driver_id where d.auth_user_id=(select auth.uid()) and d.active and d.approved and b.archived_at is null order by b.booking_date,b.pickup_time
$$;

create or replace function public.driver_respond_my_offer(p_booking_id uuid,p_accept boolean)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_driver_id uuid; v_booking public.bookings; v_offer public.booking_driver_offers; v_old text;
begin
 select id into v_driver_id from public.drivers where auth_user_id=(select auth.uid()) and active and approved and archived_at is null;
 select * into v_offer from public.booking_driver_offers where booking_id=p_booking_id and driver_id=v_driver_id and status='offered' for update;
 if not found or v_offer.expires_at<now() then raise exception 'Erbjudandet är inte längre aktivt'; end if;
 select status into v_old from public.bookings where id=p_booking_id for update;
 if p_accept then
  update public.booking_driver_offers set status='accepted',responded_at=now() where id=v_offer.id;
  update public.bookings set driver_id=v_driver_id,status='accepted',confirmed_at=coalesce(confirmed_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
  update public.drivers set availability_status='busy' where id=v_driver_id;
 else
  update public.booking_driver_offers set status='declined',responded_at=now() where id=v_offer.id;
  update public.bookings set driver_id=null,status='new',dispatched_at=null,updated_at=now() where id=p_booking_id returning * into v_booking;
 end if;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(p_booking_id,v_old,v_booking.status,'driver',case when p_accept then 'Föraren accepterade erbjudandet' else 'Föraren avvisade erbjudandet' end);
 return v_booking;
end $$;

create or replace function public.driver_progress_my_booking(p_booking_id uuid,p_status text)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_driver_id uuid; v_booking public.bookings; v_old text;
begin
 if p_status not in ('en_route','arrived','passenger_onboard','completed') then raise exception 'Ogiltig status'; end if;
 select id into v_driver_id from public.drivers where auth_user_id=(select auth.uid()) and active and approved and archived_at is null;
 select status into v_old from public.bookings where id=p_booking_id and driver_id=v_driver_id for update;
 if not found then raise exception 'Körningen tillhör inte föraren'; end if;
 update public.bookings set status=p_status,picked_up_at=case when p_status='passenger_onboard' then coalesce(picked_up_at,now()) else picked_up_at end,completed_at=case when p_status='completed' then coalesce(completed_at,now()) else completed_at end,updated_at=now() where id=p_booking_id returning * into v_booking;
 if p_status='completed' then update public.drivers set availability_status='available' where id=v_driver_id; end if;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(p_booking_id,v_old,p_status,'driver','Status ändrad i förarappen'); return v_booking;
end $$;

create or replace function public.dispatch_auto_assign(p_booking_id uuid,p_changed_by text default 'auto_dispatch')
returns public.bookings language plpgsql security definer set search_path=public,extensions as $$
declare v_booking public.bookings; v_driver uuid; v_old text;
begin
 if (select auth.uid()) is not null and not public.is_dispatch_admin() then raise exception 'Endast dispatch'; end if;
 update public.booking_driver_offers set status='expired',responded_at=now() where booking_id=p_booking_id and status='offered' and expires_at<=now();
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found or exists(select 1 from public.booking_driver_offers where booking_id=p_booking_id and status='offered' and expires_at>now()) then return v_booking; end if;
 select d.id into v_driver from public.drivers d join public.driver_locations l on l.driver_id=d.id
 where d.active and d.approved and d.is_online and d.availability_status='available' and d.archived_at is null
 and l.updated_at>now()-interval '3 minutes' and not exists(select 1 from public.booking_driver_offers o where o.booking_id=p_booking_id and o.driver_id=d.id)
 order by case when v_booking.pickup_point is null then 0 else extensions.st_distance(v_booking.pickup_point,extensions.st_setsrid(extensions.st_makepoint(l.longitude,l.latitude),4326)::extensions.geography) end,l.updated_at desc limit 1;
 if v_driver is null then return v_booking; end if;
 v_old:=v_booking.status;
 insert into public.booking_driver_offers(booking_id,driver_id,status,expires_at) values(p_booking_id,v_driver,'offered',now()+interval '45 seconds');
 update public.bookings set driver_id=v_driver,status='offered',dispatched_at=coalesce(dispatched_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
 insert into public.booking_status_history(booking_id,old_status,new_status,changed_by,note) values(p_booking_id,v_old,'offered',p_changed_by,'Automatiskt erbjudande till närmaste lämpliga förare'); return v_booking;
end $$;

-- RLS: public callers use narrow RPCs; direct table access stays role-bound.
alter table public.fare_settings enable row level security;
alter table public.price_zones enable row level security;
alter table public.price_change_log enable row level security;
drop policy if exists price_zones_public_read on public.price_zones;
create policy price_zones_public_read on public.price_zones for select to anon,authenticated using(active);
drop policy if exists fare_settings_public_read on public.fare_settings;
create policy fare_settings_public_read on public.fare_settings for select to anon,authenticated using(true);
drop policy if exists price_zones_admin_write on public.price_zones;
create policy price_zones_admin_write on public.price_zones for all to authenticated using(public.is_dispatch_admin()) with check(public.is_dispatch_admin());
drop policy if exists fare_settings_admin_write on public.fare_settings;
create policy fare_settings_admin_write on public.fare_settings for all to authenticated using(public.is_dispatch_admin()) with check(public.is_dispatch_admin());
drop policy if exists price_change_log_admin on public.price_change_log;
create policy price_change_log_admin on public.price_change_log for select to authenticated using(public.is_dispatch_admin());

revoke all on function public.avenyn_quote(text,text,double precision,double precision,double precision,double precision,text,text,text,text,integer) from public;
grant execute on function public.avenyn_quote(text,text,double precision,double precision,double precision,double precision,text,text,text,text,integer) to anon,authenticated;
revoke all on function public.customer_create_booking(text,text,text,text,text,date,time,integer,integer,text,text,integer,text,double precision,double precision,double precision,double precision,text,text,text) from public;
grant execute on function public.customer_create_booking(text,text,text,text,text,date,time,integer,integer,text,text,integer,text,double precision,double precision,double precision,double precision,text,text,text) to anon,authenticated;
revoke all on function public.customer_tracking(uuid) from public;
grant execute on function public.customer_tracking(uuid) to anon,authenticated;
revoke all on function public.driver_update_my_location(double precision,double precision,double precision,double precision) from public;
grant execute on function public.driver_update_my_location(double precision,double precision,double precision,double precision) to authenticated;
revoke all on function public.driver_set_my_online(boolean,text) from public;
grant execute on function public.driver_set_my_online(boolean,text) to authenticated;
revoke all on function public.driver_my_bookings() from public;
grant execute on function public.driver_my_bookings() to authenticated;
revoke all on function public.driver_respond_my_offer(uuid,boolean) from public;
grant execute on function public.driver_respond_my_offer(uuid,boolean) to authenticated;
revoke all on function public.driver_progress_my_booking(uuid,text) from public;
grant execute on function public.driver_progress_my_booking(uuid,text) to authenticated;

-- Preserve and link existing D1 driver accounts.
insert into public.drivers(full_name,email,phone,active,is_online,status,legacy_external_id,approved,availability_status,auth_user_id)
select 'Dzei Murti','muratix647@gmail.com','0704536695',true,true,'active','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi',true,'available',(select id from auth.users where lower(email)='muratix647@gmail.com' limit 1)
where not exists(select 1 from public.drivers where legacy_external_id='C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi');
insert into public.drivers(full_name,email,phone,active,is_online,status,legacy_external_id,approved,availability_status,archived_at)
select 'Kristian Börjesson','dzevat.murati@gmail.com','0700315315',false,false,'archived','ucOq6TIzfYtq88AfuIQKTYgYMWp5N6nqrdHeLIlQu1uCGXSD54UAgT',false,'offline','2026-09-17T18:37:08Z'
where not exists(select 1 from public.drivers where legacy_external_id='ucOq6TIzfYtq88AfuIQKTYgYMWp5N6nqrdHeLIlQu1uCGXSD54UAgT');
insert into public.dispatch_admins(auth_user_id,full_name,email,active,role)
select u.id,'Dzevat Murati',u.email,true,'admin' from auth.users u where lower(u.email)='muratix647@gmail.com'
on conflict(auth_user_id) do update set active=true,role='admin',email=excluded.email;

insert into public.driver_locations(driver_id,latitude,longitude,heading,speed_kmh,updated_at)
select d.id,57.741299561620615,11.982560187458384,0,0,'2026-09-18T04:20:02Z'::timestamptz from public.drivers d where d.legacy_external_id='C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi'
on conflict(driver_id) do nothing;

with legacy(legacy_id,pickup,destination,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,customer_name,customer_phone,customer_email,scheduled,passengers,car_type,child_seats,price,status,driver_legacy,created_at,tracking_token,archived_at,archived_by) as (values
(1,'stora Kronogårdsgatan 92','Landvetter flygplats',null::double precision,null::double precision,null::double precision,null::double precision,'Dzevat ','0704536665','muratix647@gmail.com','2026-09-17T06:43:00+02'::timestamptz,1,'standard',0,295,'cancelled','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-14T04:44:48Z'::timestamptz,null::uuid,'2026-09-14T20:12:03Z'::timestamptz,'muratix647@gmail.com'),
(2,'stora 1Min position','Landvetter flygplats',null,null,null,null,'Dzevat ','07044070','maisi@gmail.con','2026-09-15T07:43:00+02'::timestamptz,1,'large',1,905,'cancelled','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-14T05:44:03Z',null,'2026-09-14T20:12:01Z','muratix647@gmail.com'),
(3,'stora kronogårdsgatan 92','landvetter flygplats',null,null,null,null,'dzeva','0704536695','muratix647@gmail.com','2026-10-01T13:00:00+02',1,'standard',0,505,'completed','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-14T18:20:15Z','614aae10-e7be-4fdb-a33b-1481406968b0','2026-09-14T20:12:06Z','muratix647@gmail.com'),
(4,'avenyn','Landvetter flyg',null,null,null,null,'de','070000001','ab@gmail.com','2026-10-02T14:00:00+02',1,'standard',0,430,'new',null,'2026-09-14T18:47:17Z','cf00b572-adc2-414d-bd18-d69d31420fa3','2026-09-17T17:35:43Z','muratix647@gmail.com'),
(5,'Stora Kronogårdsgatan 92','Landvetter flygplats',null,null,null,null,'Dzevat Murati','+46704536695','muratix647@gmail.com','2027-09-16T20:05:00+02',1,'large',0,805,'new',null,'2026-09-16T17:05:41Z','a73bc3f8-d0f7-449c-879b-bb0e7994f30a','2026-09-17T17:35:33Z','muratix647@gmail.com'),
(6,'stora Kronogårdsgatan 92','Landvetter flygplats',null,null,null,null,'Dzevat ','0704536695','muratix647@gmail.com','2026-09-19T16:07:00+02',1,'large',1,905,'new',null,'2026-09-17T14:08:01Z','e18e1790-cc79-42aa-8fd2-1ffbd32a9e2f','2026-09-17T17:35:31Z','muratix647@gmail.com'),
(7,'Kvillegatan 1','Landvetter flygplats',null,null,null,null,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-17T18:12:00+02',1,'large',2,975,'completed','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-17T14:12:44Z','f1b24570-766e-4e8d-b32b-9cdc04bd920c',null,null),
(8,'Min nuvarande position','landvetter flyg',57.741319691004456,11.982552486354288,null,null,'MURATI DZEVAT','0704536695','muratix647@gmail.com','2026-10-01T10:00:00+02',1,'standard',1,605,'assigned',null,'2026-09-17T17:44:44Z','f1a2934c-9766-41ae-8596-79f871b8e02a',null,null),
(9,'Stora Kronogårdsgatan 92','Landvetter flygplats',null,null,null,null,'Dzevat Murati','0704536695','muratix647@gmail.com','2026-09-19T20:34:00+02',1,'standard',0,505,'assigned',null,'2026-09-17T18:34:50Z','a7de33ec-2e43-4611-b293-4949725d8708',null,null),
(10,'Min nuvarande position','Landvetter flygplats',57.8583208,11.9976704,null,null,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-18T22:48:00+02',1,'standard',0,750,'passenger_onboard','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-17T18:49:06Z','daa12691-aa11-4cc2-b39a-65fb6f163e5b',null,null),
(11,'Stensötevägen 3, 422 47 Göteborg, Västra Götalands län','Flygplatsvägen, 438 80 Härryda kommun, Västra Götalands län',57.7516142,11.9730468,57.6624148,12.287763,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-20T01:06:00+02',1,'large',1,695,'accepted','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-17T23:08:28Z','53307b11-826b-42d4-8fc7-0ebba426fe21',null,null),
(12,'E 45, 662 98 Tösse, Västra Götalands län','Flygplatsvägen, 438 80 Härryda kommun, Västra Götalands län',58.9630492,12.6118094,57.6624148,12.287763,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-22T03:14:00+02',1,'standard',1,395,'completed','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-17T23:15:23Z','ae29454a-49e2-44b4-bec5-9e5173a8b9d9',null,null),
(13,'Stensötevägen 3, 422 47 Göteborg, Västra Götalands län','Landvetter flygplats',57.7516142,11.9730468,null,null,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-20T02:10:00+02',1,'standard',1,630,'completed','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-18T00:11:15Z','89895ecf-d488-49ef-be64-d87c90010835',null,null),
(14,'E 45, 446 37 Älvängen, Västra Götalands län','Landvetter flygplats',57.9629797,12.1283241,null,null,'Gaka Murati','+46700315315','dzevat.murati@gmail.com','2026-09-19T03:39:00+02',1,'large',0,1716,'passenger_onboard','C8fKVaI9gNMSUeGWDEkJvmfIBcGSjIwwAcFJwBjJv9cL6xlWHPOiTi','2026-09-18T01:40:04Z','5d28214b-7290-4394-8b1b-284789918768',null,null),
(15,'Odinslundsgatan, 412 51 Göteborg, Västra Götalands län','Landvetter Airport (Göteborg Landvetter Airport)',57.7002701,11.9954096,57.6688,12.2923,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-18T06:46:00+02',1,'standard',0,430,'new',null,'2026-09-18T04:47:59Z','b20a1672-667a-491b-9dff-e35277803de1',null,null),
(16,'Landvetter Airport (Göteborg Landvetter Airport)','Landvetter Airport (Göteborg Landvetter Airport)',57.6688,12.2923,57.6688,12.2923,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-19T11:15:00+02',1,'standard',0,375,'new',null,'2026-09-18T09:16:27Z','1113ef80-e61d-4f2d-9f01-c7bfaac60a33',null,null),
(17,'Landvetter Airport (Göteborg Landvetter Airport)','Landvetter Airport (Göteborg Landvetter Airport)',57.6688,12.2923,57.6688,12.2923,'Dzevat Murati','+46704536695','muratix647@gmail.com','2026-09-20T11:16:00+02',1,'standard',0,375,'new',null,'2026-09-18T09:17:03Z','27c08616-e710-497d-87d6-f08ce8eeaaed',null,null)
)
insert into public.bookings(legacy_d1_id,pickup_address,dropoff_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_point,dropoff_point,customer_name,customer_phone,customer_email,booking_date,pickup_time,passengers,car_type,child_seat,child_seats,estimated_price,fixed_price,status,source,driver_id,created_at,tracking_token,archived_at,archived_by,booked_by)
select l.legacy_id,l.pickup,l.destination,l.pickup_lat,l.pickup_lng,l.dropoff_lat,l.dropoff_lng,
 case when l.pickup_lat is null or l.pickup_lng is null then null else extensions.st_setsrid(extensions.st_makepoint(l.pickup_lng,l.pickup_lat),4326)::extensions.geography end,
 case when l.dropoff_lat is null or l.dropoff_lng is null then null else extensions.st_setsrid(extensions.st_makepoint(l.dropoff_lng,l.dropoff_lat),4326)::extensions.geography end,
 l.customer_name,l.customer_phone,l.customer_email,(l.scheduled at time zone 'Europe/Stockholm')::date,(l.scheduled at time zone 'Europe/Stockholm')::time,l.passengers,l.car_type,l.child_seats>0,l.child_seats,l.price,l.price,l.status,'Migrerad från Avenyn Taxi',d.id,l.created_at,coalesce(l.tracking_token,gen_random_uuid()),l.archived_at,l.archived_by,'migration'
from legacy l left join public.drivers d on d.legacy_external_id=l.driver_legacy
where not exists(select 1 from public.bookings b where b.legacy_d1_id=l.legacy_id);

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bookings') then alter publication supabase_realtime add table public.bookings; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='driver_locations') then alter publication supabase_realtime add table public.driver_locations; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='booking_driver_offers') then alter publication supabase_realtime add table public.booking_driver_offers; end if;
end $$;
