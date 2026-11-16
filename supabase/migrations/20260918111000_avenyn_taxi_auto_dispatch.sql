-- Automatic dispatch follows OpenRide's offer/timeout pattern while preserving
-- Avenyn Taxi's existing bookings and driver records. Apache-2.0 inspiration;
-- no OpenRide branding or copied proprietary assets are used.
create or replace function public.auto_dispatch_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'new' then
    perform public.dispatch_auto_assign(new.id, 'auto_dispatch');
  end if;
  return new;
exception when others then
  -- A booking must never be lost just because no suitable driver is online.
  return new;
end;
$$;

revoke all on function public.auto_dispatch_new_booking() from public, anon, authenticated;

drop trigger if exists bookings_auto_dispatch_after_insert on public.bookings;
create trigger bookings_auto_dispatch_after_insert
after insert on public.bookings
for each row execute function public.auto_dispatch_new_booking();
