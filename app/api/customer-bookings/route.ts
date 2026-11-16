import {validatePet} from '@/lib/pets';
import {timeChangesClosed,lateCancellation} from "@/lib/booking-policy";
import {paymentMethods,storedStop,stopBreakdown,normalizeStop,validStop,withoutStopNote} from "@/lib/booking-options";
import { adminSupabase, requireSupabaseUser } from "../../../lib/supabase-server";
import { quoteTrip } from "../../../lib/quote-server";
import {
  flightNumberFromNotes,
  syncFlightForBooking,
  upsertFlightMonitorForBooking,
} from "../../../lib/flight-monitor";
import { sendBookingStatusSms } from "../../../lib/sms";

const editableStatuses = ["new", "offered", "assigned", "accepted"];
const clean = (value: unknown, maximum = 500) =>
  String(value ?? "").trim().slice(0, maximum);
const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

async function customer(request: Request) {
  const { user } = await requireSupabaseUser(request);
  const email = clean(user.email, 180).toLowerCase();
  if (!email) throw new Error("Det verifierade kontot saknar e-postadress.");
  return { email, supabase: adminSupabase() };
}

async function ownedBooking(supabase: any, email: string, id: string) {
  const result = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .eq("customer_email", email)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Bokningen hittades inte.");
  return result.data;
}

function clientBooking(row: any) {
  return {
    stop:storedStop(row).label?storedStop(row):null,
    paymentMethod:row.payment_method,
    petDetails:row.pet_details||null,
    id: row.id,
    bookingNumber: row.booking_number,
    bookingDate: row.booking_date,
    pickupClock: String(row.pickup_time || "").slice(0, 5),
    pickupTime: `${row.booking_date}T${row.pickup_time}`,
    status: row.status,
    pickup: row.pickup_address,
    destination: row.dropoff_address,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    destinationLat: row.dropoff_lat,
    destinationLng: row.dropoff_lng,
    pickupPlaceId: row.pickup_place_id,
    destinationPlaceId: row.dropoff_place_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    passengers: Number(row.passengers || 1),
    luggageCount: Number(row.luggage_count || 0),
    vehicle: /large|storbil/i.test(row.car_type || "") ? "large" : "standard",
    childSeats: Number(row.child_seats || 0),
    extraMessage: row.extra_message || "",
    price: Number(row.actual_price ?? row.fixed_price ?? row.estimated_price ?? 0),
    paymentStatus: row.payment_status,
    trackingToken: row.tracking_token,
    flightNumber: flightNumberFromNotes(row.notes) || null,
    driverName: Array.isArray(row.drivers)
      ? row.drivers[0]?.full_name || null
      : row.drivers?.full_name || null,
    timeChangesClosed: timeChangesClosed(row),
    canEdit: editableStatuses.includes(row.status) && !timeChangesClosed(row),
    canCancel:
      editableStatuses.includes(row.status) &&
      !["paid", "refunded"].includes(String(row.payment_status || "").toLowerCase()),
  };
}

