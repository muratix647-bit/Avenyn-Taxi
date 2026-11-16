import { env } from "cloudflare:workers";
import { adminSupabase, bearerToken, publicSupabase } from "./supabase-server";
import { activeVoiceStatuses, uuid } from "./voice-security";
export function voiceConfig() {
  const e = env as unknown as Record<string,string>;
  return { enabled:e.VOICE_CALLS_ENABLED==="true", account:e.TWILIO_ACCOUNT_SID, auth:e.TWILIO_AUTH_TOKEN, key:e.TWILIO_VOICE_API_KEY_SID, secret:e.TWILIO_VOICE_API_KEY_SECRET, app:e.TWILIO_VOICE_APP_SID, webhook:"https://avenyntaxi.se/api/voice/connect" };
}
export function voiceReady() { const c=voiceConfig();return !!(c.enabled&&c.account&&c.auth&&c.key&&c.secret&&c.app); }
export async function voiceBooking(id:string, tracking=false) {
  if (!uuid.test(id)) throw new Error("forbidden");
  const {data,error}=await adminSupabase().from("bookings").select("id,driver_id,status").eq(tracking?"tracking_token":"id",id).maybeSingle();
  if(error || !data || !data.driver_id || !activeVoiceStatuses.has(data.status)) throw new Error("forbidden");
  const driver=await adminSupabase().from("drivers").select("auth_user_id,active,approved,archived_at").eq("id",data.driver_id).maybeSingle();
  if(driver.error || !driver.data?.active || !driver.data.approved || driver.data.archived_at) throw new Error("forbidden");
  return {...data,driverAuth:driver.data.auth_user_id};
}
export async function authorizeVoice(request:Request, input:{trackingToken?:string;bookingId?:string}) {
  if(input.trackingToken) return {booking:await voiceBooking(input.trackingToken,true),role:"customer" as const};
  const token=bearerToken(request);if(!token) throw new Error("forbidden");
  const {data,error}=await publicSupabase().auth.getUser(token);
  if(error||!data.user) throw new Error("forbidden");
  const booking=await voiceBooking(input.bookingId||"");
  if(booking.driverAuth!==data.user.id||!["accepted","en_route","arrived","passenger_onboard"].includes(booking.status)) throw new Error("forbidden");
  return {booking,role:"driver" as const};
}
