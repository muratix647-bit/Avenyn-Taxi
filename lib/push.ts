import {DRIVER_BOOKING_CHANNEL} from './driver-notifications';
import { env } from "cloudflare:workers";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
} from "@block65/webcrypto-web-push";
import { adminSupabase } from "./supabase-server";

type StoredSubscription = {
  id: string;
  provider: "webpush" | "fcm";
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  device_token: string | null;
  platform: string | null;
};

type DriverPushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
  ttl?: number;
};

let cachedFirebaseToken = "";
let cachedFirebaseTokenExpiresAt = 0;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function firebaseReady() {
  return Boolean(
    env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY,
  );
}

async function firebaseAccessToken() {
  if (!firebaseReady()) throw new Error("Firebase är inte konfigurerat.");
  if (
    cachedFirebaseToken &&
    cachedFirebaseTokenExpiresAt > Date.now() + 60_000
  )
    return cachedFirebaseToken;

  const now = Math.floor(Date.now() / 1000);
  const header = textToBase64Url(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );
  const claims = textToBase64Url(
    JSON.stringify({
      iss: String(env.FIREBASE_CLIENT_EMAIL),
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedToken = `${header}.${claims}`;
  const privateKeyBody = String(env.FIREBASE_PRIVATE_KEY)
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const privateKeyBytes = Uint8Array.from(atob(privateKeyBody), (character) =>
    character.charCodeAt(0),
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !result.access_token)
    throw new Error(result.error_description || "Firebase-inloggningen misslyckades.");
  cachedFirebaseToken = result.access_token;
  cachedFirebaseTokenExpiresAt =
    Date.now() + Math.max(300, Number(result.expires_in) || 3600) * 1000;
  return cachedFirebaseToken;
}

export function pushPublicKey() {
  return String(env.VAPID_PUBLIC_KEY || "").trim();
}

function vapidReady() {
  return Boolean(
    pushPublicKey() && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
  );
}

export async function sendPushToSubscription(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  data: DriverPushPayload,
) {
  if (!vapidReady()) return { ok: false, status: 0 };
  const pushSubscription: PushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
  const message: PushMessage = {
    data,
    options: { ttl: data.ttl ?? 60 * 60 * 12, urgency: "high", topic: data.tag.slice(0, 32) },
  };
  const request = await buildPushPayload(message, pushSubscription, {
    subject: String(env.VAPID_SUBJECT || "mailto:info@avenyntaxi.se"),
    publicKey: pushPublicKey(),
    privateKey: String(env.VAPID_PRIVATE_KEY || ""),
  });
  const response = await fetch(subscription.endpoint, request);
  return { ok: response.ok, status: response.status };
}

export async function sendFirebasePushToToken(
  deviceToken: string,
  data: DriverPushPayload,
) {
  if (!firebaseReady()) return { ok: false, status: 0 };
  const accessToken = await firebaseAccessToken();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(String(env.FIREBASE_PROJECT_ID))}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: data.title, body: data.body },
          data: { url: data.url, tag: data.tag },
          android: {
            priority: "high",
            ttl: `${data.ttl ?? 43200}s`,
            notification: {
              channel_id: DRIVER_BOOKING_CHANNEL,
              sound: "default",
              tag: data.tag,
            },
          },
          apns: { payload: { aps: { sound: "default", badge: 1 } } },
        },
      }),
    },
  );
  return { ok: response.ok, status: response.status };
}

