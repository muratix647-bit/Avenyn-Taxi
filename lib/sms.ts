import {invoiceBankgiro,paidNoticeSv,paidNoticeEn} from './customer-invoice';
import { env } from "cloudflare:workers";

const TRACKING_ORIGIN = "https://avenyntaxi.se";

export type SmsResult = {
  accepted: boolean;
  providerId?: string;
  status?: number;
  reason?: string;
};

export function normalizePhone(value: unknown) {
  let phone = String(value || "").replace(/[^\d+]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith("0")) phone = `+46${phone.slice(1)}`;
  else if (phone.startsWith("46")) phone = `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : "";
}

function shortTrackingToken(token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return encodeURIComponent(token);
  const bytes = token.replace(/-/g, "").match(/../g)!.map(hex => String.fromCharCode(parseInt(hex, 16))).join("");
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function trackingUrl(booking: any) {
  const token = String(booking?.tracking_token || booking?.trackingToken || "");
  return token
    ? `${TRACKING_ORIGIN}/r/${shortTrackingToken(token)}`
    : TRACKING_ORIGIN;
}

function bookingNumber(booking: any) {
  return String(booking?.booking_number ?? booking?.bookingNumber ?? "").trim();
}

async function sendSms(options: {
  kind: string;
  booking: any;
  body: string;
  toPhone?: string;
}): Promise<SmsResult> {
  const accountSid = String(env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(env.TWILIO_AUTH_TOKEN || "").trim();
  const messagingServiceSid = String(
    env.TWILIO_MESSAGING_SERVICE_SID || "",
  ).trim();
  const from = String(env.TWILIO_FROM_NUMBER || "").trim();
  const to = normalizePhone(
    options.toPhone ?? options.booking?.customer_phone ?? options.booking?.customerPhone,
  );
  const number = bookingNumber(options.booking);

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    console.error("sms_configuration_error", {
      kind: options.kind,
      bookingNumber: number,
      code: "TWILIO_CONFIGURATION_MISSING",
    });
    return { accepted: false, reason: "sms_not_configured" };
  }
  if (!to) {
    console.error("sms_validation_error", {
      kind: options.kind,
      bookingNumber: number,
      code: "INVALID_RECIPIENT_PHONE",
    });
    return { accepted: false, reason: "invalid_phone" };
  }

  const form = new URLSearchParams({ To: to, Body: options.body });
  if (messagingServiceSid)
    form.set("MessagingServiceSid", messagingServiceSid);
  else form.set("From", from);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: form,
      },
    );
    const provider: any = await response
      .json()
      .catch(() => ({ message: `HTTP ${response.status}` }));

    if (!response.ok || !provider?.sid) {
      console.error("sms_provider_rejected", {
        kind: options.kind,
        bookingNumber: number,
        status: response.status,
        providerCode: provider?.code || null,
        providerError: provider?.message || "Unknown provider error",
      });
      return {
        accepted: false,
        status: response.status,
        reason: "provider_rejected",
      };
    }

    console.info("sms_provider_accepted", {
      kind: options.kind,
      bookingNumber: number,
      providerId: provider.sid,
      providerStatus: provider.status,
    });
    return {
      accepted: true,
      providerId: provider.sid,
      status: response.status,
    };
  } catch (error) {
    console.error("sms_provider_failed", {
      kind: options.kind,
      bookingNumber: number,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    });
    return { accepted: false, reason: "provider_unreachable" };
  }
}

function pickupDateTime(booking:any){
  const bookingDate=String(booking?.booking_date||"").slice(0,10);
  const bookingTime=String(booking?.pickup_time||"").slice(0,5);
  // booking_date + pickup_time are already local Swedish wall-clock values.
  // Parsing them as a JavaScript Date incorrectly adds the UTC offset (+1/+2h).
  if(/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)&&/^\d{2}:\d{2}$/.test(bookingTime))return bookingDate+" "+bookingTime;
  const raw=booking?.pickupTime||"";
  if(!raw)return "tid enligt bokningen";
  const text=String(raw).trim();
  const local=text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/);
  if(local)return local[1]+" "+local[2];
  const date=new Date(text);
  return Number.isFinite(date.getTime())?date.toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",dateStyle:"short",timeStyle:"short"}):text.replace("T"," ");
}

function flightSummary(flight:any,booking:any){
  const number=flight?.flight_number||booking?.flightNumber||booking?.flight_number||String(booking?.notes||"").match(/Flygnummer:\s*([^·]+)/i)?.[1]?.trim();
  if(!number)return "Flyg: inget flygnummer angivet.";
  const snapshot=flight?.last_snapshot||{};
  const status=flight?.last_status||snapshot?.status||"liveinfo visas i länken";
  const estimated=flight?.last_estimated_utc||snapshot?.estimatedUtc;
  const time=estimated?new Date(estimated).toLocaleTimeString("sv-SE",{timeZone:"Europe/Stockholm",hour:"2-digit",minute:"2-digit"}):"";
  return "Flyg "+number+": "+status+(time?" kl. "+time:"")+".";
}

function bookingDetailsBody(booking:any,flight?:any,includeLink=true) {
  const flightInfo=flightSummary(flight,booking);
  const flightNotice=flightInfo.startsWith("Flyg: inget")?"":" Följ även ditt flyg och flygändringar. Flyguppgifter garanteras inte; kontrollera själv med flygbolaget.";
  return "Avenyn Taxi · Bokning #"+bookingNumber(booking)+" bekräftad, "+pickupDateTime(booking)+".\nKlicka här för att följa din bil (vid förbokning från 30 min före hämtning, när position finns)."+flightNotice+(includeLink?"\n"+trackingUrl(booking):"");

}

export async function sendBookingSms(booking: any, result: any) {
  const number = bookingNumber(result);
  const body=bookingDetailsBody({...booking,...result});
  const [customer,admin]=await Promise.all([
    sendSms({kind:"booking_confirmation",booking:{...booking,...result},body}),
    sendSms({kind:"booking_confirmation_admin_copy",booking:{...booking,...result},toPhone:String(env.ADMIN_NOTIFICATION_PHONE||""),body:"Ny bokning hos Avenyn Taxi – "+(booking.customerName||booking.customer_name)+", "+(booking.customerPhone||booking.customer_phone)+". "+body}),
  ]);
  return {...customer,adminAccepted:admin.accepted};
}

export async function sendBookingDetailsSms(booking:any,flight?:any){
  const number=bookingNumber(booking);
  const body=bookingDetailsBody(booking,flight);
  const [customer,admin]=await Promise.all([
    sendSms({kind:"booking_details_manual",booking,body}),
    sendSms({kind:"booking_details_admin_copy",booking,toPhone:String(env.ADMIN_NOTIFICATION_PHONE||""),body:"SMS skickat till "+(booking.customer_name||"kund")+" ("+(booking.customer_phone||"")+"). "+body}),
  ]);
  return {customer,admin};
}

export async function sendManualBookingSms(booking:any,includeLink=true){
  const number=bookingNumber(booking);
  const body=bookingDetailsBody(booking,undefined,includeLink);
  return sendSms({kind:includeLink?"manual_booking_with_link":"manual_booking_details",booking,body});
}

export function sendBookingStatusSms(
  booking: any,
  status: string,
  driverName?: string | null,
) {
  // One confirmation SMS. Later changes are shown in the same trip link.
  return Promise.resolve({accepted:false,reason:"customer_sms_suppressed"} satisfies SmsResult);
}

export function sendFlightAlertSms(
  booking: any,
  options: {
    flightNumber: string;
    message: string;
  },
) {
  return sendSms({kind:"flight_alert",booking,body:`Avenyn Taxi · Flyg ${options.flightNumber}\n${options.message} Kontrollera med flygbolaget.\n${trackingUrl(booking)}`});
}

export function sendDriverAccountSms(
  driver: { full_name?: string | null; phone?: string | null },
  actionUrl: string,
  driverAppUrl: string,
) {
  return sendSms({
    kind: "driver_account_invite",
    booking: { customer_phone: driver.phone, booking_number: "FÖRARE" },
    body: `Avenyn Taxi\nFörarapp: ${driverAppUrl}\nSkapa lösenord: ${actionUrl}`,
  });
}

export function sendAdminSmsTest() {
  return sendSms({
    kind: "admin_sms_test",
    booking: {
      customer_phone: env.ADMIN_NOTIFICATION_PHONE,
      booking_number: "TEST",
    },
    body: "Avenyn Taxi: SMS är nu korrekt kopplat till Twilio. Boknings- och flygvarningar kan skickas automatiskt.",
  });
}

export async function sendPrebookingAdminAlert(booking:any,message:string) {
  const phone=String(env.ADMIN_NOTIFICATION_PHONE || '').trim();
  if(!phone) return {accepted:false,reason:'admin_phone_missing'};
  return sendSms({kind:'prebooking_admin_alert',booking,toPhone:phone,body:`Avenyn Taxi: Förbokning ${bookingNumber(booking)} ${booking.booking_date} kl ${String(booking.pickup_time).slice(0,5)}. ${message}. ${booking.pickup_address} → ${booking.dropoff_address}. Hantera: https://avenyntaxi.se/dispatch`});
}

