import { receiptPdf, pdfBase64 } from "./receipt-pdf";
import {receiptHtml,receiptPaid,receiptUrl,paidReceiptEmailNotice} from "./receipt";
import { env } from "cloudflare:workers";

const CONTACT_EMAIL = "info@avenyntaxi.se";
const CONTACT_PHONE = "+46 700 315 315";
const DEFAULT_FROM = "Avenyn Taxi <bokning@avenyntaxi.com>";
const LOGO_URL = "https://www.avenyntaxi.se/avenyn-logo-est-2003.jpg";

const safe = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );

const present = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const formatDateTime = (value: unknown) => {
  if (!present(value)) return "";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "long",
    timeStyle: "short",
  });
};

const bookingDateTime = (booking: any) => {
  const value = present(booking.pickupTime)
    ? String(booking.pickupTime)
    : present(booking.booking_date)
      ? `${booking.booking_date}T${String(booking.pickup_time || "00:00").slice(0, 5)}`
      : "";
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!parts) return value;
  const months = [
    "januari",
    "februari",
    "mars",
    "april",
    "maj",
    "juni",
    "juli",
    "augusti",
    "september",
    "oktober",
    "november",
    "december",
  ];
  return `${Number(parts[3])} ${months[Number(parts[2]) - 1]} ${parts[1]} kl. ${parts[4]}:${parts[5]}`;
};

const vehicleName = (value: unknown) =>
  String(value || "standard").toLowerCase() === "large"
    ? "Storbil"
    : "Vanlig bil";

const extras = (booking: any) => {
  const childSeats = Number(booking.childSeats ?? booking.child_seats ?? 0);
  const values = [];
  if (childSeats > 0)
    values.push(`${childSeats} barnstol${childSeats > 1 ? "ar" : ""}`);
  if (present(booking.flightNumber))
    values.push(`Flygnummer: ${booking.flightNumber}`);
  return values.length ? values.join(" · ") : "Inga tillval";
};

const paymentStatus = (value: unknown) => {
  const labels: Record<string, string> = {
    paid: "Betald",
    unpaid: "Obetald",
    pending: "Väntar på betalning",
    refunded: "Återbetald",
  };
  const normalized = String(value || "").toLowerCase();
  return labels[normalized] || String(value || "");
};

const row = (label: string, value: unknown) =>
  present(value)
    ? `<tr><td class="label" style="padding:10px 16px 10px 0;color:#587083;font-size:14px;line-height:1.4;vertical-align:top;width:38%"><strong>${safe(label)}</strong></td><td style="padding:10px 0;color:#102a40;font-size:15px;line-height:1.45;vertical-align:top;word-break:normal;overflow-wrap:break-word">${safe(value)}</td></tr>`
    : "";

const route = (pickup: unknown, destination: unknown) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 20px;background:#eef7fc;border:1px solid #cfe7f5;border-radius:14px">
    <tr>
      <td style="padding:18px 18px 8px;color:#087fc4;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Resa</td>
    </tr>
    <tr>
      <td style="padding:0 18px 18px;color:#102a40;font-size:17px;font-weight:700;line-height:1.5;word-break:normal;overflow-wrap:break-word">${safe(pickup)} <span style="color:#078fe8;padding:0 5px">→</span> ${safe(destination)}</td>
    </tr>
  </table>`;

const frame = (eyebrow: string, title: string, intro: string, content: string) => `<!doctype html>
<html lang="sv"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>
  @media only screen and (max-width:620px){.shell{width:100%!important;border-radius:0!important}.body{padding:22px 18px!important}.header{padding:22px 18px!important}.label{display:block!important;width:auto!important;padding-bottom:2px!important}.value{display:block!important}.button{display:block!important;text-align:center!important}}
</style></head><body style="margin:0;padding:0;background:#eef5f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef5f8"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" class="shell" width="660" cellpadding="0" cellspacing="0" style="width:100%;max-width:660px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
    <tr><td class="header" style="padding:26px 28px;background:#061d31;text-align:center">
      <img src="${LOGO_URL}" width="190" alt="Avenyn Taxi – EST 2003" style="display:block;width:190px;max-width:70%;height:auto;margin:0 auto 18px;background:#fff;border-radius:10px">
      <div style="color:#56bff7;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase">${safe(eyebrow)}</div>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;line-height:1.25">${safe(title)}</h1>
    </td></tr>
    <tr><td class="body" style="padding:28px;border:1px solid #dbe7ee;border-top:0">
      <p style="margin:0 0 16px;color:#29465d;font-size:17px;line-height:1.6">${safe(intro)}</p>
      ${content}
      <div style="margin-top:26px;padding-top:18px;border-top:1px solid #dbe7ee;color:#587083;font-size:13px;line-height:1.7;text-align:center">
        <strong style="color:#102a40">Avenyn Taxi</strong><br>
        <a href="tel:+46700315315" style="color:#087fc4;text-decoration:none">${CONTACT_PHONE}</a> · <a href="mailto:${CONTACT_EMAIL}" style="color:#087fc4;text-decoration:none">${CONTACT_EMAIL}</a>
      </div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;

