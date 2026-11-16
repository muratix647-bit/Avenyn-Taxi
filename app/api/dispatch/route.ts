import {completionUtcTime} from "@/lib/completion-time";
import {validatePet,petText} from '@/lib/pets';
import {sendManualBookingAdminEmail} from "@/lib/email";
import {paymentLabels,paymentMethods,storedStop,stopBreakdown,normalizeStop,validStop,withoutStopNote} from "@/lib/booking-options";
import { adminSupabase, requireSupabaseUser } from "../../../lib/supabase-server";
import { quoteTrip } from "../../../lib/quote-server";
import {sendCustomerSmsOnce} from "../../../lib/customer-sms-monitor";
import { confirmedAmount, hasIssuedInvoice, paymentBlocked } from "../../../lib/booking-payment-sms";
import { bookingPaymentUrl, sendBookingPaymentSms, normalizePhone, sendManualBookingSms, sendBookingStatusSms } from "../../../lib/sms";
import {
  normalizeFlightNumber,
  syncFlightForBooking,
} from "../../../lib/flight-monitor";
import { sendDriverAccountInvite } from "../../../lib/driver-auth";
import { syncPendingStripePayments } from "../../../lib/payment-sync";
import { sendAssignedBookingPush } from "../../../lib/push";

const clean = (value: unknown, maximum = 500) =>
  String(value ?? "").trim().slice(0, maximum);

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const driverPaymentMethods = ["app", "card", "swish", "paypal", "cash", "invoice", "other", "link"];

function currentBookingPrice(booking: any) {
  return Number(
    booking?.driver_reported_amount ??
      booking?.actual_price ??
      booking?.fixed_price ??
      booking?.estimated_price ??
      0,
  );
}

function normalizeBookingEdit(input: any) {
  return {
    completeHistorical: input?.completeHistorical === true,
    completedAt: undefined as string | undefined,
    completionDriverId: undefined as string | undefined,
    stop: normalizeStop(input?.stop),
    id: clean(input?.bookingId, 80),
    originalUpdatedAt: clean(input?.originalUpdatedAt, 80),
    customerName: clean(input?.customerName, 120),
    customerPhone: clean(input?.customerPhone, 40),
    customerEmail: clean(input?.customerEmail, 180).toLowerCase(),
    pickupAddress: clean(input?.pickupAddress, 300),
    pickupLat: numberOrNull(input?.pickupLat),
    pickupLng: numberOrNull(input?.pickupLng),
    pickupPlaceId: clean(input?.pickupPlaceId, 180) || null,
    pickupArea: clean(input?.pickupArea, 120) || null,
    dropoffAddress: clean(input?.dropoffAddress, 300),
    dropoffLat: numberOrNull(input?.dropoffLat),
    dropoffLng: numberOrNull(input?.dropoffLng),
    dropoffPlaceId: clean(input?.dropoffPlaceId, 180) || null,
    dropoffArea: clean(input?.dropoffArea, 120) || null,
    bookingDate: clean(input?.bookingDate, 10),
    pickupTime: clean(input?.pickupTime, 8),
    passengers: Number(input?.passengers),
    luggageCount: Number(input?.luggageCount),
    carType: /large|storbil/i.test(clean(input?.carType, 20)) ? "large" : "standard",
    childSeats: Number(input?.childSeats),
    price: numberOrNull(input?.price),
    flightNumber: normalizeFlightNumber(clean(input?.flightNumber, 20)),
    notes: clean(input?.notes, 1500) || null,
    driverPaymentMethod: clean(input?.driverPaymentMethod, 20).toLowerCase() || null,
    driverPaymentPaid: input?.driverPaymentPaid === true,
    driverPaymentNote: clean(input?.driverPaymentNote, 200) || null,
  };
}

function validateBookingEdit(edit: ReturnType<typeof normalizeBookingEdit>) {
  if (!edit.id) return "Bokningsnummer saknas.";
  if (!edit.customerName) return "Kundens namn krävs.";
  if (!/^\+?[0-9 ()-]{7,20}$/.test(edit.customerPhone))
    return "Ange ett giltigt telefonnummer.";
  if (edit.customerEmail && !/^\S+@\S+\.\S+$/.test(edit.customerEmail))
    return "Ange en giltig e-postadress.";
  if (!edit.pickupAddress || !edit.dropoffAddress)
    return "Hämtadress och destination krävs.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edit.bookingDate))
    return "Ange ett giltigt datum.";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(edit.pickupTime))
    return "Ange en giltig tid.";
  if (!Number.isInteger(edit.passengers) || edit.passengers < 1 || edit.passengers > 7)
    return "Välj mellan 1 och 7 passagerare.";
  if (!Number.isInteger(edit.luggageCount) || edit.luggageCount < 0 || edit.luggageCount > 30)
    return "Bagage måste vara mellan 0 och 30.";
  if (!["standard", "large"].includes(edit.carType)) return "Välj en giltig biltyp.";
  if (!Number.isInteger(edit.childSeats) || edit.childSeats < 0 || edit.childSeats > 3)
    return "Välj mellan 0 och 3 barnstolar.";
  if (edit.price === null || edit.price < 0) return "Ange ett giltigt pris.";
  if (
    edit.flightNumber &&
    !/^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/.test(edit.flightNumber)
  )
    return "Ange ett giltigt flygnummer, till exempel SK431.";
  if (
    edit.driverPaymentMethod &&
    !driverPaymentMethods.includes(edit.driverPaymentMethod)
  )
    return "Välj ett giltigt betalsätt.";
  if (edit.driverPaymentPaid && !edit.driverPaymentMethod)
    return "Välj betalsätt när betalningen markeras som mottagen.";
  if (edit.driverPaymentMethod === "other" && !edit.driverPaymentNote)
    return "Beskriv betalsättet när du väljer Annat.";
  return null;
}

