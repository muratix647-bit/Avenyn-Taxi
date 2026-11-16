create or replace function public.server_delete_trashed_booking(p_booking_id uuid,p_booking_number bigint,p_expected_archived_at timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_booking public.bookings%rowtype;
begin
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'Bokningen hittades inte'; end if;
 if v_booking.archived_at is null then raise exception 'Flytta bokningen till Papperskorgen först'; end if;
 if v_booking.booking_number is distinct from p_booking_number or v_booking.archived_at is distinct from p_expected_archived_at then raise exception 'Bokningen ändrades. Uppdatera Papperskorgen och försök igen'; end if;
 delete from public.booking_transport_monitors where booking_id=p_booking_id;
 delete from public.booking_status_history where booking_id=p_booking_id;
 delete from public.bookings where id=p_booking_id;
 return p_booking_id;
end $$;
revoke all on function public.server_delete_trashed_booking(uuid,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.server_delete_trashed_booking(uuid,bigint,timestamptz) to service_role;