type SendResult = {
  accepted: boolean;
  providerId?: string;
  status?: number;
  reason?: string;
};

async function sendEmail(options: {
  kind: "invoice_customer" | "booking_admin" | "booking_customer" | "receipt_customer" | "quote_request" | "flight_alert" | "contact" | "driver_invite";
  bookingId: string;
  bookingNumber: string | number;
  to: string;
  subject: string;
  html: string;
  attachments?: {filename:string; content:string; content_type:string}[];
  replyTo?: string;
  idempotencyKey: string;
}): Promise<SendResult> {
  if (!env.RESEND_API_KEY) {
    console.error("email_configuration_error", {
      kind: options.kind,
      bookingNumber: options.bookingNumber,
      error: "RESEND_API_KEY is missing",
    });
    return { accepted: false, reason: "email_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "Idempotency-Key": options.idempotencyKey,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to: [options.to],
      reply_to: options.replyTo,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    }),
  });
  const provider: any = await response
    .json()
    .catch(() => ({ message: `HTTP ${response.status}` }));

  if (!response.ok || !provider?.id) {
    console.error("email_provider_rejected", {
      kind: options.kind,
      bookingId: options.bookingId,
      bookingNumber: options.bookingNumber,
      status: response.status,
      providerError: provider?.message || provider?.name || "Unknown provider error",
    });
    return { accepted: false, status: response.status, reason: "provider_rejected" };
  }

  console.info("email_provider_accepted", {
    kind: options.kind,
    bookingId: options.bookingId,
    bookingNumber: options.bookingNumber,
    providerId: provider.id,
  });
  return { accepted: true, providerId: provider.id, status: response.status };
}

export async function sendDriverAccountEmail(input: {
  name: string;
  email: string;
  actionUrl: string;
  existingAccount: boolean;
}) {
  const requestId = crypto.randomUUID();
  const title = input.existingAccount
    ? "Välj ett nytt lösenord"
    : "Välkommen till Avenyn Taxis förarapp";
  const intro = input.existingAccount
    ? `Hej ${input.name}, du har fått en ny säker länk till ditt förarkonto.`
    : `Hej ${input.name}, du är nu registrerad som förare hos Avenyn Taxi.`;
  const buttonText = input.existingAccount
    ? "Välj nytt lösenord"
    : "Skapa lösenord";
  const html = frame(
    "Förarkonto",
    title,
    intro,
    `<p style="margin:0 0 22px;color:#29465d;font-size:16px;line-height:1.6">Tryck på knappen nedan och välj ditt personliga lösenord. Därefter loggar du in i Förarappen med <strong>${safe(input.email)}</strong>.</p><p style="margin:0;text-align:center"><a class="button" href="${safe(input.actionUrl)}" style="display:inline-block;background:#078fe8;color:#fff;text-decoration:none;padding:15px 24px;border-radius:11px;font-size:16px;font-weight:800">${buttonText}</a></p><p style="margin:20px 0 0;color:#6a7f8e;font-size:13px;line-height:1.55">Länken är personlig. Dela den inte med någon annan.</p>`,
  );
  return sendEmail({
    kind: "driver_invite",
    bookingId: requestId,
    bookingNumber: "förarkonto",
    to: input.email,
    subject: `${title} – Avenyn Taxi`,
    html,
    idempotencyKey: `avenyn-driver-invite-${requestId}`,
  });
}

export async function sendQuoteRequestEmail(quote:any){
  const requestId=crypto.randomUUID();
  const html=frame("Offertförfrågan","Ny offertförfrågan","En kund vill få pris på en resa. Detta är inte en bekräftad bokning.",`${route(quote.pickup,quote.destination)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row("Datum och tid",bookingDateTime({pickupTime:quote.pickupTime}))}${row("Passagerare",quote.passengers)}${row("Namn",quote.name)}${row("Telefon",quote.phone)}${row("E-post",quote.email)}${row("Meddelande",quote.message)}</table>`);
  return sendEmail({kind:"quote_request",bookingId:requestId,bookingNumber:"offert",to:CONTACT_EMAIL,replyTo:quote.email,subject:`Offertförfrågan: ${quote.pickup} → ${quote.destination}`,html,idempotencyKey:`avenyn-quote-${requestId}`});
}