function routeOrPriceChanged(current: any, edit: ReturnType<typeof normalizeBookingEdit>) {
  return (
    storedStop(current).label !== (edit.stop?.label||"") ||
    clean(current.pickup_address) !== edit.pickupAddress ||
    clean(current.dropoff_address) !== edit.dropoffAddress ||
    clean(current.booking_date) !== edit.bookingDate ||
    clean(current.pickup_time, 8).slice(0, 5) !== edit.pickupTime.slice(0, 5) ||
    (/large|storbil/i.test(clean(current.car_type, 20)) ? "large" : "standard") !== edit.carType ||
    Number(current.child_seats || 0) !== edit.childSeats
  );
}

function addressChanged(current: any, edit: ReturnType<typeof normalizeBookingEdit>) {
  return {
    pickup: clean(current.pickup_address) !== edit.pickupAddress,
    dropoff: clean(current.dropoff_address) !== edit.dropoffAddress,
  };
}

function validCoordinates(lat: number | null, lng: number | null) {
  return lat !== null && lng !== null && lat >= 54 && lat <= 70 && lng >= 8 && lng <= 25;
}

async function prepareBookingEdit(supabase: any, input: any) {
  const edit = normalizeBookingEdit(input);
  const validationError = validateBookingEdit(edit);
  if (validationError) throw new Error(validationError);
  const { data: current, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", edit.id)
    .maybeSingle();
  if (error) throw error;
  if (!current) throw new Error("Bokningen hittades inte.");

  if (edit.completeHistorical && current.status === "cancelled")
    throw new Error("En avbokad körning kan inte avslutas här.");
  if (Object.hasOwn(input, "completedTime") || edit.completeHistorical) {
    if (current.status !== "completed" && !edit.completeHistorical)
      throw new Error("Välj att avsluta den tidigare utförda körningen först.");
    edit.completedAt = completionUtcTime(input.completedTime);
    if (Date.parse(edit.completedAt) > Date.now()) throw new Error("Avslutstiden får inte ligga i framtiden.");
    if (Object.hasOwn(input, "completionDriverId") || edit.completeHistorical) {
      const id = clean(input.completionDriverId, 80);
      if (!id) throw new Error("Välj föraren som utförde körningen.");
      const driver = await supabase.from("drivers").select("id,approved").eq("id", id).maybeSingle();
      if (driver.error) throw driver.error;
      if (!driver.data?.approved) throw new Error("Välj en godkänd förare.");
      edit.completionDriverId = id;
    }
  }

  const changedAddress = addressChanged(current, edit);
  if (
    (changedAddress.pickup &&
      (!validCoordinates(edit.pickupLat, edit.pickupLng) || !edit.pickupPlaceId)) ||
    (changedAddress.dropoff &&
      (!validCoordinates(edit.dropoffLat, edit.dropoffLng) || !edit.dropoffPlaceId))
  ) {
    throw new Error("Välj den nya fullständiga adressen från adressförslagen.");
  }

  let quote: any = null;
  if (routeOrPriceChanged(current, edit)) {
    if (!validStop(edit.stop)) throw new Error("Välj stoppets fullständiga adress från förslagen.");
    quote = await quoteTrip({
      stopAddress:edit.stop?.label,stopLat:edit.stop?.lat,stopLng:edit.stop?.lng,stopPlaceId:edit.stop?.id,stopArea:edit.stop?.area,
      pickupAddress: edit.pickupAddress,
      dropoffAddress: edit.dropoffAddress,
      pickupLat: edit.pickupLat,
      pickupLng: edit.pickupLng,
      dropoffLat: edit.dropoffLat,
      dropoffLng: edit.dropoffLng,
      pickupPlaceId: edit.pickupPlaceId,
      dropoffPlaceId: edit.dropoffPlaceId,
      pickupArea: edit.pickupArea,
      dropoffArea: edit.dropoffArea,
      carType: edit.carType,
      childSeats: edit.childSeats,
      pickupTime: `${edit.bookingDate}T${edit.pickupTime}`,
    });
    if (quote?.total_price == null && edit.price === null)
      throw new Error("Det nya priset kunde inte beräknas. Kontrollera adresserna innan du sparar.");
  }
  const currentPrice = currentBookingPrice(current);
  const newPrice = quote?.total_price != null && edit.price === currentPrice ? Number(quote.total_price) : edit.price ?? currentPrice;
  return {
    current,
    edit:{...edit,petDetails:Object.hasOwn(input,"petDetails")?await validatePet(adminSupabase(),input.petDetails,current.pet_details):current.pet_details},
    quote,
    currentPrice,
    newPrice,
    priceChanged: Math.round(currentPrice * 100) !== Math.round(newPrice * 100),
    changedAddress,
  };
}

function bookingRow(row: any) {
  const bookingDate = row?.booking_date ?? "";
  const bookingTime = row?.pickup_time ?? "";
  return {
    ...row,
    pickup: row?.pickup_address ?? "Adress saknas",
    destination: row?.dropoff_address ?? "Destination saknas",
    destination_lat: row?.dropoff_lat ?? null,
    destination_lng: row?.dropoff_lng ?? null,
    pickup_time:
      bookingDate && bookingTime ? `${bookingDate}T${bookingTime}` : null,
    price: Number(
      row.driver_reported_amount ??
        row.actual_price ??
        row.fixed_price ??
        row.estimated_price ??
        0,
    ),
    assigned_driver_id: row.driver_id,
    driver_name: row?.drivers?.full_name ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireSupabaseUser(request);
    const { data: allowed, error: roleError } =
      await supabase.rpc("is_dispatch_admin");
    if (roleError || !allowed)
      return Response.json({ error: "Endast dispatch" }, { status: 403 });
    await syncPendingStripePayments();
    const [bookingsResult, driversResult, paymentRequestsResult] = await Promise.all([
      supabase
        .from("bookings")
        .select("*,drivers:drivers!bookings_driver_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("drivers").select("*").order("created_at"),
      adminSupabase()
        .from("payment_requests")
        .select("booking_id,amount_sek,source,status,paid_at,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const coreError = bookingsResult.error || driversResult.error;
    if (coreError) throw coreError;

    // GPS, prices and vehicles enrich Dispatch but must never make the
    // booking/driver overview unavailable.
    const [locationsResult, settingsResult, pricesResult, vehiclesResult, visitsResult] =
      await Promise.all([
        supabase
          .from("driver_locations")
          .select("driver_id,latitude,longitude,heading,updated_at")
          .order("updated_at", { ascending: false }),
      supabase.from("fare_settings").select("*").eq("id", true).maybeSingle(),
      supabase
        .from("price_zones")
        .select("code,name,region,fixed_price,active,updated_at,updated_by")
        .order("name"),
      supabase.from("vehicles").select("*").order("name"),
      supabase.rpc("get_site_visit_stats"),
      ]);

    const latestLocationByDriver = new Map<string, any>();
    if (!locationsResult.error) {
      for (const location of locationsResult.data ?? []) {
        const driverId = location?.driver_id;
        if (driverId && !latestLocationByDriver.has(driverId))
          latestLocationByDriver.set(driverId, location);
      }
    }
    const latestPaymentByBooking = new Map<string, any>();
    if (!paymentRequestsResult.error) {
      for (const payment of paymentRequestsResult.data ?? []) {
        if (!latestPaymentByBooking.has(payment.booking_id))
          latestPaymentByBooking.set(payment.booking_id, payment);
      }
    }
    const bookings = (bookingsResult.data ?? []).map((row: any) => ({
      ...bookingRow(row),
      latest_payment_request: latestPaymentByBooking.get(row.id) ?? null,
    }));
    const vehicles = vehiclesResult.error ? [] : vehiclesResult.data ?? [];
    const vehicleByDriver = new Map<string, any>();
    for (const vehicle of vehicles) {
      if (vehicle?.driver_id && vehicle?.active !== false)
        vehicleByDriver.set(vehicle.driver_id, vehicle);
    }
    // A trip's explicit vehicle takes precedence over the driver's usual vehicle.
    const activeVehicleTrips=bookings.filter((b:any)=>b.vehicle_id&&b.driver_id&&['assigned','accepted','en_route','arrived','passenger_onboard'].includes(b.status)).sort((a:any,b:any)=>{
      const running=(x:any)=>['en_route','arrived','passenger_onboard'].includes(x.status)?1:0;
      return running(a)-running(b)||String(b.pickup_time).localeCompare(String(a.pickup_time));
    });
    for(const trip of activeVehicleTrips){const car=vehicles.find((v:any)=>v.id===trip.vehicle_id);if(car)vehicleByDriver.set(trip.driver_id,car);}
    const drivers = (driversResult.data ?? []).map((driver: any) => {
      const location = latestLocationByDriver.get(driver?.id) ?? null;
      const vehicle = vehicleByDriver.get(driver?.id) ?? null;
      return {
        ...driver,
        id: driver?.id,
        name: driver?.full_name ?? "Förare",
        approved: Boolean(driver?.approved),
        online: Boolean(driver?.is_online),
        lat: location?.latitude,
        lng: location?.longitude,
        heading: location?.heading,
        updated_at: location?.updated_at,
        vehicle: vehicle
          ? {
              id: vehicle.id,
              number: vehicle.vehicle_number ?? vehicle.name ?? null,
              registrationNumber:
                vehicle.registration_number ?? vehicle.reg ?? null,
              make: vehicle.make ?? null,
              model: vehicle.model ?? null,
              color: vehicle.color ?? null,
              vehicleClass: vehicle.vehicle_class ?? null,
            }
          : null,
        deleted_at: driver?.archived_at,
      };
    });
    const settings: any = settingsResult.error
      ? {}
      : settingsResult.data ?? {};
    console.info("dispatch_data_loaded", {
      bookings: bookings.length,
      drivers: drivers.length,
      vehicles: vehiclesResult.error ? 0 : (vehiclesResult.data ?? []).length,
      gpsPositions: latestLocationByDriver.size,
    });
    return Response.json({
      bookings: bookings.filter((row: any) => !row.archived_at),
      archivedBookings: bookings.filter((row: any) => row.archived_at),
      drivers: drivers.filter((row: any) => !row.archived_at),
      archivedDrivers: drivers.filter((row: any) => row.archived_at),
      vehicles,
      fareSettings: {
        childSeatSurcharge: Number(settings.child_seat_surcharge ?? 100),
        largeVehicleSurcharge: Number(settings.large_vehicle_surcharge ?? 300),
        instantStartFee: Number(settings.instant_start_fee ?? 60),
        prebookedStartFee: Number(settings.prebooked_start_fee ?? 50),
        pricePerKm: Number(settings.price_per_km ?? 15),
        instantPricePerHour: Number(settings.instant_price_per_hour ?? 300),
        prebookedPricePerHour: Number(settings.prebooked_price_per_hour ?? 720),
        updatedAt: settings.updated_at,
      },
      fixedPrices: (pricesResult.error ? [] : pricesResult.data ?? []).map((row: any) => ({
        locality: row.name,
        code: row.code,
        region: row.region,
        destination: "landvetter",
        price: Number(row.fixed_price),
        active: row.active,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      })),
      siteVisits: visitsResult.error ? {} : visitsResult.data?.[0] ?? {},
      warnings: {
        locations: locationsResult.error?.message ?? null,
        fareSettings: settingsResult.error?.message ?? null,
        fixedPrices: pricesResult.error?.message ?? null,
        vehicles: vehiclesResult.error?.message ?? null,
        visits: visitsResult.error?.message ?? null,
      },
    });
  } catch (error: any) {
    console.error("dispatch_action_failed", {
      action: "load",
      error: error?.message || "Unknown error",
    });
    return Response.json(
      { error: error?.message || "Logga in" },
      { status: 401 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const { data: allowed } = await supabase.rpc("is_dispatch_admin");
    if (!allowed)
      return Response.json({ error: "Endast dispatch" }, { status: 403 });
    const body: any = await request.json();
    let result: any;
    let notificationStatus = "";
    let notificationDriverName = "";
    let driverInvite: any = null;
    if(body.action==="create_manual_booking"){
      const input=body.booking||{};
      const customerName=clean(input.customerName,120),customerPhone=clean(input.customerPhone,40),customerEmail=clean(input.customerEmail,180).toLowerCase();
      const pickupAddress=clean(input.pickupAddress,300),dropoffAddress=clean(input.dropoffAddress,300),bookingDate=clean(input.bookingDate,10),pickupTime=clean(input.pickupTime,8);
      const pickupLat=numberOrNull(input.pickupLat),pickupLng=numberOrNull(input.pickupLng),dropoffLat=numberOrNull(input.dropoffLat),dropoffLng=numberOrNull(input.dropoffLng),pickupPlaceId=clean(input.pickupPlaceId,180)||null,dropoffPlaceId=clean(input.dropoffPlaceId,180)||null;
      const passengers=Number(input.passengers),luggageCount=Number(input.luggageCount),childSeats=Number(input.childSeats),price=Number(input.price);
      const driverId=clean(input.driverId,80)||null,flightNumber=clean(input.flightNumber,30),notes=clean(input.notes,1200);
      if(!customerName||!/^[+]?[0-9 ()-]{7,20}$/.test(customerPhone))return Response.json({error:"Ange kundens namn och ett giltigt mobilnummer."},{status:400});
      if(customerEmail&&!/^\S+@\S+\.\S+$/.test(customerEmail))return Response.json({error:"Ange en giltig e-postadress."},{status:400});
      if(!pickupAddress||!dropoffAddress||!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)||!/^\d{2}:\d{2}$/.test(pickupTime))return Response.json({error:"Fyll i adresser, datum och tid."},{status:400});
      if(!Number.isInteger(passengers)||passengers<1||passengers>7||!Number.isInteger(luggageCount)||luggageCount<0||luggageCount>30||!Number.isInteger(childSeats)||childSeats<0||childSeats>3||!Number.isFinite(price)||price<0)return Response.json({error:"Kontrollera passagerare, bagage, barnstolar och pris."},{status:400});
      if(driverId){const driver=await supabase.from("drivers").select("id,approved,active,archived_at").eq("id",driverId).maybeSingle();if(driver.error)throw driver.error;if(!driver.data||!driver.data.approved||driver.data.active===false||driver.data.archived_at)return Response.json({error:"Den valda föraren är inte tillgänglig."},{status:400});}
      const stop=normalizeStop(input.stop);
      if(!validStop(stop))return Response.json({error:"Välj stoppets fullständiga adress från förslagen."},{status:400});
      if(!paymentMethods.includes(input.paymentMethod))return Response.json({error:"Välj ett giltigt betalsätt."},{status:400});
      const petDetails=await validatePet(adminSupabase(),input.petDetails);
      const normalizedFlightNumber=normalizeFlightNumber(flightNumber);
      const combinedNotes=[normalizedFlightNumber?`Flygnummer: ${normalizedFlightNumber}`:"",stop?`Extra stopp: ${stop.label}`:"",withoutStopNote(notes)].filter(Boolean).join(" · ")||null;
      const created=await adminSupabase().from("bookings").insert({pet_details:petDetails,customer_name:customerName,customer_phone:customerPhone,customer_email:customerEmail||null,pickup_address:pickupAddress,pickup_lat:pickupLat,pickup_lng:pickupLng,pickup_place_id:pickupPlaceId,dropoff_address:dropoffAddress,dropoff_lat:dropoffLat,dropoff_lng:dropoffLng,dropoff_place_id:dropoffPlaceId,booking_date:bookingDate,pickup_time:pickupTime,passengers,luggage_count:luggageCount,car_type:/large|storbil/i.test(clean(input.carType,20))?"large":"standard",payment_method:clean(input.paymentMethod,30)||"Kort",estimated_price:price,fixed_price:price,status:driverId?"assigned":"new",source:"Admin",driver_id:driverId,child_seat:childSeats>0,child_seats:childSeats,notes:combinedNotes,extra_message:combinedNotes,booked_by:user.email||user.id,price_breakdown:{type:"manual",entered_by:user.email||user.id,...stopBreakdown(stop)}}).select("*").single();
      if(created.error)throw created.error;
      const adminEmail=await sendManualBookingAdminEmail(created.data).catch(()=>({admin:{accepted:false}}));
      if(!adminEmail.admin.accepted)console.error("manual_booking_admin_email_failed",{bookingId:created.data.id});
      await syncFlightForBooking(created.data).catch((error) =>
        console.error("manual_booking_flight_monitor_failed", {
          bookingNumber: created.data.booking_number,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      if (driverId)
        await sendAssignedBookingPush(created.data.id).catch((error) =>
          console.error("manual_booking_driver_push_failed", {
            bookingId: created.data.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      const sms=await sendCustomerSmsOnce(created.data.id,"booking_confirmation","initial",latest=>sendManualBookingSms(latest)).catch(()=>({accepted:false,reason:"send_failed"}));
      return Response.json({ok:true,data:created.data,smsSent:sms.accepted,smsScheduled:false,smsError:sms.accepted?null:"Bokningen är skapad, men SMS kunde inte skickas. Använd Skicka SMS-bekräftelse på bokningen.",adminEmailSent:adminEmail.admin.accepted});
    }
    if (body.action === 'send_payment_sms' || body.action === 'copy_payment_link') {
      const copying = body.action === 'copy_payment_link';
      const db = adminSupabase();
      const id = clean(body.bookingId,80);
      const booking = await db.from('bookings').select('*').eq('id',id).maybeSingle();
      if (booking.error || !booking.data) return Response.json({error:'Bokningen kunde inte hämtas.'},{status:404});
      const phone = normalizePhone(booking.data.customer_phone);
      const amount = confirmedAmount(booking.data);
      const validate = (row:any) => paymentBlocked(row) || (!row.tracking_token ? 'Bokningen saknar kundlänk.' : '')
        || (!copying && (!phone || normalizePhone(row.customer_phone)!==phone || phone!==normalizePhone(body.phone)) ? 'Kontrollera bokningens mobilnummer.' : '')
        || (!amount || confirmedAmount(row)!==amount || body.amount!==amount ? 'Kontrollera det fasta priset eller slutpriset och uppdatera bokningen.' : '');
      const problem = validate(booking.data);
      if (problem) return Response.json({error:problem},{status:409});
      if (await hasIssuedInvoice(db,id)) return Response.json({error:'Det finns redan en faktura för bokningen.'},{status:409});
      if (copying) return Response.json({ok:true,url:bookingPaymentUrl(booking.data,amount)},{headers:{'Cache-Control':'no-store'}});
      const eventKey = phone + ':' + Math.round(amount * 100);
      const sms = await sendCustomerSmsOnce(id,'payment_link',eventKey,async latest => {
        if (validate(latest) || await hasIssuedInvoice(db,id)) return {accepted:false,reason:'booking_changed'};
        return sendBookingPaymentSms(latest,amount);
      });
      if (!sms.accepted) return Response.json({error:sms.reason==='confirmation_pending_review' || sms.reason==='provider_unreachable' ? 'Utskicket behöver kontrolleras hos SMS-tjänsten innan du försöker igen.' : 'Länken kunde inte skickas. Kontrollera bokningen och SMS-tjänsten.'},{status:409});
      return Response.json({ok:true,message:sms.reason==='already_sent'?'Betallänken har redan skickats till SMS-tjänsten.':'Betallänken har skickats till SMS-tjänsten för leverans.'});
    }
    if(body.action==="send_booking_sms"){
      const bookingId=clean(body.bookingId,80);
      if(!/^[0-9a-f-]{36}$/i.test(bookingId))return Response.json({error:"Ogiltig bokning."},{status:400});
      const sms=await sendCustomerSmsOnce(bookingId,"booking_confirmation","initial",latest=>sendManualBookingSms(latest));
      if(!sms.accepted)return Response.json({ok:false,error:sms.reason==="booking_inactive"?"Bokningen är avslutad eller avbokad.":sms.reason==="confirmation_pending_review"?"Ett SMS-utskick pågår eller behöver kontrolleras. Ingen extra kopia har skickats.":"SMS kunde inte skickas. Kontrollera telefonnumret och SMS-tjänsten. Bokningen är kvar."},{status:422});
      return Response.json({ok:true,customerSmsSent:true,message:sms.reason==="already_sent"?"SMS-bekräftelsen har redan skickats till SMS-tjänsten. Ingen dubblett skickades.":"SMS-bekräftelsen har skickats till SMS-tjänsten för leverans till kunden."});
    }
    if (body.action === "preview_booking_edit") {
      const prepared = await prepareBookingEdit(supabase, body.booking);
      return Response.json({
        ok: true,
        currentPrice: prepared.currentPrice,
        newPrice: prepared.newPrice,
        requiresPriceConfirmation: prepared.priceChanged,
        protectedStatus: ["completed", "cancelled"].includes(prepared.current.status),
      });
    }
    if (body.action === "update_booking") {
      const prepared = await prepareBookingEdit(supabase, body.booking);
      if (
        ["completed", "cancelled"].includes(prepared.current.status) &&
        body.confirmProtected !== true
      ) {
        return Response.json(
          { error: "Extra bekräftelse krävs för avslutade och avbokade bokningar." },
          { status: 409 },
        );
      }
      if (
        prepared.priceChanged &&
        (body.confirmPriceChange !== true ||
          Number(body.expectedNewPrice) !== prepared.newPrice)
      ) {
        return Response.json(
          {
            error: "Bekräfta det nya beräknade priset innan du sparar.",
            currentPrice: prepared.currentPrice,
            newPrice: prepared.newPrice,
            requiresPriceConfirmation: true,
          },
          { status: 409 },
        );
      }

      const now = new Date().toISOString();
      const previousBreakdown =
        prepared.current.price_breakdown &&
        typeof prepared.current.price_breakdown === "object"
          ? prepared.current.price_breakdown
          : {};
      const combinedNotes = [
        prepared.edit.flightNumber &&
          `Flygnummer: ${prepared.edit.flightNumber}`,
        prepared.edit.stop && `Extra stopp: ${prepared.edit.stop.label}`,
        withoutStopNote(prepared.edit.notes),
      ]
        .filter(Boolean)
        .join(" · ") || null;
      const values: Record<string, any> = {
        pet_details:prepared.edit.petDetails,
        customer_name: prepared.edit.customerName,
        customer_phone: prepared.edit.customerPhone,
        customer_email: prepared.edit.customerEmail || null,
        pickup_address: prepared.edit.pickupAddress,
        pickup_lat: prepared.edit.pickupLat,
        pickup_lng: prepared.edit.pickupLng,
        pickup_place_id: prepared.edit.pickupPlaceId,
        dropoff_address: prepared.edit.dropoffAddress,
        dropoff_lat: prepared.edit.dropoffLat,
        dropoff_lng: prepared.edit.dropoffLng,
        dropoff_place_id: prepared.edit.dropoffPlaceId,
        booking_date: prepared.edit.bookingDate,
        pickup_time: prepared.edit.pickupTime,
        passengers: prepared.edit.passengers,
        luggage_count: prepared.edit.luggageCount,
        car_type: prepared.edit.carType,
        child_seat: prepared.edit.childSeats > 0,
        child_seats: prepared.edit.childSeats,
        notes: combinedNotes,
        extra_message: prepared.edit.notes,
        updated_at: now,
        price_breakdown: {
          ...previousBreakdown,
          ...stopBreakdown(prepared.edit.stop),
          ...(prepared.quote
            ? {
                zone: prepared.quote.zone_name,
                base: Number(prepared.quote.base_price || prepared.newPrice),
                large_vehicle: Number(prepared.quote.large_surcharge || 0),
                child_seats: Number(prepared.quote.child_seat_surcharge || 0),
              }
            : {}),
          last_dispatch_edit_at: now,
          last_dispatch_edit_by: user.email || user.id,
        },
      };
      if (prepared.edit.completedAt) {
        values.completed_at = prepared.edit.completedAt;
        if (prepared.edit.completeHistorical) values.status = "completed";
        if (prepared.edit.completionDriverId) {
          values.driver_id = prepared.edit.completionDriverId;
          if (prepared.edit.completionDriverId !== prepared.current.driver_id) {
            values.assigned_partner_id = null;
            values.vehicle_id = null;
          }
        }
        values.price_breakdown = {...values.price_breakdown,
          last_completion_correction: {
            previous_completed_at: prepared.current.completed_at,
            completed_at: prepared.edit.completedAt,
            previous_driver_id: prepared.current.driver_id,
            driver_id: prepared.edit.completionDriverId || prepared.current.driver_id,
            previous_status: prepared.current.status,
            changed_at: now, changed_by: user.id,
          },
        };
      }
      if (prepared.changedAddress.pickup)
        values.pickup_point = `SRID=4326;POINT(${prepared.edit.pickupLng} ${prepared.edit.pickupLat})`;
      if (prepared.changedAddress.dropoff)
        values.dropoff_point = `SRID=4326;POINT(${prepared.edit.dropoffLng} ${prepared.edit.dropoffLat})`;
      if (prepared.priceChanged) {
        values.estimated_price = prepared.newPrice;
        values.fixed_price = prepared.newPrice;
        if (prepared.quote) values.price_zone_code = prepared.quote.zone_code || null;
        if (prepared.current.actual_price != null)
          values.actual_price = prepared.newPrice;
        if (prepared.current.driver_reported_amount != null)
          values.driver_reported_amount = prepared.newPrice;
      }
      const verifiedPayment = String(prepared.current.payment_status || "").toLowerCase() === "paid";
      if (!verifiedPayment) values.payment_method = paymentLabels[prepared.edit.driverPaymentMethod||""] || null;
      {
        const verifiedOnlinePayment =
          String(prepared.current.payment_status || "").toLowerCase() === "paid";
        values.driver_reported_payment_method = verifiedOnlinePayment
          ? "app"
          : prepared.edit.driverPaymentMethod === "link" ? "other" : prepared.edit.driverPaymentMethod;
        values.driver_reported_paid = verifiedOnlinePayment
          ? true
          : prepared.edit.driverPaymentPaid;
        values.driver_reported_payment_note = prepared.edit.driverPaymentMethod === "link" ? ["Betallänk",prepared.edit.driverPaymentNote].filter(Boolean).join(" · ") : prepared.edit.driverPaymentNote;
        values.driver_reported_at = now;
        values.price_breakdown = {
          ...values.price_breakdown,
          last_dispatch_payment_edit_at: now,
          last_dispatch_payment_edit_by: user.email || user.id,
        };
      }
      let update = supabase
        .from("bookings")
        .update(values)
        .eq("id", prepared.edit.id);
      if (prepared.edit.originalUpdatedAt)
        update = update.eq("updated_at", prepared.edit.originalUpdatedAt);
      result = await update.select().maybeSingle();
      if (!result.error && !result.data) {
        return Response.json(
          { error: "Bokningen ändrades samtidigt i en annan vy. Uppdatera Dispatch och försök igen." },
          { status: 409 },
        );
      }
      if (!result.error && result.data)
        await syncFlightForBooking(result.data).catch((error) =>
          console.error("dispatch_edit_flight_monitor_failed", {
            bookingNumber: result.data.booking_number,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }
    else if (body.action === "release_to_all") {
      result = await supabase.rpc("dispatch_release_to_all", {p_booking_id:body.bookingId});
    }
    else if (body.action === "assign") {
      if (!body.bookingId || !body.driverId)
        return Response.json(
          { error: "Välj en godkänd förare" },
          { status: 400 },
        );
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("id,full_name,approved,active,archived_at")
        .eq("id", body.driverId)
        .maybeSingle();
      if (driverError) throw driverError;
      if (
        !driver ||
        !driver.approved ||
        driver.active === false ||
        driver.archived_at
      )
        return Response.json(
          { error: "Körningen kan bara tilldelas en aktiv och godkänd förare" },
          { status: 400 },
        );
      result = await supabase.rpc("dispatch_assign_driver", {
        p_booking_id: body.bookingId,
        p_driver_id: body.driverId,
        p_changed_by: user.email || "dispatch",
      });
      notificationStatus = "assigned";
      notificationDriverName = driver.full_name || "";
    }
    else if (body.action === "status") {
      result = await supabase.rpc("dispatch_set_booking_status", {
        p_booking_id: body.bookingId,
        p_status: body.status,
        p_changed_by: user.email || "dispatch",
        p_note: "Ändrad i trafikledningen",
      });
      notificationStatus = String(body.status || "");
    }
    else if (
      body.action === "archive_booking" ||
      body.action === "restore_booking"
    )
      result = await supabase.rpc("dispatch_archive_booking", {
        p_booking_id: body.bookingId,
        p_restore: body.action === "restore_booking",
      });
    else if (body.action === "permanently_delete_booking") {
      const id=clean(body.bookingId,80);
      if(!id||body.confirmPermanentDelete!==true)return Response.json({error:"Bekräfta permanent radering."},{status:400});
      const server=adminSupabase();
      const current=await server.from("bookings").select("id,booking_number,archived_at").eq("id",id).maybeSingle();
      if(current.error)throw current.error;
      if(!current.data)return Response.json({error:"Bokningen hittades inte."},{status:404});
      if(!current.data.archived_at)return Response.json({error:"Flytta bokningen till Papperskorgen först."},{status:409});
      if(String(body.bookingNumber)!==String(current.data.booking_number))return Response.json({error:"Bokningen ändrades. Uppdatera Papperskorgen och försök igen."},{status:409});
      result=await server.rpc("server_delete_trashed_booking",{p_booking_id:id,p_booking_number:current.data.booking_number,p_expected_archived_at:current.data.archived_at});
      if(!result.error&&!result.data)return Response.json({error:"Bokningen återställdes eller ändrades samtidigt. Uppdatera Papperskorgen."},{status:409});
    }
    else if (
      body.action === "invite_driver" ||
      body.action === "invite_driver_sms"
    ) {
      const driverId = clean(body.driverId, 80);
      const driver = await adminSupabase()
        .from("drivers")
        .select("id,email,phone,full_name,archived_at")
        .eq("id", driverId)
        .maybeSingle();
      if (driver.error) throw driver.error;
      if (!driver.data || driver.data.archived_at)
        return Response.json({ error: "Föraren hittades inte." }, { status: 404 });
      driverInvite = await sendDriverAccountInvite(
        driver.data,
        body.action === "invite_driver_sms" ? "sms" : "email",
      );
      result = { data: driver.data, error: null };
    }
    else if (body.action === "save_driver") {
      const driver = body.driver ?? {};
      const driverId = clean(driver.id, 80);
      const fullName = clean(driver.fullName, 120);
      const email = clean(driver.email, 180).toLowerCase();
      const phone = clean(driver.phone, 40);
      const taxiDriverLicenseNumber =
        clean(driver.taxiDriverLicenseNumber, 50).toUpperCase() || null;
      const approved = driver.approved !== false;
      if (fullName.length < 2)
        return Response.json(
          { error: "Ange förarens fullständiga namn." },
          { status: 400 },
        );
      if (!/^\S+@\S+\.\S+$/.test(email))
        return Response.json(
          { error: "Ange en giltig e-postadress." },
          { status: 400 },
        );
      if (!/^[+]?[0-9 ()-]{7,20}$/.test(phone))
        return Response.json(
          { error: "Ange ett giltigt mobilnummer." },
          { status: 400 },
        );
      if (
        taxiDriverLicenseNumber &&
        !/^[A-Z0-9ÅÄÖ .\/-]{3,50}$/.test(taxiDriverLicenseNumber)
      )
        return Response.json(
          { error: "Kontrollera numret för taxiförarlegitimationen." },
          { status: 400 },
        );

      const driverAdmin = adminSupabase();
      const duplicate = await driverAdmin
        .from("drivers")
        .select("id,archived_at")
        .ilike("email", email)
        .limit(2);
      if (duplicate.error) throw duplicate.error;
      const existingWithEmail = (duplicate.data ?? []).find(
        (row: any) => row.id !== driverId,
      );
      if (existingWithEmail)
        return Response.json(
          {
            error: existingWithEmail.archived_at
              ? "E-postadressen finns redan i arkivet. Återställ föraren därifrån."
              : "Det finns redan en förare med denna e-postadress.",
          },
          { status: 409 },
        );

      if (taxiDriverLicenseNumber) {
        const duplicateLicense = await driverAdmin
          .from("drivers")
          .select("id,archived_at")
          .ilike("taxi_driver_license_number", taxiDriverLicenseNumber)
          .limit(2);
        if (duplicateLicense.error) throw duplicateLicense.error;
        const existingWithLicense = (duplicateLicense.data ?? []).find(
          (row: any) => row.id !== driverId,
        );
        if (existingWithLicense)
          return Response.json(
            {
              error: existingWithLicense.archived_at
                ? "Taxiförarlegitimationen finns redan på en förare i arkivet."
                : "Taxiförarlegitimationen används redan av en annan förare.",
            },
            { status: 409 },
          );
      }

      const values = {
        full_name: fullName,
        email,
        phone,
        taxi_driver_license_number: taxiDriverLicenseNumber,
        approved,
        active: approved,
        is_online: false,
        availability_status: approved ? "offline" : "paused",
        updated_at: new Date().toISOString(),
      };
      result = driverId
        ? await driverAdmin
            .from("drivers")
            .update(values)
            .eq("id", driverId)
            .is("archived_at", null)
            .select()
            .single()
        : await driverAdmin
            .from("drivers")
            .insert({ ...values, status: "active" })
            .select()
            .single();
      if (!driverId && !result.error && result.data) {
        try {
          driverInvite = await sendDriverAccountInvite(result.data);
        } catch (inviteError: any) {
          driverInvite = {
            sent: false,
            error:
              inviteError?.message ||
              "Föraren sparades, men inbjudan kunde inte skickas.",
          };
        }
      }
    }
    else if (body.action === "approve") {
      const approved = Boolean(body.approved);
      result = await adminSupabase()
        .from("drivers")
        .update({
          approved,
          active: approved,
          is_online: false,
          availability_status: approved ? "offline" : "paused",
          updated_at: new Date().toISOString(),
        })
        .eq("id", clean(body.driverId, 80))
        .is("archived_at", null)
        .select()
        .single();
    }
    else if (body.action === "delete_driver") {
      const driverId = clean(body.driverId, 80);
      const activeBooking = await adminSupabase()
        .from("bookings")
        .select("id")
        .eq("driver_id", driverId)
        .in("status", [
          "new",
          "scheduled",
          "offered",
          "assigned",
          "accepted",
          "en_route",
          "arrived",
          "passenger_onboard",
        ])
        .limit(1);
      if (activeBooking.error) throw activeBooking.error;
      if (activeBooking.data?.length)
        return Response.json(
          {
            error:
              "Föraren har en aktiv bokning. Tilldela körningen till en annan förare innan kontot raderas.",
          },
          { status: 409 },
        );
      result = await adminSupabase()
        .from("drivers")
        .update({
          active: false,
          approved: false,
          is_online: false,
          status: "archived",
          availability_status: "offline",
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId)
        .select()
        .single();
    }
    else if (body.action === "restore_driver")
      result = await adminSupabase()
        .from("drivers")
        .update({
          archived_at: null,
          active: false,
          approved: false,
          is_online: false,
          status: "active",
          availability_status: "paused",
          updated_at: new Date().toISOString(),
        })
        .eq("id", clean(body.driverId, 80))
        .select()
        .single();
    else if (body.action === "save_fare_settings")
      result = await supabase
        .from("fare_settings")
        .update({
          child_seat_surcharge: Number(body.settings.childSeatSurcharge),
          large_vehicle_surcharge: Number(body.settings.largeVehicleSurcharge),
          instant_start_fee: Number(body.settings.instantStartFee),
          prebooked_start_fee: Number(body.settings.prebookedStartFee),
          price_per_km: Number(body.settings.pricePerKm),
          instant_price_per_hour: Number(body.settings.instantPricePerHour),
          prebooked_price_per_hour: Number(body.settings.prebookedPricePerHour),
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("id", true)
        .select()
        .single();
    else if (body.action === "save_fixed_price")
      result = await supabase
        .from("price_zones")
        .update({
          fixed_price: Number(body.price),
          active: Boolean(body.active),
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq(body.code ? "code" : "name", body.code || body.locality)
        .select()
        .single();
    else if (body.action === "save_vehicle") {
      const vehicle = body.vehicle ?? {};
      const registration = String(vehicle.registrationNumber || "")
        .trim()
        .toUpperCase();
      const vehicleNumber = String(vehicle.vehicleNumber || "").trim();
      const capacity = Number(vehicle.passengerCapacity);
      if (
        !registration ||
        !vehicleNumber ||
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > 9
      ) {
        return Response.json(
          {
            error:
              "Bilnummer, registreringsnummer och giltigt antal passagerare krävs",
          },
          { status: 400 },
        );
      }
      const values = {
        name: vehicleNumber,
        reg: registration,
        vehicle_number: vehicleNumber,
        registration_number: registration,
        make: String(vehicle.make || "").trim() || null,
        model: String(vehicle.model || "").trim() || null,
        color: String(vehicle.color || "").trim() || null,
        passenger_capacity: capacity,
        vehicle_class: String(vehicle.vehicleClass || "Standard").trim(),
        active: vehicle.active !== false,
        status: vehicle.active === false ? "Inaktiv" : "Aktiv",
        driver_id: vehicle.driverId || null,
        updated_at: new Date().toISOString(),
      };
      result = vehicle.id
        ? await supabase
            .from("vehicles")
            .update(values)
            .eq("id", vehicle.id)
            .select()
            .single()
        : await supabase.from("vehicles").insert(values).select().single();
    } else if (body.action === "archive_vehicle") {
      result = await supabase
        .from("vehicles")
        .update({
          active: false,
          status: "Arkiverad",
          driver_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clean(body.vehicleId, 80))
        .select()
        .single();
    } else if (body.action === "restore_vehicle") {
      result = await supabase
        .from("vehicles")
        .update({
          active: true,
          status: "Aktiv",
          updated_at: new Date().toISOString(),
        })
        .eq("id", clean(body.vehicleId, 80))
        .select()
        .single();
    } else if (body.action === "auto_assign") {
      result = await supabase.rpc("dispatch_auto_assign", {
        p_booking_id: body.bookingId,
        p_changed_by: "dispatch_manual_auto",
      });
      if (result.error) throw result.error;
      return Response.json({ok:true,data:result.data,message:result.data?.status === "offered" ? "Körningen erbjuds närmaste lediga förare. Vid nej går den vidare till nästa." : "Ingen lämplig ledig förare med aktuell GPS hittades. Du kan välja förare manuellt eller lägga ut körningen i auktion."});
    }
    else return Response.json({ error: "Okänd åtgärd" }, { status: 400 });
    if (result.error) throw result.error;
    if (body.bookingId && notificationStatus === "assigned")
      await sendAssignedBookingPush(String(body.bookingId)).catch((error) =>
        console.error("assigned_booking_driver_push_failed", {
          bookingId: body.bookingId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    let customerSmsSent: boolean | undefined;
    if (
      body.bookingId &&
      ["assigned", "en_route", "arrived", "completed", "cancelled"].includes(
        notificationStatus,
      )
    ) {
      const customerBooking = await adminSupabase()
        .from("bookings")
        .select("id,booking_number,customer_phone,tracking_token,drivers:drivers!bookings_driver_id_fkey(full_name)")
        .eq("id", body.bookingId)
        .maybeSingle();
      if (customerBooking.error) {
        console.error("booking_sms_lookup_failed", {
          bookingId: body.bookingId,
          status: notificationStatus,
          error: customerBooking.error.message,
        });
        customerSmsSent = false;
      } else if (customerBooking.data) {
        const relatedDriver = Array.isArray(customerBooking.data.drivers)
          ? customerBooking.data.drivers[0]
          : customerBooking.data.drivers;
        const sms = await sendBookingStatusSms(
          customerBooking.data,
          notificationStatus,
          notificationDriverName || relatedDriver?.full_name || null,
        );
        customerSmsSent = sms.accepted;
      }
    }
    return Response.json({ ok: true, data: result.data, customerSmsSent, driverInvite });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Ändringen kunde inte sparas" },
      { status: 400 },
    );
  }
}
