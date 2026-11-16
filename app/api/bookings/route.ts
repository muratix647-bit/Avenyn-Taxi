import {companyBookingAccess} from '@/lib/company-portal';
import {EconomyError} from '@/lib/economy-server';
import {validatePet,petText} from '@/lib/pets';
import {readQuote} from '@/lib/quote-token';
import {POLICY_VERSION} from "@/lib/booking-policy";
import {paymentMethods,stopBreakdown} from "@/lib/booking-options";
import { adminSupabase, publicSupabase, requireSupabaseUser } from "../../../lib/supabase-server";

import { sendBookingEmails } from "../../../lib/email";
import {sendCustomerSmsOnce} from "../../../lib/customer-sms-monitor";
import { sendBookingSms } from "../../../lib/sms";
import { syncFlightForBooking } from "../../../lib/flight-monitor";

export async function POST(request: Request) {
  try {
    const input:any = await request.json();
    if(input.policyVersion!==POLICY_VERSION)return Response.json({error:"Godkänn bokningsvillkoren innan du bokar."},{status:400});
    const corporate=input.companyId||input.paymentMethod==='Faktura'?await companyBookingAccess(request,input):null;
    const booking = {
      dispatchMode: input.pickupTime === "now" ? "instant" : "prebooking",
      paymentMethod: corporate?"Faktura":paymentMethods.includes(input.paymentMethod)?input.paymentMethod:"Kort",
      pickup: String(input.pickup || "").trim(),
      destination: String(input.destination || "").trim(),
      stop: String(input.stop || "").trim(),
      stopId: input.stopId ? String(input.stopId) : null,
      stopArea: input.stopArea ? String(input.stopArea) : null,
      stopLat: input.stopLat ?? null,
      stopLng: input.stopLng ?? null,
      pickupId: input.pickupId ? String(input.pickupId) : null,
      destinationId: input.destinationId ? String(input.destinationId) : null,
      pickupArea: input.pickupArea ? String(input.pickupArea) : null,
      destinationArea: input.destinationArea ? String(input.destinationArea) : null,
      pickupLat: input.pickupLat ?? null,
      pickupLng: input.pickupLng ?? null,
      destinationLat: input.destinationLat ?? null,
      destinationLng: input.destinationLng ?? null,
      customerName: String(input.customerName || "").trim(),
      customerPhone: String(input.customerPhone || "").trim(),
      customerEmail: String(input.customerEmail || "").trim().toLowerCase(),
      pickupTime: input.pickupTime==="now" ? new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date()).replace(" ","T") : String(input.pickupTime || ""),
      passengers: Number(input.passengers),
      vehicle: input.vehicle === "large" ? "large" as const : "standard" as const,
      childSeats: Number(input.childSeats) || 0,
      luggageCount: Number(input.luggageCount) || 0,
      flightNumber: String(input.flightNumber || "").trim(),
      extraMessage: String(input.extraMessage || "").trim(),
      locale: String(input.locale || "sv").trim().slice(0, 5),
    };
    if (!booking.customerName || !booking.customerPhone) return Response.json({ error: "Namn och mobilnummer krävs." }, { status: 400 });
    if (!/^\+?[0-9 ()-]{7,20}$/.test(booking.customerPhone)) return Response.json({ error: "Ange ett giltigt mobilnummer." }, { status: 400 });
    if (booking.customerEmail && !/^\S+@\S+\.\S+$/.test(booking.customerEmail)) return Response.json({ error: "Ange en giltig e-postadress." }, { status: 400 });
    if (!booking.pickup || !booking.destination) return Response.json({ error: "Hämtadress och destination krävs." }, { status: 400 });
    if (booking.stop && (booking.stopLat === null || booking.stopLng === null || !Number.isFinite(Number(booking.stopLat)) || !Number.isFinite(Number(booking.stopLng)))) return Response.json({ error: "Välj en plats i listan för stoppet." }, { status: 400 });
    if (!Number.isInteger(booking.passengers) || booking.passengers < 1 || booking.passengers > 7) return Response.json({ error: "Välj mellan 1 och 7 passagerare." }, { status: 400 });
    if (!Number.isInteger(booking.childSeats) || booking.childSeats < 0 || booking.childSeats > 3) return Response.json({ error: "Välj mellan 0 och 3 barnstolar." }, { status: 400 });
    const scheduled = new Date(booking.pickupTime);
    if (!Number.isFinite(scheduled.getTime())) return Response.json({ error: "Välj ett giltigt datum och klockslag." }, { status: 400 });
    const date = booking.pickupTime.slice(0, 10);
    const time = booking.pickupTime.slice(11, 19) || `${booking.pickupTime.slice(11, 16)}:00`;
    for (const [lat,lng] of [[booking.pickupLat,booking.pickupLng],[booking.destinationLat,booking.destinationLng]]) {
      if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)
        return Response.json({error:'Välj hämtplats och destination i listan eller på kartan.'},{status:400});
    }
    const quoteInput = {
      pickupAddress: String(booking.pickup || "").trim(),
      dropoffAddress: String(booking.destination || "").trim(),
      pickupLat: booking.pickupLat ?? null,
      pickupLng: booking.pickupLng ?? null,
      dropoffLat: booking.destinationLat ?? null,
      dropoffLng: booking.destinationLng ?? null,
      stopAddress: booking.stop || null,
      stopLat: booking.stopLat ?? null,
      stopLng: booking.stopLng ?? null,
      stopPlaceId: booking.stopId ?? null,
      stopArea: booking.stopArea,
      pickupPlaceId: booking.pickupId ?? null,
      dropoffPlaceId: booking.destinationId ?? null,
      pickupArea: booking.pickupArea,
      dropoffArea: booking.destinationArea,
      carType: booking.vehicle === "large" ? "large" : "standard",
      childSeats: Number(booking.childSeats) || 0,
      pickupTime: input.pickupTime === "now" ? "now" : booking.pickupTime,
    };
    const lockedQuote=await readQuote(input.quoteToken,quoteInput);
    if(!lockedQuote)return Response.json({error:"Prisförslaget har gått ut eller resan ändrats. Uppdatera priset och bekräfta igen.",refreshQuote:true},{status:409});
    const companyPrice=lockedQuote.quote?.company_pricing;
    if((corporate&&(companyPrice?.company_id!==corporate.companyId||companyPrice?.booker_id!==corporate.userId))||(!corporate&&companyPrice))return Response.json({error:'Uppdatera priset för vald företagskund.',refreshQuote:true},{status:409});
    const petDetails=await validatePet(adminSupabase(),input.petDetails);
    const verifiedQuote=lockedQuote.quote;
    if (verifiedQuote?.total_price == null) return Response.json({ error: "Kontakta oss för fast pris" }, { status: 400 });
    const {data,error}=await adminSupabase().rpc(corporate?'billing_create_quoted_booking':'customer_create_quoted_booking',{
      p_quote_id:lockedQuote.id,p_booking:{...booking,petDetails},p_quote:verifiedQuote,
      p_policy_version:POLICY_VERSION,
      ...(corporate?{p_user_id:corporate.userId,p_company_id:corporate.companyId,p_reference:corporate.reference}:{}),
    });
    if (error) return Response.json({ error: error.message.includes("Kontakta oss") ? "Kontakta oss för fast pris" : error.message }, { status: 400 });
    const result = data?.[0];
    if (!result) throw new Error("Bokningen saknar svar från databasen.");
    {
      const server=adminSupabase();
      const current=await server.from("bookings").select("price_breakdown").eq("id",result.id).single();
      if(current.error)throw current.error;{const saved=await server.from("bookings").update({pet_details:petDetails,price_breakdown:{...(current.data?.price_breakdown||{}),...(booking.stop?stopBreakdown({label:booking.stop,lat:booking.stopLat,lng:booking.stopLng,id:booking.stopId,area:booking.stopArea}):{}),booking_policy:{version:POLICY_VERSION,accepted_at:new Date().toISOString(),accepted:true,acceptance_method:"booking_confirmation"}}}).eq("id",result.id);if(saved.error)throw saved.error;}
    }
    const monitorBooking = {
      id: result.id,
      booking_number: result.booking_number,
      booking_date: date,
      status: result.status,
      pickup_address: booking.pickup,
      dropoff_address: booking.destination,
      customer_name: booking.customerName,
      customer_phone: booking.customerPhone,
      customer_email: booking.customerEmail,
      tracking_token: result.tracking_token,
      notes: [booking.flightNumber && `Flygnummer: ${booking.flightNumber}`, booking.stop && `Extra stopp: ${booking.stop}`, booking.extraMessage].filter(Boolean).join(" · ") || null,
    };
    const notificationBooking = {
      ...booking,
      extraMessage: [petDetails&&`Djur: ${petText(petDetails)}`,booking.stop && `Extra stopp: ${booking.stop}`, booking.extraMessage].filter(Boolean).join(" · "),
    };
    const [email, sms, flightMonitor] = await Promise.all([
      sendBookingEmails(notificationBooking, result).catch((error) => {
        console.error("booking_email_unexpected_error", {
          bookingNumber: result.booking_number,
          error: error instanceof Error ? error.message : "Unknown email error",
        });
        return { sent: false };
      }),
      sendCustomerSmsOnce(result.id,"booking_confirmation","initial",latest=>sendBookingSms(latest,latest)).catch((error) => {
        console.error("booking_sms_unexpected_error", {
          bookingNumber: result.booking_number,
          error: error instanceof Error ? error.message : "Unknown SMS error",
        });
        return { accepted: false, reason:"send_failed" };
      }),
      booking.flightNumber
        ? syncFlightForBooking(monitorBooking).catch((error) => {
            console.error("booking_flight_monitor_failed", {
              bookingNumber: result.booking_number,
              error: error instanceof Error ? error.message : "Unknown flight monitor error",
            });
            return { monitored: false };
          })
        : Promise.resolve({ monitored: false }),
    ]);
    return Response.json({
      ok: true,
      id: Number(result.booking_number),
      bookingId: result.id,
      status: result.status,
      price: Number(result.price),
      trackingToken: result.tracking_token,
      emailSent: email.sent,
      smsSent: sms.accepted,
      smsScheduled: false,
      smsError: sms.accepted ? null : "Bokningen är sparad, men SMS-bekräftelsen kunde inte skickas. Kontakta Avenyn Taxi.",
      flightMonitored: Boolean(flightMonitor.monitored),
      booking: {
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail,
        pickup: booking.pickup,
        stop: booking.stop || undefined,
        destination: booking.destination,
        pickupTime: booking.pickupTime,
        passengers: booking.passengers,
        vehicle: booking.vehicle,
        childSeats: booking.childSeats,
        petDetails,
      },
    });
  } catch (error) {
    if(error instanceof EconomyError)return Response.json({error:error.message},{status:error.status});
    console.error("booking_failed", error);
    return Response.json({ error: "Bokningen kunde inte sparas. Försök igen." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireSupabaseUser(request);
    const { data, error } = await supabase
      .from("bookings")
      .select("*,drivers:drivers!bookings_driver_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw error;
    return Response.json(data);
  } catch {
    return Response.json({ error: "Logga in" }, { status: 401 });
  }
}