export async function sendAssignedBookingPush(bookingId: string, timeUpdate = false, prebooking = false) {
  if (!bookingId) return { sent: 0, removed: 0 };
  const admin = adminSupabase();
  const bookingResult = await admin
    .from("bookings")
    .select(
      "id,booking_number,driver_id,pickup_address,dropoff_address,pickup_time,booking_date,status,archived_at,assigned_partner_id,pet_details,price_breakdown",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingResult.error || !bookingResult.data || (!prebooking && !bookingResult.data.driver_id))
    return { sent: 0, removed: 0 };

  if(prebooking&&(bookingResult.data.driver_id||bookingResult.data.assigned_partner_id||bookingResult.data.archived_at||!['new','scheduled','confirmed'].includes(bookingResult.data.status)))return {sent:0,removed:0};
  let driverIds:string[]=[];
  if(prebooking){const result=await admin.from('drivers').select('id,accepts_pets').eq('active',true).eq('approved',true).is('archived_at',null);if(result.error)throw result.error;const declined=await admin.from('driver_action_log').select('driver_id,created_at').eq('booking_id',bookingId).eq('action','broadcast_declined');if(declined.error)throw declined.error;const declinedIds=new Set((declined.data||[]).filter(r=>Date.parse(r.created_at)>(Date.parse(bookingResult.data.price_breakdown?.broadcast_reopened_at||'')||0)).map(r=>r.driver_id));driverIds=(result.data||[]).filter(d=>!declinedIds.has(d.id)).map(d=>d.id);if(!driverIds.length)return {sent:0,removed:0};}
  const subscriptionsResult = await admin
    .from("driver_push_subscriptions")
    .select("id,provider,endpoint,p256dh,auth,device_token,platform")
    .in("driver_id", prebooking?driverIds:[bookingResult.data.driver_id]);
  if (subscriptionsResult.error) {
    console.error("driver_push_subscription_lookup_failed", {
      bookingId,
      error: subscriptionsResult.error.message,
    });
    return { sent: 0, removed: 0 };
  }

  const booking = bookingResult.data;
  const number = booking.booking_number || booking.id;
  const body = `${booking.pickup_address} → ${booking.dropoff_address}`.slice(
    0,
    220,
  );
  const data: DriverPushPayload = {
    ttl: booking.status === "offered" ? 45 : 43200,
    title: booking.status === "cancelled" ? `Avbokad resa #${number} · Avenyn Taxi` : prebooking ? `Ledig bokning #${number} · Avenyn Taxi` : timeUpdate ? `Ny hämtningstid #${number} · Avenyn Taxi` : `Ny bokning #${number} · Avenyn Taxi`,
    body: (timeUpdate||prebooking) ? `${booking.booking_date} kl ${String(booking.pickup_time).slice(0,5)} · ${body}` : body,
    tag: `${timeUpdate ? "time-update" : "booking"}-${booking.id}`,
    url: `/driver?booking=${encodeURIComponent(booking.id)}`,
  };
  let sent = 0;
  const deadIds: string[] = [];
  await Promise.all(
    ((subscriptionsResult.data ?? []) as StoredSubscription[]).map(
      async (subscription) => {
        try {
          const result =
            subscription.provider === "fcm" && subscription.device_token
              ? await sendFirebasePushToToken(subscription.device_token, data)
              : vapidReady() &&
                  subscription.endpoint &&
                  subscription.p256dh &&
                  subscription.auth
                ? await sendPushToSubscription(
                    {
                      endpoint: subscription.endpoint,
                      p256dh: subscription.p256dh,
                      auth: subscription.auth,
                    },
                    data,
                  )
                : { ok: false, status: 0 };
          if (result.ok) sent += 1;
          else if ([404, 410].includes(result.status)) deadIds.push(subscription.id);
        } catch (error) {
          console.error("driver_push_delivery_failed", {
            bookingId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    ),
  );
  if (deadIds.length)
    await admin.from("driver_push_subscriptions").delete().in("id", deadIds);
  return { sent, removed: deadIds.length };
}

/** Reminder goes only to the assigned driver's currently registered devices. */
export async function sendDriverReminderPush(driverId:string,data:DriverPushPayload) {
 const admin=adminSupabase();
 const driver=await admin.from('drivers').select('id').eq('id',driverId).eq('active',true).eq('approved',true).is('archived_at',null).maybeSingle();
 if(driver.error)throw driver.error;
 if(!driver.data)return {sent:0};
 const subscriptions=await admin.from('driver_push_subscriptions').select('id,provider,endpoint,p256dh,auth,device_token,platform').eq('driver_id',driverId);
 if(subscriptions.error)throw subscriptions.error;
 let sent=0;
 await Promise.all((subscriptions.data||[]).map(async subscription=>{
  try{
   const result=subscription.provider==='fcm'&&subscription.device_token
    ?await sendFirebasePushToToken(subscription.device_token,data)
    :subscription.endpoint&&subscription.p256dh&&subscription.auth
     ?await sendPushToSubscription({endpoint:subscription.endpoint,p256dh:subscription.p256dh,auth:subscription.auth},data)
     :{ok:false,status:0};
   if(result.ok)sent++;
   else if([404,410].includes(result.status))await admin.from('driver_push_subscriptions').delete().eq('id',subscription.id);
  }catch{console.error('driver_reminder_push_failed',{driverId});}
 }));
 return {sent};
}
