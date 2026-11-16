create table if not exists public.driver_trip_accounting_edits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  changed_by_auth_user uuid not null references auth.users(id) on delete restrict,
  previous_values jsonb not null,
  new_values jsonb not null,
  reason text not null,
  changed_at timestamptz not null default now()
);

alter table public.driver_trip_accounting_edits enable row level security;

create index if not exists driver_trip_accounting_edits_booking_idx
  on public.driver_trip_accounting_edits (booking_id, changed_at desc);

create index if not exists driver_trip_accounting_edits_driver_idx
  on public.driver_trip_accounting_edits (driver_id, changed_at desc);

comment on table public.driver_trip_accounting_edits is
  'Oföränderlig historik över rättelser som förare gör i slutförda körningars redovisning.';

create or replace function public.driver_my_completed_bookings(p_month date)
returns setof public.bookings
language sql
security definer
set search_path = public, pg_temp
as $$
  select b.*
  from public.bookings b
  join public.drivers d on d.id = b.driver_id
  where d.auth_user_id = (select auth.uid())
    and d.active
    and d.approved
    and d.archived_at is null
    and b.archived_at is null
    and b.status = 'completed'
    and b.completed_at >= (date_trunc('month', p_month::timestamp) at time zone 'Europe/Stockholm')
    and b.completed_at < ((date_trunc('month', p_month::timestamp) + interval '1 month') at time zone 'Europe/Stockholm')
  order by b.completed_at desc
$$;

create or replace function public.driver_update_my_completed_booking(
  p_booking_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_paid boolean,
  p_note text default null,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver_id uuid;
  v_auth_user_id uuid := (select auth.uid());
  v_booking public.bookings;
  v_method text := lower(trim(coalesce(p_payment_method, '')));
  v_paid boolean := coalesce(p_paid, false);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_amount is null or p_amount < 0 or p_amount > 100000 then
    raise exception 'Ange ett giltigt belopp';
  end if;
  if v_method not in ('app', 'card', 'swish', 'paypal', 'cash', 'invoice', 'other') then
    raise exception 'Välj ett giltigt betalsätt';
  end if;
  if v_method = 'other' and v_note is null then
    raise exception 'Beskriv det andra betalsättet';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'Ange varför uppgifterna ändras';
  end if;
  if char_length(v_reason) > 300 or char_length(coalesce(v_note, '')) > 200 then
    raise exception 'Texten är för lång';
  end if;

  select id into v_driver_id
  from public.drivers
  where auth_user_id = v_auth_user_id
    and active
    and approved
    and archived_at is null;

  if v_driver_id is null then
    raise exception 'Aktivt förarkonto saknas';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and driver_id = v_driver_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'Körningen tillhör inte föraren';
  end if;
  if v_booking.status <> 'completed' then
    raise exception 'Endast slutförda körningar kan redigeras';
  end if;
  if v_booking.payment_status = 'paid' then
    raise exception 'En verifierad appbetalning kan inte ändras i förarappen';
  end if;

  insert into public.driver_trip_accounting_edits(
    booking_id,
    driver_id,
    changed_by_auth_user,
    previous_values,
    new_values,
    reason
  ) values (
    p_booking_id,
    v_driver_id,
    v_auth_user_id,
    jsonb_build_object(
      'amount', v_booking.driver_reported_amount,
      'payment_method', v_booking.driver_reported_payment_method,
      'paid', v_booking.driver_reported_paid,
      'note', v_booking.driver_reported_payment_note
    ),
    jsonb_build_object(
      'amount', p_amount,
      'payment_method', v_method,
      'paid', v_paid,
      'note', v_note
    ),
    v_reason
  );

  update public.bookings
  set actual_price = p_amount,
      driver_reported_amount = p_amount,
      driver_reported_payment_method = v_method,
      driver_reported_paid = v_paid,
      driver_reported_payment_note = v_note,
      driver_reported_at = now(),
      driver_reported_by = v_driver_id,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.driver_my_completed_bookings(date) from public, anon;
grant execute on function public.driver_my_completed_bookings(date) to authenticated;

revoke all on function public.driver_update_my_completed_booking(uuid, numeric, text, boolean, text, text) from public, anon;
grant execute on function public.driver_update_my_completed_booking(uuid, numeric, text, boolean, text, text) to authenticated;
