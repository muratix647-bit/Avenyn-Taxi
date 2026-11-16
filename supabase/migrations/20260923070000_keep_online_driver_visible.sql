-- Keep an explicitly online driver visible at the latest known position while
-- a locked phone pauses browser GPS updates. The driver remains in control of
-- visibility through the online/offline toggle.
create or replace function public.public_online_drivers()
returns table(latitude double precision,longitude double precision,heading double precision,updated_at timestamptz)
language sql security definer set search_path=public as $$
 select round(l.latitude::numeric,2)::double precision,
        round(l.longitude::numeric,2)::double precision,
        l.heading,
        l.updated_at
 from public.driver_locations l
 join public.drivers d on d.id=l.driver_id
 where d.active
   and d.approved
   and d.is_online
   and d.archived_at is null
$$;

revoke all on function public.public_online_drivers() from public;
grant execute on function public.public_online_drivers() to anon,authenticated;