export async function GET(request: Request) {
  try {
    const { email, supabase } = await customer(request);
    const { data, error } = await supabase
      .from("bookings")
      .select("*,drivers!bookings_driver_id_fkey(full_name)")
      .eq("customer_email", email)
      .order("booking_date", { ascending: false })
      .order("pickup_time", { ascending: false })
      .limit(100);
    if (error) throw error;
    return Response.json(
      { email, bookings: (data || []).map(clientBooking) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Logga in för att se dina resor." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function normalizeEdit(input: any) {
  return {
    stop:normalizeStop(input?.stop),
    paymentMethod:clean(input?.paymentMethod,30),
    id: clean(input?.bookingId, 80),
    customerName: clean(input?.customerName, 120),
    customerPhone: clean(input?.customerPhone, 40),
    pickupAddress: clean(input?.pickup, 300),
    pickupLat: numberOrNull(input?.pickupLat),
    pickupLng: numberOrNull(input?.pickupLng),
    pickupPlaceId: clean(input?.pickupPlaceId, 180) || null,
    destinationAddress: clean(input?.destination, 300),
    destinationLat: numberOrNull(input?.destinationLat),
    destinationLng: numberOrNull(input?.destinationLng),
    destinationPlaceId: clean(input?.destinationPlaceId, 180) || null,
    bookingDate: clean(input?.bookingDate, 10),
    pickupTime: clean(input?.pickupTime, 8),
    passengers: Number(input?.passengers),
    luggageCount: Number(input?.luggageCount),
    vehicle: input?.vehicle === "large" ? "large" : "standard",
    childSeats: Number(input?.childSeats),
    flightNumber: clean(input?.flightNumber, 12).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    extraMessage: clean(input?.extraMessage, 1000),
  };
}

function validateEdit(edit: ReturnType<typeof normalizeEdit>) {
  if (!edit.id) return "Bokningen saknas.";
  if (!edit.customerName) return "Namn krävs.";
  if (!/^\+?[0-9 ()-]{7,20}$/.test(edit.customerPhone))
    return "Ange ett giltigt mobilnummer.";
  if (!edit.pickupAddress || !edit.destinationAddress)
    return "Hämtadress och destination krävs.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edit.bookingDate)) return "Välj ett giltigt datum.";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(edit.pickupTime)) return "Välj en giltig tid.";
  if (!Number.isInteger(edit.passengers) || edit.passengers < 1 || edit.passengers > 7)
    return "Välj mellan 1 och 7 passagerare.";
  if (!Number.isInteger(edit.luggageCount) || edit.luggageCount < 0 || edit.luggageCount > 30)
    return "Bagage måste vara mellan 0 och 30.";
  if (!Number.isInteger(edit.childSeats) || edit.childSeats < 0 || edit.childSeats > 3)
    return "Välj mellan 0 och 3 barnstolar.";
  return null;
}

function routeChanged(current: any, edit: ReturnType<typeof normalizeEdit>) {
  return (
    storedStop(current).label !== (edit.stop?.label||"") ||
    current.pickup_address !== edit.pickupAddress ||
    current.dropoff_address !== edit.destinationAddress ||
    current.booking_date !== edit.bookingDate ||
    String(current.pickup_time || "").slice(0, 5) !== edit.pickupTime.slice(0, 5) ||
    (/large|storbil/i.test(current.car_type || "") ? "large" : "standard") !== edit.vehicle ||
    Number(current.child_seats || 0) !== edit.childSeats
  );
}

function currentPrice(row: any) {
  return Number(row.actual_price ?? row.fixed_price ?? row.estimated_price ?? 0);
}

export async function PATCH(request: Request) {
  try {
    const { email, supabase } = await customer(request);
    const body = await request.json();
    const edit = normalizeEdit(body);
    const validation = validateEdit(edit);
    if (validation) return Response.json({ error: validation }, { status: 400 });
    const current = await ownedBooking(supabase, email, edit.id);
    const petDetails=Object.hasOwn(body,"petDetails")?await validatePet(supabase,body.petDetails,current.pet_details):current.pet_details;
    if (!editableStatuses.includes(current.status))
      return Response.json(
        { error: "Bokningen kan inte längre redigeras eftersom resan har startat eller avslutats." },
        { status: 409 },
      );
    const pickupAddressChanged = current.pickup_address !== edit.pickupAddress;
    const destinationAddressChanged = current.dropoff_address !== edit.destinationAddress;
    if (
      (pickupAddressChanged && (!edit.pickupPlaceId || edit.pickupLat === null || edit.pickupLng === null)) ||
      (destinationAddressChanged && (!edit.destinationPlaceId || edit.destinationLat === null || edit.destinationLng === null))
    )
      return Response.json(
        { error: "Välj den nya fullständiga adressen från adressförslagen." },
        { status: 400 },
      );

    let quote: any = null;
    if(current.price_breakdown?.company_pricing&&(pickupAddressChanged||destinationAddressChanged||storedStop(current).label!==(edit.stop?.label||'')||(/large|storbil/i.test(current.car_type||'')?'large':'standard')!==edit.vehicle||Number(current.child_seats||0)!==edit.childSeats))return Response.json({error:'Kontakta Avenyn Taxi för att ändra sträcka, biltyp eller tillval på en avtalsresa.'},{status:409});
    if (routeChanged(current, edit)&&!current.price_breakdown?.company_pricing) {
      if(!validStop(edit.stop))return Response.json({error:"Välj stoppets fullständiga adress från förslagen."},{status:400});
      quote = await quoteTrip({
        stopAddress:edit.stop?.label,stopLat:edit.stop?.lat,stopLng:edit.stop?.lng,stopPlaceId:edit.stop?.id,stopArea:edit.stop?.area,
        pickupAddress: edit.pickupAddress,
        dropoffAddress: edit.destinationAddress,
        pickupLat: edit.pickupLat,
        pickupLng: edit.pickupLng,
        dropoffLat: edit.destinationLat,
        dropoffLng: edit.destinationLng,
        pickupPlaceId: edit.pickupPlaceId,
        dropoffPlaceId: edit.destinationPlaceId,
        carType: edit.vehicle,
        childSeats: edit.childSeats,
        pickupTime: `${edit.bookingDate}T${edit.pickupTime}`,
      });
      if (quote?.total_price == null)
        return Response.json({ error: "Kontakta oss för fast pris." }, { status: 400 });
    }
    const oldPrice = currentPrice(current);
    const newPrice = quote?.total_price == null ? oldPrice : Number(quote.total_price);
    const priceChanged = Math.round(oldPrice * 100) !== Math.round(newPrice * 100);
    if (body.preview === true)
      return Response.json({
        ok: true,
        currentPrice: oldPrice,
        newPrice,
        requiresPriceConfirmation: priceChanged,
      });
    if (
      priceChanged &&
      (body.confirmPriceChange !== true || Number(body.expectedNewPrice) !== newPrice)
    )
      return Response.json(
        {
          error: "Bekräfta det nya priset innan du sparar.",
          currentPrice: oldPrice,
          newPrice,
          requiresPriceConfirmation: true,
        },
        { status: 409 },
      );

    const notes = [
      edit.flightNumber && `Flygnummer: ${edit.flightNumber}`,
      edit.stop && `Extra stopp: ${edit.stop.label}`,
      withoutStopNote(edit.extraMessage),
    ].filter(Boolean).join(" · ") || null;
    const values: Record<string, any> = {
      pet_details:petDetails,
      price_breakdown:{...(current.price_breakdown||{}),...stopBreakdown(edit.stop)},
      customer_name: edit.customerName,
      customer_phone: edit.customerPhone,
      pickup_address: edit.pickupAddress,
      dropoff_address: edit.destinationAddress,
      booking_date: edit.bookingDate,
      pickup_time: edit.pickupTime,
      passengers: edit.passengers,
      luggage_count: edit.luggageCount,
      car_type: edit.vehicle,
      child_seat: edit.childSeats > 0,
      child_seats: edit.childSeats,
      notes,
      extra_message: edit.extraMessage || null,
      updated_at: new Date().toISOString(),
    };
    if(!["paid","refunded"].includes(String(current.payment_status||"").toLowerCase())) {
      if(!paymentMethods.includes(edit.paymentMethod))return Response.json({error:"Välj ett giltigt betalsätt."},{status:400});
      const linked=await supabase.from('billing_booking_links').select('company_id').eq('booking_id',current.id).maybeSingle();
      if(linked.error)throw linked.error;
      if(linked.data&&edit.paymentMethod!=='Faktura')return Response.json({error:'Kontakta Avenyn Taxi för att ändra betalningssätt på en företagsresa.'},{status:400});
      if(!linked.data&&edit.paymentMethod==='Faktura'&&current.payment_method!=='Faktura')return Response.json({error:'Ansök om företagsbokning för att boka med faktura.'},{status:400});
      values.payment_method=edit.paymentMethod;
    }
    if (pickupAddressChanged) {
      values.pickup_lat = edit.pickupLat;
      values.pickup_lng = edit.pickupLng;
      values.pickup_place_id = edit.pickupPlaceId;
      values.pickup_point = `SRID=4326;POINT(${edit.pickupLng} ${edit.pickupLat})`;
    }
    if (destinationAddressChanged) {
      values.dropoff_lat = edit.destinationLat;
      values.dropoff_lng = edit.destinationLng;
      values.dropoff_place_id = edit.destinationPlaceId;
      values.dropoff_point = `SRID=4326;POINT(${edit.destinationLng} ${edit.destinationLat})`;
    }
    if (quote) {
      values.estimated_price = newPrice;
      values.fixed_price = newPrice;
      values.price_zone_code = quote.zone_code || null;
    }
    const result = await supabase
      .from("bookings")
      .update(values)
      .eq("id", edit.id)
      .eq("customer_email", email)
      .select("*")
      .single();
    if (result.error) throw result.error;
    await syncFlightForBooking(result.data).catch((error) =>
      console.error("customer_edit_flight_monitor_failed", {
        bookingNumber: result.data.booking_number,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json({ ok: true, booking: clientBooking(result.data), newPrice });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Bokningen kunde inte ändras." },
      { status: /Logga in/.test(error?.message || "") ? 401 : 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { email, supabase } = await customer(request);
    const id = clean(new URL(request.url).searchParams.get("id"), 80);
    const booking = await ownedBooking(supabase, email, id);
    if (!editableStatuses.includes(booking.status))
      return Response.json(
        { error: "Bokningen kan inte avbokas här eftersom resan redan har startat eller avslutats." },
        { status: 409 },
      );
    if (["paid", "refunded"].includes(String(booking.payment_status || "").toLowerCase()))
      return Response.json(
        { error: "Den här bokningen är betald. Ring 0700-315 315 så hjälper vi dig med avbokning och eventuell återbetalning." },
        { status: 409 },
      );
    if(lateCancellation(booking))return Response.json({error:"Avbokning inom 24 timmar: kontakta oss. Hela det bekräftade priset debiteras enligt godkända bokningsvillkor."},{status:409});
    const now = new Date().toISOString();
    const result = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("customer_email", email)
      .select("*")
      .single();
    if (result.error) throw result.error;
    await upsertFlightMonitorForBooking(result.data).catch(() => undefined);
    await sendBookingStatusSms(result.data, "cancelled").catch(() => undefined);
    return Response.json({ ok: true });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Bokningen kunde inte avbokas." },
      { status: /Logga in/.test(error?.message || "") ? 401 : 400 },
    );
  }
}
