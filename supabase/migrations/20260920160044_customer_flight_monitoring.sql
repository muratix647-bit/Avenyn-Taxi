create extension if not exists pg_net with schema extensions;

create table if not exists public.booking_flight_monitors (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  flight_number text not null,
  direction text not null check (direction in ('arrivals', 'departures')),
  flight_date date not null,
  active boolean not null default true,
  last_scheduled_utc timestamptz,
  last_estimated_utc timestamptz,
  last_actual_utc timestamptz,
  last_status_code text,
  last_status text,
  last_gate text,
  last_baggage_claim text,
  last_first_bag_utc timestamptz,
  last_snapshot jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_flight_monitors enable row level security;
revoke all on public.booking_flight_monitors from anon, authenticated;

create index if not exists booking_flight_monitors_active_date_idx
  on public.booking_flight_monitors (active, flight_date);

insert into public.booking_flight_monitors (
  booking_id,
  flight_number,
  direction,
  flight_date
)
select
  b.id,
  upper(replace((regexp_match(b.notes, 'flyg(?:nummer)?\s*[:#-]?\s*([a-z0-9]{2,3}\s?[0-9]{1,4}[a-z]?)', 'i'))[1], ' ', '')),
  case
    when b.dropoff_address ~* '(landvetter|GOT\s*(airport|flygplats))'
      and b.pickup_address !~* '(landvetter|GOT\s*(airport|flygplats))'
    then 'departures'
    else 'arrivals'
  end,
  b.booking_date
from public.bookings b
where b.notes ~* 'flyg(?:nummer)?\s*[:#-]?\s*[a-z0-9]{2,3}\s?[0-9]{1,4}[a-z]?'
  and b.status not in ('completed', 'cancelled')
  and b.booking_date >= current_date - 1
on conflict (booking_id) do nothing;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'avenyn-flight-monitor-every-3-minutes') then
    perform cron.unschedule('avenyn-flight-monitor-every-3-minutes');
  end if;
end
$$;

select cron.schedule(
  'avenyn-flight-monitor-every-3-minutes',
  '*/3 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'avenyn_flight_monitor_url'),
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'avenyn_flight_monitor_secret')
      ),
      body := jsonb_build_object('scheduledAt', now()),
      timeout_milliseconds := 30000
    ) as request_id;
  $job$
);