export async function sendContactEmail(message: {name:string;email:string;phone?:string;message:string}) {
  const requestId = crypto.randomUUID();
  const html = frame(
    "Kontaktformulär",
    "Nytt meddelande från hemsidan",
    message.name + " har skickat ett meddelande via avenyntaxi.se.",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + row("Namn",message.name) + row("E-post",message.email) + row("Telefon",message.phone) + row("Meddelande",message.message) + '</table>',
  );
  return sendEmail({
    kind:"contact",
    bookingId:requestId,
    bookingNumber:"kontakt",
    to:CONTACT_EMAIL,
    replyTo:message.email,
    subject:"Kontakt från hemsidan: " + message.name,
    html,
    idempotencyKey:"avenyn-contact-" + requestId,
  });
}

// Retry transient admin delivery failures with the same provider idempotency key.
async function sendBookingAdminEmail(options: Parameters<typeof sendEmail>[0]): Promise<SendResult> {
  let result: SendResult = {accepted:false,reason:"network_error"};
  for(let attempt=0;attempt<2;attempt++){
    try {result=await sendEmail(options);} catch {result={accepted:false,reason:"network_error"};}
    if(result.accepted || result.reason === "email_not_configured" || (result.status && result.status < 500 && result.status !== 429))return result;
  }
  return result;
}

export async function sendManualBookingAdminEmail(b:any){
  return sendBookingEmails({source:"Admin",customerName:b.customer_name,customerPhone:b.customer_phone,customerEmail:b.customer_email,pickup:b.pickup_address,destination:b.dropoff_address,booking_date:b.booking_date,pickup_time:b.pickup_time,passengers:b.passengers,vehicle:b.car_type,childSeats:b.child_seats,extraMessage:b.notes}, {...b,price:b.fixed_price??b.estimated_price??0},{customer:false});
}

export async function sendBookingEmails(booking: any, result: any, options: {customer?: boolean} = {}) {
  const bookingId = String(result.id);
  const bookingNumber = result.booking_number;
  const price = Number(result.price);
  const trackingUrl = `https://www.avenyntaxi.se/track/${encodeURIComponent(String(result.tracking_token))}`;
  const commonRows = `${row("Bokningsnummer", `#${bookingNumber}`)}${row("Kund", booking.customerName)}${row("Datum och tid", bookingDateTime(booking))}${row("Passagerare", booking.passengers)}${row("Biltyp", vehicleName(booking.vehicle))}${row("Barnstol/tillval", extras(booking))}`;
  const priceBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#061d31;border-radius:12px"><tr><td style="padding:16px;color:#fff;font-size:15px;font-weight:700">Pris</td><td align="right" style="padding:16px;color:#fff;font-size:24px;font-weight:800">${safe(price)} kr</td></tr></table>`;
  const customerHtml = frame(
    "Bokningsbekräftelse",
    "Tack för din bokning",
    `Hej ${booking.customerName}, din bokning är mottagen.`,
    `${route(booking.pickup, booking.destination)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${commonRows}</table>${priceBlock}<p>Datum och tid kan ändras i kundappen innan hämtningen har påbörjats, även sista dygnet. Sen avbokning eller utebliven resa: fullt bekräftat pris enligt godkända villkor. <a href="https://avenyntaxi.se/bokningsvillkor">Bokningsvillkor</a></p><p style="margin:24px 0 4px;text-align:center"><a class="button" href="${safe(trackingUrl)}" style="display:inline-block;background:#078fe8;color:#fff;text-decoration:none;padding:14px 22px;border-radius:11px;font-size:16px;font-weight:800">Följ din taxi live</a></p><p style="margin:14px 0 0;text-align:center"><a href="https://www.avenyntaxi.se/customer" style="color:#087fc4;font-size:14px;font-weight:700">Logga in och se Mina resor</a></p>`,
  );
  const adminHtml = frame(
    "Administrativ bokning",
    `Ny bokning #${bookingNumber}`,
    booking.source === "Admin" ? "En ny bokning har skapats i Admin." : "En ny bokning har skapats via kundsidan.",
    `${route(booking.pickup, booking.destination)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${commonRows}${row("Telefonnummer", booking.customerPhone)}${row("E-post", booking.customerEmail)}${row("Flygnummer", booking.flightNumber)}${row("Extra meddelande", booking.extraMessage)}</table>${priceBlock}`,
  );

  const [admin, customer] = await Promise.all([
    sendBookingAdminEmail({
      kind: "booking_admin",
      bookingId,
      bookingNumber,
      to: CONTACT_EMAIL,
      replyTo: booking.customerEmail || undefined,
      subject: `Ny bokning #${bookingNumber} – Avenyn Taxi`,
      html: adminHtml,
      idempotencyKey: `avenyn-booking-admin-${bookingId}`,
    }),
    options.customer !== false && booking.customerEmail ? sendEmail({
      kind: "booking_customer",
      bookingId,
      bookingNumber,
      to: booking.customerEmail,
      replyTo: CONTACT_EMAIL,
      subject: `Din bokning hos Avenyn Taxi – #${bookingNumber}`,
      html: customerHtml,
      idempotencyKey: `avenyn-booking-customer-${bookingId}`,
    }).catch(() => ({accepted:false,reason:"customer_email_failed"})) : Promise.resolve({accepted:true,reason:"customer_email_skipped"}),
  ]);
  return { sent: Boolean(booking.customerEmail) && options.customer !== false && customer.accepted, admin, customer };
}