export async function sendBookingTimeUpdateSms(booking:any){
 const body=`Avenyn Taxi · Uppdaterad hämtningstid\nBokning #${bookingNumber(booking)}\n${pickupDateTime(booking)}`;
 return Promise.all([sendSms({kind:'admin_time_update',booking,toPhone:String(env.ADMIN_NOTIFICATION_PHONE||''),body:`Kunden har ändrat hämtningstiden. ${body}`})]);
}

export function sendPickupReminderSms(booking:any){
 return sendSms({kind:'pickup_reminder',booking,body:`Avenyn Taxi · Påminnelse om bokning #${bookingNumber(booking)}\nHämtning ${pickupDateTime(booking)} vid ${booking.pickup_address}.\nKlicka här Avenyn-Taxi: ${trackingUrl(booking)}`});
}

export function bookingPaymentUrl(booking: any, amount: number) {
  return trackingUrl(booking) + '?belopp=' + Math.round(amount * 100) + '#betala';
}

export function sendBookingPaymentSms(booking: any, amount: number) {
  const link = bookingPaymentUrl(booking,amount);
  const body = `Avenyn Taxi · Bokning #${bookingNumber(booking)}
Hämtning ${pickupDateTime(booking)}. Att betala: ${amount.toLocaleString('sv-SE')} kr. Öppna bokningen och betala: ${link}`;
  return sendSms({kind:'payment_link', booking, body});
}

export function sendInvoiceLinkSms(phone:string,number:string,url:string) {
  return sendSms({kind:'invoice_pdf',booking:{},toPhone:phone,body:`Avenyn Taxi · Din faktura ${number} finns som PDF. Öppna fakturan: ${url}`});
}

export function sendPaidReceiptSms(booking:any,url:string){
 return sendSms({kind:'paid_receipt',booking,body:`Avenyn Taxi #${booking.booking_number}. ${paidNoticeSv} ${paidNoticeEn}\n${invoiceBankgiro} (endast info).\nKvitto: ${url}`});
}
