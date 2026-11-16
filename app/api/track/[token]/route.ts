import {lateCancellation,timeChangesClosed} from "@/lib/booking-policy";
import { adminSupabase, publicSupabase } from "../../../../lib/supabase-server";

const flightNumberFromNotes = (notes: unknown) => {
  const match = String(notes || "").match(
    /flyg(?:nummer)?\s*[:#-]?\s*([a-z0-9]{2,3}\s?\d{1,4}[a-z]?)/i,
  );
  return match?.[1]?.toUpperCase().replace(/\s+/g, "") || null;
};

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ error: "Ogiltig bokningslänk" }, { status: 400 });
  const { data, error } = await publicSupabase().rpc("customer_tracking", { p_tracking_token: token });
  if (error || !data?.[0]) return Response.json({ error: "Bokningen hittades inte" }, { status: 404 });
  const row = data[0];
  const privateBooking = await adminSupabase()
    .from("bookings")
    .select("id, payment_status, booking_date, pickup_time, driver_id, notes, passengers, child_seats, car_type, luggage_count, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, price_breakdown")
    .eq("tracking_token", token)
    .maybeSingle();
  const driver = privateBooking.data?.driver_id ? await adminSupabase().from("drivers").select("phone").eq("id",privateBooking.data.driver_id).is("archived_at",null).maybeSingle() : null;
  const showDriver=["assigned","accepted","en_route","arrived","passenger_onboard"].includes(row.status);
  return Response.json({
    id: row.booking_number,
    booking_id: privateBooking.data?.id ?? null,
    payment_status: privateBooking.data?.payment_status ?? null,
    cancellation_fee_applies: lateCancellation(privateBooking.data || row),
    time_changes_closed: timeChangesClosed(privateBooking.data || row),
    pickup: row.pickup_address,
    destination: row.dropoff_address,
    pickup_time: `${row.booking_date}T${row.pickup_time}`,
    status: row.status,
    price: Number(row.price),
    driver_name: showDriver ? row.driver_name : null,
    driver_phone: ["assigned","accepted","en_route","arrived","passenger_onboard"].includes(row.status) ? driver?.data?.phone || null : null,
    vehicle_number: row.vehicle_number,
    vehicle_model: row.vehicle_model,
    registration_number: row.registration_number,
    driver_lat: showDriver ? row.driver_latitude : null,
    driver_lng: showDriver ? row.driver_longitude : null,
    location_updated: row.location_updated_at,
    pickup_lat: privateBooking.data?.pickup_lat ?? null,
    pickup_lng: privateBooking.data?.pickup_lng ?? null,
    destination_lat: privateBooking.data?.dropoff_lat ?? null,
    destination_lng: privateBooking.data?.dropoff_lng ?? null,
    route_stop: privateBooking.data?.price_breakdown?.stop_address ? {lat: privateBooking.data.price_breakdown.stop_lat, lng: privateBooking.data.price_breakdown.stop_lng} : null,
    passengers: privateBooking.data?.passengers ?? null,
    child_seats: privateBooking.data?.child_seats ?? 0,
    car_type: privateBooking.data?.car_type ?? null,
    luggage_count: privateBooking.data?.luggage_count ?? null,
    flight_number: privateBooking.error
      ? null
      : flightNumberFromNotes(privateBooking.data?.notes),
  }, { headers: { "Cache-Control": "no-store" } });
}
