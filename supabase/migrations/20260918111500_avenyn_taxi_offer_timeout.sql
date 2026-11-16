create extension if not exists pg_cron with schema extensions;

create or replace function public.process_expired_driver_offers()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare offer_record record;
begin
  for offer_record in
    select distinct booking_id
    from public.booking_driver_offers
    where status = 'offered' and expires_at <= now()
  loop
    update public.booking_driver_offers
      set status = 'expired', responded_at = now()
      where booking_id = offer_record.booking_id and status = 'offered' and expires_at <= now();
    update public.bookings
      set driver_id = null, status = 'new', updated_at = now()
      where id = offer_record.booking_id and status = 'offered';
    perform public.dispatch_auto_assign(offer_record.booking_id, 'offer_timeout');
  end loop;
end;
$$;

revoke all on function public.process_expired_driver_offers() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'avenyn-driver-offer-timeout';
select cron.schedule('avenyn-driver-offer-timeout', '* * * * *', 'select public.process_expired_driver_offers()');
