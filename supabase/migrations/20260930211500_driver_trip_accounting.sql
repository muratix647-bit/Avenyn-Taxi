alter table public.bookings
  add column if not exists driver_reported_amount numeric,
  add column if not exists driver_reported_payment_method text,
  add column if not exists driver_reported_paid boolean,
  add column if not exists driver_reported_payment_note text,
  add column if not exists driver_reported_at timestamptz,
  add column if not exists driver_reported_by uuid references public.drivers(id) on delete set null;

alter table public.bookings
  drop constraint if exists bookings_driver_reported_amount_check;

alter table public.bookings
  add constraint bookings_driver_reported_amount_check
  check (driver_reported_amount is null or (driver_reported_amount >= 0 and driver_reported_amount <= 100000)) not valid;

alter table public.bookings
  drop constraint if exists bookings_driver_reported_payment_method_check;

alter table public.bookings
  add constraint bookings_driver_reported_payment_method_check
  check (
    driver_reported_payment_method is null
    or driver_reported_payment_method in ('app', 'card', 'swish', 'paypal', 'cash', 'invoice', 'other')
  ) not valid;

create index if not exists bookings_driver_completed_report_idx
  on public.bookings (driver_id, completed_at desc)
  where status = 'completed';

comment on column public.bookings.driver_reported_amount is
  'Slutbelopp registrerat av den tilldelade föraren när körningen avslutas.';
comment on column public.bookings.driver_reported_payment_method is
  'Betalsätt registrerat av föraren. Separat från betalningsleverantörens status.';
comment on column public.bookings.driver_reported_paid is
  'Förarens uppgift om betalning mottagits. Ändrar inte payment_status för onlinebetalningar.';

create or replace function public.driver_complete_my_booking(
  p_booking_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_paid boolean,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver_id uuid;
  v_booking public.bookings;
  v_method text := lower(trim(coalesce(p_payment_method, '')));
  v_paid boolean := coalesce(p_paid, false);
begin
  if p_amount is null or p_amount < 0 or p_amount > 100000 then
    raise exception 'Ange ett giltigt slutbelopp';
  end if;
  if v_method not in ('app', 'card', 'swish', 'paypal', 'cash', 'invoice', 'other') then
    raise exception 'Välj ett giltigt betalsätt';
  end if;
  if v_method = 'other' and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Beskriv det andra betalsättet';
  end if;

  select id into v_driver_id
  from public.drivers
  where auth_user_id = (select auth.uid())
    and active
    and approved
    and archived_at is null;

  if v_driver_id is null then
    raise exception 'Aktivt förarkonto saknas';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and driver_id = v_driver_id
  for update;

  if not found then
    raise exception 'Körningen tillhör inte föraren';
  end if;
  if v_booking.status <> 'passenger_onboard' then
    raise exception 'Körningen måste ha status Kund i bilen innan den kan slutföras';
  end if;

  if v_booking.payment_status = 'paid' then
    v_method := 'app';
    v_paid := true;
  end if;

  update public.bookings
  set status = 'completed',
      actual_price = p_amount,
      completed_at = now(),
      driver_reported_amount = p_amount,
      driver_reported_payment_method = v_method,
      driver_reported_paid = v_paid,
      driver_reported_payment_note = nullif(trim(coalesce(p_note, '')), ''),
      driver_reported_at = now(),
      driver_reported_by = v_driver_id,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  update public.drivers
  set availability_status = 'available', updated_at = now()
  where id = v_driver_id;

  insert into public.booking_status_history(
    booking_id, old_status, new_status, changed_by, note
  ) values (
    p_booking_id,
    'passenger_onboard',
    'completed',
    'driver',
    'Körningen slutfördes med belopp och betalsätt registrerat i förarappen'
  );

  return v_booking;
end;
$$;

create or replace function public.driver_undo_my_booking_status(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver_id uuid;
  v_booking public.bookings;
  v_previous_status text;
begin
  select id into v_driver_id
  from public.drivers
  where auth_user_id = (select auth.uid())
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

  v_previous_status := case v_booking.status
    when 'accepted' then 'assigned'
    when 'en_route' then 'accepted'
    when 'arrived' then 'en_route'
    when 'passenger_onboard' then 'arrived'
    when 'completed' then 'passenger_onboard'
    else null
  end;

  if v_previous_status is null then
    raise exception 'Den här statusen kan inte ångras';
  end if;
  if v_booking.status = 'completed'
    and v_booking.completed_at < now() - interval '15 minutes' then
    raise exception 'En slutförd körning kan bara återöppnas inom 15 minuter';
  end if;

  update public.bookings
  set status = v_previous_status,
      completed_at = case when v_booking.status = 'completed' then null else completed_at end,
      picked_up_at = case when v_booking.status = 'passenger_onboard' then null else picked_up_at end,
      driver_reported_amount = case when v_booking.status = 'completed' then null else driver_reported_amount end,
      driver_reported_payment_method = case when v_booking.status = 'completed' then null else driver_reported_payment_method end,
      driver_reported_paid = case when v_booking.status = 'completed' then null else driver_reported_paid end,
      driver_reported_payment_note = case when v_booking.status = 'completed' then null else driver_reported_payment_note end,
      driver_reported_at = case when v_booking.status = 'completed' then null else driver_reported_at end,
      driver_reported_by = case when v_booking.status = 'completed' then null else driver_reported_by end,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  update public.drivers
  set availability_status = 'busy', updated_at = now()
  where id = v_driver_id;

  insert into public.booking_status_history(
    booking_id, old_status, new_status, changed_by, note
  ) values (
    p_booking_id,
    case v_previous_status
      when 'assigned' then 'accepted'
      when 'accepted' then 'en_route'
      when 'en_route' then 'arrived'
      when 'arrived' then 'passenger_onboard'
      else 'completed'
    end,
    v_previous_status,
    'driver',
    'Föraren ångrade senaste statusändringen'
  );

  return v_booking;
end;
$$;

revoke all on function public.driver_complete_my_booking(uuid, numeric, text, boolean, text) from public, anon;
grant execute on function public.driver_complete_my_booking(uuid, numeric, text, boolean, text) to authenticated;

revoke all on function public.driver_undo_my_booking_status(uuid) from public, anon;
grant execute on function public.driver_undo_my_booking_status(uuid) to authenticated;
