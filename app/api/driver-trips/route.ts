import {prebookingBoard} from '@/lib/driver-prebooking-board';
import {driverTrip} from '@/lib/driver-trip-privacy';
import {streetPaymentHistory} from '@/lib/driver-payment-history';
import {isOwnCompany,monthPeriod,validPeriod} from '@/lib/report-period';
import { adminSupabase, requireSupabaseUser } from "../../../lib/supabase-server";
import { sendReceiptEmail } from "../../../lib/email";
import { sendBookingStatusSms } from "../../../lib/sms";
import { syncPendingStripePayments } from "../../../lib/payment-sync";

const mapTrip = (row: any) => ({ ...row, pickup: row.pickup_address, destination: row.dropoff_address, destination_lat: row.dropoff_lat, destination_lng: row.dropoff_lng, pickup_time: `${row.booking_date}T${row.pickup_time}`, price: Number(row.driver_reported_amount ?? row.actual_price ?? row.fixed_price ?? row.estimated_price ?? 0), id: row.id });

function stockholmDateKey(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function historySummary(rows: any[]) {
  const total = rows.reduce((sum, row) => sum + Number(row.price || 0), 0);
  const paid = rows.filter(
    (row) => row.driver_reported_paid === true || row.payment_status === "paid",
  );
  const appPaid = paid.filter(
    (row) =>
      row.driver_reported_payment_method === "app" ||
      (row.payment_status === "paid" && !row.driver_reported_payment_method),
  );
  return {
    trips: rows.filter(row => !row.street_payment).length,
    blippPaid: paid.filter(row => row.driver_reported_payment_method === "blipp").reduce((sum,row)=>sum+Number(row.price||0),0),
    revenue: total,
    paid: paid.reduce((sum, row) => sum + Number(row.price || 0), 0),
    appPaid: appPaid.reduce((sum, row) => sum + Number(row.price || 0), 0),
    unpaid: rows
      .filter(
        (row) => row.driver_reported_paid !== true && row.payment_status !== "paid",
      )
      .reduce((sum, row) => sum + Number(row.price || 0), 0),
  };
}

async function notifyCompletedBooking(bookingId: string, booking: any) {
  let customerSmsSent: boolean | undefined;
  const customerBooking = await adminSupabase()
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (customerBooking.error) {
    console.error("booking_sms_lookup_failed", {
      bookingId,
      status: "completed",
      error: customerBooking.error.message,
    });
    customerSmsSent = false;
  } else if (customerBooking.data) {
    booking = customerBooking.data;
    const sms = await sendBookingStatusSms(customerBooking.data, "completed");
    customerSmsSent = sms.accepted;
  }

  let receiptEmailSent: boolean | undefined;
  try {
    const receipt = await sendReceiptEmail({ ...booking, status: "completed" });
    receiptEmailSent = receipt.accepted;
  } catch (error) {
    receiptEmailSent = false;
    console.error("receipt_email_unexpected_error", {
      bookingId,
      bookingNumber: booking.booking_number,
      error: error instanceof Error ? error.message : "Unknown email error",
    });
  }
  return { receiptEmailSent, customerSmsSent };
}

export async function GET(request: Request) {
  try {
    const { supabase,user } = await requireSupabaseUser(request);
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "history") {
      const requestedMonth = url.searchParams.get("month") || stockholmDateKey(new Date()).slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth))
        return Response.json({ error: "Ogiltig månad" }, { status: 400 });
      const fallback=monthPeriod(requestedMonth);
      const period={from:url.searchParams.get('from')||fallback.from,to:url.searchParams.get('to')||fallback.to};
      if(!validPeriod(period))return Response.json({error:'Välj ett giltigt datumintervall.'},{status:400});
      const months:string[]=[];let cursor=period.from.slice(0,7);
      while(cursor<=period.to.slice(0,7)&&months.length<=24){months.push(cursor);const next=new Date(cursor+'-01T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);cursor=next.toISOString().slice(0,7);}
      if(months.length>24)return Response.json({error:'Välj högst 24 månader åt gången.'},{status:400});
      const rows:any[]=[];
      for(const m of months){const result=await supabase.rpc('driver_my_completed_bookings',{p_month:m+'-01'});if(result.error)throw result.error;rows.push(...(result.data??[]));}
      let history = Array.from(new Map(rows.map(row=>[row.id,row])).values()).map(mapTrip).filter((row:any)=>{const day=row.completed_at?stockholmDateKey(row.completed_at):row.booking_date;return day>=period.from&&day<=period.to;});
      const admin=adminSupabase();
      const person=await admin.from('drivers').select('id').eq('auth_user_id',user.id).maybeSingle();
      if(person.error)throw person.error;
      if(person.data){
        const payments:any[]=[];
        const start=new Date(period.from+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-1);
        const end=new Date(period.to+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
        for(let offset=0;;offset+=1000){
          const result=await admin.from('driver_payments').select('id,amount_ore,reference,status,paid_at,payment_channel').eq('driver_id',person.data.id).eq('status','paid').gte('paid_at',start.toISOString()).lt('paid_at',end.toISOString()).order('paid_at',{ascending:false}).order('id').range(offset,offset+999);
          if(result.error)throw result.error;
          payments.push(...(result.data||[]));
          if((result.data||[]).length<1000)break;
        }
        history.push(...streetPaymentHistory(payments,period));
        history.sort((a:any,b:any)=>String(b.completed_at||'').localeCompare(String(a.completed_at||'')));
      }
      const link=person.data?await admin.from('partner_drivers').select('partner_id').eq('driver_id',person.data.id).maybeSingle():{data:null,error:null};
      if(link.error)throw link.error;
      let showDriverShare=true;
      if(link.data){const company=await admin.from('taxi_partners').select('company').eq('id',link.data.partner_id).single();if(company.error)throw company.error;showDriverShare=isOwnCompany(company.data.company);}
      return Response.json({
        showDriverShare,
        month: requestedMonth,
        history,
        summary: historySummary(history),
      });
    }
    const initial = await supabase.rpc("driver_my_bookings");
    if (initial.error) throw initial.error;
    if(new URL(request.url).searchParams.get('activeOnly')==='1') {
      const pool=await supabase.rpc('driver_prebooking_pool');
      if(pool.error)throw pool.error;
      return Response.json({active:(initial.data||[]).map(driverTrip).map(mapTrip).filter((row:any)=>!['completed','cancelled'].includes(row.status)),availableIds:(pool.data||[]).map((row:any)=>String(row.id))},{headers:{'Cache-Control':'no-store'}});
    }
    let data = initial.data;
    const updatedPayments = await syncPendingStripePayments(
      (data ?? []).map((row: any) => String(row.id)),
    );
    if (updatedPayments > 0) {
      const refreshed = await supabase.rpc("driver_my_bookings");
      if (refreshed.error) throw refreshed.error;
      data = refreshed.data;
    }
    const rows = (data ?? []).map(driverTrip).map(mapTrip);
    const history = rows
      .filter((row: any) => row.status === "completed")
      .sort(
        (a: any, b: any) =>
          new Date(b.completed_at || 0).getTime() -
          new Date(a.completed_at || 0).getTime(),
      )
      .slice(0, 20);
    const active = rows.filter((row: any) => !["completed", "cancelled"].includes(row.status));
    const today = stockholmDateKey(new Date());
    const completedToday = rows.filter(
      (row: any) =>
        row.status === "completed" &&
        stockholmDateKey(row.completed_at || `${row.booking_date}T${row.pickup_time}`) === today,
    );
    const pool=await supabase.rpc("driver_prebooking_pool");
    if(pool.error)throw pool.error;
    const person=await adminSupabase().from('drivers').select('id,accepts_pets').eq('auth_user_id',user.id).eq('active',true).eq('approved',true).is('archived_at',null).single();if(person.error)throw person.error;
    const offered=pool.data||[];const ids=[...rows,...offered].map((r:any)=>r.id);
    if(ids.length){const details=await adminSupabase().from('bookings').select('id,pet_details').in('id',ids);if(details.error)throw details.error;const pets=new Map((details.data||[]).map((r:any)=>[r.id,r.pet_details]));for(const row of [...rows,...offered])row.pet_details=pets.get(row.id)||null;}
    const upcoming=await adminSupabase().from('bookings').select('id,booking_number,booking_date,pickup_time,pickup_address,dropoff_address,passengers,car_type,child_seats,luggage_count,pet_details,fixed_price,estimated_price,price_breakdown,created_at,status,driver_id,assigned_partner_id').is('archived_at',null).or(`booking_date.gte.${today},and(driver_id.is.null,assigned_partner_id.is.null,status.in.(new,scheduled,confirmed))`).in('status',['new','scheduled','confirmed','offered','assigned','accepted','en_route','arrived']).order('booking_date').order('pickup_time').limit(500);
    if(upcoming.error)throw upcoming.error;
    const declined=await adminSupabase().from('driver_action_log').select('booking_id,created_at').eq('driver_id',person.data.id).eq('action','broadcast_declined');
    if(declined.error)throw declined.error;
    const reopened=new Map((upcoming.data||[]).map(b=>[b.id,Date.parse(b.price_breakdown?.broadcast_reopened_at||'')||0]));
    const declinedIds=new Set((declined.data||[]).filter(r=>Date.parse(r.created_at)>(reopened.get(r.booking_id)||0)).map(r=>r.booking_id));
    const board=prebookingBoard((upcoming.data||[]).filter(b=>!declinedIds.has(b.id)),offered,person.data.id,person.data.accepts_pets);
    return Response.json({ prebookings:board, active, history, summary: { trips: completedToday.length, revenue: completedToday.reduce((sum: number, row: any) => sum + row.price, 0) } });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Logga in" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const body: any = await request.json();
    const bookingId = String(body.bookingId || "").trim();
    if (!bookingId) return Response.json({ error: "Bokningsnummer saknas" }, { status: 400 });
    if (body.action === "decline_booking") {
      const db=adminSupabase();
      const person=await db.from('drivers').select('id').eq('auth_user_id',user.id).eq('active',true).eq('approved',true).is('archived_at',null).single();
      if(person.error)throw person.error;
      const pool=await supabase.rpc('driver_prebooking_pool');
      if(pool.error)throw pool.error;
      if(!(pool.data||[]).some((b:any)=>String(b.id)===bookingId))return Response.json({error:'Bokningen är inte längre ledig.'},{status:409});
      const saved=await db.from('driver_action_log').insert({booking_id:bookingId,actor_id:user.id,driver_id:person.data.id,action:'broadcast_declined',details:{note:'Föraren tackade nej. Bokningen är kvar för övriga förare.'}});
      if(saved.error)throw saved.error;
      return Response.json({ok:true});
    }
    if (body.action === "claim_prebooking") {
      const person=await adminSupabase().from('drivers').select('id,accepts_pets').eq('auth_user_id',(await requireSupabaseUser(request)).user.id).single();
      if(person.error)throw person.error;
      const trip=await adminSupabase().from('bookings').select('pet_details').eq('id',bookingId).maybeSingle();if(trip.error)throw trip.error;
      if(trip.data?.pet_details&&!person.data.accepts_pets)return Response.json({error:'Aktivera djurresor under Mer för att acceptera denna resa.'},{status:409});
      const result=await supabase.rpc("driver_claim_prebooking",{p_booking_id:bookingId});
      if(result.error)throw result.error;
      return Response.json({ok:true,data:result.data&&typeof result.data==="object"?driverTrip(result.data):result.data});
    }
    if (body.action === "undo") {
      const result = await supabase.rpc("driver_undo_my_booking_status", {
        p_booking_id: bookingId,
      });
      if (result.error) throw result.error;
      return Response.json({ ok: true, data: result.data&&typeof result.data==="object"?driverTrip(result.data):result.data });
    }
    if (body.action === "edit_accounting") {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000)
        return Response.json({ error: "Ange ett giltigt belopp" }, { status: 400 });
      const result = await supabase.rpc("driver_update_my_completed_booking", {
        p_booking_id: bookingId,
        p_amount: amount,
        p_payment_method: String(body.paymentMethod || ""),
        p_paid: body.paid === true,
        p_note: String(body.paymentNote || "").trim().slice(0, 200) || null,
        p_reason: String(body.reason || "").trim().slice(0, 300) || null,
      });
      if (result.error) throw result.error;
      return Response.json({ ok: true, data: result.data&&typeof result.data==="object"?driverTrip(result.data):result.data });
    }
    if (body.action === "reject") {
      const result = await supabase.rpc("driver_reject_my_booking", { p_booking_id: bookingId });
      if (result.error) throw result.error;
      const next=await adminSupabase().rpc('dispatch_auto_assign',{p_booking_id:bookingId,p_changed_by:'driver_declined'});
      if(next.error)console.error('next_driver_offer_failed',next.error.message);
      return Response.json({ ok: true, data: result.data&&typeof result.data==="object"?driverTrip(result.data):result.data });
    }
    if (body.action === "complete") {
      const current = await supabase.rpc("driver_my_bookings");
      if (current.error) throw current.error;
      const booking = (current.data ?? []).find(
        (row: any) => String(row.id) === bookingId,
      );
      if (!booking)
        return Response.json(
          { error: "Körningen tillhör inte den inloggade föraren" },
          { status: 404 },
        );
      if (booking.status !== "passenger_onboard")
        return Response.json(
          { error: "Körningen måste ha status Kund i bilen innan den kan slutföras" },
          { status: 409 },
        );

      const prepaid = booking.payment_status === "paid";
      const amount = prepaid
        ? Number(
            booking.actual_price ??
              booking.fixed_price ??
              booking.estimated_price ??
              0,
          )
        : Number(body.amount);
      const method = prepaid ? "app" : String(body.paymentMethod || "");
      const paid = prepaid ? true : body.paid === true;
      const note = String(body.paymentNote || "").trim().slice(0, 200);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000)
        return Response.json(
          { error: "Ange ett giltigt slutbelopp" },
          { status: 400 },
        );

      const result = await supabase.rpc("driver_complete_my_booking", {
        p_booking_id: bookingId,
        p_amount: amount,
        p_payment_method: method,
        p_paid: paid,
        p_note: note || null,
      });
      if (result.error) throw result.error;
      const updated = Array.isArray(result.data) ? result.data[0] : result.data;
      const notifications = await notifyCompletedBooking(bookingId, {
        ...booking,
        ...(updated || {}),
      });
      return Response.json({ ok: true, data: result.data&&typeof result.data==="object"?driverTrip(result.data):result.data, ...notifications });
    }
    const transitions: Record<string, string[]> = {
      offered: ["accepted"],
      assigned: ["accepted"],
      accepted: ["en_route"],
      en_route: ["arrived"],
      arrived: ["passenger_onboard"],
    };
    const nextStatus = String(body.status || "");
    if (!["accepted", "en_route", "arrived", "passenger_onboard"].includes(nextStatus))
      return Response.json(
        { error: "Slutför körningen genom att registrera belopp och betalsätt" },
        { status: 400 },
      );
    const current = await supabase.rpc("driver_my_bookings");
    if (current.error) throw current.error;
    const booking = (current.data ?? []).find((row: any) => String(row.id) === bookingId);
    if (!booking) return Response.json({ error: "Körningen tillhör inte den inloggade föraren" }, { status: 404 });
    if (!transitions[String(booking.status)]?.includes(nextStatus)) return Response.json({ error: "Körningen måste följa ordningen Tilldelad → På väg → Framme → Kund i bilen → Slutförd" }, { status: 409 });
    const result = await supabase.rpc("driver_progress_my_booking", { p_booking_id: bookingId, p_status: nextStatus });
    if (result.error) throw result.error;
    let customerSmsSent: boolean | undefined;
    if (["accepted", "en_route", "arrived"].includes(nextStatus)) {
      const customerBooking = await adminSupabase()
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();
      if (customerBooking.error) {
        console.error("booking_sms_lookup_failed", {
          bookingId,
          status: nextStatus,
          error: customerBooking.error.message,
        });
        customerSmsSent = false;
      } else if (customerBooking.data) {
        const sms = await sendBookingStatusSms(
          customerBooking.data,
          nextStatus,
        );
        customerSmsSent = sms.accepted;
      }
    }
    let receiptEmailSent: boolean | undefined;
    if (nextStatus === "completed") {
      const updated = Array.isArray(result.data) ? result.data[0] : result.data;
      const completedBooking = { ...booking, ...(updated || {}), status: "completed" };
      const notifications = await notifyCompletedBooking(
        bookingId,
        completedBooking,
      );
      receiptEmailSent = notifications.receiptEmailSent;
      customerSmsSent = notifications.customerSmsSent;
    }
    return Response.json({
      ok: true,
      data: result.data&&typeof result.data==="object"?driverTrip(result.data):result.data,
      receiptEmailSent,
      customerSmsSent,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Statusen kunde inte ändras" }, { status: 400 });
  }
}