export async function sendReceiptEmail(booking: any,manualAttempt?:string,manualRecipient?:string) {
  const bookingId = String(booking.id);
  const bookingNumber = booking.booking_number;
  const html = manualAttempt?paidReceiptEmailNotice()+'<p>Ditt kvitto från Avenyn Taxi finns i bifogad PDF.</p>':receiptHtml(booking) + `<p style="text-align:center"><a href="${safe(receiptUrl(booking))}">Öppna och spara kvittot</a></p>`;

  return sendEmail({
    kind: "receipt_customer",
    bookingId,
    bookingNumber,
    to: manualRecipient||booking.customer_email,
    replyTo: CONTACT_EMAIL,
    subject: `${receiptPaid(booking)?"Kvitto":"Resesammanställning"} från Avenyn Taxi – #${bookingNumber}`,
    html,
    attachments: [{filename:`Avenyn-Taxi-${bookingNumber}.pdf`,content:pdfBase64(await receiptPdf(booking)),content_type:"application/pdf"}],
    idempotencyKey: manualAttempt?`avenyn-receipt-copy-${bookingId}-${manualAttempt}`:`avenyn-receipt-customer-${bookingId}`,
  });
}

export async function sendFlightAlertEmail(
  booking: any,
  options: {
    flightNumber: string;
    message: string;
    eventKey: string;
  },
) {
  const bookingId = String(booking.id);
  const bookingNumber = booking.booking_number;
  const trackingUrl = `https://www.avenyntaxi.se/track/${encodeURIComponent(String(booking.tracking_token))}`;
  const html = frame(
    "Flygvarning",
    `${options.flightNumber} har uppdaterats`,
    `Hej ${booking.customer_name || "kund"}, ${options.message.toLocaleLowerCase("sv")}.`,
    `${route(booking.pickup_address, booking.dropoff_address)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row("Flygnummer", options.flightNumber)}${row("Bokningsnummer", `#${bookingNumber}`)}${row("Ändring", options.message)}</table><p style="margin:24px 0 4px;text-align:center"><a class="button" href="${safe(trackingUrl)}" style="display:inline-block;background:#078fe8;color:#fff;text-decoration:none;padding:14px 22px;border-radius:11px;font-size:16px;font-weight:800">Se flyget live</a></p>`,
  );
  return sendEmail({
    kind: "flight_alert",
    bookingId,
    bookingNumber,
    to: booking.customer_email,
    replyTo: CONTACT_EMAIL,
    subject: `Viktig flyguppdatering ${options.flightNumber} – Avenyn Taxi`,
    html,
    idempotencyKey: `avenyn-flight-${bookingId}-${options.eventKey}`.slice(0, 250),
  });
}

export function sendCustomerInvoice(to:string,number:string,reference:string,total:string,bytes:Uint8Array,attempt:string){
  return sendEmail({
    kind:'invoice_customer',bookingId:number,bookingNumber:number,to,
    subject:'Faktura '+number+' från Avenyn Taxi',
    html:frame('Kundfaktura','Din faktura från Avenyn Taxi','Fakturan finns bifogad som PDF.',
      '<p>Att betala: <strong>'+safe(total)+'</strong></p><p>Ange <strong>'+safe(reference)+'</strong> som meddelande vid betalning. Bankgiro och förfallodatum står på fakturan.</p>'),
    replyTo:CONTACT_EMAIL,idempotencyKey:'avenyn-invoice-'+attempt,
    attachments:[{filename:number+'.pdf',content:pdfBase64(bytes),content_type:'application/pdf'}],
  });
}
