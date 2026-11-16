import { env } from "cloudflare:workers";

const STRIPE_API = "https://api.stripe.com/v1";

function stripeKey() {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe är inte konfigurerat.");
  return env.STRIPE_SECRET_KEY;
}

export async function stripeRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      ...(init.headers || {}),
    },
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Stripe kunde inte behandla betalningen.");
  return data;
}

export async function createCheckoutSession(options: {
  bookingId: string;
  bookingNumber: string | number;
  amountSek: number;
  customerEmail?: string | null;
  customerName: string;
  pickup: string;
  destination: string;
  trackingToken: string;
  requestId: string;
  origin: string;
}) {
  const amountOre = Math.round(options.amountSek * 100);
  if (!Number.isSafeInteger(amountOre) || amountOre < 300) throw new Error("Bokningen har ett ogiltigt betalningsbelopp.");
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("locale", "sv");
  params.set("client_reference_id", options.bookingId);
  if (options.customerEmail) params.set("customer_email", options.customerEmail);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "sek");
  params.set("line_items[0][price_data][unit_amount]", String(amountOre));
  params.set("line_items[0][price_data][product_data][name]", `Taxiresa #${options.bookingNumber}`);
  params.set("line_items[0][price_data][product_data][description]", `${options.pickup} → ${options.destination}`.slice(0, 500));
  params.set("metadata[booking_id]", options.bookingId);
  params.set("metadata[booking_number]", String(options.bookingNumber));
  params.set("metadata[payment_request_id]", options.requestId);
  params.set("payment_intent_data[metadata][booking_id]", options.bookingId);
  params.set("payment_intent_data[metadata][payment_request_id]", options.requestId);
  if (options.customerEmail) params.set("payment_intent_data[receipt_email]", options.customerEmail);
  params.set("custom_fields[0][key]", "company");
  params.set("custom_fields[0][label][type]", "custom");
  params.set("custom_fields[0][label][custom]", "Företagsnamn (valfritt)");
  params.set("custom_fields[0][type]", "text");
  params.set("custom_fields[0][optional]", "true");
  params.set("custom_fields[1][key]", "reference");
  params.set("custom_fields[1][label][type]", "custom");
  params.set("custom_fields[1][label][custom]", "Fakturareferens (valfritt)");
  params.set("custom_fields[1][type]", "text");
  params.set("custom_fields[1][optional]", "true");
  params.set("success_url", `${options.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${options.origin}/track/${options.trackingToken}?payment=cancelled`);
  return stripeRequest("/checkout/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `avenyn-payment-${options.requestId}`,
    },
    body: params,
  });
}

export function retrieveCheckoutSession(sessionId: string) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}
