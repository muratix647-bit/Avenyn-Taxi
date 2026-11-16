-- Remove direct anonymous access to operational/customer records. Public flows
-- use narrowly scoped RPCs; official prices remain readable by the public API.
revoke all on table public.bookings from anon;
revoke all on table public.drivers from anon;
revoke all on table public.driver_locations from anon;
revoke all on table public.booking_driver_offers from anon;
revoke all on table public.booking_status_history from anon;
revoke all on table public.dispatch_admins from anon;
revoke all on table public.profiles from anon;
revoke all on table public.vehicles from anon;
revoke all on table public.price_change_log from anon;

alter view if exists public.dispatch_bookings set (security_invoker = true);
alter view if exists public.dispatch_drivers set (security_invoker = true);
revoke all on public.dispatch_bookings from anon;
revoke all on public.dispatch_drivers from anon;

alter table if exists public."Dzevat Murati" enable row level security;
revoke all on table public."Dzevat Murati" from anon;

-- Legacy ID-taking RPCs are superseded by auth-bound "my" RPCs.
revoke all on function public.driver_accept_booking(uuid,uuid) from anon, authenticated;
revoke all on function public.driver_progress_booking(uuid,uuid,text) from anon, authenticated;
revoke all on function public.driver_respond_offer(uuid,uuid,boolean) from anon, authenticated;
revoke all on function public.driver_set_online(uuid,boolean) from anon, authenticated;
revoke all on function public.driver_update_location(uuid,double precision,double precision,double precision,double precision) from anon, authenticated;
revoke all on function public.customer_booking_status(bigint,text) from anon, authenticated;
revoke all on function public.customer_create_booking(text,text,text,text,text,date,time without time zone,integer,integer,text,text,numeric,boolean,text) from anon, authenticated;
