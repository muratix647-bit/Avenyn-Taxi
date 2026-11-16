import { confirmedAmount, hasIssuedInvoice, paymentBlocked } from "../../../../lib/booking-payment-sms";
import { adminSupabase, requireSupabaseUser } from "../../../../lib/supabase-server";
import { createCheckoutSession, retrieveCheckoutSession } from "../../../../lib/stripe";

function bookingAmount(booking: any) {
  return Number(booking.actual_price ?? booking.fixed_price ?? booking.estimated_price ?? 0);
}

async function driverOwnsBooking(request: Request, bookingId: string) {
  const { supabase } = await requireSupabaseUser(request);
  const { data, error } = await supabase.rpc("driver_my_bookings");
  if (error) throw error;
  return (data || []).some((row: any) => String(row.id) === bookingId);
}

export async function POST(request: Request) {
  try {
    const body: any = await request.json();
    const bookingId = String(body.bookingId || "").trim();
    const trackingToken = String(body.trackingToken || "").trim();
    const source = body.source === "driver" ? "driver" : "customer";
    if (!bookingId) return Response.json({ error: "Bokningen saknas." }, { status: 400 });
    const admin = adminSupabase();
    const { data: booking, error } = await admin.from("bookings").select("id,booking_number,tracking_token,customer_name,customer_email,customer_phone,pickup_address,dropoff_address,estimated_price,fixed_price,actual_price,payment_status,status,archived_at,driver_reported_paid,driver_reported_amount").eq("id", bookingId).maybeSingle();
    if (error || !booking) return Response.json({ error: "Bokningen hittades inte." }, { status: 404 });
    if (source === "driver") {
      if (!(await driverOwnsBooking(request, bookingId))) return Response.json({ error: "Körningen tillhör inte den inloggade föraren." }, { status: 403 });
    } else if (!trackingToken || trackingToken !== String(booking.tracking_token)) {
      return Response.json({ error: "Ogiltig betalningslänk." }, { status: 403 });
    }
    const blocked = paymentBlocked(booking);
    if (blocked) return Response.json({error:blocked},{status:409});
    if (body.quotedOre !== undefined) {
      if (!confirmedAmount(booking) || body.quotedOre !== Math.round(confirmedAmount(booking)*100))
        return Response.json({error:'Priset har ändrats. Kontakta trafikledningen för en ny betallänk.'},{status:409});
      if (await hasIssuedInvoice(admin,booking.id))
        return Response.json({error:'En faktura har utfärdats för resan. Kontakta trafikledningen.'},{status:409});
    }
    const fromSms = body.quotedOre !== undefined;
    const amount = fromSms ? confirmedAmount(booking) : bookingAmount(booking);
    if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Bokningen saknar ett giltigt pris." }, { status: 400 });

    const entry = {booking_id:booking.id,amount_sek:amount,source:fromSms?'dispatch':source,status:'creating'};
    let claim = await admin.from("payment_requests").insert(entry).select("id,stripe_checkout_session_id").single();
    if (fromSms && claim.error?.code==='23505') {
      const existing = await admin.from("payment_requests").select("id,stripe_checkout_session_id")
        .eq("booking_id",booking.id).eq("source","dispatch").eq("amount_sek",amount).in("status",["pending","creating"]).maybeSingle();
      if (!existing.data || existing.error) return Response.json({error:'Försök öppna betalningen igen.'},{status:409});
      if (existing.data.stripe_checkout_session_id) {
        const previous = await retrieveCheckoutSession(existing.data.stripe_checkout_session_id);
        if (previous.status==='open' && previous.url) return Response.json({ok:true,url:previous.url,amount});
        if (previous.status!=='expired') return Response.json({error:'Betalningen har redan påbörjats eller slutförts.'},{status:409});
        const expired = await admin.from("payment_requests").update({status:'expired'}).eq('id',existing.data.id).eq('status','pending');
        if (expired.error) throw expired.error;
        claim = await admin.from("payment_requests").insert(entry).select("id,stripe_checkout_session_id").single();
      } else {
        claim = {...claim,data:existing.data,error:null} as typeof claim;
      }
    }
    if (claim.error || !claim.data) throw claim.error || Error('Betalningen kunde inte öppnas.');
    const paymentRequest = claim.data;
    const origin = new URL(request.url).origin;
    const session = await createCheckoutSession({
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      amountSek: amount,
      customerEmail: booking.customer_email,
      customerName: booking.customer_name,
      pickup: booking.pickup_address,
      destination: booking.dropoff_address,
      trackingToken: booking.tracking_token,
      requestId: paymentRequest.id,
      origin,
    });
    const { error: updateError } = await admin.from("payment_requests").update({stripe_checkout_session_id:session.id,checkout_url:session.url,status:"pending"}).eq("id",paymentRequest.id).eq("status","creating");
    if (updateError) throw updateError;
    return Response.json({ ok: true, url: session.url, amount, paymentRequestId: paymentRequest.id });
  } catch (error) {
    console.error("payment_checkout_failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Betalningen kunde inte startas." }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() || "";
    if (!sessionId.startsWith("cs_")) return Response.json({ error: "Betalningen saknas." }, { status: 400 });
    const session = await retrieveCheckoutSession(sessionId);
    const requestId = String(session.metadata?.payment_request_id || "");
    const bookingId = String(session.metadata?.booking_id || "");
    if (!requestId || !bookingId) return Response.json({ error: "Betalningen saknar bokningskoppling." }, { status: 400 });
    const paid = session.payment_status === "paid";
    const admin = adminSupabase();
    const { data: paymentRequest } = await admin.from("payment_requests").select("id,booking_id,amount_sek,status").eq("id", requestId).eq("booking_id", bookingId).maybeSingle();
    if (!paymentRequest) return Response.json({ error: "Betalningen hittades inte." }, { status: 404 });
    if (paid) {
      await admin.from("payment_requests").update({status:"paid",paid_at:new Date().toISOString(),stripe_payment_intent_id:session.payment_intent || null}).eq("id", requestId);
      await admin.from("bookings").update({payment_status:"paid",payment_method:"Stripe",updated_at:new Date().toISOString()}).eq("id", bookingId);
    }
    return Response.json({ ok: true, paid, status: session.payment_status, amount: Number(paymentRequest.amount_sek), bookingId });
  } catch (error) {
    console.error("payment_status_failed", error);
    return Response.json({ error: "Betalningsstatusen kunde inte kontrolleras." }, { status: 400 });
  }
}
